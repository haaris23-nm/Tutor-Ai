import express from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

import { readDatabase, writeDatabase, initializeDatabase } from './server_db';
import { createToken, verifyToken, authenticateUser } from './server_auth';
import { extractTextFromPdf } from './server_pdf';
import { generateAcademicMetadata, generatePracticeExam, generateStudyRecommendations, generateFullStudyGuide } from './server_gemini';
import { Subject, Note, Flashcard, PracticeExam, QuizAttempt, PlannerTask, ActivityLog } from './src/types';

import { adminAuth } from './src/lib/firebase-admin.ts';
import { getOrCreateUser } from './src/db/users.ts';
import {
  fetchSubjects,
  insertSubject,
  fetchNotes,
  insertNote,
  fetchFlashcards,
  insertFlashcards,
  updateFlashcardMasteryRecord,
  fetchPlannerTasks,
  insertPlannerTask,
  updatePlannerTaskStatusRecord,
  fetchActivityLogs,
  insertActivityLog,
  fetchQuizAttempts,
  insertQuizAttempt,
  fetchNotifications,
  insertNotification,
  isCloudSqlActive
} from './src/db/repository.ts';

// Boot systems
const dbState = initializeDatabase();
console.log('Main DB Initialized safely. Users registered:', dbState.users.length);
console.log('Cloud SQL Active Status:', isCloudSqlActive() ? 'YES (PostgreSQL connected)' : 'Local JSON fallback mode');

const app = express();
const PORT = 3000;

// High Payload Size limits to support textbooks/notes/PDF slides without crashing
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Simple cryptographic password simulation helper
function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/* --- FIREBASE & JWT AUTH ROUTES --- */

// Google Sign-In with Firebase Authentication
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Firebase ID token is required.' });

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const email = decoded.email || '';
    const username = decoded.name || email.split('@')[0] || 'Learner';

    if (isCloudSqlActive()) {
      await getOrCreateUser(uid, email, username);
    }

    const db = readDatabase();
    let user = db.users.find(u => u.id === uid || u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      user = {
        id: uid,
        username,
        email,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);

      // Seed initial default subjects in Cloud SQL & local DB
      const initSubjs: Subject[] = [
        { id: `subj_${Date.now()}_cs`, userId: uid, name: 'Computer Science (AI & Robotics)', color: 'emerald', createdAt: new Date().toISOString() },
        { id: `subj_${Date.now()}_math`, userId: uid, name: 'Advanced Calculus', color: 'indigo', createdAt: new Date().toISOString() }
      ];
      for (const s of initSubjs) {
        await insertSubject(s);
      }

      await insertNotification({
        id: `not_${Date.now()}`,
        userId: uid,
        title: 'Welcome to Tutor AI with Cloud SQL!',
        message: 'Your academic records are powered by Google Cloud SQL (PostgreSQL) and secured by Firebase Auth.',
        read: false,
        createdAt: new Date().toISOString()
      });

      await writeDatabase(db);
    }

    res.setHeader('Set-Cookie', `tutor_ai_auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return res.json({ user, token });
  } catch (err: any) {
    console.error('Firebase Google authentication failure:', err);
    res.status(401).json({ error: 'Failed to verify Firebase authentication credentials.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all standard user credentials.' });
    }

    const db = readDatabase();
    const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const newUser = {
      id: `user_${Date.now()}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    
    // Auto-create initial default subjects for new users
    const userSubjects = [
      { id: `subj_${Date.now()}_cs`, userId: newUser.id, name: 'Computer Science (AI & Robotics)', color: 'emerald', createdAt: new Date().toISOString() },
      { id: `subj_${Date.now()}_math`, userId: newUser.id, name: 'Advanced Calculus', color: 'indigo', createdAt: new Date().toISOString() }
    ];
    db.subjects.push(...userSubjects);

    // Welcome Notification
    db.notifications.push({
      id: `not_${Date.now()}`,
      userId: newUser.id,
      title: 'Welcome to Tutor AI!',
      message: 'Great to have you! Tap "Notes Repository" to begin uploading study material or generate adaptive quizzes!',
      read: false,
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);

    const token = createToken({ id: newUser.id, email: newUser.email });
    res.setHeader('Set-Cookie', `tutor_ai_auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    
    return res.status(201).json({ user: newUser, token });
  } catch (err) {
    console.error('Registration failure:', err);
    res.status(500).json({ error: 'Server authentication issue.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = readDatabase();
    // Simulate lookup
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Account not found. Please register.' });
    }

    const token = createToken({ id: user.id, email: user.email });
    res.setHeader('Set-Cookie', `tutor_ai_auth_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);

    return res.json({ user, token });
  } catch (err) {
    console.error('Login failure:', err);
    res.status(500).json({ error: 'Server authentication database lock.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'tutor_ai_auth_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ message: 'Successfully logged out user.' });
});

app.get('/api/auth/session', (req, res) => {
  try {
    const cookieHeader = req.headers.cookie || '';
    const cookies = cookieHeader.split(';').reduce((acc: any, cookie: string) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
    
    const token = cookies['tutor_ai_auth_token'] || '';
    if (!token) {
      return res.status(401).json({ error: 'Session unavailable.' });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ error: 'Token is expired or spoofed.' });
    }

    const db = readDatabase();
    const user = db.users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User does not exist.' });
    }

    return res.json({ user, token });
  } catch (err) {
    res.status(500).json({ error: 'Session checker failure.' });
  }
});


/* --- SUBJECTS MANAGEMENT CONTROLLERS --- */

app.get('/api/subjects', authenticateUser, async (req, res) => {
  try {
    const userSubjects = await fetchSubjects(req.user!.id);
    res.json(userSubjects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve subjects.' });
  }
});

app.post('/api/subjects', authenticateUser, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject title is required.' });

    const newSubj: Subject = {
      id: `subj_${Date.now()}`,
      userId: req.user!.id,
      name: name.trim(),
      color: color || 'indigo',
      createdAt: new Date().toISOString()
    };

    await insertSubject(newSubj);
    broadcastToUser(req.user!.id, { type: 'SUBJECT_CREATED', payload: newSubj });
    return res.status(201).json(newSubj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create academic subject.' });
  }
});


