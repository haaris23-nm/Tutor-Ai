import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Plus, CheckCircle2, Clock, Play, RefreshCw, Layers, ListTodo, Sparkles } from 'lucide-react';
import { Subject, PlannerTask } from '../types';

interface PlannerViewProps {
  subjects: Subject[];
  tasks: PlannerTask[];
  onAddTask: (title: string, subjectId: string, description: string, dueDate: string) => Promise<any>;
  onUpdateTaskStatus: (id: string, status: 'pending' | 'active' | 'completed') => Promise<any>;
}

export function PlannerView({
  subjects,
  tasks,
  onAddTask,
  onUpdateTaskStatus
}: PlannerViewProps) {
  // Fields state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubjId, setTaskSubjId] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskDue, setTaskDue] = useState(new Date().toISOString().split('T')[0]);

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSubjId || !taskDue) return;

    try {
      await onAddTask(taskTitle, taskSubjId, taskDesc, taskDue);
      setTaskTitle('');
      setTaskDesc('');
      setShowTaskModal(false);
    } catch {
      alert('Failed saving planner task.');
    }
  };

  // Organize tasks by categories
  const pending = tasks.filter(t => t.status === 'pending');
  const active = tasks.filter(t => t.status === 'active');
  const completed = tasks.filter(t => t.status === 'completed');

  // Multi progress bar properties
  const compPct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const actPct = tasks.length ? Math.round((active.length / tasks.length) * 100) : 0;
  const pendPct = tasks.length ? Math.round((pending.length / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Top Planner progress monitoring bar */}
      <div className="p-6 rounded-2xl bg-[#181C25] border border-white/5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00C47A]" /> Academic Milestones Studio
            </h1>
            <p className="text-xs text-[#94A3B8]">Manage daily syllabus objectives, set due dates and schedule study plans.</p>
          </div>

          <button
            onClick={() => setShowTaskModal(true)}
            className="px-4 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 shadow-[0_0_15px_rgba(0,196,122,0.3)] text-white font-medium text-xs flex items-center gap-1 shrink-0 self-start sm:self-center transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Academic Milestone
          </button>
        </div>

        {/* Dynamic composite bar indicators */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Progress: {completed.length} of {tasks.length} objectives solved</span>
            <span className="text-[#00C47A] font-bold">{compPct}% Completed</span>
          </div>

          <div className="h-2.5 bg-[#0F1117] rounded-full flex overflow-hidden border border-white/5">
            <div className="h-full bg-[#00C47A]" style={{ width: `${compPct}%` }} title={`Completed: ${compPct}%`}></div>
            <div className="h-full bg-[#6366F1]" style={{ width: `${actPct}%` }} title={`Active study: ${actPct}%`}></div>
            <div className="h-full bg-[#1E293B]" style={{ width: `${pendPct}%` }} title={`Pending: ${pendPct}%`}></div>
          </div>

          {/* Color dictionary keys */}
          <div className="flex flex-wrap gap-4 text-[10px] font-mono text-[#94A3B8] pt-1">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#00C47A]"></span> Completed (Solved)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#6366F1]"></span> Active (In Progress)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#1E293B]"></span> Pending (In Queue)</span>
          </div>
        </div>
      </div>

      {/* Structured Columns board grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-270px)] md:overflow-hidden pr-0.5">
        
        {/* COLUMN 1: PENDING */}
        <div className="flex flex-col bg-[#181C25]/45 rounded-2xl border border-white/5 p-4.5 h-full overflow-y-auto shadow-lg animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <span className="text-xs font-mono font-bold text-[#94A3B8] flex items-center gap-1.5">
              <Layers className="w-4 h-4" /> PENDING ({pending.length})
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
            {pending.length > 0 ? (
              pending.map((t) => (
                <TaskCard key={t.id} task={t} subjects={subjects} onMove={(status) => onUpdateTaskStatus(t.id, status)} />
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs">No pending tasks. Keep adding milestones!</div>
            )}
          </div>
        </div>

        {/* COLUMN 2: ACTIVE */}
        <div className="flex flex-col bg-[#181C25]/45 rounded-2xl border border-white/5 p-4.5 h-full overflow-y-auto shadow-lg animate-fadeIn" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <span className="text-xs font-mono font-bold text-indigo-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> ACTIVE STUDY ({active.length})
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
            {active.length > 0 ? (
              active.map((t) => (
                <TaskCard key={t.id} task={t} subjects={subjects} onMove={(status) => onUpdateTaskStatus(t.id, status)} />
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs">No active study sets. Shift cards to begin.</div>
            )}
          </div>
        </div>

        {/* COLUMN 3: COMPLETED */}
        <div className="flex flex-col bg-[#181C25]/45 rounded-2xl border border-[#00C47A]/15 p-4.5 h-full overflow-y-auto shadow-lg animate-fadeIn" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <span className="text-xs font-mono font-bold text-[#00C47A] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> COMPLETED ({completed.length})
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
            {completed.length > 0 ? (
              completed.map((t) => (
                <TaskCard key={t.id} task={t} subjects={subjects} onMove={(status) => onUpdateTaskStatus(t.id, status)} />
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 text-xs">Complete active tasks to achieve your daily milestones.</div>
            )}
          </div>
        </div>

      </div>

      {/* Modal: Create new planner milestone task card */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-[#0F1117]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="w-full max-w-md bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white font-sans flex items-center gap-1">Add Academic Milestone</h3>
            <form onSubmit={handleAddTaskSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8]">Objective Milestone Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Finish Calculus Derivative Set, Read DNA papers..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8]">Related Syllabus Subject</label>
                <select
                  required
                  value={taskSubjId}
                  onChange={(e) => setTaskSubjId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all"
                >
                  <option value="">-- Choose Subject Folder --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8]">Short Details (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Solve page 4 exercises, memorise vocab terminology list, etc..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all resize-none font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8]">Goal Due Date</label>
                <input
                  type="date"
                  required
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-mono"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs text-[#94A3B8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C47A] hover:bg-[#00B06B] shadow-[0_0_15px_rgba(0,196,122,0.3)] text-white font-medium text-xs flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Schedule Task
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}

/* --- Internal Task Card component matching Twilight Minimalism --- */
function TaskCard({
  task,
  subjects,
  onMove
}: {
  key?: string | number;
  task: PlannerTask;
  subjects: Subject[];
  onMove: (status: 'pending' | 'active' | 'completed') => void | Promise<any>;
}) {
  const associatedSubject = subjects.find(s => s.id === task.subjectId);

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.01 }}
      className="p-4 rounded-xl bg-[#181C25] border border-white/5 font-sans shadow hover:border-white/10 text-left space-y-2.5 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-mono font-semibold px-2 py-0.5 rounded bg-[#0F1117] text-[#00C47A] border border-[#00C47A]/15">
          {associatedSubject?.name.split(' ')[0] || 'Academic'}
        </span>
        <span className="text-[10px] font-mono text-[#94A3B8]">{task.dueDate}</span>
      </div>

      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-white leading-snug">{task.title}</p>
        <p className="text-xs text-[#94A3B8] font-normal line-clamp-3">{task.description}</p>
      </div>

      {/* Shifting column connectors controls */}
      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/5">
        {task.status !== 'pending' && (
          <button
            onClick={() => onMove('pending')}
            className="p-1 px-2 rounded-md bg-[#0F1117] hover:bg-white/5 border border-white/5 text-[10px] text-[#94A3B8] font-mono flex items-center gap-1 cursor-pointer transition-colors"
            title="Move to Pending"
          >
            Queue
          </button>
        )}
        {task.status !== 'active' && (
          <button
            onClick={() => onMove('active')}
            className="p-1 px-2 rounded-md bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/20 text-[10px] text-indigo-400 font-mono flex items-center gap-1 cursor-pointer transition-colors"
            title="Start Study Task"
          >
            <Play className="w-2.5 h-2.5" /> Study
          </button>
        )}
        {task.status !== 'completed' && (
          <button
            onClick={() => onMove('completed')}
            className="p-1 px-2 rounded-md bg-[#00C47A]/10 hover:bg-[#00C47A]/25 border border-[#00C47A]/20 text-[10px] text-[#00C47A] font-mono flex items-center gap-1 cursor-pointer transition-colors"
            title="Mark Goal Solved"
          >
            <CheckCircle2 className="w-2.5 h-2.5" /> Solved
          </button>
        )}
      </div>
    </motion.div>
  );
}
