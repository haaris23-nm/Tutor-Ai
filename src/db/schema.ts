import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Users table with Firebase UID
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  username: text('username'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Academic Subject Categories
export const subjects = pgTable('subjects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('indigo'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Study Notes & Research Papers
export const notes = pgTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  summary: text('summary'),
  vocabulary: jsonb('vocabulary'),
  flashcards: jsonb('flashcards'),
  isPdf: boolean('is_pdf').default(false),
  pdfId: text('pdf_id'),
  isOnline: boolean('is_online').default(false),
  source: text('source').default('custom'),
  sourceLabel: text('source_label'),
  sourceUrl: text('source_url'),
  author: text('author'),
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Flashcards Deck
export const flashcards = pgTable('flashcards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  subjectId: text('subject_id').notNull(),
  noteId: text('note_id'),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  mastery: text('mastery').notNull().default('unfamiliar'),
  lastReviewedAt: timestamp('last_reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Study Planner Milestones & Tasks
export const plannerTasks = pgTable('planner_tasks', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueDate: text('due_date').notNull(),
  status: text('status').notNull().default('active'),
  priority: text('priority').notNull().default('medium'),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Activity Logs
export const activityLogs = pgTable('activity_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  activityType: text('activity_type').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Quiz Attempts & Scores
export const quizAttempts = pgTable('quiz_attempts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  examId: text('exam_id').notNull(),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  score: integer('score').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
