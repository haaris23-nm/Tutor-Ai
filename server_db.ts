import fs from 'fs';
import path from 'path';
import { DatabaseSchema } from './src/types';

const DB_FILE = path.join(process.cwd(), 'server_db_json.json');
const BACKUP_FILE = path.join(process.cwd(), 'server_db_json.backup.json');

// Initialize schema shape
const initialSchema: DatabaseSchema = {
  users: [],
  subjects: [],
  notes: [],
  pdfDocuments: [],
  flashcards: [],
  practiceExams: [],
  quizAttempts: [],
  studyPlans: [],
  plannerTasks: [],
  activityLogs: [],
  notifications: []
};

// Queue locks for concurrent writing
let isWriting = false;
const writeQueue: Array<{ data: DatabaseSchema; resolve: (val: boolean) => void; reject: (err: any) => void }> = [];

export function initializeDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('Database file does not exist. Creating new database...: ', DB_FILE);
      writeDatabaseSync(initialSchema);
      return initialSchema;
    }

    const data = fs.readFileSync(DB_FILE, 'utf8');
    let parsed: DatabaseSchema;
    try {
      parsed = JSON.parse(data);
    } catch (parseErr) {
      console.error('Database file corrupted. Attempting to restore from backup...', parseErr);
      if (fs.existsSync(BACKUP_FILE)) {
        const backupData = fs.readFileSync(BACKUP_FILE, 'utf8');
        parsed = JSON.parse(backupData);
        // Write the backup back to the main DB file
        writeDatabaseSync(parsed);
      } else {
        console.warn('Backup file not found. Re-initializing database.');
        parsed = initialSchema;
        writeDatabaseSync(initialSchema);
      }
    }

    // Schema validation and recovery migrations
    let updated = false;
    for (const key of Object.keys(initialSchema) as Array<keyof DatabaseSchema>) {
      if (!parsed[key] || !Array.isArray(parsed[key])) {
        parsed[key] = [] as any;
        updated = true;
      }
    }

    // Seed default data if users array is empty
    if (parsed.users.length === 0) {
      console.log('Seeding initial interactive sample data for Tutor AI...');
      seedDefaultData(parsed);
      updated = true;
    }

    if (updated) {
      writeDatabaseSync(parsed);
    }

    return parsed;
  } catch (err) {
    console.error('Failed to initialize database securely:', err);
    return initialSchema;
  }
}

export function readDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return initializeDatabase();
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    return parsed;
  } catch (err) {
    console.error('Error reading database, resolving securely:', err);
    return initializeDatabase();
  }
}

function writeDatabaseSync(data: DatabaseSchema) {
  try {
    const serialized = JSON.stringify(data, null, 2);
    // Write atomically via temporary file
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, serialized, 'utf8');
    fs.renameSync(tempFile, DB_FILE);

    // Update backup file asynchronously
    fs.writeFile(BACKUP_FILE, serialized, 'utf8', (writeBackErr) => {
      if (writeBackErr) console.error('Failed to update DB backup file:', writeBackErr);
    });
  } catch (err) {
    console.error('Failed to write database synchronously:', err);
  }
}

export async function writeDatabase(data: DatabaseSchema): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request = { data, resolve, reject };
    writeQueue.push(request);
    processWriteQueue();
  });
}

function processWriteQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;

  const current = writeQueue.shift()!;
  try {
    const serialized = JSON.stringify(current.data, null, 2);
    const tempFile = `${DB_FILE}.tmp`;

    fs.writeFile(tempFile, serialized, 'utf8', (err) => {
      if (err) {
        isWriting = false;
        current.reject(err);
        processWriteQueue();
        return;
      }

      fs.rename(tempFile, DB_FILE, (renameErr) => {
        isWriting = false;
        if (renameErr) {
          current.reject(renameErr);
        } else {
          // Backup asynchronously
          fs.writeFile(BACKUP_FILE, serialized, 'utf8', () => {});
          current.resolve(true);
        }
        processWriteQueue();
      });
    });
  } catch (err) {
    isWriting = false;
    current.reject(err);
    processWriteQueue();
  }
}

