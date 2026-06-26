import React from 'react';
import { User, Shield, HelpCircle, HardDrive, KeyRound, Sparkles } from 'lucide-react';

interface SettingsViewProps {
  user: { username: string; email: string } | null;
  onLogout: () => void;
}

export function SettingsView({ user, onLogout }: SettingsViewProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 select-none font-sans text-left">
      
      {/* Settings header */}
      <div className="border-b border-white/5 pb-3">
        <h1 className="text-xl font-bold text-white tracking-tight">Academic Settings & Profiles</h1>
        <p className="text-xs text-[#94A3B8]">View cryptographic keys, examine database directories, and manage your student session.</p>
      </div>

      <div className="bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-6 shadow-2xl animate-fadeIn">
        
        {/* Profile Card */}
        <div className="flex items-center gap-4 border-b border-white/5 pb-5">
          <div className="p-4 rounded-xl bg-[#00C47A]/10 text-[#00C47A] w-14 h-14 flex items-center justify-center border border-[#00C47A]/20">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-sans">{user?.username || 'Alex Student'}</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">{user?.email || 'haarisrafi2006@gmail.com'}</p>
          </div>
        </div>

        <div className="space-y-4">
          
          {/* Section 1: Security Session */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">Security & Access</span>
            <div className="p-4 rounded-xl bg-[#0F1117] border border-white/5 flex justify-between items-center text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-gray-200">Custom JWT Middleware Protected</p>
                <p className="text-[#94A3B8]">Session signs cookie tokens using native HS256 algorithm.</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-[#00C47A]/10 text-[#00C47A] font-mono font-semibold border border-[#00C47A]/20">SECURE</span>
            </div>
          </div>

          {/* Section 2: Database storage details */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">Relational JSON Storage Details</span>
            <div className="p-4 rounded-xl bg-[#0F1117] border border-white/5 space-y-3 text-xs text-[#94A3B8]">
              <div className="flex justify-between">
                <span>Database File</span>
                <span className="font-mono text-gray-200">server_db_json.json</span>
              </div>
              <div className="flex justify-between">
                <span>Backup Schema Cache</span>
                <span className="font-mono text-gray-200">server_db_json.backup.json</span>
              </div>
              <p className="text-[11px] leading-relaxed mt-1 text-[#94A3B8]">
                Database uses atomic temp writer blocks to entirely prevent file serialization corruptions. Schema recovers automatically if attributes fail matches.
              </p>
            </div>
          </div>

          {/* Section 3: AI Co-PILOT references */}
          <div className="space-y-2">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">AI Integration Parameters</span>
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 space-y-3 text-xs">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-300">Model Name Reference</span>
                <span className="font-mono text-indigo-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> gemini-3.5-flash
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#94A3B8] font-sans">
                Google GenAI SDK lazily loads model configurations. If your GEMINI_API_KEY environment credentials are not present, an intelligent local mock fallback engine takes over, ensuring the UI remains active and responsive.
              </p> 
            </div>
          </div>

        </div>

        {/* Clear Exit System Button */}
        <div className="pt-4 border-t border-white/5 flex justify-end">
          <button
            onClick={onLogout}
            className="px-4.5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs transition font-sans cursor-pointer"
          >
            Logout Academic Session
          </button>
        </div>

      </div>

    </div>
  );
}