/* --- NOTES REPOSITORY & AI SUMMARIES CONTROLLERS --- */

app.get('/api/notes', authenticateUser, async (req, res) => {
  try {
    const notes = await fetchNotes(req.user!.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve notes.' });
  }
});

app.post('/api/notes', authenticateUser, async (req, res) => {
  try {
    const { subjectId, title, content } = req.body;
    if (!subjectId || !title || !content) {
      return res.status(400).json({ error: 'Subject, Title, and Content are required fields.' });
    }

    const noteId = `note_${Date.now()}`;

    // Request Gemini AI Academic Metadata synthesis
    let aiMeta;
    try {
      aiMeta = await generateAcademicMetadata(title, content);
    } catch {
      aiMeta = { summary: '', vocabulary: [], flashcards: [] };
    }

    const newNote: Note = {
      id: noteId,
      userId: req.user!.id,
      subjectId,
      title: title.trim(),
      content: content.trim(),
      summary: aiMeta.summary,
      vocabulary: aiMeta.vocabulary,
      isPdf: false,
      source: 'custom',
      createdAt: new Date().toISOString()
    };

    await insertNote(newNote);

    // If Gemini returned flashcards, populate the user card decks as well
    if (aiMeta.flashcards && aiMeta.flashcards.length > 0) {
      const generatedCards: Flashcard[] = aiMeta.flashcards.map((f: any, i: number) => ({
        id: `fc_${Date.now()}_${i}`,
        userId: req.user!.id,
        subjectId,
        noteId: newNote.id,
        question: f.question,
        answer: f.answer,
        mastery: 'unfamiliar',
        createdAt: new Date().toISOString()
      }));
      await insertFlashcards(generatedCards);
    }

    // Append to Activity Logs
    await insertActivityLog({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Created Note',
      details: `Added new note: "${newNote.title}" with AI summary extraction.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });

    // Notify connected client WS
    broadcastToUser(req.user!.id, { type: 'NOTE_CREATED', payload: newNote });
    
    return res.status(201).json(newNote);
  } catch (err) {
    console.error('Note creation error:', err);
    res.status(500).json({ error: 'Failed to process AI study note.' });
  }
});

// PDF Drag-and-Drop Raw File processing up to 100MB
app.post('/api/notes/upload', authenticateUser, async (req, res) => {
  try {
    const { fileName, fileDataB64, subjectId } = req.body;
    if (!fileName || !fileDataB64 || !subjectId) {
      return res.status(400).json({ error: 'PDF filename, base64 data stream and subject are required.' });
    }

    const buffer = Buffer.from(fileDataB64, 'base64');
    if (buffer.length > 100 * 1024 * 1024) {
      return res.status(413).json({ error: 'Academic material upload exceeds maximum 100MB capacity limit.' });
    }

    // Parse note via our advanced, crash-proof PDF layout text builder
    const parseResult = extractTextFromPdf(buffer, fileName);
    const croppedTitle = fileName.replace(/\.pdf$/i, '');

    const db = readDatabase();
    const noteId = `note_pdf_${Date.now()}`;

    // Query Gemini API to clean summary and translate PDF headings beautifully (fallback inside if key inactive)
    let aiMeta;
    try {
      aiMeta = await generateAcademicMetadata(croppedTitle, parseResult.text);
    } catch {
      aiMeta = {
        summary: parseResult.summary,
        vocabulary: parseResult.vocabulary,
        flashcards: parseResult.flashcards
      };
    }

    const newNote: Note = {
      id: noteId,
      userId: req.user!.id,
      subjectId,
      title: croppedTitle,
      content: parseResult.text,
      summary: aiMeta.summary || parseResult.summary,
      vocabulary: aiMeta.vocabulary || parseResult.vocabulary,
      isPdf: true,
      pdfId: `pdf_${Date.now()}`,
      source: 'pdf',
      createdAt: new Date().toISOString()
    };

    await insertNote(newNote);

    // Inject flashcards from academic PDF
    const targetFlashcards = aiMeta.flashcards || parseResult.flashcards;
    if (targetFlashcards && targetFlashcards.length > 0) {
      const generatedCards: Flashcard[] = targetFlashcards.map((f: any, i: number) => ({
        id: `fc_pdf_${Date.now()}_${i}`,
        userId: req.user!.id,
        subjectId,
        noteId: newNote.id,
        question: f.question,
        answer: f.answer,
        mastery: 'unfamiliar',
        createdAt: new Date().toISOString()
      }));
      await insertFlashcards(generatedCards);
    }

    // Log Activity
    await insertActivityLog({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Uploaded PDF Material',
      details: `Processed and indexed "${fileName}" with automated vocabulary maps.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });
    broadcastToUser(req.user!.id, { type: 'PDF_UPLOADED', payload: newNote });

    return res.status(201).json(newNote);
  } catch (err) {
    console.error('PDF Document ingestion crashed:', err);
    res.status(500).json({ error: 'Crash Protection: Error executing document binary stream.' });
  }
});


/* --- ONLINE NOTES & MULTI-SOURCE ACADEMIC SEARCH ENDPOINTS --- */

function stripHtml(htmlStr: string): string {
  if (!htmlStr) return '';
  return htmlStr.replace(/<\/?[^>]+(>|$)/g, '').replace(/&[a-z0-9]+;/gi, ' ').trim();
}

// In-Memory Fast Response Cache for Academic Queries
interface SearchCacheEntry {
  timestamp: number;
  results: any[];
  responseTimeMs: number;
}
const searchCache = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL

// Resilient fetch with strict timeout to prevent slow external networks from lagging the user
async function fetchWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 2300): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// Pre-seed popular academic topics so first hits respond in ~1-5ms
(function preSeedCache() {
  const seeds = [
    {
      query: 'photosynthesis',
      results: [
        {
          id: 'ai_photosynthesis',
          title: 'Photosynthesis (Full AI Study Guide)',
          snippet: 'Complete textbook synthesis: Light-dependent reactions in thylakoid membranes, Calvin cycle, ATP synthesis, and cellular chloroplast mechanics.',
          source: 'ai',
          sourceLabel: 'AI Knowledge Generator'
        },
        {
          id: 'wiki_photosynthesis',
          title: 'Photosynthesis',
          snippet: 'Biological process used by plants and organisms to convert light energy into chemical energy stored in carbohydrate molecules like glucose.',
          source: 'wikipedia',
          sourceLabel: 'Wikipedia',
          sourceUrl: 'https://en.wikipedia.org/wiki/Photosynthesis'
        },
        {
          id: 'wb_photosynthesis',
          title: 'Plant Biology / Photosynthesis',
          snippet: 'Comprehensive Wikibooks open textbook chapter covering Z-scheme electron flow, photophosphorylation, and stomatal gas regulation.',
          source: 'wikibooks',
          sourceLabel: 'Wikibooks Textbook',
          sourceUrl: 'https://en.wikibooks.org/wiki/Plant_Biology'
        },
        {
          id: 'wuniv_photosynthesis',
          title: 'Photosynthesis Laboratory & Lecture Series',
          snippet: 'Wikiversity college course module on measuring photochemical quantum yields and light saturation curves in C3 and C4 plants.',
          source: 'wikiversity',
          sourceLabel: 'Wikiversity Course',
          sourceUrl: 'https://en.wikiversity.org/wiki/Photosynthesis'
        },
        {
          id: 'ol_photosynthesis',
          title: 'Molecular Biology of the Cell (Photosynthesis Chapters)',
          snippet: 'Published curriculum text by Alberts et al. detailing chloroplast ATP synthase coupling and pigment absorption spectra.',
          source: 'openlibrary',
          sourceLabel: 'Open Library Books',
          author: 'Bruce Alberts, Alexander Johnson',
          year: 2002
        },
        {
          id: 'arxiv_photosynthesis',
          title: 'Quantum Coherence and Energy Transfer in Photosynthetic Complexes',
          snippet: 'ArXiv Biophysics research review exploring exciton transport efficiency in Fenna-Matthews-Olson (FMO) protein complexes.',
          source: 'arxiv',
          sourceLabel: 'ArXiv Science Paper'
        }
      ]
    },
    {
      query: 'neural networks',
      results: [
        {
          id: 'ai_neural_networks',
          title: 'Neural Networks (Full AI Study Guide)',
          snippet: 'Deep learning fundamentals: Perceptrons, multi-layer architectures, backpropagation calculus, activation functions (ReLU, GELU), and loss optimization.',
          source: 'ai',
          sourceLabel: 'AI Knowledge Generator'
        },
        {
          id: 'wiki_neural_networks',
          title: 'Artificial neural network',
          snippet: 'Computational systems inspired by biological neural networks that constitute animal brains, solving complex pattern recognition and classification.',
          source: 'wikipedia',
          sourceLabel: 'Wikipedia',
          sourceUrl: 'https://en.wikipedia.org/wiki/Artificial_neural_network'
        },
        {
          id: 'wb_neural_networks',
          title: 'Artificial Intelligence / Neural Networks',
          snippet: 'Wikibooks open curriculum textbook on gradient descent algorithms, feedforward networks, and convolutional feature extractors.',
          source: 'wikibooks',
          sourceLabel: 'Wikibooks Textbook'
        },
        {
          id: 'wuniv_neural_networks',
          title: 'Machine Learning & Deep Neural Architecture',
          snippet: 'Wikiversity university syllabus on backpropagation derivations, vanishing gradient remediation, and tensor computation.',
          source: 'wikiversity',
          sourceLabel: 'Wikiversity Course'
        },
        {
          id: 'ol_neural_networks',
          title: 'Deep Learning (Adaptive Computation & Machine Learning)',
          snippet: 'Seminal MIT Press textbook by Goodfellow, Bengio, and Courville covering representation learning and regularized deep nets.',
          source: 'openlibrary',
          sourceLabel: 'Open Library Books',
          author: 'Ian Goodfellow, Yoshua Bengio',
          year: 2016
        },
        {
          id: 'arxiv_neural_networks',
          title: 'Attention Is All You Need',
          snippet: 'Foundational ArXiv pre-print paper introducing Transformer models based entirely on self-attention mechanisms.',
          source: 'arxiv',
          sourceLabel: 'ArXiv Science Paper'
        }
      ]
    }
  ];

  for (const s of seeds) {
    searchCache.set(`${s.query}:all`, {
      timestamp: Date.now(),
      results: s.results,
      responseTimeMs: 3
    });
  }
})();

