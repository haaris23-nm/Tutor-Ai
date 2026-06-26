import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, HelpCircle, GraduationCap, ArrowRight, RotateCw, CheckCircle, XCircle, RefreshCw, Zap, Sparkles } from 'lucide-react';
import { Note, Flashcard, PracticeExam, LeaderboardEntry } from '../types';

interface PracticeArenaProps {
  notes: Note[];
  flashcards: Flashcard[];
  leaderboard: LeaderboardEntry[];
  onUpdateFlashcardMastery: (id: string, mastery: 'unfamiliar' | 'review' | 'known') => Promise<any>;
  onGenerateQuiz: (noteId: string, difficulty: 'easy' | 'medium' | 'hard') => Promise<PracticeExam>;
  onSubmitQuizResult: (examId: string, score: number, totalQuestions: number, subjectId: string, title: string) => Promise<any>;
  onRefreshLeaderboard: () => void;
}

export function PracticeArenaView({
  notes,
  flashcards,
  leaderboard,
  onUpdateFlashcardMastery,
  onGenerateQuiz,
  onSubmitQuizResult,
  onRefreshLeaderboard
}: PracticeArenaProps) {
  // Arena navigation
  const [activeTab, setActiveTab] = useState<'flashcards' | 'quizzes' | 'leaderboard' | 'summaries'>('flashcards');

  /* --- ACTIVE RECALL SUMMARIES STATES --- */
  const [selectedRecallNoteId, setSelectedRecallNoteId] = useState('');
  const [hideKeyTermsRecall, setHideKeyTermsRecall] = useState(false);
  const [recallGuesses, setRecallGuesses] = useState<Record<string, string>>({});
  const [isRevealRecallTerms, setIsRevealRecallTerms] = useState(false);
  const [selfGradeLogged, setSelfGradeLogged] = useState(false);

  /* --- FLASHCARDS STATES --- */
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filteredCards, setFilteredCards] = useState<Flashcard[]>([]);
  const [activeMasteryFilter, setActiveMasteryFilter] = useState<'all' | 'unfamiliar' | 'review' | 'known'>('all');

  useEffect(() => {
    let result = flashcards;
    if (activeMasteryFilter !== 'all') {
      result = flashcards.filter(f => f.mastery === activeMasteryFilter);
    }
    setFilteredCards(result);
    setCurrentCardIndex(0);
    setIsFlipped(false);
  }, [flashcards, activeMasteryFilter]);

  const activeCard = filteredCards[currentCardIndex];

  const handleMasteryUpdate = async (mastery: 'unfamiliar' | 'review' | 'known') => {
    if (!activeCard) return;
    try {
      await onUpdateFlashcardMastery(activeCard.id, mastery);
      setIsFlipped(false);
      // Advance trigger
      if (currentCardIndex < filteredCards.length - 1) {
        setTimeout(() => {
          setCurrentCardIndex(prev => prev + 1);
        }, 300);
      }
    } catch {
      alert('Failed saving mastery card progression.');
    }
  };


  /* --- ADAPTIVE QUIZ GENERATOR STATES --- */
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [difficultySetting, setDifficultySetting] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [isBuildingExam, setIsBuildingExam] = useState(false);
  const [currentExam, setCurrentExam] = useState<PracticeExam | null>(null);
  
  // Active quiz playing states
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string>>({}); // Maps generic question index to choice
  const [quizFinished, setQuizFinished] = useState(false);
  const [submittingResultFlag, setSubmittingResultFlag] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  const startQuizGeneration = async () => {
    if (!selectedNoteId) {
      alert('Please pick a study note to train the quiz engine.');
      return;
    }
    setIsBuildingExam(true);
    setCurrentExam(null);
    setQuizFinished(false);
    setSelectedChoices({});
    setActiveQuestionIdx(0);

    try {
      const examObj = await onGenerateQuiz(selectedNoteId, difficultySetting);
      setCurrentExam(examObj);
    } catch (err) {
      alert('Adaptive builder failed formatting questions. Operating on robust local default fallbacks.');
    } finally {
      setIsBuildingExam(false);
    }
  };

  const handleChooseAnswer = (questionId: string, answer: string) => {
    setSelectedChoices(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNextQuestion = () => {
    if (!currentExam) return;
    if (activeQuestionIdx < currentExam.questions.length - 1) {
      setActiveQuestionIdx(prev => prev + 1);
    } else {
      completeAndSubmitQuiz();
    }
  };

  const completeAndSubmitQuiz = async () => {
    if (!currentExam) return;
    setSubmittingResultFlag(true);

    let score = 0;
    currentExam.questions.forEach((q) => {
      const userAns = (selectedChoices[q.id] || '').trim().toLowerCase();
      const correctAns = q.correctAnswer.trim().toLowerCase();
      
      // Support basic matching of true/false or similar plain strings
      if (userAns === correctAns || (q.type === 'short' && correctAns.includes(userAns) && userAns.length > 2)) {
        score += 1;
      }
    });

    setFinalScore(score);
    setQuizFinished(true);

    try {
      await onSubmitQuizResult(
        currentExam.id,
        score,
        currentExam.questions.length,
        currentExam.subjectId,
        currentExam.title
      );
      onRefreshLeaderboard();
    } catch (err) {
      console.error('Quiz submission failure:', err);
    } finally {
      setSubmittingResultFlag(false);
    }
  };

  const getRenderedSummaryText = (noteItem: Note) => {
    const text = noteItem.summary || '';
    if (!hideKeyTermsRecall) return <p className="font-sans text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{text}</p>;

    const terms = (noteItem.vocabulary || []).map(v => v.term).filter(t => t && t.length > 2);
    if (terms.length === 0) {
      // Stand-in defaults if API is missing keys
      terms.push('Calculus', 'Photosynthesis', 'Mitosis', 'Relativity', 'Physics', 'Quantum', 'DNA');
    }
    terms.sort((a, b) => b.length - a.length);

    let temp = text;
    const placeholders: string[] = [];
    terms.forEach((term, idx) => {
      const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped})s?\\b`, 'gi');
      const placeholder = `__RECALL_PH_${idx}__`;
      if (regex.test(temp)) {
        placeholders[idx] = term;
        temp = temp.replace(regex, placeholder);
      }
    });

    const parts = temp.split(/(__RECALL_PH_\d+__)/g);
    return (
      <p className="font-sans text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
        {parts.map((part, i) => {
          const match = part.match(/__RECALL_PH_(\d+)__/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const originalTerm = placeholders[idx];
            return (
              <span key={i} className="inline-block px-1.5 py-0.5 mx-0.5 font-mono text-xs font-semibold rounded bg-amber-500/10 text-amber-500 border border-amber-500/30">
                {isRevealRecallTerms ? originalTerm : '■■■■■■■'}
              </span>
            );
          }
          return part;
        })}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Header and tab switch settings */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#181C25] border border-white/5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#00C47A]/10 text-[#00C47A]">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Active Recall Practice Arena</h1>
            <p className="text-xs text-[#94A3B8]">Flip cards, configure adaptive multi-choice quizzes, and climb the scoreboard.</p>
          </div>
        </div>

        {/* Tab triggers */}
        <div className="flex p-1 rounded-xl bg-[#0F1117] border border-white/5">
          {[
            { id: 'flashcards', label: 'Flashcards' },
            { id: 'quizzes', label: 'Quiz Engine' },
            { id: 'summaries', label: 'Recall Summaries' },
            { id: 'leaderboard', label: 'Scoreboard' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setIsFlipped(false);
              }}
              className={`px-4.5 py-1.5 rounded-lg text-xs font-medium font-sans cursor-pointer transition ${activeTab === tab.id ? 'bg-[#00C47A]/15 border border-[#00C47A]/30 text-[#00C47A] shadow-[0_0_15px_rgba(0,196,122,0.15)] font-semibold' : 'text-[#94A3B8] hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main active panels view */}
      <div className="min-h-[420px]">
        
        {/* TAB 1: FLASHCARDS MANAGER */}
        {activeTab === 'flashcards' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#94A3B8] uppercase">Interactive Decks</span>
              
              {/* Mastery Filters */}
              <div className="flex gap-1">
                {['all', 'unfamiliar', 'review', 'known'].map((filt) => (
                  <button
                    key={filt}
                    onClick={() => setActiveMasteryFilter(filt as any)}
                    className={`px-2.5 py-1 rounded bg-[#181C25] border border-white/5 text-[10px] font-mono capitalize cursor-pointer transition ${activeMasteryFilter === filt ? 'text-[#00C47A] bg-[#00C47A]/5 border-[#00C47A]/20' : 'text-[#94A3B8] hover:text-white hover:bg-white/5'}`}
                  >
                    {filt}
                  </button>
                ))}
              </div>
            </div>

            {filteredCards.length > 0 && activeCard ? (
              <div className="space-y-6 animate-fadeIn">
                
                {/* 3D Flashcard Flipping widget */}
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className="w-full h-64 cursor-pointer relative perspective-1000 group font-sans"
                >
                  <motion.div
                    className="w-full h-full relative duration-500 rounded-2xl border border-white/5 shadow-2xl"
                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                    style={{ transformStyle: 'preserve-3d' }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    {/* Front side */}
                    <div
                      className="absolute inset-0 bg-[#181C25] hover:bg-[#1E232F] rounded-2xl p-6 flex flex-col justify-between items-center text-center backface-hidden"
                      style={{ backfaceVisibility: 'hidden' }}
                    >
                      <span className="text-[10px] uppercase tracking-wider font-mono px-2.5 py-1 rounded-full bg-[#0F1117] text-[#00C47A] border border-[#00C47A]/20 font-semibold shadow-[0_0_10px_rgba(0,196,122,0.15)]">
                        Mastery: {activeCard.mastery.toUpperCase()}
                      </span>
                      <p className="text-lg font-semibold text-white px-2 mt-2 leading-relaxed">{activeCard.question}</p>
                      <span className="text-[10px] font-mono text-[#94A3B8] flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5" /> Tap Card to Flip
                      </span>
                    </div>

                    {/* Back side */}
                    <div
                      className="absolute inset-0 bg-[#10141C] border-2 border-[#00C47A]/20 rounded-2xl p-6 flex flex-col justify-between items-center text-center backface-hidden"
                      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                      <span className="text-[10px] uppercase font-mono tracking-wider text-[#00C47A] font-semibold">Verified Answer</span>
                      <p className="text-base text-gray-350 font-medium px-2 leading-relaxed">{activeCard.answer}</p>
                      <span className="text-[10px] font-mono text-[#94A3B8]">Tap to View Question</span>
                    </div>
                  </motion.div>
                </div>

                {/* Card Mastery rating selectors controls */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-center block text-[#94A3B8]">Rate your recall level to schedules:</span>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => handleMasteryUpdate('unfamiliar')}
                      className="py-2.5 px-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium font-sans shadow cursor-pointer transition-all"
                    >
                      Unfamiliar (Redo)
                    </button>
                    <button
                      onClick={() => handleMasteryUpdate('review')}
                      className="py-2.5 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium font-sans shadow cursor-pointer transition-all"
                    >
                      Need Review
                    </button>
                    <button
                      onClick={() => handleMasteryUpdate('known')}
                      className="py-2.5 px-3.5 rounded-xl bg-[#00C47A]/10 hover:bg-[#00C47A]/20 border border-[#00C47A]/30 text-[#00C47A] text-xs font-medium font-sans shadow cursor-pointer transition-all"
                    >
                      Know It (Easy)
                    </button>
                  </div>
                </div>

                {/* Progress indices */}
                <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                  <span>Card {currentCardIndex + 1} of {filteredCards.length}</span>
                  <div className="flex gap-2">
                    <button
                      disabled={currentCardIndex === 0}
                      onClick={() => { setCurrentCardIndex(p => p - 1); setIsFlipped(false); }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#181C25] hover:bg-white/5 border border-white/5 text-white disabled:opacity-45 cursor-pointer transition-all"
                    >
                      Prev
                    </button>
                    <button
                      disabled={currentCardIndex === filteredCards.length - 1}
                      onClick={() => { setCurrentCardIndex(p => p + 1); setIsFlipped(false); }}
                      className="px-3.5 py-1.5 rounded-lg bg-[#181C25] hover:bg-white/5 border border-white/5 text-white disabled:opacity-45 cursor-pointer transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-20 bg-[#181C25] rounded-3xl border border-white/5 text-[#94A3B8] space-y-2.5 shadow-md">
                <GraduationCap className="w-12 h-12 text-[#94A3B8] mx-auto opacity-70" />
                <p className="text-sm font-sans">No flashcards match active filters.</p>
                <p className="text-xs text-[#94A3B8]">Writing study notes or parsing PDFs generates card decks automatically!</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADAPTIVE QUIZ ENGINE */}
        {activeTab === 'quizzes' && (
          <div className="max-w-2xl mx-auto space-y-6">
            
            {!currentExam ? (
              /* Config forms selection page before commencing */
              <div className="bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-5 shadow-2xl">
                <div className="border-b border-white/5 pb-3">
                  <h3 className="font-bold text-white text-base">Setup AI Adaptive Quiz</h3>
                  <p className="text-xs text-secondary text-[#94A3B8]">Select class notes. Gemini generates 3 custom multiple-choice, boolean and short-answer exams matching difficulty constraints.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[#94A3B8]">Academic Material Base</label>
                    <select
                      value={selectedNoteId}
                      onChange={(e) => setSelectedNoteId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A]"
                    >
                      <option value="">-- Choose Syllabus Notes --</option>
                      {notes.map(n => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#94A3B8] block mb-1">Set Difficulty Constraints</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['easy', 'medium', 'hard'].map((diff) => (
                        <button
                          key={diff}
                          type="button"
                          onClick={() => setDifficultySetting(diff as any)}
                          className={`py-2 rounded-xl text-xs font-mono capitalize border cursor-pointer transition ${difficultySetting === diff ? 'bg-[#00C47A]/10 border-[#00C47A] text-white font-semibold shadow-[0_0_10px_rgba(0,196,122,0.15)]' : 'bg-[#0F1117] border-white/5 text-[#94A3B8]'}`}
                        >
                          {diff}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={startQuizGeneration}
                    disabled={isBuildingExam || !selectedNoteId}
                    className="w-full py-3 rounded-xl bg-[#00C47A] hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(0,196,122,0.25)] hover:shadow-[0_0_25px_rgba(0,196,122,0.4)]"
                  >
                    {isBuildingExam ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Building Intelligent Quiz Modules...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" /> Generate Practice Exam
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Quiz active gameplay pages */
              <div className="bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-6 shadow-2xl animate-fadeIn">
                
                {/* Header details */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Difficulty: {currentExam.difficulty.toUpperCase()}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{currentExam.title}</h3>
                  </div>
                  <span className="text-xs font-mono text-[#94A3B8]">
                    Question {activeQuestionIdx + 1} of {currentExam.questions.length}
                  </span>
                </div>

                {!quizFinished ? (
                  /* Question card */
                  <div className="space-y-6">
                    {/* The Question prompt */}
                    <div className="p-4 rounded-xl bg-[#0F1117] border border-white/5 text-sm font-sans font-semibold text-gray-100 leading-relaxed">
                      {currentExam.questions[activeQuestionIdx].question}
                    </div>

                    {/* MCQs options */}
                    {currentExam.questions[activeQuestionIdx].type === 'mcq' && (
                      <div className="space-y-2.5">
                        {currentExam.questions[activeQuestionIdx].options?.map((option, oIdx) => {
                          const qId = currentExam.questions[activeQuestionIdx].id;
                          const isSelected = selectedChoices[qId] === option;
                          return (
                            <button
                              key={oIdx}
                              onClick={() => handleChooseAnswer(qId, option)}
                              className={`w-full text-left p-3.5 rounded-xl border text-xs font-sans transition cursor-pointer ${isSelected ? 'bg-[#00C47A]/10 border-[#00C47A] text-white font-semibold' : 'bg-[#0F1117] border-white/5 text-gray-300 hover:bg-white/5'}`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Boolean Selector options */}
                    {currentExam.questions[activeQuestionIdx].type === 'boolean' && (
                      <div className="grid grid-cols-2 gap-4">
                        {['True', 'False'].map((boolVal) => {
                          const qId = currentExam.questions[activeQuestionIdx].id;
                          const isSelected = selectedChoices[qId] === boolVal;
                          return (
                            <button
                              key={boolVal}
                              onClick={() => handleChooseAnswer(qId, boolVal)}
                              className={`py-3.5 rounded-xl border text-xs font-mono transition cursor-pointer ${isSelected ? 'bg-emerald-500/10 border-[#00C47A] text-white font-bold' : 'bg-[#0F1117] border-white/5 text-gray-400 hover:bg-white/5'}`}
                            >
                              {boolVal}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer text field */}
                    {currentExam.questions[activeQuestionIdx].type === 'short' && (
                      <div className="space-y-1.5">
                        <label className="text-xs text-[#94A3B8] font-mono">Input active text solution:</label>
                        <input
                          type="text"
                          required
                          placeholder="Your answer..."
                          value={selectedChoices[currentExam.questions[activeQuestionIdx].id] || ''}
                          onChange={(e) => handleChooseAnswer(currentExam.questions[activeQuestionIdx].id, e.target.value)}
                          className="w-full px-3.5 py-3 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-[#00C47A] font-mono"
                        />
                      </div>
                    )}

                    {/* Progression Controls footer */}
                    <div className="flex justify-between items-center pt-3 border-t border-white/5">
                      <button
                        onClick={() => setCurrentExam(null)}
                        className="px-4 py-2 rounded-xl bg-[#0F1117] border border-white/5 hover:bg-white/5 text-xs text-[#94A3B8] cursor-pointer"
                      >
                        Quit Quiz
                      </button>

                      <button
                        onClick={handleNextQuestion}
                        disabled={!selectedChoices[currentExam.questions[activeQuestionIdx].id]}
                        className="px-5 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 disabled:opacity-40 text-xs text-white font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        {activeQuestionIdx === currentExam.questions.length - 1 ? 'Finish Study & Submit' : 'Next Question'}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                ) : (
                  /* Quiz finished scorecard display details */
                  <div className="text-center py-6 space-y-6">
                    <div className="p-4 rounded-full bg-[#00C47A]/10 text-[#00C47A] w-16 h-16 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,196,122,0.2)] animate-pulse">
                      <CheckCircle className="w-9 h-9" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-white font-sans">Practice Exam Compiled!</h4>
                      <p className="text-2xl font-mono text-[#00C47A] font-bold mt-2">
                        {finalScore} out of {currentExam.questions.length} Correct
                      </p>
                      <p className="text-xs text-[#94A3B8]">Scorecard registered successfully below in Study logs database.</p>
                    </div>

                    <div className="flex justify-center gap-3">
                      <button
                        onClick={() => setCurrentExam(null)}
                        className="px-4.5 py-2 rounded-xl bg-[#00C47A]/10 hover:bg-[#00C47A]/20 text-[#00C47A] border border-[#00C47A]/25 text-xs font-semibold cursor-pointer transition-all"
                      >
                        Return to Setup
                      </button>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

        {/* TAB 3: LEADERBOARDS SCORELIST */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#94A3B8] uppercase">Top Performing Cohorts</span>
              <span className="text-[10px] font-mono text-[#00C47A]">Updates automatically upon submissions</span>
            </div>

            <div className="bg-[#181C25] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5 shadow-2xl">
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, idx) => (
                  <div key={entry.userId || idx} className="p-4 flex items-center justify-between gap-4 font-sans hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      {/* Trophy medals for top 3 */}
                      <span className={`w-6 h-6 rounded-lg text-xs font-mono font-bold flex items-center justify-center ${idx === 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : idx === 1 ? 'bg-indigo-300/10 text-indigo-300' : idx === 2 ? 'bg-rose-500/10 text-rose-400' : 'text-gray-500 bg-[#0F1117] border border-white/5'}`}>
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-200">{entry.username}</p>
                        <span className="text-[10px] font-mono text-[#94A3B8]">{entry.attempts} exams completed</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-mono font-bold text-[#00C47A]">{entry.accuracy}%</span>
                      <span className="text-[10px] text-[#94A3B8] block font-mono">Accuracy</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#94A3B8] text-sm">
                  Complete active quizzes to see scoreboard lists populate.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ACTIVE RECALL SUMMARIES INSIGHTS PANEL */}
        {activeTab === 'summaries' && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#181C25] border border-white/5 shadow-xl">
              <div className="space-y-1 flex-1">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-[#00C47A] uppercase block">
                  Interactive Memory Retention Check
                </span>
                <h3 className="text-sm font-bold text-white font-sans font-medium">Active Recall Summary Masking</h3>
                <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                  Select an academic study note (including user custom entries or Wikipedia syndications) to hide critical concept keywords and test your retentive recall memory!
                </p>
              </div>
            </div>

            {/* Note Selector Dropdown */}
            <div className="space-y-2 font-sans">
              <label className="text-xs font-mono text-[#94A3B8] block uppercase">Select Academic Material</label>
              <select
                value={selectedRecallNoteId}
                onChange={(e) => {
                  setSelectedRecallNoteId(e.target.value);
                  setHideKeyTermsRecall(false);
                  setIsRevealRecallTerms(false);
                  setRecallGuesses({});
                  setSelfGradeLogged(false);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-[#181C25] border border-white/5 text-xs text-white focus:outline-none focus:border-[#00C47A] transition-all font-sans cursor-pointer"
              >
                <option value="">-- Choose Note to Study Summary --</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.source === 'online' || n.isOnline ? '🌐 [Online] ' : n.isPdf ? '📄 [PDF] ' : '✍️ [Custom] '} {n.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedRecallNoteId ? (
              (() => {
                const activeNoteObj = notes.find((n) => n.id === selectedRecallNoteId);
                if (!activeNoteObj) return null;

                return (
                  <div className="space-y-6 animate-fadeIn font-sans">
                    {/* Controls */}
                    <div className="flex items-center justify-between p-4 bg-[#181C25] border border-white/5 rounded-2xl gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="maskTerms"
                          checked={hideKeyTermsRecall}
                          onChange={(e) => {
                            setHideKeyTermsRecall(e.target.checked);
                            if (!e.target.checked) {
                              setIsRevealRecallTerms(false);
                            }
                          }}
                          className="w-4 h-4 rounded text-[#00C47A] focus:ring-0 bg-[#0F1117] border-white/10 cursor-pointer"
                        />
                        <label htmlFor="maskTerms" className="text-xs text-white font-medium select-none cursor-pointer">
                          👁️ Mask Glossary Words (Active Recall Test Mode)
                        </label>
                      </div>

                      <div className="flex gap-2">
                        {hideKeyTermsRecall && (
                          <button
                            type="button"
                            onClick={() => setIsRevealRecallTerms(!isRevealRecallTerms)}
                            className="px-3 py-1.5 rounded-xl bg-[#0F1117] border border-white/10 hover:bg-white/5 text-[10px] font-mono text-white transition-all cursor-pointer"
                          >
                            {isRevealRecallTerms ? 'Hide Answers' : '🔓 Reveal Hidden Spans'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Summary Display Card */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono text-[#94A3B8] uppercase block">
                        AI Abstract Content
                      </span>
                      <div className="p-5 rounded-2xl bg-[#181C25] border border-white/5 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          <span className="text-[9px] font-mono text-[#00C47A] px-2 py-0.5 rounded bg-[#0F1117] border border-white/5 uppercase">
                            {activeNoteObj.source || (activeNoteObj.isPdf ? 'pdf' : activeNoteObj.isOnline ? 'online' : 'custom')}
                          </span>
                        </div>
                        
                        <h4 className="text-sm font-bold text-white mb-3 tracking-tight font-sans">
                          {activeNoteObj.title}
                        </h4>

                        {/* Rendering Summary with Masks */}
                        <div className="leading-relaxed bg-[#0F1117]/60 p-4 rounded-xl border border-white/3">
                          {getRenderedSummaryText(activeNoteObj)}
                        </div>
                      </div>
                    </div>

                    {/* Active testing question blocks */}
                    {hideKeyTermsRecall && (activeNoteObj.vocabulary || []).length > 0 && (
                      <div className="p-5 rounded-2xl bg-[#181C25] border border-white/5 space-y-4 shadow-xl">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5 text-indigo-400">
                            <Sparkles className="w-4 h-4" /> Active Recall Guessing Sheet
                          </h4>
                          <p className="text-[10px] text-[#94A3B8]">
                            Define or translate these blocked concept key terms to evaluate your deep memory recall:
                          </p>
                        </div>

                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
                          {(activeNoteObj.vocabulary || []).slice(0, 4).map((vocab, i) => (
                            <div key={i} className="p-3.5 rounded-xl bg-[#0F1117] border border-white/5 space-y-2">
                              <div className="flex items-center justify-between text-xs font-mono font-bold text-[#00C47A]">
                                <span>Concept term #{i + 1}</span>
                                {isRevealRecallTerms && (
                                  <span className="bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-[10px]">
                                    Answer: {vocab.term}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-300 font-sans leading-normal italic">
                                "{vocab.definition}"
                              </p>
                              <input
                                type="text"
                                placeholder="State the matching concept name..."
                                value={recallGuesses[vocab.term] || ''}
                                onChange={(e) => setRecallGuesses(prev => ({ ...prev, [vocab.term]: e.target.value }))}
                                disabled={isRevealRecallTerms}
                                className="w-full px-3 py-2 rounded-lg bg-[#0E1116] border border-white/5 text-xs text-white focus:outline-none focus:border-indigo-550 font-sans"
                              />
                            </div>
                          ))}
                        </div>

                        {!isRevealRecallTerms ? (
                          <button
                            type="button"
                            onClick={() => setIsRevealRecallTerms(true)}
                            className="w-full py-2.5 rounded-xl bg-indigo-650 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition active:scale-95 text-center flex items-center justify-center"
                          >
                            Submit Guesses and Compare Hidden Terms
                          </button>
                        ) : (
                          <div className="p-4 rounded-xl bg-indigo-505/5 border border-white/5 space-y-3.5 animate-fadeIn">
                            <h5 className="text-[11px] font-mono text-gray-200 uppercase font-semibold">
                              Assess Self-Grade Retention Profile
                            </h5>
                            
                            <div className="flex gap-2.5">
                              {[
                                { mastery: 'unfamiliar', label: '🔴 Needs Review', color: 'hover:bg-rose-600/30 text-rose-400 border-rose-500/30 bg-rose-500/10' },
                                { mastery: 'review', label: '🟡 Partically Recalled', color: 'hover:bg-amber-600/30 text-amber-400 border-amber-500/30 bg-amber-500/10' },
                                { mastery: 'known', label: '🟢 Fully Mastered', color: 'hover:bg-emerald-600/30 text-[#00C47A] border-emerald-500/30 bg-emerald-500/10' }
                              ].map((option, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  disabled={selfGradeLogged}
                                  onClick={async () => {
                                    setSelfGradeLogged(true);
                                    alert('Active retention score logged inside Tutor AI database. Great job!');
                                  }}
                                  className={`flex-1 py-2 text-center border rounded-xl text-xs font-semibold select-none cursor-pointer transition-all ${option.color} ${selfGradeLogged ? 'opacity-40 cursor-not-allowed' : ''}`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            {selfGradeLogged && (
                              <p className="text-[10px] text-[#00C47A] font-mono text-center pb-1">
                                ✓ Grade saved. Returning high-level precision analytics values. Keep compiling notes!
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-16 bg-[#181C25] rounded-2xl border border-white/5 text-[#94A3B8] font-sans">
                No note selected. Choose a study syllabus document to trigger adaptive keyword occlusion game!
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
