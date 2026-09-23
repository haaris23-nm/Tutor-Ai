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

// Boot systems
const dbState = initializeDatabase();
console.log('Main DB Initialized safely. Users registered:', dbState.users.length);

const app = express();
const PORT = 3000;

// High Payload Size limits to support textbooks/notes/PDF slides without crashing
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Simple cryptographic password simulation helper
function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/* --- JWT / AUTH ROUTES --- */

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

app.get('/api/subjects', authenticateUser, (req, res) => {
  const db = readDatabase();
  const userSubjects = db.subjects.filter(s => s.userId === req.user!.id);
  res.json(userSubjects);
});

app.post('/api/subjects', authenticateUser, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Subject title is required.' });

    const db = readDatabase();
    const newSubj: Subject = {
      id: `subj_${Date.now()}`,
      userId: req.user!.id,
      name: name.trim(),
      color: color || 'indigo',
      createdAt: new Date().toISOString()
    };

    db.subjects.push(newSubj);
    await writeDatabase(db);

    broadcastToUser(req.user!.id, { type: 'SUBJECT_CREATED', payload: newSubj });
    return res.status(201).json(newSubj);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create academic subject.' });
  }
});


/* --- NOTES REPOSITORY & AI SUMMARIES CONTROLLERS --- */

app.get('/api/notes', authenticateUser, (req, res) => {
  const db = readDatabase();
  const notes = db.notes.filter(n => n.userId === req.user!.id);
  res.json(notes);
});

