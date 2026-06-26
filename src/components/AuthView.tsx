import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Sparkles, User, Mail, Lock, ShieldCheck, ArrowRight } from 'lucide-react';

interface AuthViewProps {
  onLogin: (email: string, password: string) => Promise<any>;
  onRegister: (username: string, email: string, password: string) => Promise<any>;
}

export function AuthView({ onLogin, onRegister }: AuthViewProps) {
  const [isLoginTab, setIsLoginTab] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNotice('');
    setIsLoading(true);

    try {
      if (isLoginTab) {
        await onLogin(email, password);
      } else {
        await onRegister(username, email, password);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Credentials authentication failed. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex items-center justify-center p-4 select-none font-sans bg-[#0F1117] relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00C47A]/5 blur-3xl rounded-full"></div>
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-[#181C25] rounded-3xl border border-white/5 p-8 shadow-[0_12px_45px_rgba(0,0,0,0.5)] relative z-10 space-y-6"
      >
        {/* Brand details */}
        <div className="text-center space-y-1">
          <div className="p-3.5 rounded-2xl bg-[#00C47A]/10 text-[#00C47A] w-14 h-14 flex items-center justify-center mx-auto shadow-inner shadow-[0_0_15px_rgba(0,196,122,0.2)]">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-3">Tutor AI</h1>
          <p className="text-xs text-secondary text-[#94A3B8]">Your Intelligent Academic Companion</p>
        </div>

        {/* Dynamic selector triggers tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-[#0F1117] border border-white/5">
          <button
            onClick={() => { setIsLoginTab(true); setErrorNotice(''); }}
            className={`py-2 rounded-lg text-xs font-semibold transition ${isLoginTab ? 'bg-[#00C47A]/10 border border-[#00C47A]/20 text-[#00C47A] shadow-[0_0_15px_rgba(0,196,122,0.15)] font-semibold' : 'text-[#94A3B8] hover:text-white'}`}
          >
            Student Login
          </button>
          <button
            onClick={() => { setIsLoginTab(false); setErrorNotice(''); }}
            className={`py-2 rounded-lg text-xs font-semibold transition ${!isLoginTab ? 'bg-[#00C47A]/10 border border-[#00C47A]/20 text-[#00C47A] shadow-[0_0_15px_rgba(0,196,122,0.15)] font-semibold' : 'text-[#94A3B8] hover:text-white'}`}
          >
            Create Account
          </button>
        </div>

        {/* Error message boxes */}
        {errorNotice && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs text-center font-mono leading-relaxed"
          >
            ⚠️ {errorNotice}
          </motion.div>
        )}

        {/* Forms handling */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {!isLoginTab && (
            <div className="space-y-1 text-left">
              <label className="text-xs text-[#94A3B8] flex items-center gap-1"><User className="w-3.5 h-3.5" /> Student Username</label>
              <input
                type="text"
                required
                placeholder="e.g. Alex"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
              />
            </div>
          )}

          <div className="space-y-1 text-left">
            <label className="text-xs text-[#94A3B8] flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Academic Email Address</label>
            <input
              type="email"
              required
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-xs text-[#94A3B8] flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Account Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 mt-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 shadow-[0_0_20px_rgba(0,196,122,0.25)] hover:shadow-[0_0_25px_rgba(0,196,122,0.4)] disabled:opacity-50 text-white font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? 'Authenticating Credentials...' : isLoginTab ? 'Enter Arena' : 'Setup Profile Directory'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-[10px] font-mono text-center text-gray-500 flex items-center justify-center gap-1 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-450" /> HS256 Encrypted Academic Session
        </div>

      </motion.div>
    </div>
  );
}
