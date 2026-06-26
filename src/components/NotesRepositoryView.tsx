import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderPlus, BookOpen, FileText, Upload, Plus, Brain, Check, AlertCircle, FileDigit, HelpCircle, Search, Globe, RefreshCw } from 'lucide-react';
import { Subject, Note } from '../types';

interface NotesRepositoryProps {
  subjects: Subject[];
  notes: Note[];
  onCreateSubject: (name: string, color: string) => Promise<any>;
  onCreateNote: (subjectId: string, title: string, content: string) => Promise<any>;
  onUploadPdf: (fileName: string, base64: string, subjectId: string) => Promise<any>;
  onImportOnline: (title: string, subjectId: string, customSubjectName?: string) => Promise<any>;
}

export function NotesRepositoryView({
  subjects,
  notes,
  onCreateSubject,
  onCreateNote,
  onUploadPdf,
  onImportOnline
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

  // Wikipedia Search Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [wikiSearchQuery, setWikiSearchQuery] = useState('');
  const [wikiSearchResults, setWikiSearchResults] = useState<{ title: string; snippet: string; pageid: number }[]>([]);
  const [isSearchingWiki, setIsSearchingWiki] = useState(false);
  const [selectedWikiArticle, setSelectedWikiArticle] = useState<{ title: string; snippet: string } | null>(null);
  const [importSubjectId, setImportSubjectId] = useState('');
  const [importCustomSubjectName, setImportCustomSubjectName] = useState('');
  const [isImportingWiki, setIsImportingWiki] = useState(false);
  const [wikiErrorMessage, setWikiErrorMessage] = useState('');

  // Upload progress states
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ name: string; progress: number; status: 'loading' | 'success' | 'error'; errorMsg?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWikiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wikiSearchQuery.trim()) return;
    setIsSearchingWiki(true);
    setWikiErrorMessage('');
    setWikiSearchResults([]);
    setSelectedWikiArticle(null);
    try {
      const resp = await fetch(`/api/notes/search-online?q=${encodeURIComponent(wikiSearchQuery)}`);
      if (!resp.ok) {
        throw new Error('Wikipedia search query failed to resolve.');
      }
      const data = await resp.json();
      setWikiSearchResults(data);
    } catch (err: any) {
      setWikiErrorMessage(err.message || 'Failed connecting to Wikipedia database.');
    } finally {
      setIsSearchingWiki(false);
    }
  };

  const handleWikiImport = async () => {
    if (!selectedWikiArticle) return;
    
    // Default import subject color or create custom
    const finalSubId = importSubjectId || selectedSubjectId;
    if (!finalSubId) {
      alert('Please pick an Academic Subject directory, or enter a custom subject name.');
      return;
    }
    if (finalSubId === 'custom' && !importCustomSubjectName.trim()) {
      alert('Please insert a valid custom subject directory name.');
      return;
    }

    setIsImportingWiki(true);
    setWikiErrorMessage('');
    try {
      const note = await onImportOnline(
        selectedWikiArticle.title,
        finalSubId,
        finalSubId === 'custom' ? importCustomSubjectName : undefined
      );
      
      // Update active note details to focus user immediately
      setActiveNote(note);
      setShowImportModal(false);
      
      // Clear input fields
      setWikiSearchQuery('');
      setWikiSearchResults([]);
      setSelectedWikiArticle(null);
      setImportSubjectId('');
      setImportCustomSubjectName('');
    } catch (err: any) {
      setWikiErrorMessage(err.message || 'Wikipedia import or AI analysis crashed. Verify your keys.');
    } finally {
      setIsImportingWiki(false);
    }
  };

  // Filter System execution
  let baseFilteredNotes = selectedSubjectId
    ? notes.filter(n => n.subjectId === selectedSubjectId)
    : notes;

  if (sourceFilter === 'custom') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'custom' || (!n.source && !n.isPdf));
  } else if (sourceFilter === 'online') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'online' || n.isOnline);
  } else if (sourceFilter === 'pdf') {
    baseFilteredNotes = baseFilteredNotes.filter(n => n.source === 'pdf' || n.isPdf);
  }

  const filteredNotes = baseFilteredNotes;

  const currentSubjectObj = subjects.find(s => s.id === selectedSubjectId);

  // Colors dictionary
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    emerald: 'bg-emerald-500/10 text-[#00C47A] border-emerald-500/30',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjName.trim()) return;
    try {
      const resp = await onCreateSubject(newSubjName, newSubjColor);
      setSelectedSubjectId(resp.id);
      setNewSubjName('');
      setShowSubjectModal(false);
    } catch (err) {
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
    } catch (err) {
      alert('Error extracting text summary.');
    }
  };

  // Convert & Process PDF files safely
  const processFile = async (file: File) => {
    if (!selectedSubjectId) {
      alert('Select an academic subject folder on the left before dragging items.');
      return;
    }

    if (file.type !== 'application/pdf') {
      alert('Only standard PDF file documents are supported in the Notes Repository.');
      return;
    }

    // Capacity Validation checks (100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert('Document size exceeds the extreme limit constraint of 100MB.');
      return;
    }

    const itemIdx = uploadQueue.length;
    const queueItem = { name: file.name, progress: 10, status: 'loading' as const };
    setUploadQueue(prev => [...prev, queueItem]);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    // Simulate dynamic progress bar increments
    const progressTimer = setInterval(() => {
      setUploadQueue(prev => {
        const copy = [...prev];
        if (copy[itemIdx] && copy[itemIdx].progress < 85) {
          copy[itemIdx].progress += 15;
        }
        return copy;
      });
    }, 400);

    reader.onload = async () => {
      try {
        const base64Str = (reader.result as string).split(',')[1];
        
        // Upload to server Express API
        const noteResp = await onUploadPdf(file.name, base64Str, selectedSubjectId);
        
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
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] select-none">
      
      {/* Subjects folders panel */}
      <div className="lg:col-span-1 bg-[#181C25] rounded-2xl border border-white/5 p-4 flex flex-col justify-between overflow-y-auto shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold tracking-wider text-[#94A3B8] uppercase">
              Curriculum Folder
            </span>
            <button
              onClick={() => setShowSubjectModal(true)}
              className="p-1 rounded bg-[#0F1117] border border-white/5 text-[#00C47A] hover:bg-white/5 transition-all"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => setSelectedSubjectId('')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-sans flex items-center gap-2.5 transition cursor-pointer ${!selectedSubjectId ? 'bg-white/5 border-r-2 border-[#00C47A] text-[#00C47A] font-medium' : 'hover:bg-white/5 text-[#94A3B8] hover:text-white'}`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>All Subjects ({notes.length})</span>
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
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-sans flex items-center justify-between gap-2 transition cursor-pointer ${selectedSubjectId === s.id ? 'bg-white/5 border-r-2 border-[#00C47A] text-[#00C47A] font-medium' : 'hover:bg-white/5 text-[#94A3B8] hover:text-white'}`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${s.color === 'emerald' ? 'bg-[#00C47A]' : s.color === 'rose' ? 'bg-rose-400' : s.color === 'math' || s.color === 'indigo' ? 'bg-indigo-400' : 'bg-amber-400'}`}></span>
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
                    <div className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-rose-500' : item.status === 'success' ? 'bg-[#00C47A]' : 'bg-indigo-500'}`} style={{ width: `${item.progress}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main files grid list or active note panel */}
      <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-5 gap-6 h-full font-sans">
        {activeNote ? (
          /* Active Note AI Metadata & revision cards viewer panels */
          <div className="md:col-span-5 bg-[#181C25] rounded-2xl border border-white/5 p-6 flex flex-col justify-between overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveNote(null)}
                  className="text-xs text-[#00C47A] hover:underline font-mono"
                >
                  ← Back to Note Repository
                </button>
                <h3 className="text-lg font-bold text-white leading-tight">{activeNote.title}</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#0F1117] text-[#00C47A]">
                  {activeNote.isPdf ? 'PDF Notes Material' : 'Written Notes'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
              {/* Actual body details */}
              <div className="lg:col-span-2 space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-mono text-[#94A3B8] uppercase flex items-center gap-1">Notes Data Material</span>
                  <div className="bg-[#0F1117] border border-white/5 p-5 rounded-2xl text-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-sans max-h-[350px] overflow-y-auto">
                    {activeNote.content}
                  </div>
                </div>

                {activeNote.summary && (
                  <div className="p-4 rounded-xl bg-indigo-505/5 border border-white/5 space-y-1.5">
                    <span className="text-xs font-mono text-[#00C47A] uppercase flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" /> AI Intelligent Abstract Summary
                    </span>
                    <p className="text-xs text-[#94A3B8] leading-relaxed font-sans">{activeNote.summary}</p>
                  </div>
                )}
              </div>

              {/* Vocabulary and Quick Glossary cards on the right */}
              <div className="lg:col-span-1 space-y-4 border-l border-white/5 lg:pl-6">
                <div>
                  <span className="text-xs font-mono text-[#94A3B8] uppercase tracking-wider block mb-2.5">Vocabulary Dictionary</span>
                  <div className="space-y-2.5">
                    {activeNote.vocabulary && activeNote.vocabulary.length > 0 ? (
                      activeNote.vocabulary.map((vocab, i) => (
                        <div key={i} className="p-3 rounded-xl bg-[#0F1117] border border-white/5 text-xs">
                          <p className="font-mono text-[#00C47A] font-semibold">{vocab.term}</p>
                          <p className="text-[#94A3B8] mt-1 font-sans">{vocab.definition}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-[#94A3B8] text-xs font-sans">
                        Open settings secrets and verify GEMINI_API_KEY to generate term glossaries automatically.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Main Note Repository grid listing with PDF dragging block triggers */
          <>
            <div className="md:col-span-3 space-y-4 h-full overflow-y-auto pr-1">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {currentSubjectObj ? currentSubjectObj.name : 'Notes Repository'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {/* Wikipedia online integration search trigger */}
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-sans text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
                    >
                      <Globe className="w-3.5 h-3.5" /> Search & Import Online Notes
                    </button>
                    {selectedSubjectId && (
                      <button
                        onClick={() => setShowNoteModal(true)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#00C47A] hover:bg-emerald-600 text-white font-sans text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-[0_4px_12px_rgba(0,196,122,0.2)]"
                      >
                        <Plus className="w-4 h-4" /> Add Academic Note
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
                      { id: 'all', label: 'All notes' },
                      { id: 'custom', label: 'My Custom Notes' },
                      { id: 'online', label: 'Online Imports' },
                      { id: 'pdf', label: 'PDF Uploads' }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => setSourceFilter(btn.id as any)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-medium cursor-pointer transition ${sourceFilter === btn.id ? 'text-[#00C47A] bg-[#00C47A]/10 border-[#00C47A]/30 font-semibold' : 'text-[#94A3B8] bg-white/2 border-white/5 hover:text-white hover:bg-white/5'}`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredNotes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  {filteredNotes.map((note) => (
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
                          ) : note.source === 'online' || note.isOnline ? (
                            <Globe className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <FileText className="w-5 h-5 text-indigo-300" />
                          )}
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-[10px] font-mono text-[#94A3B8]">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[9px] font-mono font-semibold text-[#00C47A] border border-white/5 px-2 py-0.5 rounded-md bg-[#0F1117] mt-1 inline-block uppercase tracking-wider">
                            {note.source || (note.isPdf ? 'pdf' : note.isOnline ? 'online' : 'custom')}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-semibold text-gray-150 group-hover:text-white truncate">{note.title}</h4>
                        <p className="text-xs text-[#94A3B8] mt-1 line-clamp-3 leading-relaxed font-sans">{note.content}</p>
                      </div>

                      {note.summary && (
                        <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-[#00C47A] font-mono">
                          <Check className="w-3.5 h-3.5" /> AI Summary Attached
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-[#181C25] rounded-2xl border border-white/5 text-[#94A3B8] space-y-3">
                  <p className="text-sm font-sans">No notes have been registered inside this syllabus directory yet.</p>
                  {!selectedSubjectId && <p className="text-xs text-[#94A3B8] font-sans">Select an Academic Subject directory folder to add files!</p>}
                </div>
              )}
            </div>

            {/* Drag and drop indexing area panel */}
            <div className="md:col-span-2 h-full">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center transition duration-200 shadow-xl ${isDragging ? 'border-[#00C47A] bg-[#00C47A]/5' : !selectedSubjectId ? 'border-white/5 bg-[#181C25]/40 opacity-70 cursor-not-allowed' : 'border-white/10 bg-[#181C25] hover:border-[#00C47A]/30'}`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="application/pdf"
                  className="hidden"
                  disabled={!selectedSubjectId}
                />
                
                <div className="space-y-4">
                  <div className="p-4 rounded-full bg-[#0F1117] text-[#94A3B8] mx-auto w-16 h-16 flex items-center justify-center border border-white/5">
                    <Upload className="w-7 h-7" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-gray-200">
                      {!selectedSubjectId ? 'Folder Locked' : 'Import Lecture notes & PDFs'}
                    </p>
                    <p className="text-xs text-[#94A3B8] max-w-xs mx-auto leading-relaxed">
                      {!selectedSubjectId
                        ? 'Select or create a subject directory from the left index panel to open imports.'
                        : 'Drag and drop your academic PDF notes here, or upload files from local files.'}
                    </p>
                  </div>

                  {selectedSubjectId && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs font-mono font-medium tracking-tight text-white transition active:scale-95 cursor-pointer"
                    >
                      Browse PDF Materials
                    </button>
                  )}

                  <div className="text-[10px] font-mono text-[#94A3B8] block max-w-xs mx-auto leading-relaxed">
                    Max size check limit: <b className="text-gray-300">100MB</b>. Document texts extracted, vocabulary mapped, active revision cards generated automatically.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 1. Modal: Add Subject folder */}
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
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-[#00C47A] focus:ring-1 focus:ring-[#00C47A]/30 transition-all"
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
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${col === 'indigo' ? 'bg-indigo-500' : col === 'emerald' ? 'bg-[#00C47A]' : col === 'rose' ? 'bg-rose-500' : col === 'amber' ? 'bg-amber-500' : col === 'purple' ? 'bg-purple-500' : 'bg-cyan-500'} ${newSubjColor === col ? 'border-white' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 font-sans">
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs text-[#94A3B8]"
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

      {/* 2. Modal: Custom rich study note creator */}
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
                  <span className="text-[10px] font-mono text-[#94A3B8]">Gemini generates summaries automatically</span>
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
                  className="px-4 py-2 rounded-xl bg-[#0F1117] hover:bg-white/5 border border-white/5 text-xs text-[#94A3B8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#00C47A] hover:bg-emerald-600 shadow-[0_0_15px_rgba(0,196,122,0.3)] text-white font-medium text-xs flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Brain className="w-3.5 h-3.5" /> Synthesize AI Summary
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* 3. Modal: Wikipedia Search & Import Online Notes */}
      {showImportModal && (
        <div className="fixed inset-0 bg-[#0F1117]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl bg-[#181C25] rounded-3xl border border-white/5 p-6 space-y-5 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-sans">Search & Import Online Academic Notes</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {wikiErrorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{wikiErrorMessage}</span>
              </div>
            )}

            {/* Stage 1: Search Form */}
            <form onSubmit={handleWikiSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  required
                  placeholder="Type academic topic... (e.g. Photosynthesis, General Relativity, Mitosis)"
                  value={wikiSearchQuery}
                  onChange={(e) => setWikiSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all font-sans"
                />
              </div>
              <button
                type="submit"
                disabled={isSearchingWiki}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-sans transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                {isSearchingWiki ? 'Searching...' : 'Explore'}
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 min-h-0 overflow-y-auto">
              {/* Left column: Search Results */}
              <div className="flex flex-col space-y-2 min-h-0">
                <span className="text-[10px] font-mono font-semibold tracking-wider text-[#94A3B8] uppercase block">
                  Search Results ({wikiSearchResults.length})
                </span>
                <div className="flex-1 overflow-y-auto space-y-2 bg-[#0F1117]/60 rounded-2xl p-2 border border-white/5 max-h-[300px]">
                  {isSearchingWiki ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-[#94A3B8] text-xs gap-3 font-mono">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                      <span>Synthesizing index list...</span>
                    </div>
                  ) : wikiSearchResults.length > 0 ? (
                    wikiSearchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedWikiArticle({ title: item.title, snippet: item.snippet });
                          // Set default import class subject choice
                          if (!importSubjectId && selectedSubjectId) {
                            setImportSubjectId(selectedSubjectId);
                          }
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition ${selectedWikiArticle?.title === item.title ? 'bg-indigo-600/10 border-indigo-505 text-white' : 'bg-[#0F1117] border-white/5 hover:border-white/10 text-gray-300'}`}
                      >
                        <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-450" />
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-[#94A3B8] mt-1 line-clamp-2 leading-normal">
                          {item.snippet}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[#94A3B8] text-xs font-sans">
                      No matching records. Enter an academic topic above and click Explore!
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: Import Options */}
              <div className="flex flex-col space-y-3 justify-between bg-[#0F1117]/40 p-4 border border-white/5 rounded-2xl">
                {selectedWikiArticle ? (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-indigo-450 uppercase font-semibold">Selected Topic</span>
                      <h4 className="text-sm font-bold text-white mt-1">{selectedWikiArticle.title}</h4>
                      <p className="text-xs text-[#94A3B8] line-clamp-3 mt-1 leading-normal italic">
                        "{selectedWikiArticle.snippet}"
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-[#94A3B8] block mb-1 font-sans">Target Syllabus Folder</label>
                        <select
                          value={importSubjectId || selectedSubjectId}
                          onChange={(e) => setImportSubjectId(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-indigo-550"
                        >
                          <option value="">-- Choose Target Folder --</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              📁 {s.name}
                            </option>
                          ))}
                          <option value="custom">✨ [ Create Custom Subject Inline ]</option>
                        </select>
                      </div>

                      {(importSubjectId === 'custom' || (!importSubjectId && selectedSubjectId === 'custom')) && (
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[11px] text-[#94A3B8] block font-sans">Custom Subject / Class Name</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Biochemistry, World History..."
                            value={importCustomSubjectName}
                            onChange={(e) => setImportCustomSubjectName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#0F1117] border border-white/5 text-xs text-white focus:outline-none focus:border-indigo-500 font-sans"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isImportingWiki}
                      onClick={handleWikiImport}
                      className="w-full py-2.5 rounded-xl bg-[#00C47A] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-[0_4px_15px_rgba(0,196,122,0.3)]"
                    >
                      {isImportingWiki ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Syndicating & Analyzing with AI...
                        </>
                      ) : (
                        <>
                          <Brain className="w-3.5 h-3.5" />
                          Syndicate & Generate AI Summary
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-[#94A3B8] text-xs text-center py-12 px-2">
                    <Globe className="w-8 h-8 text-white/5 mb-3 animate-pulse" />
                    <p className="font-sans leading-relaxed">
                      Select an article from search results to configure target syllabus folders and import options.
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