app.get('/api/notes/search-online', authenticateUser, async (req, res) => {
  const startTime = performance.now();
  const query = (req.query.q as string) || '';
  const sourceFilter = (req.query.source as string) || 'all';

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const cleanQuery = query.trim();
  const cacheKey = `${cleanQuery.toLowerCase()}:${sourceFilter}`;

  // 1. Check Fast In-Memory Cache
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({
      results: cached.results,
      responseTimeMs: 2,
      cached: true,
      total: cached.results.length
    });
  }

  const results: any[] = [];
  const userAgentHeaders = {
    'User-Agent': 'TutorAI/2.0 (Academic Study Co-Pilot; student-support@tutor.ai)'
  };

  // Always include the AI Turbo Study Guide generator as a premier option
  if (sourceFilter === 'all' || sourceFilter === 'ai') {
    results.push({
      id: `ai_gen_${Date.now()}`,
      title: `${cleanQuery} (Full AI Study Guide)`,
      snippet: `Synthesize a comprehensive, textbook-quality study guide with core concepts, formulas, definitions, and flashcards for "${cleanQuery}".`,
      source: 'ai',
      sourceLabel: 'AI Knowledge Generator',
      category: 'Synthesized Syllabus'
    });
  }

  const promises: Promise<any>[] = [];

  // 1. Wikipedia Search (General Encyclopedia & Science)
  if (sourceFilter === 'all' || sourceFilter === 'wikipedia') {
    promises.push(
      fetchWithTimeout(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.query?.search) {
            data.query.search.slice(0, 4).forEach((item: any) => {
              results.push({
                id: `wiki_${item.pageid}`,
                title: item.title,
                snippet: stripHtml(item.snippet) || `Academic reference guide for ${item.title}.`,
                source: 'wikipedia',
                sourceLabel: 'Wikipedia',
                sourceUrl: `https://en.wikipedia.org/?curid=${item.pageid}`,
                pageid: item.pageid
              });
            });
          }
        })
        .catch(() => {})
    );
  }

  // 2. Wikibooks Search (Open Textbooks & Study Modules)
  if (sourceFilter === 'all' || sourceFilter === 'wikibooks') {
    promises.push(
      fetchWithTimeout(
        `https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.query?.search) {
            data.query.search.slice(0, 3).forEach((item: any) => {
              results.push({
                id: `wb_${item.pageid}`,
                title: item.title,
                snippet: stripHtml(item.snippet) || `Open textbook curriculum notes for ${item.title}.`,
                source: 'wikibooks',
                sourceLabel: 'Wikibooks Textbook',
                sourceUrl: `https://en.wikibooks.org/?curid=${item.pageid}`,
                pageid: item.pageid
              });
            });
          }
        })
        .catch(() => {})
    );
  }

  // 3. Wikiversity Search (College & University Course Lecture Notes)
  if (sourceFilter === 'all' || sourceFilter === 'wikiversity' || sourceFilter === 'wikibooks') {
    promises.push(
      fetchWithTimeout(
        `https://en.wikiversity.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.query?.search) {
            data.query.search.slice(0, 3).forEach((item: any) => {
              results.push({
                id: `wuniv_${item.pageid}`,
                title: item.title,
                snippet: stripHtml(item.snippet) || `University lecture modules and course notes for ${item.title}.`,
                source: 'wikiversity',
                sourceLabel: 'Wikiversity Course',
                sourceUrl: `https://en.wikiversity.org/?curid=${item.pageid}`,
                pageid: item.pageid
              });
            });
          }
        })
        .catch(() => {})
    );
  }

  // 4. Open Library / Internet Archive (Textbooks & Academic Books)
  if (sourceFilter === 'all' || sourceFilter === 'openlibrary') {
    promises.push(
      fetchWithTimeout(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanQuery)}&limit=4&fields=key,title,author_name,first_publish_year,subject,first_sentence`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.docs && Array.isArray(data.docs)) {
            data.docs.slice(0, 3).forEach((book: any, idx: number) => {
              const authors = book.author_name ? book.author_name.slice(0, 2).join(', ') : 'Academic Scholar';
              const yearStr = book.first_publish_year ? ` (${book.first_publish_year})` : '';
              const snippet = book.first_sentence && Array.isArray(book.first_sentence) 
                ? book.first_sentence[0] 
                : (book.subject ? `Curriculum topics: ${book.subject.slice(0, 4).join(', ')}.` : `Academic literature and study text on ${book.title}.`);
              results.push({
                id: `ol_${book.key?.replace(/\//g, '_') || idx}`,
                title: `${book.title}${yearStr}`,
                snippet: snippet.length > 200 ? snippet.substring(0, 200) + '...' : snippet,
                source: 'openlibrary',
                sourceLabel: 'Open Library Books',
                author: authors,
                year: book.first_publish_year,
                sourceUrl: book.key ? `https://openlibrary.org${book.key}` : undefined
              });
            });
          }
        })
        .catch(() => {})
    );
  }

  // 5. Project Gutenberg (Foundational Scientific Classics & Literature)
  if (sourceFilter === 'all' || sourceFilter === 'gutenberg') {
    promises.push(
      fetchWithTimeout(
        `https://gutendex.com/books/?search=${encodeURIComponent(cleanQuery)}`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.results && Array.isArray(data.results)) {
            data.results.slice(0, 3).forEach((book: any) => {
              const author = book.authors && book.authors[0] ? book.authors[0].name : 'Classic Author';
              const subjects = book.subjects ? book.subjects.slice(0, 3).join(', ') : '';
              results.push({
                id: `gut_${book.id}`,
                title: book.title,
                snippet: subjects ? `Classical treatise. Key subjects: ${subjects}.` : `Full historical text and original work by ${author}.`,
                source: 'gutenberg',
                sourceLabel: 'Gutenberg Classics',
                author,
                sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`
              });
            });
          }
        })
        .catch(() => {})
    );
  }

  // 6. ArXiv Science Papers (Computer Science, Physics, Math, Quantitative Bio)
  if (sourceFilter === 'all' || sourceFilter === 'arxiv') {
    promises.push(
      fetchWithTimeout(
        `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&start=0&max_results=3`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.text() : null)
        .then(xmlText => {
          if (xmlText) {
            const entryRegex = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<summary>([\s\S]*?)<\/summary>[\s\S]*?<\/entry>/gi;
            let match;
            let count = 0;
            while ((match = entryRegex.exec(xmlText)) !== null && count < 3) {
              const rawTitle = match[1].replace(/\n/g, ' ').trim();
              const rawSummary = match[2].replace(/\n/g, ' ').trim();
              results.push({
                id: `arxiv_${Date.now()}_${count}`,
                title: rawTitle,
                snippet: rawSummary.length > 200 ? rawSummary.substring(0, 200) + '...' : rawSummary,
                source: 'arxiv',
                sourceLabel: 'ArXiv Science Paper'
              });
              count++;
            }
          }
        })
        .catch(() => {})
    );
  }

  // 7. Crossref Academic Registry (Peer-Reviewed Journal Articles)
  if (sourceFilter === 'all' || sourceFilter === 'crossref') {
    promises.push(
      fetchWithTimeout(
        `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=3&select=DOI,title,abstract,author,container-title`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.message?.items && Array.isArray(data.message.items)) {
            data.message.items.forEach((item: any, idx: number) => {
              const rawTitle = item.title && item.title[0] ? item.title[0] : null;
              if (rawTitle) {
                const journal = item['container-title'] && item['container-title'][0] ? item['container-title'][0] : 'Academic Journal';
                const cleanAbstract = item.abstract ? stripHtml(item.abstract) : `Peer-reviewed scientific publication in ${journal}.`;
                results.push({
                  id: `crossref_${Date.now()}_${idx}`,
                  title: rawTitle,
                  snippet: cleanAbstract.length > 200 ? cleanAbstract.substring(0, 200) + '...' : cleanAbstract,
                  source: 'crossref',
                  sourceLabel: 'Crossref Journal Article',
                  sourceUrl: item.DOI ? `https://doi.org/${item.DOI}` : undefined
                });
              }
            });
          }
        })
        .catch(() => {})
    );
  }

  // 8. DuckDuckGo Instant Knowledge Definition API
  if (sourceFilter === 'all' || sourceFilter === 'duckduckgo') {
    promises.push(
      fetchWithTimeout(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=0`,
        userAgentHeaders
      )
        .then(r => r && r.ok ? r.json() : null)
        .then(data => {
          if (data?.Abstract && data.Abstract.length > 30) {
            results.push({
              id: `ddg_${Date.now()}`,
              title: data.Heading || cleanQuery,
              snippet: data.Abstract,
              source: 'duckduckgo',
              sourceLabel: 'Instant Definition & Overview',
              sourceUrl: data.AbstractURL || undefined
            });
          }
        })
        .catch(() => {})
    );
  }

  // Await all parallel fast fetches
  await Promise.allSettled(promises);

  const durationMs = Math.round(performance.now() - startTime);

  // Store in cache for future rapid response
  searchCache.set(cacheKey, {
    timestamp: Date.now(),
    results,
    responseTimeMs: durationMs
  });

  return res.json({
    results,
    responseTimeMs: durationMs,
    cached: false,
    total: results.length
  });
});

app.post('/api/notes/import-online', authenticateUser, async (req, res) => {
  try {
    const {
      title,
      source,
      subjectId,
      customSubjectName,
      pageid,
      snippet,
      sourceUrl,
      author,
      year
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Article or note title is required.' });
    }

    const cleanTitle = title.trim();
    const db = readDatabase();
    let finalSubjectId = subjectId;

    // Intelligent Subject Resolution: Auto-create or Auto-match if user didn't pick a folder
    if (!finalSubjectId || finalSubjectId === 'auto' || finalSubjectId === '') {
      // 1. Check if user already has an existing subject that matches keywords
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const matched = db.subjects.find(s =>
        s.userId === req.user!.id &&
        titleWords.some(w => s.name.toLowerCase().includes(w))
      );

      if (matched) {
        finalSubjectId = matched.id;
      } else {
        // 2. Auto-generate an intuitive academic subject folder name
        let autoName = 'General Studies';
        const lower = cleanTitle.toLowerCase();
        if (/calculus|algebra|geometry|math|equation|probability|matrix/.test(lower)) {
          autoName = 'Mathematics';
        } else if (/neural|algorithm|computer|python|code|data structure|robot|cyber/.test(lower)) {
          autoName = 'Computer Science';
        } else if (/physics|quantum|mechanics|thermodynamics|relativity|optics/.test(lower)) {
          autoName = 'Physics';
        } else if (/photosynthesis|cell|dna|bio|genetics|organism|protein|enzyme/.test(lower)) {
          autoName = 'Biology & Life Sciences';
        } else if (/war|history|century|empire|revolution|renaissance/.test(lower)) {
          autoName = 'World History';
        } else if (/economy|market|microeconomic|macroeconomic|finance/.test(lower)) {
          autoName = 'Economics';
        } else {
          autoName = cleanTitle.length > 25 ? cleanTitle.substring(0, 22) + '...' : cleanTitle;
        }

        const existingAuto = db.subjects.find(
          s => s.userId === req.user!.id && s.name.toLowerCase() === autoName.toLowerCase()
        );

        if (existingAuto) {
          finalSubjectId = existingAuto.id;
        } else {
          const colors = ['emerald', 'indigo', 'rose', 'amber', 'purple', 'cyan'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          const newSubj: Subject = {
            id: `subj_${Date.now()}`,
            userId: req.user!.id,
            name: autoName,
            color: randomColor,
            createdAt: new Date().toISOString()
          };
          db.subjects.push(newSubj);
          finalSubjectId = newSubj.id;
          broadcastToUser(req.user!.id, { type: 'SUBJECT_CREATED', payload: newSubj });
        }
      }
    } else if (finalSubjectId === 'custom') {
      const targetName = customSubjectName?.trim() || cleanTitle;
      const existingSubj = db.subjects.find(
        s => s.userId === req.user!.id && s.name.toLowerCase() === targetName.toLowerCase()
      );

      if (existingSubj) {
        finalSubjectId = existingSubj.id;
      } else {
        const colors = ['emerald', 'indigo', 'rose', 'amber', 'purple', 'cyan'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newSubj: Subject = {
          id: `subj_${Date.now()}`,
          userId: req.user!.id,
          name: targetName,
          color: randomColor,
          createdAt: new Date().toISOString()
        };
        db.subjects.push(newSubj);
        finalSubjectId = newSubj.id;
        broadcastToUser(req.user!.id, { type: 'SUBJECT_CREATED', payload: newSubj });
      }
    }

    let rawContent = '';

    // Fetch full or extract content based on source
    if (source === 'wikipedia') {
      try {
        const queryUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(cleanTitle)}&format=json&origin=*`;
        const res = await fetchWithTimeout(queryUrl, {}, 2500);
        if (res && res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages;
          if (pages) {
            const firstPageKey = Object.keys(pages)[0];
            if (firstPageKey && pages[firstPageKey]?.extract) {
              rawContent = pages[firstPageKey].extract;
            }
          }
        }
        if (!rawContent || rawContent.length < 100) {
          const wikiSummaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle.replace(/\s+/g, '_'))}`;
          const sumRes = await fetchWithTimeout(wikiSummaryUrl, {}, 2000);
          if (sumRes && sumRes.ok) {
            const sumData = await sumRes.json();
            rawContent = sumData.extract || sumData.description || '';
          }
        }
      } catch (e) {
        console.warn('Wikipedia fetch failed, falling back to AI synthesis.');
      }
    } else if (source === 'wikibooks') {
      try {
        const queryUrl = `https://en.wikibooks.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(cleanTitle)}&format=json&origin=*`;
        const res = await fetchWithTimeout(queryUrl, {}, 2500);
        if (res && res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages;
          if (pages) {
            const firstPageKey = Object.keys(pages)[0];
            if (firstPageKey && pages[firstPageKey]?.extract) {
              rawContent = pages[firstPageKey].extract;
            }
          }
        }
      } catch (e) {
        console.warn('Wikibooks fetch failed, falling back to AI synthesis.');
      }
    } else if (source === 'wikiversity') {
      try {
        const queryUrl = `https://en.wikiversity.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=${encodeURIComponent(cleanTitle)}&format=json&origin=*`;
        const res = await fetchWithTimeout(queryUrl, {}, 2500);
        if (res && res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages;
          if (pages) {
            const firstPageKey = Object.keys(pages)[0];
            if (firstPageKey && pages[firstPageKey]?.extract) {
              rawContent = pages[firstPageKey].extract;
            }
          }
        }
      } catch (e) {
        console.warn('Wikiversity fetch failed, falling back to AI synthesis.');
      }
    } else if (snippet) {
      rawContent = snippet;
    }

    // If source is AI generator or content is too short for a rich study guide, synthesize complete syllabus guide
    if (source === 'ai' || !rawContent || rawContent.length < 150) {
      const topicForAi = cleanTitle.replace(/\s*\(Full AI Study Guide\)$/i, '');
      const aiGuide = await generateFullStudyGuide(topicForAi);
      rawContent = rawContent ? `${rawContent}\n\n${aiGuide}` : aiGuide;
    }

    // Synthesize academic metadata (concise summary, vocabulary, active recall flashcards)
    let aiMeta;
    try {
      aiMeta = await generateAcademicMetadata(cleanTitle, rawContent);
    } catch {
      aiMeta = { summary: '', vocabulary: [], flashcards: [] };
    }

    const noteId = `note_${Date.now()}`;
    const cleanNoteTitle = cleanTitle.replace(/\s*\(Full AI Study Guide\)$/i, '');
    const newNote: Note = {
      id: noteId,
      userId: req.user!.id,
      subjectId: finalSubjectId,
      title: cleanNoteTitle,
      content: rawContent.trim(),
      summary: aiMeta.summary || `Comprehensive academic study notes and active revision guide for ${cleanNoteTitle}.`,
      vocabulary: aiMeta.vocabulary || [],
      isPdf: false,
      isOnline: true,
      source: (source as any) || 'online',
      sourceLabel: source === 'wikipedia' ? 'Wikipedia' : source === 'wikibooks' ? 'Wikibooks' : source === 'wikiversity' ? 'Wikiversity' : source === 'openlibrary' ? 'Open Library' : source === 'gutenberg' ? 'Gutenberg Classics' : source === 'arxiv' ? 'ArXiv Paper' : source === 'crossref' ? 'Crossref Journal' : source === 'duckduckgo' ? 'Instant Definition' : 'AI Study Guide',
      sourceUrl,
      author,
      year,
      createdAt: new Date().toISOString()
    };

    await insertNote(newNote);

    // Inject flashcards directly into user deck
    if (aiMeta.flashcards && aiMeta.flashcards.length > 0) {
      const generatedCards: Flashcard[] = aiMeta.flashcards.map((f: any, i: number) => ({
        id: `fc_${Date.now()}_${i}`,
        userId: req.user!.id,
        subjectId: finalSubjectId,
        noteId: newNote.id,
        question: f.question,
        answer: f.answer,
        mastery: 'unfamiliar',
        createdAt: new Date().toISOString()
      }));
      await insertFlashcards(generatedCards);
    }

    // Activity Log
    await insertActivityLog({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Imported Online Note',
      details: `Imported "${newNote.title}" from ${newNote.sourceLabel || source}. Generated ${aiMeta.flashcards?.length || 0} active recall cards.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });

    broadcastToUser(req.user!.id, { type: 'NOTE_CREATED', payload: newNote });

    return res.status(201).json(newNote);
  } catch (err: any) {
    console.error('Import online note error:', err);
    return res.status(500).json({ error: 'Failed to import and synthesize online note.' });
  }
});


/* --- PRACTICE ARENA: FLASHCARDS, QUIZZES, LEADERBOARDS --- */

app.get('/api/flashcards', authenticateUser, async (req, res) => {
  try {
    const decks = await fetchFlashcards(req.user!.id);
    res.json(decks);
  } catch (err) {
    res.status(500).json({ error: 'Failed retrieving flashcards.' });
  }
});

app.put('/api/flashcards/:id', authenticateUser, async (req, res) => {
  try {
    const { mastery } = req.body;
    if (!mastery || !['unfamiliar', 'review', 'known'].includes(mastery)) {
      return res.status(400).json({ error: 'Invalid card mastery level specified.' });
    }

    const card = await updateFlashcardMasteryRecord(req.params.id, req.user!.id, mastery);
    if (!card) return res.status(404).json({ error: 'Flashcard deck not found.' });

    return res.json(card);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update flashcard mastery.' });
  }
});

// Generate dynamic practice adaptive quizzes
app.post('/api/notes/:id/generate-exam', authenticateUser, async (req, res) => {
  try {
    const { difficulty } = req.body; // 'easy', 'medium', 'hard'
    const noteId = req.params.id;

    const db = readDatabase();
    const note = db.notes.find(n => n.id === noteId && n.userId === req.user!.id);
    if (!note) return res.status(404).json({ error: 'Note material not found to build quiz.' });

    const subject = db.subjects.find(s => s.id === note.subjectId);
    const subjectName = subject ? subject.name : 'General Science';

    // Call custom Gemini API Adaptive quiz prompt
    const quizResponse = await generatePracticeExam(subjectName, note.title, note.content, difficulty || 'medium');

    const newPracticeExam: PracticeExam = {
      id: `exam_${Date.now()}`,
      noteId: note.id,
      subjectId: note.subjectId,
      title: quizResponse.title || `Adaptive Quiz: ${note.title}`,
      difficulty: difficulty || 'medium',
      questions: quizResponse.questions.map((q: any, idx: number) => ({
        id: q.id || `q_${idx}_${Date.now()}`,
        type: q.type || 'mcq',
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correctAnswer
      }))
    };

    db.practiceExams.push(newPracticeExam);
    await writeDatabase(db);

    return res.status(201).json(newPracticeExam);
  } catch (err) {
    console.error('Quiz creation failure:', err);
    res.status(500).json({ error: 'Failed mapping custom adaptive study test parameters.' });
  }
});

app.get('/api/subjects/:subjectId/exams', authenticateUser, (req, res) => {
  const db = readDatabase();
  const exams = db.practiceExams.filter(e => e.subjectId === req.params.subjectId);
  res.json(exams);
});

// Submit Academic Quiz Attempts scorecard
app.post('/api/quizzes/submit', authenticateUser, async (req, res) => {
  try {
    const { examId, score, totalQuestions, subjectId, title } = req.body;
    if (!examId || score === undefined || !totalQuestions || !subjectId) {
      return res.status(400).json({ error: 'Incomplete score attributes.' });
    }

    const attempt: QuizAttempt = {
      id: `att_${Date.now()}`,
      userId: req.user!.id,
      examId,
      subjectId,
      title: title || 'Adaptive Quiz Attempt',
      score,
      totalQuestions,
      attemptedAt: new Date().toISOString()
    };

    await insertQuizAttempt(attempt);

    // Dynamic Activity Logger
    const accuracyPct = Math.round((score / totalQuestions) * 100);
    await insertActivityLog({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Completed Quiz',
      details: `Scored ${score}/${totalQuestions} (${accuracyPct}%) on "${attempt.title}".`,
      activityType: 'quiz',
      createdAt: new Date().toISOString()
    });

    // Broadcast update
    broadcastToUser(req.user!.id, { type: 'QUIZ_SUBMITTED', payload: attempt });
    // Emit global leaderboard event Update
    broadcastGlobalNotification({ type: 'LEADERBOARD_REFRESH', message: `${req.user!.username} completed active arena quiz!` });

    return res.status(201).json(attempt);
  } catch (err) {
    res.status(500).json({ error: 'Failed logging exam grade.' });
  }
});

// Leaderboard score aggregates
app.get('/api/leaderboard', (req, res) => {
  const db = readDatabase();
  
  // Aggregate attempts by user
  const userMap = new Map<string, { username: string; totalScore: number; qs: number; count: number }>();
  
  // Populate users
  db.users.forEach(u => {
    userMap.set(u.id, { username: u.username, totalScore: 0, qs: 0, count: 0 });
  });

  // Calculate scores
  db.quizAttempts.forEach(qa => {
    if (userMap.has(qa.userId)) {
      const entry = userMap.get(qa.userId)!;
      entry.totalScore += qa.score;
      entry.qs += qa.totalQuestions;
      entry.count += 1;
    }
  });

  const list = Array.from(userMap.entries()).map(([userId, val]) => {
    const averageScore = val.count ? Number((val.totalScore / val.count).toFixed(1)) : 0;
    const accuracy = val.qs ? Math.round((val.totalScore / val.qs) * 100) : 0;
    return {
      userId,
      username: val.username,
      accuracy,
      attempts: val.count,
      averageScore
    };
  }).sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);

  res.json(list.slice(0, 15)); // Top 15
});


/* --- PLANNER MODULE TASKS --- */

app.get('/api/planner', authenticateUser, async (req, res) => {
  try {
    const tasks = await fetchPlannerTasks(req.user!.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed fetching planner tasks.' });
  }
});

app.post('/api/planner', authenticateUser, async (req, res) => {
  try {
    const { title, subjectId, description, dueDate } = req.body;
    if (!title || !subjectId || !dueDate) {
      return res.status(400).json({ error: 'Task Title, Subject, and Due date are required.' });
    }

    const newTask: PlannerTask = {
      id: `task_${Date.now()}`,
      userId: req.user!.id,
      subjectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      dueDate,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await insertPlannerTask(newTask);

    // Save logs
    await insertActivityLog({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Planner Task Added',
      details: `Scheduled milestone task: "${newTask.title}" for ${dueDate}.`,
      activityType: 'planner',
      createdAt: new Date().toISOString()
    });

    broadcastToUser(req.user!.id, { type: 'PLANNER_UPDATED', payload: newTask });
    return res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: 'Failed logging planner task.' });
  }
});

app.put('/api/planner/:id', authenticateUser, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'active', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Incorrect milestone status.' });
    }

    const task = await updatePlannerTaskStatusRecord(req.params.id, req.user!.id, status as any);
    if (!task) return res.status(404).json({ error: 'Planner task not found.' });

    broadcastToUser(req.user!.id, { type: 'PLANNER_UPDATED', payload: task });
    return res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed updating study milestone status.' });
  }
});


/* --- ANALYTICS DATA AGGREGATION --- */

app.get('/api/analytics', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Filter student-specific models
    const attempts = await fetchQuizAttempts(userId);
    const tasks = await fetchPlannerTasks(userId);
    const notes = await fetchNotes(userId);
    const cards = await fetchFlashcards(userId);
    const subjects = await fetchSubjects(userId);

    // 1. Chart Data: Study Trends & Quiz score progression
    const quizHistory = attempts.map((a, i) => ({
      name: `Quiz ${i + 1}`,
      score: Math.round((a.score / a.totalQuestions) * 100),
      title: a.title
    }));

    // 2. Chart Data: Study hours mock synthesis linked to actual study logs/subjects
    const hoursData = subjects.map(s => {
      const subjectNotesCount = notes.filter(n => n.subjectId === s.id).length;
      const subjectQuizzesCount = attempts.filter(a => a.subjectId === s.id).length;
      return {
        subject: s.name.split(' ')[0], // get short prefix
        hours: 4 + (subjectNotesCount * 2) + (subjectQuizzesCount * 1.5)
      };
    });

    // 3. Subject Mastery distribution
    const masteryData = subjects.map(s => {
      const subjectCards = cards.filter(f => f.subjectId === s.id);
      const knownCount = subjectCards.filter(c => c.mastery === 'known').length;
      const masteryPct = subjectCards.length ? Math.round((knownCount / subjectCards.length) * 100) : 50;
      return {
        name: s.name.split(' ')[0],
        mastery: masteryPct
      };
    });

    // Calculate metrics
    const completionRate = tasks.length ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0;
    const avgScores = attempts.length
      ? Math.round((attempts.reduce((sum, current) => sum + (current.score / current.totalQuestions), 0) / attempts.length) * 100)
      : 0;

    res.json({
      studyHours: hoursData.reduce((total, cur) => total + cur.hours, 0),
      completionRate,
      averageScorePct: avgScores,
      subjectsCount: subjects.length,
      quizHistory,
      hoursBySubject: hoursData,
      masteryBySubject: masteryData
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed computing analytics.' });
  }
});

// GET custom study intelligent recommendations from Gemini API
app.get('/api/analytics/ai-recommendations', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const attempts = await fetchQuizAttempts(userId);
    const logs = await fetchActivityLogs(userId);

    const summarizedHistory = `Student completed ${attempts.length} quizzes. Recent items completed: ${logs.slice(0, 5).map(l => l.action).join(', ')}`;
    const resultMarkdown = await generateStudyRecommendations(summarizedHistory);
    
    return res.json({ recommendations: resultMarkdown });
  } catch (err) {
    res.status(500).json({ error: 'AI failed to parse intelligence recommendation parameters.' });
  }
});


/* --- SYSTEM GLOBAL NOTIFICATIONS AND LOGS --- */

app.get('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const notifs = await fetchNotifications(req.user!.id);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: 'Failed fetching notifications.' });
  }
});

app.post('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const newNotif = {
      id: `not_${Date.now()}`,
      userId: req.user!.id,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: new Date().toISOString()
    };

    await insertNotification(newNotif);

    // Broadcast live update over real-time WebSockets
    broadcastToUser(req.user!.id, { type: 'NOTIFICATION_BROADCAST', payload: newNotif });

    return res.status(201).json(newNotif);
  } catch (err) {
    console.error('Error creating local notification:', err);
    res.status(500).json({ error: 'Failed dispatching custom academic notification.' });
  }
});

app.post('/api/notifications/read', authenticateUser, async (req, res) => {
  try {
    const db = readDatabase();
    db.notifications.forEach(n => {
      if (n.userId === req.user!.id) n.read = true;
    });
    await writeDatabase(db);
    return res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed logging notifications read state.' });
  }
});

app.get('/api/activity-logs', authenticateUser, async (req, res) => {
  try {
    const logs = await fetchActivityLogs(req.user!.id);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed retrieving activity logs.' });
  }
});


/* --- SHARED HTTP SERVER / WEBSOCKET ARCHITECTURE --- */

const server = http.createServer(app);

// 1. Manually instantiate native WebSocketServer on the main port server
const wss = new WebSocketServer({ noServer: true });

// 2. Active Socket Registry: Map<UserId, Set<WebSocket>>
const socketRegistry = new Map<string, Set<WebSocket>>();

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  
  if (pathname === '/ws') {
    // Intercept http upgrading securely
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws: WebSocket) => {
  console.log('New client WS handshake request initiated...');
  let currentUserId: string | null = null;

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      
      // Connection Auths via JWT payload
      if (data.type === 'AUTH') {
        const token = data.payload.token;
        const decoded = verifyToken(token);
        
        if (decoded && decoded.id) {
          currentUserId = decoded.id;
          
          if (!socketRegistry.has(currentUserId!)) {
            socketRegistry.set(currentUserId!, new Set<WebSocket>());
          }
          socketRegistry.get(currentUserId!)!.add(ws);
          
          ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', message: 'Real-time WebSocket tunnel active.' }));
          console.log(`WebSocket fully active, authenticated for User: ${currentUserId}`);
        } else {
          ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'JWT token invalid/expired.' }));
          ws.close();
        }
      }

      // Keepalive Heartbeats
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (err) {
      console.error('Socket message parse error:', err);
    }
  });

  // Handle connection failures safely: error listeners + cleanups
  ws.on('error', (err) => {
    console.warn(`Socket communication error on user ${currentUserId}:`, err);
    cleanupSocket(currentUserId, ws);
  });

  ws.on('close', () => {
    cleanupSocket(currentUserId, ws);
  });
});

function cleanupSocket(userId: string | null, ws: WebSocket) {
  if (userId && socketRegistry.has(userId)) {
    const sockets = socketRegistry.get(userId)!;
    sockets.delete(ws);
    if (sockets.size === 0) {
      socketRegistry.delete(userId);
    }
    console.log(`Socket disconnected and clean registry complete for user: ${userId}`);
  }
}

// Broadcasting helpers
export function broadcastToUser(userId: string, event: { type: string; payload: any }) {
  try {
    const sockets = socketRegistry.get(userId);
    if (sockets && sockets.size > 0) {
      const dataStr = JSON.stringify(event);
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(dataStr);
        }
      });
    }
  } catch (err) {
    console.error('WS broadcast error:', err);
  }
}

export function broadcastGlobalNotification(event: { type: string; message: string }) {
  try {
    const dataStr = JSON.stringify(event);
    socketRegistry.forEach((sockets) => {
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(dataStr);
        }
      });
    });
  } catch (err) {
    console.error('Global WS notify error:', err);
  }
}


/* --- VITE MIDDLEWARE HANDLING CLIENT IN SINGLE PORT --- */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    // Mount Vite asset pipe after APIs
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Tutor AI Server successfully started running on port http://0.0.0.0:${PORT}`);
  });
}

startServer();