app.post('/api/notes', authenticateUser, async (req, res) => {
  try {
    const { subjectId, title, content } = req.body;
    if (!subjectId || !title || !content) {
      return res.status(400).json({ error: 'Subject, Title, and Content are required fields.' });
    }

    const db = readDatabase();
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

    db.notes.push(newNote);

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
      db.flashcards.push(...generatedCards);
    }

    // Append to Activity Logs
    db.activityLogs.push({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Created Note',
      details: `Added new note: "${newNote.title}" with AI summary extraction.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);

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

    db.notes.push(newNote);

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
      db.flashcards.push(...generatedCards);
    }

    // Log Activity
    db.activityLogs.push({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Uploaded PDF Material',
      details: `Processed and indexed "${fileName}" with automated vocabulary maps.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);
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
  return htmlStr.replace(/<\/?[^>]+(>|$)/g, '').trim();
}

app.get('/api/notes/search-online', authenticateUser, async (req, res) => {
  const query = (req.query.q as string) || '';
  const sourceFilter = (req.query.source as string) || 'all';

  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const cleanQuery = query.trim();
  const results: any[] = [];

  // 1. Always offer an AI Knowledge Generator Option as featured card
  results.push({
    id: `ai_gen_${Date.now()}`,
    title: `${cleanQuery} (Full AI Study Guide)`,
    snippet: `Synthesize a comprehensive, textbook-quality study guide with core concepts, formulas, vocabulary, and flashcards for "${cleanQuery}".`,
    source: 'ai',
    sourceLabel: 'AI Knowledge Generator'
  });

  const promises: Promise<any>[] = [];

  const userAgentHeaders = {
    'User-Agent': 'TutorAI/1.0 (Academic Study Assistant; contact@tutor.ai)'
  };

  // Wikipedia Search
  if (sourceFilter === 'all' || sourceFilter === 'wikipedia') {
    promises.push(
      fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`, { headers: userAgentHeaders })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.query?.search) {
            data.query.search.slice(0, 5).forEach((item: any) => {
              results.push({
                id: `wiki_${item.pageid}`,
                title: item.title,
                snippet: stripHtml(item.snippet),
                source: 'wikipedia',
                sourceLabel: 'Wikipedia',
                pageid: item.pageid
              });
            });
          }
        })
        .catch(err => console.error('Wikipedia search error:', err))
    );
  }

  // Wikibooks Search (Open Textbooks & Study Notes)
  if (sourceFilter === 'all' || sourceFilter === 'wikibooks') {
    promises.push(
      fetch(`https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&origin=*`, { headers: userAgentHeaders })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.query?.search) {
            data.query.search.slice(0, 5).forEach((item: any) => {
              results.push({
                id: `wb_${item.pageid}`,
                title: item.title,
                snippet: stripHtml(item.snippet) || `Open Wikibooks textbook notes for ${item.title}.`,
                source: 'wikibooks',
                sourceLabel: 'Wikibooks Textbook',
                pageid: item.pageid
              });
            });
          }
        })
        .catch(err => console.error('Wikibooks search error:', err))
    );
  }

  // ArXiv Open Science Repository Search (Physics, CS, Math, Bio)
  if (sourceFilter === 'all' || sourceFilter === 'arxiv') {
    promises.push(
      fetch(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&start=0&max_results=4`, { headers: userAgentHeaders })
        .then(r => r.ok ? r.text() : null)
        .then(xmlText => {
          if (xmlText) {
            const entryRegex = /<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<summary>([\s\S]*?)<\/summary>[\s\S]*?<\/entry>/gi;
            let match;
            let count = 0;
            while ((match = entryRegex.exec(xmlText)) !== null && count < 4) {
              const rawTitle = match[1].replace(/\n/g, ' ').trim();
              const rawSummary = match[2].replace(/\n/g, ' ').trim();
              results.push({
                id: `arxiv_${Date.now()}_${count}`,
                title: rawTitle,
                snippet: rawSummary.length > 180 ? rawSummary.substring(0, 180) + '...' : rawSummary,
                source: 'arxiv',
                sourceLabel: 'ArXiv Science Paper'
              });
              count++;
            }
          }
        })
        .catch(err => console.error('ArXiv search error:', err))
    );
  }

  await Promise.allSettled(promises);
  return res.json(results);
});

app.post('/api/notes/import-online', authenticateUser, async (req, res) => {
  try {
    const { title, source, subjectId, customSubjectName, pageid, snippet } = req.body;
    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Article or note title is required.' });
    }

    const cleanTitle = title.trim();
    const db = readDatabase();
    let finalSubjectId = subjectId;

    // Handle inline creation of custom subject
    if (subjectId === 'custom') {
      if (!customSubjectName || customSubjectName.trim() === '') {
        return res.status(400).json({ error: 'A valid custom subject name is required.' });
      }

      const existingSubj = db.subjects.find(
        s => s.userId === req.user!.id && s.name.toLowerCase() === customSubjectName.trim().toLowerCase()
      );

      if (existingSubj) {
        finalSubjectId = existingSubj.id;
      } else {
        const colors = ['emerald', 'indigo', 'rose', 'amber', 'purple', 'cyan'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        const newSubj = {
          id: `subj_${Date.now()}`,
          userId: req.user!.id,
          name: customSubjectName.trim(),
          color: randomColor,
          createdAt: new Date().toISOString()
        };
        db.subjects.push(newSubj);
        finalSubjectId = newSubj.id;
        broadcastToUser(req.user!.id, { type: 'SUBJECT_CREATED', payload: newSubj });
      }
    }

    if (!finalSubjectId) {
      return res.status(400).json({ error: 'Please select a subject folder, or enter a custom subject name.' });
    }

    let rawContent = '';

    // Fetch content based on source
    if (source === 'wikipedia') {
      try {
        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle.replace(/\s+/g, '_'))}`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          rawContent = wikiData.extract || wikiData.description || '';
        }
      } catch (e) {
        console.warn('Wikipedia REST summary failed, fallback to AI synthesis.');
      }
    } else if (source === 'wikibooks') {
      try {
        const wbUrl = `https://en.wikibooks.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle.replace(/\s+/g, '_'))}`;
        const wbRes = await fetch(wbUrl);
        if (wbRes.ok) {
          const wbData = await wbRes.json();
          rawContent = wbData.extract || wbData.description || '';
        }
      } catch (e) {
        console.warn('Wikibooks REST summary failed, fallback to AI synthesis.');
      }
    }

    // If source is 'arxiv', snippet contains full summary
    if (source === 'arxiv' && snippet) {
      rawContent = snippet;
    }

    // Fallback or AI Note Generation if content is missing or user requested AI Generator
    if (source === 'ai' || !rawContent || rawContent.length < 50) {
      const topicForAi = cleanTitle.replace(/\s*\(Full AI Study Guide\)$/i, '');
      rawContent = await generateFullStudyGuide(topicForAi);
    }

    // Synthesize academic metadata (summary, vocab, flashcards)
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
      summary: aiMeta.summary || 'AI-analyzed study note summary.',
      vocabulary: aiMeta.vocabulary || [],
      isPdf: false,
      isOnline: true,
      source: 'online',
      createdAt: new Date().toISOString()
    };

    db.notes.push(newNote);

    // If Gemini/fallback returned flashcards, insert them into user's flashcards deck
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
      db.flashcards.push(...generatedCards);
    }

    // Log Activity
    db.activityLogs.push({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Imported Online Note',
      details: `Imported reference note "${newNote.title}" from ${source || 'online resource'}.`,
      activityType: 'note',
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);
    broadcastToUser(req.user!.id, { type: 'NOTE_CREATED', payload: newNote });

    return res.status(201).json(newNote);
  } catch (err: any) {
    console.error('Import online note error:', err);
    return res.status(500).json({ error: 'Failed to import and analyze online note.' });
  }
});


/* --- PRACTICE ARENA: FLASHCARDS, QUIZZES, LEADERBOARDS --- */

app.get('/api/flashcards', authenticateUser, (req, res) => {
  const db = readDatabase();
  const decks = db.flashcards.filter(f => f.userId === req.user!.id);
  res.json(decks);
});

