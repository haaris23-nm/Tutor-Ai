export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  content: string;
  summary?: string;
  vocabulary?: { term: string; definition: string }[];
  flashcards?: { question: string; answer: string; mastery?: 'new' | 'learning' | 'mastered' }[];
  isPdf: boolean;
  pdfId?: string;
  isOnline?: boolean;
  source?: 'custom' | 'online' | 'pdf';
  createdAt: string;
}

export interface PDFDocument {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  extractedText?: string;
  noteId?: string;
  uploadedAt: string;
}

export interface Flashcard {
  id: string;
  userId: string;
  subjectId: string;
  noteId?: string;
  question: string;
  answer: string;
  mastery: 'unfamiliar' | 'review' | 'known';
  lastReviewedAt?: string;
  createdAt: string;
}

export interface PracticeExam {
  id: string;
  noteId: string;
  subjectId: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questions: {
    id: string;
    type: 'mcq' | 'boolean' | 'short';
    question: string;
    options?: string[]; // for MCQs
    correctAnswer: string;
  }[];
}

export interface QuizAttempt {
  id: string;
  userId: string;
  examId: string;
  subjectId: string;
  title: string;
  score: number;
  totalQuestions: number;
  attemptedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  accuracy: number;
  attempts: number;
  averageScore: number;
}

export interface StudyPlan {
  id: string;
  userId: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface PlannerTask {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  description?: string;
  dueDate: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  activityType: 'study' | 'quiz' | 'note' | 'planner';
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface DatabaseSchema {
  users: User[];
  subjects: Subject[];
  notes: Note[];
  pdfDocuments: PDFDocument[];
  flashcards: Flashcard[];
  practiceExams: PracticeExam[];
  quizAttempts: QuizAttempt[];
  studyPlans: StudyPlan[];
  plannerTasks: PlannerTask[];
  activityLogs: ActivityLog[];
  notifications: Notification[];
}