function seedDefaultData(db: DatabaseSchema) {
  // Seed a sample student
  const sampleUser = {
    id: 'user_student1',
    username: 'alex_student',
    email: 'haarisrafi2006@gmail.com', // Match from session metadata
    createdAt: new Date().toISOString()
  };
  db.users.push(sampleUser);

  // Seed sample subjects
  const subjects = [
    { id: 'subj_cs', userId: 'user_student1', name: 'Computer Science (AI & Robotics)', color: 'emerald', createdAt: new Date().toISOString() },
    { id: 'subj_math', userId: 'user_student1', name: 'Advanced Calculus', color: 'indigo', createdAt: new Date().toISOString() },
    { id: 'subj_physics', userId: 'user_student1', name: 'Quantum Mechanics', color: 'rose', createdAt: new Date().toISOString() }
  ];
  db.subjects.push(...subjects);

  // Seed default notes
  const note1 = {
    id: 'note_ai_intro',
    userId: 'user_student1',
    subjectId: 'subj_cs',
    title: 'Introduction to Generative Models',
    content: 'Generative models learn the underlying probability distribution of data. Large Language Models (LLMs) like Gemini use the Transformer architecture, utilizing self-attention mechanisms to weigh tokens and predict next sequences dynamically. Key parameter properties include temperature (controlling output entropy/randomness), topP (nucleus sampling threshold), and topK constraint.',
    summary: 'Large Language Models (LLMs) find patterns in training data specifically utilizing self-attention mechanisms to produce coherent text output. This note covers foundational concepts including decoding configuration settings like temperature, topP, and topK.',
    vocabulary: [
      { term: 'Transformer Architecture', definition: 'A deep-learning architecture utilizing self-attention mechanisms, designed primarily for sequential natural language processing.' },
      { term: 'Self-Attention', definition: 'A technique that computes correlation scores among tokens, enabling models to relate words regardless of distance.' },
      { term: 'Temperature', definition: 'A hyperparameter that scales candidate token logits, altering output creativity or precision.' }
    ],
    flashcards: [
      { question: 'What architecture do models like Gemini rely on?', answer: 'The Transformer architecture with self-attention algorithms.' },
      { question: 'What does low Temperature configuration produce?', answer: 'Highly deterministic, precise, and less random text selections.' }
    ],
    isPdf: false,
    createdAt: new Date().toISOString()
  };
  db.notes.push(note1);

  // Seed flashcards
  db.flashcards.push(
    { id: 'fc_1', userId: 'user_student1', subjectId: 'subj_cs', noteId: 'note_ai_intro', question: 'What is Generative AI?', answer: 'AI focused on creating new content like text, code, music, or images.', mastery: 'known', createdAt: new Date().toISOString() },
    { id: 'fc_2', userId: 'user_student1', subjectId: 'subj_cs', noteId: 'note_ai_intro', question: 'Explain the role of top-p sampling.', answer: 'It selects from the smallest set of words whose cumulative probability exceeds p.', mastery: 'review', createdAt: new Date().toISOString() },
    { id: 'fc_3', userId: 'user_student1', subjectId: 'subj_math', question: 'State the Fundamental Theorem of Calculus.', answer: 'It connects differentiation and integration, proving that integration is the inverse of differentiation.', mastery: 'unfamiliar', createdAt: new Date().toISOString() }
  );

  // Seed practice exam
  const exam = {
    id: 'exam_ai_basics',
    noteId: 'note_ai_intro',
    subjectId: 'subj_cs',
    title: 'Machine Learning Foundations Quiz',
    difficulty: 'medium' as const,
    questions: [
      {
        id: 'q_1',
        type: 'mcq' as const,
        question: 'Which mechanism is fundamental to the Transformer neural network architecture?',
        options: [
          'Convolution kernels',
          'Self-attention mechanisms',
          'Recurrent feedback loops',
          'Random walk matrices'
        ],
        correctAnswer: 'Self-attention mechanisms'
      },
      {
        id: 'q_2',
        type: 'boolean' as const,
        question: 'Higher temperature scales logits causing responses to become more predictable.',
        correctAnswer: 'False'
      },
      {
        id: 'q_3',
        type: 'short' as const,
        question: 'What term defines neural models generating plausible-sounding but factually incorrect assertions?',
        correctAnswer: 'Hallucination'
      }
    ]
  };
  db.practiceExams.push(exam);

  // Seed initial study plans
  db.studyPlans.push({
    id: 'plan_1',
    userId: 'user_student1',
    title: 'Calculus and AI Mastery Strategy',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  });

  // Seed planner tasks
  db.plannerTasks.push(
    { id: 'task_1', userId: 'user_student1', subjectId: 'subj_cs', title: 'Complete LLM Summary Review', description: 'Read vocab list and memorize key metrics', dueDate: new Date().toISOString().split('T')[0], status: 'pending', createdAt: new Date().toISOString() },
    { id: 'task_2', userId: 'user_student1', subjectId: 'subj_math', title: 'Solve Derivative Set 4', description: 'Page 31 exercises 1-15', dueDate: new Date().toISOString().split('T')[0], status: 'active', createdAt: new Date().toISOString() },
    { id: 'task_3', userId: 'user_student1', subjectId: 'subj_physics', title: 'Read Schrodinger Formula Basics', description: 'Intro to quantum wavefunction notes', dueDate: new Date().toISOString().split('T')[0], status: 'completed', createdAt: new Date().toISOString() }
  );

  // Seed sample scoreboards
  db.quizAttempts.push(
    { id: 'att_1', userId: 'user_student1', examId: 'exam_ai_basics', subjectId: 'subj_cs', title: 'Machine Learning Foundations Quiz', score: 3, totalQuestions: 3, attemptedAt: new Date(Date.now() - 360000).toISOString() },
    { id: 'att_2', userId: 'user_student1', examId: 'exam_ai_basics', subjectId: 'subj_cs', title: 'Machine Learning Foundations Quiz', score: 2, totalQuestions: 3, attemptedAt: new Date(Date.now() - 86400000).toISOString() }
  );

  // Seed interactive logs and welcome notifications
  db.activityLogs.push(
    { id: 'log_1', userId: 'user_student1', action: 'Account created', details: 'Student registered successfully', activityType: 'study', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
    { id: 'log_2', userId: 'user_student1', action: 'Note Created', details: 'Added Study Note regarding Generative Models', activityType: 'note', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'log_3', userId: 'user_student1', action: 'Completed Quiz', details: 'Finished Machine Learning Foundations Quiz with 100% score', activityType: 'quiz', createdAt: new Date(Date.now() - 360000).toISOString() }
  );

  db.notifications.push(
    { id: 'not_1', userId: 'user_student1', title: 'Welcome to Tutor AI!', message: 'Upload notes, extract plain-text from PDFs, ask Gemini intelligent summaries, create cards, and boost your GPA!', read: false, createdAt: new Date().toISOString() }
  );
}
