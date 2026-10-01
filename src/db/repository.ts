import { db } from './index.ts';
import * as schema from './schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { readDatabase, writeDatabase } from '../../server_db';
import { Subject, Note, Flashcard, PlannerTask, ActivityLog, QuizAttempt, Notification, LeaderboardEntry } from '../types';

export const isCloudSqlActive = (): boolean => {
  return !!process.env.SQL_HOST;
};

/* --- SUBJECTS --- */

export async function fetchSubjects(userId: string): Promise<Subject[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.subjects).where(eq(schema.subjects.userId, userId));
      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        name: r.name,
        color: r.color,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchSubjects failed, checking local store:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.subjects.filter(s => s.userId === userId);
}

export async function insertSubject(subject: Subject): Promise<Subject> {
  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.subjects).values({
        id: subject.id,
        userId: subject.userId,
        name: subject.name,
        color: subject.color,
        createdAt: new Date(subject.createdAt)
      });
    } catch (err) {
      console.warn('Cloud SQL insertSubject failed, using local store:', err);
    }
  }

  const localDb = readDatabase();
  localDb.subjects.push(subject);
  await writeDatabase(localDb);
  return subject;
}

/* --- NOTES --- */

export async function fetchNotes(userId: string): Promise<Note[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.notes).where(eq(schema.notes.userId, userId));
      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        subjectId: r.subjectId,
        title: r.title,
        content: r.content,
        summary: r.summary || undefined,
        vocabulary: (r.vocabulary as any) || undefined,
        flashcards: (r.flashcards as any) || undefined,
        isPdf: !!r.isPdf,
        pdfId: r.pdfId || undefined,
        isOnline: !!r.isOnline,
        source: (r.source as any) || 'custom',
        sourceLabel: r.sourceLabel || undefined,
        sourceUrl: r.sourceUrl || undefined,
        author: r.author || undefined,
        year: r.year || undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchNotes failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.notes.filter(n => n.userId === userId);
}

export async function insertNote(note: Note): Promise<Note> {
  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.notes).values({
        id: note.id,
        userId: note.userId,
        subjectId: note.subjectId,
        title: note.title,
        content: note.content,
        summary: note.summary || null,
        vocabulary: (note.vocabulary as any) || null,
        flashcards: (note.flashcards as any) || null,
        isPdf: !!note.isPdf,
        pdfId: note.pdfId || null,
        isOnline: !!note.isOnline,
        source: note.source || 'custom',
        sourceLabel: note.sourceLabel || null,
        sourceUrl: note.sourceUrl || null,
        author: note.author || null,
        year: note.year ? Number(note.year) : null,
        createdAt: new Date(note.createdAt)
      });
    } catch (err) {
      console.warn('Cloud SQL insertNote failed, using local store:', err);
    }
  }

  const localDb = readDatabase();
  localDb.notes.push(note);
  await writeDatabase(localDb);
  return note;
}

/* --- FLASHCARDS --- */

export async function fetchFlashcards(userId: string): Promise<Flashcard[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.flashcards).where(eq(schema.flashcards.userId, userId));
      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        subjectId: r.subjectId,
        noteId: r.noteId || undefined,
        question: r.question,
        answer: r.answer,
        mastery: (r.mastery as any) || 'unfamiliar',
        lastReviewedAt: r.lastReviewedAt ? new Date(r.lastReviewedAt).toISOString() : undefined,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchFlashcards failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.flashcards.filter(f => f.userId === userId);
}

