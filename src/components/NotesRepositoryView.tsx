import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderPlus,
  BookOpen,
  FileText,
  Upload,
  Plus,
  Brain,
  Check,
  AlertCircle,
  FileDigit,
  Search,
  Globe,
  RefreshCw,
  ExternalLink,
  Zap,
  Sparkles,
  BookMarked,
  Layers,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Clock,
  User,
  Calendar
} from 'lucide-react';
import { Subject, Note, SearchOnlineResult } from '../types';

interface NotesRepositoryProps {
  subjects: Subject[];
  notes: Note[];
  onCreateSubject: (name: string, color: string) => Promise<any>;
  onCreateNote: (subjectId: string, title: string, content: string) => Promise<any>;
  onUploadPdf: (fileName: string, base64: string, subjectId: string) => Promise<any>;
  onImportOnline: (
    title: string,
    subjectId: string,
    customSubjectName?: string,
    source?: string,
    pageid?: string | number,
    snippet?: string,
    sourceUrl?: string,
    author?: string,
    year?: string | number
  ) => Promise<any>;
  authToken?: string;
  onNavigate?: (view: string) => void;
}

export function NotesRepositoryView({
  subjects,
  notes,
  onCreateSubject,
  onCreateNote,
  onUploadPdf,
  onImportOnline,
  authToken,
  onNavigate
}: NotesRepositoryProps) {
  // Navigation states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeNote, setActiveNote] = useState<Note | null>(null);

  // Source filters states
  const [sourceFilter, setSourceFilter] = useState<'all' | 'custom' | 'online' | 'pdf'>('all');

  // Forms states
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjColor, setNewSubjColor] = useState('indigo');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');

  // Online Notes Search Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [searchSourceTab, setSearchSourceTab] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<SearchOnlineResult[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<SearchOnlineResult | null>(null);
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importCustomSubjectName, setImportCustomSubjectName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [directImportingId, setDirectImportingId] = useState<string | null>(null);
  const [searchErrorMessage, setSearchErrorMessage] = useState('');
  const [searchTiming, setSearchTiming] = useState<{ ms: number; cached: boolean; total: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Upload progress & drag states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; progress: number; status: 'loading' | 'success' | 'error'; errorMsg?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<any>(null);

  // Categorized Quick Topic Presets across disciplines
  const quickCategories = [
    {
      category: 'STEM & Sciences',
      topics: ['Photosynthesis', 'Quantum Mechanics', 'DNA Replication', 'Thermodynamics', 'Organic Chemistry']
    },
    {
      category: 'Computer Science',
      topics: ['Neural Networks', 'Operating Systems', 'Data Structures', 'Cryptography', 'Distributed Systems']
    },
    {
      category: 'Mathematics',
      topics: ['Calculus Integration', 'Linear Algebra', 'Probability Theory', 'Differential Equations']
    },
    {
      category: 'Humanities & Economics',
      topics: ['World War II', 'Renaissance Art', 'Macroeconomics', 'Cognitive Psychology']
    }
  ];

  // Colors dictionary for subjects
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    emerald: 'bg-emerald-500/10 text-[#00C47A] border-emerald-500/30',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
  };

  const getSourceBadge = (source?: string, sourceLabel?: string) => {
    switch (source) {
      case 'wikipedia':
        return { label: sourceLabel || 'Wikipedia', color: 'bg-sky-500/10 text-sky-400 border-sky-500/30' };
      case 'wikibooks':
        return { label: sourceLabel || 'Wikibooks', color: 'bg-emerald-500/10 text-[#00C47A] border-emerald-500/30' };
      case 'wikiversity':
        return { label: sourceLabel || 'Wikiversity Course', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' };
      case 'openlibrary':
        return { label: sourceLabel || 'Open Library Book', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'gutenberg':
        return { label: sourceLabel || 'Gutenberg Classic', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'arxiv':
        return { label: sourceLabel || 'ArXiv Science Paper', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'crossref':
        return { label: sourceLabel || 'Crossref Journal', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
      case 'duckduckgo':
        return { label: sourceLabel || 'Instant Definition', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'ai':
        return { label: sourceLabel || 'AI Study Guide', color: 'bg-violet-500/10 text-violet-300 border-violet-500/30' };
      case 'pdf':
        return { label: 'PDF Document', color: 'bg-emerald-500/10 text-[#00C47A] border-emerald-500/30' };
      default:
        return { label: sourceLabel || 'Online Import', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
    }
  };

  // Online Search Trigger with Caching & Multi-Source
  const handleOnlineSearch = async (e?: React.FormEvent, customQuery?: string, customSource?: string) => {
    if (e) e.preventDefault();
    const queryToUse = customQuery !== undefined ? customQuery : wikiSearchQuery;
    const sourceToUse = customSource !== undefined ? customSource : searchSourceTab;

    if (!queryToUse.trim()) return;
    setIsSearchingOnline(true);
    setSearchErrorMessage('');
    setSelectedArticle(null);

    try {
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const resp = await fetch(`/api/notes/search-online?q=${encodeURIComponent(queryToUse)}&source=${sourceToUse}`, {
        headers,
        credentials: 'include'
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || 'Search query failed to connect to online databases.');
      }

      const data = await resp.json();
      const resultsArray: SearchOnlineResult[] = Array.isArray(data) ? data : (data.results || []);

      setSearchResults(resultsArray);
      if (data.responseTimeMs !== undefined) {
        setSearchTiming({
          ms: data.responseTimeMs,
          cached: !!data.cached,
          total: data.total || resultsArray.length
        });
      }

      if (resultsArray.length > 0) {
        setSelectedArticle(resultsArray[0]);
        if (!importSubjectId && selectedSubjectId) {
          setImportSubjectId(selectedSubjectId);
        }
      }
    } catch (err: any) {
      setSearchErrorMessage(err.message || 'Failed connecting to online study databases.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  // Live search debounced input trigger
  const handleSearchInputChange = (val: string) => {
    setWikiSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (val.trim().length >= 3) {
      searchDebounceRef.current = setTimeout(() => {
        handleOnlineSearch(undefined, val, searchSourceTab);
      }, 350);
    }
  };

  // 1-Click Quick Direct Import
  const handleDirect1ClickImport = async (article: SearchOnlineResult) => {
    setDirectImportingId(article.id);
    setSearchErrorMessage('');

    try {
      // Auto assign target subject if user has one selected, or let server auto-generate
      const targetSub = selectedSubjectId || importSubjectId || 'auto';
      const note = await onImportOnline(
        article.title,
        targetSub,
        undefined,
        article.source,
        article.pageid,
        article.snippet,
        article.sourceUrl,
        article.author,
        article.year
      );

      setToastMessage({
        text: `✨ Successfully imported "${note.title}" with active recall flashcards!`,
        type: 'success'
      });
      setTimeout(() => setToastMessage(null), 4000);

      setActiveNote(note);
      setShowImportModal(false);
      setWikiSearchQuery('');
      setSearchResults([]);
      setSelectedArticle(null);
    } catch (err: any) {
      setSearchErrorMessage(err.message || 'Import failed. Please try again.');
    } finally {
      setDirectImportingId(null);
    }
  };

  // Full detailed import from preview panel
  const handleDetailedImport = async () => {
    if (!selectedArticle) return;

    const finalSubId = importSubjectId || selectedSubjectId || 'auto';
    if (finalSubId === 'custom' && !importCustomSubjectName.trim()) {
      setSearchErrorMessage('Please enter a custom subject name, or select an existing folder.');
      return;
    }

    setIsImporting(true);
    setSearchErrorMessage('');
    try {
      const note = await onImportOnline(
        selectedArticle.title,
        finalSubId,
        finalSubId === 'custom' ? importCustomSubjectName : undefined,
        selectedArticle.source,
        selectedArticle.pageid,
        selectedArticle.snippet,
        selectedArticle.sourceUrl,
        selectedArticle.author,
        selectedArticle.year
      );

      setToastMessage({
        text: `✨ Successfully imported "${note.title}" with AI study summary!`,
        type: 'success'
      });
      setTimeout(() => setToastMessage(null), 4000);

      setActiveNote(note);
      setShowImportModal(false);
      setWikiSearchQuery('');
      setSearchResults([]);
      setSelectedArticle(null);
      setImportSubjectId('');
      setImportCustomSubjectName('');
    } catch (err: any) {
      setSearchErrorMessage(err.message || 'Import failed. Please check your connection.');
    } finally {
      setIsImporting(false);
    }
  };

  // Filter System execution
  let baseFilteredNotes = selectedSubjectId
    ? notes.filter(n => n.subjectId === selectedSubjectId)
    : notes;

  if (sourceFilter === 'custom') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'custom' || (!n.source && !n.isPdf && !n.isOnline));
  } else if (sourceFilter === 'online') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'online' || n.isOnline || (n.source && n.source !== 'custom' && n.source !== 'pdf'));
  } else if (sourceFilter === 'pdf') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'pdf' || n.isPdf);
  }

  const filteredNotes = baseFilteredNotes;
  const currentSubjectObj = subjects.find(s => s.id === selectedSubjectId);

  // Subject and Note Creation Handlers
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    try {
      const resp = await onCreateSubject(newSubjName, newSubjColor);
      setSelectedSubjectId(resp.id);
      setNewSubjName('');
      setShowSubjectModal(false);
    } catch {
      alert('Failed creating new curriculum directory.');
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      alert('Please select or create an academic Subject directory folder first.');
      return;
    }
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;

    try {
      const note = await onCreateNote(selectedSubjectId, newNoteTitle, newNoteContent);
      setActiveNote(note);
      setNewNoteTitle('');
      setNewNoteContent('');
      setShowNoteModal(false);
    } catch {
      alert('Error extracting text summary.');
    }
  };

  // Drag and drop processing
  const processFile = async (file: File) => {
    if (!file || !selectedSubjectId) return;

    const itemIdx = uploadQueue.length;
    setUploadQueue(prev => [...prev, { name: file.name, progress: 20, status: 'loading' }]);

    const progressTimer = setInterval(() => {
      setUploadQueue(prev => {
        const copy = [...prev];
        if (copy[itemIdx] && copy[itemIdx].status === 'loading') {
          copy[itemIdx].progress = Math.min(copy[itemIdx].progress + 20, 85);
        }
        return copy;
      });
    }, 250);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const rawBase64 = (reader.result as string).split(',')[1];
      try {
        const noteResp = await onUploadPdf(file.name, rawBase64, selectedSubjectId);
        clearInterval(progressTimer);
        setUploadQueue(prev => {
          const copy = [...prev];
          if (copy[itemIdx]) {
            copy[itemIdx].progress = 100;
            copy[itemIdx].status = 'success';
          }
          return copy;
        });
        setActiveNote(noteResp);
      } catch (err: any) {
        clearInterval(progressTimer);
        setUploadQueue(prev => {
          const copy = [...prev];
          if (copy[itemIdx]) {
            copy[itemIdx].status = 'error';
            copy[itemIdx].errorMsg = err.message || 'Processing failed';
          }
          return copy;
        });
      }
    };

    reader.onerror = () => {
      clearInterval(progressTimer);
      setUploadQueue(prev => {
        const copy = [...prev];
        if (copy[itemIdx]) {
          copy[itemIdx].status = 'error';
          copy[itemIdx].errorMsg = 'Failed reading file stream.';
        }
        return copy;
      });
    };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] select-none relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-medium flex items-center gap-2 backdrop-blur-md ${
              toastMessage.type === 'success'
                ? 'bg-[#00C47A]/15 border-[#00C47A]/40 text-[#00C47A]'
                : 'bg-rose-500/15 border-rose-500/40 text-rose-400'
            }`}
          >
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left panel: Subjects Curriculum folders */}
      <div className="lg:col-span-1 bg-[#181C25] rounded-2xl border border-white/5 p-4 flex flex-col justify-between overflow-y-auto shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold tracking-wider text-[#94A3B8] uppercase">
              Curriculum Folders
            </span>
            <button
              onClick={() => setShowSubjectModal(true)}
              className="p-1 rounded-lg bg-[#0F1117] border border-white/5 text-[#00C47A] hover:bg-white/5 transition-all cursor-pointer"
              title="Add subject folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              onClick={() => setSelectedSubjectId('')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-sans flex items-center gap-2.5 transition cursor-pointer ${
                !selectedSubjectId
                  ? 'bg-white/5 border-r-2 border-[#00C47A] text-[#00C47A] font-medium'
                  : 'hover:bg-white/5 text-[#94A3B8] hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>All Folders ({notes.length})</span>
            </button>

            {subjects.map((s) => {
              const count = notes.filter(n => n.subjectId === s.id).length;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedSubjectId(s.id);
                    setActiveNote(null);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-sans flex items-center justify-between gap-2 transition cursor-pointer ${
                    selectedSubjectId === s.id
                      ? 'bg-white/5 border-r-2 border-[#00C47A] text-[#00C47A] font-medium'
                      : 'hover:bg-white/5 text-[#94A3B8] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      s.color === 'emerald' ? 'bg-[#00C47A]' : s.color === 'rose' ? 'bg-rose-400' : s.color === 'amber' ? 'bg-amber-400' : s.color === 'purple' ? 'bg-purple-400' : s.color === 'cyan' ? 'bg-cyan-400' : 'bg-indigo-400'
                    }`}></span>
                    <span className="truncate">{s.name}</span>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#0F1117] text-[#94A3B8]">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upload simulated progression tracking queue widgets */}
        {uploadQueue.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/5 space-y-2.5">
            <span className="text-[10px] font-mono uppercase text-[#94A3B8] block">Material Ingestion Queue</span>
            <div className="space-y-2">
              {uploadQueue.slice(-2).map((item, id) => (
                <div key={id} className="p-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-gray-350">
                  <div className="flex items-center justify-between gap-2 gap-y-1 mb-1 font-mono text-[10px]">
                    <span className="truncate">{item.name}</span>
                    {item.status === 'success' && <span className="text-[#00C47A] font-semibold flex items-center gap-0.5"><Check className="w-3 h-3" /> OK</span>}
                    {item.status === 'error' && <span className="text-rose-500 font-semibold flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Error</span>}
                    {item.status === 'loading' && <span className="text-indigo-400 font-semibold animate-pulse">{item.progress}%</span>}
                  </div>
                  <div className="h-1 bg-gray-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-rose-500' : item.status === 'success' ? 'bg-[#00C47A]' : 'bg-indigo-500'}`}
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area: Notes List or Active Note Viewer */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-6 h-full font-sans">
        {activeNote ? (
          /* Active Note AI Metadata & Revision Cards Viewer */
          <div className="md:col-span-5 bg-[#181C25] rounded-2xl border border-white/5 p-6 flex flex-col justify-between overflow-y-auto space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveNote(null)}
                  className="text-xs text-[#00C47A] hover:underline font-mono flex items-center gap-1 cursor-pointer"
                >
                  ← Back to Notes Repository
                </button>
                <h3 className="text-lg font-bold text-white leading-tight">{activeNote.title}</h3>
                
                {/* Meta details: Author, Year, Source */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {activeNote.author && (
                    <span className="text-[11px] font-sans text-gray-400 flex items-center gap-1">
                      <User className="w-3 h-3 text-indigo-400" /> {activeNote.author}
                    </span>
                  )}
                  {activeNote.year && (
                    <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#00C47A]" /> {activeNote.year}
                    </span>
                  )}
                  {activeNote.sourceUrl && (
                    <a
                      href={activeNote.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> View Web Source
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const badge = getSourceBadge(activeNote.source, activeNote.sourceLabel);
                  return (
                    <span className={`text-[10px] font-mono px-2.5 py-1 rounded-lg border font-semibold uppercase tracking-wider ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}

                {onNavigate && (
                  <button
                    onClick={() => onNavigate('practice')}
                    className="px-3 py-1.5 rounded-xl bg-[#00C47A] hover:bg-emerald-600 text-white font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_12px_rgba(0,196,122,0.3)]"
                  >
                    <Zap className="w-3.5 h-3.5" /> Practice Flashcards
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
              {/* Note Content Material */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-[#94A3B8] uppercase flex items-center gap-1">
                    Academic Study Notes & Excerpts
                  </span>
                  <div className="bg-[#0F1117] border border-white/5 p-5 rounded-2xl text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-[380px] overflow-y-auto">
                    {activeNote.content}
                  </div>
                </div>

                {activeNote.summary && (
                  <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1.5">
                    <span className="text-xs font-mono text-[#00C47A] uppercase flex items-center gap-1.5 font-semibold">
                      <Brain className="w-3.5 h-3.5" /> AI Intelligent Abstract Summary
                    </span>
                    <p className="text-xs text-gray-300 leading-relaxed font-sans">{activeNote.summary}</p>
                  </div>
                )}
              </div>

              {/* Vocabulary and Quick Glossary cards on the right */}
              <div className="lg:col-span-1 space-y-4 border-l border-white/5 lg:pl-6">
                <div>
                  <span className="text-xs font-mono text-[#94A3B8] uppercase tracking-wider block mb-2.5">
                    Vocabulary Glossary
                  </span>
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {activeNote.vocabulary && activeNote.vocabulary.length > 0 ? (
                      activeNote.vocabulary.map((vocab, i) => (
                        <div key={i} className="p-3 rounded-xl bg-[#0F1117] border border-white/5 text-xs">
                          <p className="font-mono text-[#00C47A] font-semibold">{vocab.term}</p>
                          <p className="text-[#94A3B8] mt-1 font-sans">{vocab.definition}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-[#94A3B8] text-xs font-sans">
                        Key vocabulary terms will be extracted and saved to your revision deck automatically.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Main Note Repository Grid Listing */
          <>
            <div className="md:col-span-3 space-y-4 h-full overflow-y-auto pr-1">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {currentSubjectObj ? currentSubjectObj.name : 'All Academic Notes'}
                    </h2>
                    <p className="text-xs text-[#94A3B8] font-sans">
                      {filteredNotes.length} notes registered • 8 integrated global online repositories
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Primary Online Notes Search Button */}
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-sans text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.3)] active:scale-95"
                    >
                      <Globe className="w-4 h-4 text-white" />
                      <span>Search Online Notes</span>
                      <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono">8 Sources</span>
                    </button>

                    {selectedSubjectId && (
                      <button
                        onClick={() => setShowNoteModal(true)}
                        className="px-3.5 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 text-white font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,196,122,0.25)]"
                      >
                        <Plus className="w-4 h-4" /> Add Note
                      </button>
                    )}
                  </div>
                </div>

                {/* Notes Filter Options */}
                <div className="flex items-center justify-between border-y border-white/5 py-2">
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-[#94A3B8] uppercase">
                    Filter Source
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'all', label: 'All Notes' },
                      { id: 'online', label: '🌐 Online Imports' },
                      { id: 'custom', label: '✍️ Custom Notes' },
                      { id: 'pdf', label: '📄 PDF Slides' }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setSourceFilter(btn.id as any)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-medium cursor-pointer transition ${
                          sourceFilter === btn.id
                            ? 'text-[#00C47A] bg-[#00C47A]/10 border-[#00C47A]/30 font-semibold'
                            : 'text-[#94A3B8] bg-white/2 border-white/5 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredNotes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  {filteredNotes.map((note) => {
                    const badge = getSourceBadge(note.source, note.sourceLabel);
                    return (
                      <motion.div
                        id={note.id}
                        key={note.id}
                        onClick={() => setActiveNote(note)}
                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                        className="p-4 rounded-xl bg-[#181C25] border border-white/5 hover:border-[#00C47A]/30 cursor-pointer text-left space-y-3 relative group transition-colors shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="p-2 rounded-lg bg-[#0F1117] text-emerald-400 group-hover:text-emerald-300">
                            {note.isPdf ? (
                              <FileDigit className="w-5 h-5 text-emerald-400" />
                            ) : note.source && note.source !== 'custom' ? (
                              <Globe className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <FileText className="w-5 h-5 text-indigo-300" />
                            )}
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className="text-[10px] font-mono text-[#94A3B8]">
                              {new Date(note.createdAt).toLocaleDateString()}
                            </span>
                            <span className={`text-[9px] font-mono font-semibold border px-2 py-0.5 rounded-md mt-1 inline-block uppercase tracking-wider ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-semibold text-gray-150 group-hover:text-white truncate">{note.title}</h4>
                          <p className="text-xs text-[#94A3B8] mt-1 line-clamp-3 leading-relaxed font-sans">{note.content}</p>
                        </div>

                        {note.summary && (
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-[#00C47A]">
                            <span className="flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> AI Summary
                            </span>
                            {note.vocabulary && note.vocabulary.length > 0 && (
                              <span className="text-gray-400">
                                {note.vocabulary.length} Vocab Terms
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16 bg-[#181C25] rounded-2xl border border-white/5 text-[#94A3B8] space-y-3">
                  <p className="text-sm font-sans">No notes in this syllabus view yet.</p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-sans inline-flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Globe className="w-3.5 h-3.5" /> Search Online Notes
                  </button>
                </div>
              )}
            </div>

            {/* Drag and Drop PDF Indexing Panel */}
            <div className="md:col-span-2 h-full">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition duration-200 shadow-xl ${
                  isDragging
                    ? 'border-[#00C47A] bg-[#00C47A]/5'
                    : !selectedSubjectId
                    ? 'border-white/5 bg-[#181C25]/40 opacity-70'
                    : 'border-white/10 bg-[#181C25] hover:border-[#00C47A]/30'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                />
                
                <div className="space-y-4">
                  <div className="p-4 rounded-full bg-[#0F1117] text-[#94A3B8] mx-auto w-16 h-16 flex items-center justify-center border border-white/5">
                    <Upload className="w-7 h-7" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-200">
                      Upload Lecture Notes & PDFs
                    </p>
                    <p className="text-xs text-[#94A3B8] max-w-xs mx-auto leading-relaxed">
                      {selectedSubjectId
                        ? 'Drag and drop your academic PDF notes here, or browse local files.'
                        : 'Select any curriculum folder on the left, or search online notes directly.'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 max-w-xs mx-auto">
                    <button
                      onClick={() => {
                        if (!selectedSubjectId && subjects.length > 0) {
                          setSelectedSubjectId(subjects[0].id);
                        }
                        fileInputRef.current?.click();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs font-mono font-medium tracking-tight text-white transition active:scale-95 cursor-pointer"
                    >
                      Browse PDF Materials
                    </button>

                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-sans font-medium text-indigo-300 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5" /> Or Explore 8 Online Repositories
                    </button>
                  </div>

                  <div className="text-[10px] font-mono text-[#94A3B8] block max-w-xs mx-auto leading-relaxed">
                    Max capacity: <b className="text-gray-300">100MB</b>. Text extracted, vocabulary mapped, active revision cards generated automatically.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 1. Modal: Add Subject Folder */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-[#0F1117]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white font-sans">Create Curriculum Directory</h3>
            <form onSubmit={handleCreateSubject} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8] font-sans">Curriculum / Class Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Calculus, Physics, Genetics..."
                  value={newSubjName}
                  onChange={(e) => setNewSubjName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8] block mb-1 font-sans">Color Palette Badge</label>
                <div className="flex gap-2">
                  {['indigo', 'emerald', 'rose', 'amber', 'purple', 'cyan'].map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewSubjColor(col)}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        col === 'indigo' ? 'bg-indigo-500' : col === 'emerald' ? 'bg-[#00C47A]' : col === 'rose' ? 'bg-rose-500' : col === 'amber' ? 'bg-amber-500' : col === 'purple' ? 'bg-purple-500' : 'bg-cyan-500'
                      } ${newSubjColor === col ? 'border-white' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs text-[#94A3B8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 shadow-[0_0_15px_rgba(0,196,122,0.3)] text-white font-medium text-xs transition cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Modal: Custom Note Creator */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-[#0F1117]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl bg-[#181C25] rounded-2xl border border-white/5 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <h3 className="text-base font-bold text-white">Create Academic Note Entry</h3>
              <p className="text-[10px] font-mono text-[#00C47A]">Subject: {currentSubjectObj?.name}</p>
            </div>
            
            <form onSubmit={handleCreateNote} className="space-y-3.5 font-sans">
              <div className="space-y-1">
                <label className="text-xs text-[#94A3B8]">Class Note Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Unit 3 Neural Nets, Wave mechanics..."
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#94A3B8]">Rich Material / Detailed Text</label>
                  <span className="text-[10px] font-mono text-[#94A3B8]">AI generates summaries and flashcards automatically</span>
                </div>
                <textarea
                  required
                  rows={8}
                  placeholder="Paste research, write explanations, syllabus highlights..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all font-sans resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoteModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs text-[#94A3B8] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 shadow-[0_0_15px_rgba(0,196,122,0.3)] text-white font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5" /> Synthesize AI Summary
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 3. Modal: Search & 1-Click Import Multi-Source Academic Notes */}
      {showImportModal && (
        <div className="fixed inset-0 bg-[#0F1117]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-4xl bg-[#181C25] rounded-3xl border border-white/10 p-5 sm:p-6 space-y-4 shadow-2xl flex flex-col max-h-[92vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-sans flex items-center gap-2">
                    Multi-Source Academic Notes Explorer
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Search across 8 online databases: Wikipedia, Wikiversity, Open Library, ArXiv, Gutenberg, Crossref & AI
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {searchErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchErrorMessage}</span>
              </div>
            )}

            {/* Search Input Bar */}
            <div className="space-y-2.5">
              <form onSubmit={handleOnlineSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Search any study topic, book, formula, or paper... (e.g. Quantum Mechanics, Photosynthesis, Neural Networks)"
                    value={wikiSearchQuery}
                    onChange={(e) => handleSearchInputChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F1117] border border-white/10 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
                  />
                  {wikiSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setWikiSearchQuery('');
                        setSearchResults([]);
                        setSelectedArticle(null);
                        setSearchTiming(null);
                      }}
                      className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearchingOnline}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-sans transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-[0_4px_12px_rgba(99,102,241,0.25)] shrink-0"
                >
                  {isSearchingOnline ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{isSearchingOnline ? 'Searching...' : 'Explore'}</span>
                </button>
              </form>

              {/* Source Filter Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'all', label: 'All Sources (8)' },
                    { id: 'wikipedia', label: 'Wikipedia' },
                    { id: 'wikibooks', label: 'Open Textbooks' },
                    { id: 'openlibrary', label: 'Open Library Books' },
                    { id: 'arxiv', label: 'ArXiv Papers' },
                    { id: 'crossref', label: 'Crossref Journals' },
                    { id: 'gutenberg', label: 'Classics' },
                    { id: 'ai', label: 'AI Study Guide' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSearchSourceTab(tab.id);
                        if (wikiSearchQuery.trim()) {
                          handleOnlineSearch(undefined, wikiSearchQuery, tab.id);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium border transition cursor-pointer ${
                        searchSourceTab === tab.id
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-semibold shadow-sm'
                          : 'bg-white/2 border-white/5 text-[#94A3B8] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Speed & Results Metric Banner */}
                {searchTiming ? (
                  <span className="text-[10px] font-mono text-[#00C47A] flex items-center gap-1 bg-[#00C47A]/10 border border-[#00C47A]/20 px-2 py-0.5 rounded-full">
                    <Zap className="w-3 h-3 animate-pulse" />
                    <span>⚡ {searchTiming.ms}ms response • {searchResults.length} notes</span>
                    {searchTiming.cached && <span className="text-gray-400 font-sans">(Cached)</span>}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#94A3B8]">
                    ⚡ Real-time multi-database search
                  </span>
                )}
              </div>

              {/* Categorized Quick Topic Preset Pills */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">Quick Topics:</span>
                  {quickCategories.flatMap(c => c.topics).map((topic, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setWikiSearchQuery(topic);
                        handleOnlineSearch(undefined, topic, searchSourceTab);
                      }}
                      className="px-2.5 py-1 rounded-full bg-[#0F1117] hover:bg-white/5 border border-white/10 text-[10px] text-gray-300 hover:text-white whitespace-nowrap transition cursor-pointer flex items-center gap-1"
                    >
                      <span>✨</span>
                      <span>{topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Grid & Preview Panel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto">
              
              {/* Left Column: Search Results Cards */}
              <div className="flex flex-col space-y-2 min-h-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold tracking-wider text-[#94A3B8] uppercase">
                    Available Notes & Guides ({searchResults.length})
                  </span>
                  <span className="text-[10px] text-[#94A3B8] font-sans">
                    Click card to preview or ⚡ 1-Click Import
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 bg-[#0F1117]/60 rounded-2xl p-2.5 border border-white/5 max-h-[350px]">
                  {isSearchingOnline ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-[#94A3B8] text-xs gap-3 font-mono">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span>Querying Wikipedia, Wikiversity, Open Library, ArXiv & AI...</span>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((item) => {
                      const badge = getSourceBadge(item.source, item.sourceLabel);
                      const isDirectImporting = directImportingId === item.id;
                      const isSelected = selectedArticle?.id === item.id;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedArticle(item);
                            if (!importSubjectId && selectedSubjectId) {
                              setImportSubjectId(selectedSubjectId);
                            }
                          }}
                          className={`p-3.5 rounded-xl border text-left cursor-pointer transition space-y-2 relative group ${
                            isSelected
                              ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                              : 'bg-[#0F1117] border-white/5 hover:border-white/10 text-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5 text-white">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="line-clamp-1">{item.title}</span>
                            </h4>
                            <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-md border uppercase tracking-wider shrink-0 ${badge.color}`}>
                              {badge.label}
                            </span>
                          </div>

                          <p className="text-[11px] text-[#94A3B8] line-clamp-2 leading-relaxed">
                            {item.snippet}
                          </p>

                          {/* Footer with meta tags and 1-Click Import Button */}
                          <div className="flex items-center justify-between pt-1 border-t border-white/5">
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              {item.author && <span className="truncate max-w-[120px]">👤 {item.author}</span>}
                              {item.year && <span>📅 {item.year}</span>}
                            </div>

                            {/* ⚡ 1-Click Instant Import Button */}
                            <button
                              type="button"
                              disabled={isDirectImporting}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDirect1ClickImport(item);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#00C47A]/15 hover:bg-[#00C47A]/25 border border-[#00C47A]/30 text-[#00C47A] text-[10px] font-semibold font-mono flex items-center gap-1 transition active:scale-95 cursor-pointer"
                            >
                              {isDirectImporting ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Importing...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3" />
                                  <span>1-Click Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-16 text-[#94A3B8] text-xs font-sans space-y-3">
                      <Globe className="w-10 h-10 text-white/10 mx-auto" />
                      <p>Type any academic subject or click one of the quick topics above to explore notes instantly!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Reference Inspector & Target Folder Setup */}
              <div className="flex flex-col space-y-3 justify-between bg-[#0F1117]/50 p-4 border border-white/5 rounded-2xl">
                {selectedArticle ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-indigo-400 uppercase font-semibold">
                          Selected Reference Preview
                        </span>
                        {(() => {
                          const badge = getSourceBadge(selectedArticle.source, selectedArticle.sourceLabel);
                          return (
                            <span className={`text-[9px] font-mono font-semibold border px-2 py-0.5 rounded-full ${badge.color}`}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>

                      <h4 className="text-sm font-bold text-white leading-snug">{selectedArticle.title}</h4>

                      {/* Excerpt */}
                      <p className="text-xs text-gray-300 line-clamp-5 leading-relaxed italic bg-[#0F1117] p-3 rounded-xl border border-white/5">
                        "{selectedArticle.snippet}"
                      </p>

                      {/* Author / Source link */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                        {selectedArticle.author && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-indigo-400" /> {selectedArticle.author}
                          </span>
                        )}
                        {selectedArticle.year && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-[#00C47A]" /> {selectedArticle.year}
                          </span>
                        )}
                        {selectedArticle.sourceUrl && (
                          <a
                            href={selectedArticle.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink className="w-3 h-3" /> View Original Reference
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Target Syllabus Folder Selection */}
                    <div className="space-y-3 pt-2 border-t border-white/5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs text-[#94A3B8] font-sans">Target Curriculum Folder</label>
                          <span className="text-[10px] text-[#00C47A] font-mono">
                            {importSubjectId || selectedSubjectId ? 'Folder Selected' : 'Auto-detected'}
                          </span>
                        </div>
                        <select
                          value={importSubjectId || selectedSubjectId || ''}
                          onChange={(e) => setImportSubjectId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-[#0F1117] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                        >
                          <option value="">⚡ Auto-Detect & Match Curriculum Folder</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              📁 {s.name}
                            </option>
                          ))}
                          <option value="custom">✨ [ Create New Subject Folder Inline ]</option>
                        </select>
                      </div>

                      {importSubjectId === 'custom' && (
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[11px] text-[#94A3B8] block font-sans">New Custom Subject Folder Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Modern Physics, Bioethics, Macroeconomics..."
                            value={importCustomSubjectName}
                            onChange={(e) => setImportCustomSubjectName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-[#0F1117] border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                          />
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      disabled={isImporting}
                      onClick={handleDetailedImport}
                      className="w-full py-2.5 rounded-xl bg-[#00C47A] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-sans transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-[0_4px_15px_rgba(0,196,122,0.3)]"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Syndicating & Generating AI Flashcards...</span>
                        </>
                      ) : (
                        <>
                          <Brain className="w-3.5 h-3.5" />
                          <span>Import Note & Synthesize Study Guide</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] text-xs text-center py-12 px-3 space-y-3">
                    <Globe className="w-10 h-10 text-white/5 animate-pulse" />
                    <p className="font-sans leading-relaxed max-w-xs">
                      Select an online note from the search results to inspect excerpts, configure curriculum folders, or use <b>⚡ 1-Click Add</b>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
