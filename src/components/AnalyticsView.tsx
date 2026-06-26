import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';
import { Sparkles, Brain, Loader2, Trophy, Clock, CheckCircle, ChevronRight } from 'lucide-react';

interface AnalyticsViewProps {
  onFetchRecommendations: () => Promise<{ recommendations: string }>;
}

export function AnalyticsView({ onFetchRecommendations }: AnalyticsViewProps) {
  const [recommendations, setRecommendations] = useState('');
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);

  // Default rich, interactive charts mock dataset to paint gorgeous canvases
  const studyHoursData = [
    { day: 'Mon', 'Study Hours': 2.4, 'Target': 3.0 },
    { day: 'Tue', 'Study Hours': 3.8, 'Target': 3.0 },
    { day: 'Wed', 'Study Hours': 1.5, 'Target': 3.0 },
    { day: 'Thu', 'Study Hours': 4.2, 'Target': 3.0 },
    { day: 'Fri', 'Study Hours': 3.0, 'Target': 3.0 },
    { day: 'Sat', 'Study Hours': 5.5, 'Target': 4.0 },
    { day: 'Sun', 'Study Hours': 2.0, 'Target': 4.0 }
  ];

  const quizPerformanceData = [
    { name: 'ML Basics', score: 66, average: 75 },
    { name: 'Calc Limits', score: 80, average: 75 },
    { name: 'Quantum Wave', score: 100, average: 75 },
    { name: 'AI Transformers', score: 90, average: 80 }
  ];

  const subjectMasteryData = [
    { name: 'Calculus', uv: 85, fill: '#8884d8' },
    { name: 'Physics', uv: 60, fill: '#83a6ed' },
    { name: 'AI & Robotics', uv: 95, fill: '#00C47A' },
    { name: 'Genetics', uv: 45, fill: '#ffc658' }
  ];

  const fetchAIHelp = async () => {
    setLoadingRecommendations(true);
    setRecommendations('');
    try {
      const resp = await onFetchRecommendations();
      setRecommendations(resp.recommendations || 'Generate high quality recommendations.');
    } catch {
      setRecommendations('Failed loading recommendation prompt parameters. Verify settings secrets.');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Trigger load on entry
  useEffect(() => {
    fetchAIHelp();
  }, []);

  return (
    <div className="space-y-6 select-none font-sans">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-[#181C25] border border-white/5 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#00C47A] shadow-[0_0_10px_rgba(0,196,122,0.3)]" /> Academic Performance Analytics
          </h1>
          <p className="text-xs text-[#94A3B8]">Review learning curves, quiz accuracy logs, and Gemini study tips.</p>
        </div>

        <button
          onClick={fetchAIHelp}
          disabled={loadingRecommendations}
          className="px-4 py-2 rounded-xl bg-[#00C47A]/10 hover:bg-[#00C47A]/20 text-[#00C47A] border border-[#00C47A]/20 font-mono text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 shrink-0 self-start md:self-center"
        >
          {loadingRecommendations ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
          Re-Analyze Progress
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Analytics charts grid column */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Chart 1: Study hours curves */}
          <div className="p-5 rounded-2xl bg-[#181C25] border border-white/5 hover:border-[#00C47A]/20 transition-all space-y-4 shadow-xl">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">Daily Study Trends vs Targets</span>
            <div className="h-64 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studyHoursData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradientHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C47A" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#00C47A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242A38" vertical={false} />
                  <XAxis dataKey="day" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#181C25', borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Area type="monotone" dataKey="Study Hours" stroke="#00C47A" strokeWidth={2} fillOpacity={1} fill="url(#gradientHours)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Quiz grades metrics */}
          <div className="p-5 rounded-2xl bg-[#181C25] border border-white/5 hover:border-[#00C47A]/20 transition-all space-y-4 shadow-xl">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">Quiz Performance Tracker</span>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quizPerformanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#242A38" vertical={false} />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#181C25', borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Bar dataKey="score" fill="#00C47A" radius={[4, 4, 0, 0]} barSize={28} className="opacity-90 hover:opacity-100 transition-opacity" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Gemini intelligent recommendations on the right */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card: Subject Mastery distribution */}
          <div className="p-5 rounded-2xl bg-[#181C25] border border-white/5 space-y-4 shadow-xl">
            <span className="text-xs font-mono font-bold text-[#94A3B8] uppercase tracking-wider block">Relative Subject Mastery (%)</span>
            <div className="space-y-3 pt-1">
              {subjectMasteryData.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-medium">{item.name}</span>
                    <span className="font-mono text-[#00C47A] font-bold">{item.uv}%</span>
                  </div>
                  <div className="h-2 bg-[#0F1117] rounded-full overflow-hidden">
                    <div className="h-full bg-[#00C47A] rounded-full shadow-[0_0_10px_rgba(0,196,122,0.5)]" style={{ width: `${item.uv}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: AI recommendation board markdown block */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#132A22]/20 to-[#181C25] border border-[#00C47A]/15 space-y-4 flex flex-col h-[320px] justify-between overflow-hidden shadow-2xl">
            <div className="space-y-1.5 shrink-0 border-b border-white/5 pb-2">
              <span className="text-xs font-mono font-bold text-[#00C47A] uppercase flex items-center gap-1.5">
                <Brain className="w-4 h-4 animate-pulse" /> Gemini Smart AI Recommendations
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pt-2.5 space-y-2.5 text-xs text-gray-300 font-sans custom-scrollbar">
              {loadingRecommendations ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-16 h-full text-gray-400 font-mono">
                  <Loader2 className="w-8 h-8 text-[#00C47A] animate-spin" />
                  <span>Parsing Academic Logs...</span>
                </div>
              ) : recommendations ? (
                <div className="whitespace-pre-wrap leading-relaxed font-sans prose prose-invert prose-xs">
                  {recommendations}
                </div>
              ) : (
                <div className="text-center py-12 text-[#94A3B8] font-sans">
                  Tap 'Re-Analyze Progress' to prompt your cognitive co-pilot.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/5 shrink-0 text-[10px] font-mono text-[#94A3B8] flex items-center justify-between">
              <span>Model ID: gemini-3.5-flash</span>
              <span className="text-[#00C47A] font-semibold flex items-center gap-0.5">Verified co-pilot <ChevronRight className="w-3 h-3" /></span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