export async function insertFlashcards(cards: Flashcard[]): Promise<void> {
  if (cards.length === 0) return;

  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.flashcards).values(
        cards.map(c => ({
          id: c.id,
          userId: c.userId,
          subjectId: c.subjectId,
          noteId: c.noteId || null,
          question: c.question,
          answer: c.answer,
          mastery: c.mastery || 'unfamiliar',
          lastReviewedAt: c.lastReviewedAt ? new Date(c.lastReviewedAt) : null,
          createdAt: new Date(c.createdAt)
        }))
      );
    } catch (err) {
      console.warn('Cloud SQL insertFlashcards failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  localDb.flashcards.push(...cards);
  await writeDatabase(localDb);
}

export async function updateFlashcardMasteryRecord(cardId: string, userId: string, mastery: 'unfamiliar' | 'review' | 'known'): Promise<Flashcard | null> {
  if (isCloudSqlActive()) {
    try {
      const updated = await db
        .update(schema.flashcards)
        .set({
          mastery,
          lastReviewedAt: new Date()
        })
        .where(and(eq(schema.flashcards.id, cardId), eq(schema.flashcards.userId, userId)))
        .returning();

      if (updated.length > 0) {
        const r = updated[0];
        return {
          id: r.id,
          userId: r.userId,
          subjectId: r.subjectId,
          noteId: r.noteId || undefined,
          question: r.question,
          answer: r.answer,
          mastery: (r.mastery as any) || 'unfamiliar',
          lastReviewedAt: r.lastReviewedAt ? new Date(r.lastReviewedAt).toISOString() : undefined,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('Cloud SQL updateFlashcardMastery failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  const card = localDb.flashcards.find(f => f.id === cardId && f.userId === userId);
  if (card) {
    card.mastery = mastery;
    card.lastReviewedAt = new Date().toISOString();
    await writeDatabase(localDb);
  }
  return card || null;
}

/* --- PLANNER TASKS --- */

export async function fetchPlannerTasks(userId: string): Promise<PlannerTask[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.plannerTasks).where(eq(schema.plannerTasks.userId, userId));
      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        subjectId: r.subjectId,
        title: r.title,
        description: r.description || undefined,
        dueDate: r.dueDate,
        status: (r.status as any) || 'active',
        priority: (r.priority as any) || 'medium',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchPlannerTasks failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.plannerTasks.filter(t => t.userId === userId);
}

export async function insertPlannerTask(task: PlannerTask): Promise<PlannerTask> {
  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.plannerTasks).values({
        id: task.id,
        userId: task.userId,
        subjectId: task.subjectId,
        title: task.title,
        description: task.description || null,
        dueDate: task.dueDate,
        status: task.status || 'active',
        priority: task.priority || 'medium',
        createdAt: new Date(task.createdAt)
      });
    } catch (err) {
      console.warn('Cloud SQL insertPlannerTask failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  localDb.plannerTasks.push(task);
  await writeDatabase(localDb);
  return task;
}

export async function updatePlannerTaskStatusRecord(taskId: string, userId: string, status: 'active' | 'completed'): Promise<PlannerTask | null> {
  if (isCloudSqlActive()) {
    try {
      const updated = await db
        .update(schema.plannerTasks)
        .set({ status })
        .where(and(eq(schema.plannerTasks.id, taskId), eq(schema.plannerTasks.userId, userId)))
        .returning();

      if (updated.length > 0) {
        const r = updated[0];
        return {
          id: r.id,
          userId: r.userId,
          subjectId: r.subjectId,
          title: r.title,
          description: r.description || undefined,
          dueDate: r.dueDate,
          status: (r.status as any) || 'active',
          priority: (r.priority as any) || 'medium',
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
        };
      }
    } catch (err) {
      console.warn('Cloud SQL updatePlannerTask failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  const task = localDb.plannerTasks.find(t => t.id === taskId && t.userId === userId);
  if (task) {
    task.status = status;
    await writeDatabase(localDb);
  }
  return task || null;
}

/* --- ACTIVITY LOGS --- */

export async function fetchActivityLogs(userId: string): Promise<ActivityLog[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db
        .select()
        .from(schema.activityLogs)
        .where(eq(schema.activityLogs.userId, userId))
        .orderBy(desc(schema.activityLogs.createdAt));

      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        action: r.action,
        details: r.details,
        activityType: (r.activityType as any) || 'study',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchActivityLogs failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.activityLogs.filter(l => l.userId === userId);
}

export async function insertActivityLog(log: ActivityLog): Promise<ActivityLog> {
  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.activityLogs).values({
        id: log.id,
        userId: log.userId,
        action: log.action,
        details: log.details,
        activityType: log.activityType,
        createdAt: new Date(log.createdAt)
      });
    } catch (err) {
      console.warn('Cloud SQL insertActivityLog failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  localDb.activityLogs.push(log);
  await writeDatabase(localDb);
  return log;
}

/* --- QUIZ ATTEMPTS --- */

export async function fetchQuizAttempts(userId: string): Promise<QuizAttempt[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.quizAttempts).where(eq(schema.quizAttempts.userId, userId));
      return records.map(r => {
        const timeStr = r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString();
        return {
          id: r.id,
          userId: r.userId,
          examId: r.examId,
          subjectId: r.subjectId,
          title: r.title,
          score: r.score,
          totalQuestions: r.totalQuestions,
          attemptedAt: timeStr,
          createdAt: timeStr
        };
      });
    } catch (err) {
      console.warn('Cloud SQL fetchQuizAttempts failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.quizAttempts ? localDb.quizAttempts.filter(q => q.userId === userId) : [];
}

export async function insertQuizAttempt(attempt: QuizAttempt): Promise<QuizAttempt> {
  if (isCloudSqlActive()) {
    try {
      const dateVal = attempt.createdAt ? new Date(attempt.createdAt) : (attempt.attemptedAt ? new Date(attempt.attemptedAt) : new Date());
      await db.insert(schema.quizAttempts).values({
        id: attempt.id,
        userId: attempt.userId,
        examId: attempt.examId,
        subjectId: attempt.subjectId,
        title: attempt.title,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        createdAt: dateVal
      });
    } catch (err) {
      console.warn('Cloud SQL insertQuizAttempt failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  if (!localDb.quizAttempts) localDb.quizAttempts = [];
  localDb.quizAttempts.push(attempt);
  await writeDatabase(localDb);
  return attempt;
}

/* --- NOTIFICATIONS --- */

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  if (isCloudSqlActive()) {
    try {
      const records = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId));
      return records.map(r => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        message: r.message,
        read: !!r.read,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString()
      }));
    } catch (err) {
      console.warn('Cloud SQL fetchNotifications failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  return localDb.notifications ? localDb.notifications.filter(n => n.userId === userId) : [];
}

export async function insertNotification(notification: Notification): Promise<Notification> {
  if (isCloudSqlActive()) {
    try {
      await db.insert(schema.notifications).values({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        read: !!notification.read,
        createdAt: new Date(notification.createdAt)
      });
    } catch (err) {
      console.warn('Cloud SQL insertNotification failed, fallback to local:', err);
    }
  }

  const localDb = readDatabase();
  if (!localDb.notifications) localDb.notifications = [];
  localDb.notifications.push(notification);
  await writeDatabase(localDb);
  return notification;
}