app.put('/api/flashcards/:id', authenticateUser, async (req, res) => {
  try {
    const { mastery } = req.body;
    if (!mastery || !['unfamiliar', 'review', 'known'].includes(mastery)) {
      return res.status(400).json({ error: 'Invalid card mastery level specified.' });
    }

    const db = readDatabase();
    const card = db.flashcards.find(f => f.id === req.params.id && f.userId === req.user!.id);
    if (!card) return res.status(404).json({ error: 'Flashcard deck not found.' });

    card.mastery = mastery;
    card.lastReviewedAt = new Date().toISOString();

    await writeDatabase(db);
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

    const db = readDatabase();
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

    db.quizAttempts.push(attempt);

    // Dynamic Activity Logger
    const accuracyPct = Math.round((score / totalQuestions) * 100);
    db.activityLogs.push({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Completed Quiz',
      details: `Scored ${score}/${totalQuestions} (${accuracyPct}%) on "${attempt.title}".`,
      activityType: 'quiz',
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);

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

app.get('/api/planner', authenticateUser, (req, res) => {
  const db = readDatabase();
  const tasks = db.plannerTasks.filter(t => t.userId === req.user!.id);
  res.json(tasks);
});

app.post('/api/planner', authenticateUser, async (req, res) => {
  try {
    const { title, subjectId, description, dueDate } = req.body;
    if (!title || !subjectId || !dueDate) {
      return res.status(400).json({ error: 'Task Title, Subject, and Due date are required.' });
    }

    const db = readDatabase();
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

    db.plannerTasks.push(newTask);

    // Save logs
    db.activityLogs.push({
      id: `act_${Date.now()}`,
      userId: req.user!.id,
      action: 'Planner Task Added',
      details: `Scheduled milestone task: "${newTask.title}" for ${dueDate}.`,
      activityType: 'planner',
      createdAt: new Date().toISOString()
    });

    await writeDatabase(db);
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

    const db = readDatabase();
    const task = db.plannerTasks.find(t => t.id === req.params.id && t.userId === req.user!.id);
    if (!task) return res.status(404).json({ error: 'Planner task not found.' });

    task.status = status;

    await writeDatabase(db);
    broadcastToUser(req.user!.id, { type: 'PLANNER_UPDATED', payload: task });

    return res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed updating study milestone status.' });
  }
});


/* --- ANALYTICS DATA AGGREGATION --- */

app.get('/api/analytics', authenticateUser, (req, res) => {
  const db = readDatabase();
  const userId = req.user!.id;

  // Filter student-specific models
  const attempts = db.quizAttempts.filter(qa => qa.userId === userId);
  const tasks = db.plannerTasks.filter(t => t.userId === userId);
  const notes = db.notes.filter(n => n.userId === userId);
  const cards = db.flashcards.filter(f => f.userId === userId);

  // 1. Chart Data: Study Trends & Quiz score progression
  const quizHistory = attempts.map((a, i) => ({
    name: `Quiz ${i + 1}`,
    score: Math.round((a.score / a.totalQuestions) * 100),
    title: a.title
  }));

  // 2. Chart Data: Study hours mock synthesis linked to actual study logs/subjects
  const subjects = db.subjects.filter(s => s.userId === userId);
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
});

// GET custom study intelligent recommendations from Gemini API
app.get('/api/analytics/ai-recommendations', authenticateUser, async (req, res) => {
  try {
    const db = readDatabase();
    const userId = req.user!.id;
    const attempts = db.quizAttempts.filter(qa => qa.userId === userId);
    const logs = db.activityLogs.filter(al => al.userId === userId);

    const summarizedHistory = `Student completed ${attempts.length} quizzes. Recent items completed: ${logs.slice(0, 5).map(l => l.action).join(', ')}`;
    const resultMarkdown = await generateStudyRecommendations(summarizedHistory);
    
    return res.json({ recommendations: resultMarkdown });
  } catch (err) {
    res.status(500).json({ error: 'AI failed to parse intelligence recommendation parameters.' });
  }
});


/* --- SYSTEM GLOBAL NOTIFICATIONS AND LOGS --- */

app.get('/api/notifications', authenticateUser, (req, res) => {
  const db = readDatabase();
  const notes = db.notifications.filter(n => n.userId === req.user!.id);
  res.json(notes);
});

app.post('/api/notifications', authenticateUser, async (req, res) => {
  try {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required.' });
    }

    const db = readDatabase();
    const newNotif = {
      id: `not_${Date.now()}`,
      userId: req.user!.id,
      title: title.trim(),
      message: message.trim(),
      read: false,
      createdAt: new Date().toISOString()
    };

    db.notifications.push(newNotif);
    await writeDatabase(db);

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

app.get('/api/activity-logs', authenticateUser, (req, res) => {
  const db = readDatabase();
  const logs = db.activityLogs.filter(al => al.userId === req.user!.id);
  res.json(logs);
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
