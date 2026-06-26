import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, CheckCircle2, Clock, Trophy, Wifi, WifiOff, RefreshCw, Calendar, ArrowRight, Zap } from 'lucide-react';
import { SocketStatus, WebSocketEvent } from '../hooks/useWebSocketManager';
import { Subject, PlannerTask, ActivityLog, QuizAttempt } from '../types';

interface DashboardViewProps {
  socketStatus: SocketStatus;
  subjects: Subject[];
  tasks: PlannerTask[];
  logs: ActivityLog[];
  attempts: QuizAttempt[];
  onNavigate: (view: string) => void;
  user: { username: string; email: string } | null;
}

export function DashboardView({
  socketStatus,
  subjects,
  tasks,
  logs,
  attempts,
  onNavigate,
  user
}: DashboardViewProps) {
  // Metric Calculations
  const totalHours = 4 + (logs.filter(l => l.activityType === 'study').length * 2) + (attempts.length * 1.5);
  const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
  const completionRate = tasks.length ? Math.round((tasksCompleted / tasks.length) * 100) : 0;
  
  const avgScore = attempts.length
    ? Math.round((attempts.reduce((sum, qa) => sum + (qa.score / qa.totalQuestions), 0) / attempts.length) * 100)
    : 0;

  // Next upcoming tasks sorted
  const pendingTasks = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 rounded-2xl bg-gradient-to-r from-[#181C25] to-[#1F2533] border border-white/5 shadow-2xl overflow-hidden relative">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#00C47A]/5 blur-3xl rounded-full -mr-20 -mt-20"></div>
        
        <div className="space-y-1 relative z-10">
          <span className="text-xs font-mono text-[#00C47A] tracking-wider uppercase font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 animate-pulse" /> Student Portal
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans sm:text-3xl">
            Welcome back, {user?.username || 'Learner'}!
          </h1>
          <p className="text-[#94A3B8] text-sm max-w-xl">
            Your real-time co-pilot is tracking your active academic goals, revision flashcards, and quizzes. Ready to excel today?
          </p>
        </div>


      </div>

      {/* Metrics goals grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'm-hours', label: 'Study Hours', value: `${totalHours.toFixed(1)} hrs`, desc: 'Active reading time', icon: Clock, color: 'text-[#00C47A]', bg: 'bg-emerald-500/5', barColor: 'bg-[#00C47A]', pct: 80 },
          { id: 'm-tasks', label: 'Milestone Rate', value: `${completionRate}%`, desc: `${tasksCompleted}/${tasks.length} tasks done`, icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-500/5', barColor: 'bg-indigo-500', pct: completionRate },
          { id: 'm-score', label: 'Quiz Average', value: `${avgScore}%`, desc: 'Of total answers correct', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/5', barColor: 'bg-amber-500', pct: avgScore },
          { id: 'm-subjects', label: 'Active Curriculums', value: `${subjects.length}`, desc: 'Enrolled study courses', icon: BookOpen, color: 'text-[#00C47A]', bg: 'bg-emerald-500/5', barColor: 'bg-[#00C47A]', pct: (subjects.length / 5) * 100 }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <motion.div
              id={metric.id}
              key={metric.id}
              whileHover={{ y: -3, transition: { duration: 0.15 } }}
              className="p-5 rounded-2xl bg-[#181C25] border border-white/5 hover:border-[#00C47A]/30 shadow-md relative overflow-hidden transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-[#94A3B8] font-sans">{metric.label}</span>
                  <div className="text-2xl font-bold tracking-tight text-white font-mono">{metric.value}</div>
                  <span className="text-xs text-[#94A3B8]">{metric.desc}</span>
                </div>
                <div className={`p-2.5 rounded-xl ${metric.bg} ${metric.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4 h-1.5 bg-[#0F1117] rounded-full overflow-hidden">
                <div className={`h-full ${metric.barColor} rounded-full`} style={{ width: `${Math.max(10, Math.min(100, metric.pct))}%` }}></div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Planner upcoming milestones */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00C47A]" /> Calendar Timeline
            </h2>
            <button
              onClick={() => onNavigate('planner')}
              className="text-xs text-[#00C47A] hover:underline font-mono flex items-center gap-1"
            >
              View Full Planner <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-[#181C25] rounded-2xl border border-white/5 p-5 divide-y divide-white/5 shadow-md">
            {pendingTasks.length > 0 ? (
              pendingTasks.map((t) => {
                const associatedSubject = subjects.find(s => s.id === t.subjectId);
                return (
                  <div key={t.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#0F1117] text-[#94A3B8]">
                          {associatedSubject?.name.split(' ')[0] || 'Academic'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${t.status === 'active' ? 'bg-[#00C47A]/10 text-[#00C47A]' : 'bg-[#94A3B8]/10 text-gray-400'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-200 mt-0.5">{t.title}</p>
                      {t.description && <p className="text-xs text-[#94A3B8]">{t.description}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-[#94A3B8]">Due: {t.dueDate}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[#94A3B8] text-sm space-y-2">
                <p>No pending study tasks are currently scheduled.</p>
                <button
                  onClick={() => onNavigate('planner')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#00C47A]/10 text-[#00C47A] font-mono text-xs hover:bg-[#00C47A]/20"
                >
                  Schedule Initial Milestone
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Activity Feed */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <Wifi className="w-5 h-5 text-[#00C47A]" /> Live Activity Feed
          </h2>

          <div className="bg-[#181C25] rounded-2xl border border-white/5 p-5 shadow-sm overflow-hidden h-[245px] hover:overflow-y-auto custom-scrollbar relative flex flex-col justify-between">
            <div className="space-y-3.5 overflow-hidden">
              {logs.length > 0 ? (
                logs.slice(0, 5).map((l, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={l.id || i}
                    className="flex items-start gap-2.5 text-xs ring-offset-neutral-900 border-l border-[#00C47A]/30 pl-3 py-0.5"
                  >
                    <div className="space-y-0.5 flex-1">
                      <span className="font-mono text-[#94A3B8] text-[10px] block">
                        {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <p className="font-semibold text-gray-200">{l.action}</p>
                      <p className="text-[#94A3B8] text-[11px] leading-relaxed">{l.details}</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12 text-[#94A3B8] text-sm">
                  Active study events appear here in real time.
                </div>
              )}
            </div>
            
            {logs.length > 0 && (
              <div className="text-center pt-2 border-t border-white/5 text-[10px] font-mono text-[#00C47A]">
                ● Listening on ws://localhost:3000/ws
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
