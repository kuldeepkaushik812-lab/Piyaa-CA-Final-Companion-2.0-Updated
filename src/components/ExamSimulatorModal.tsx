import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  Activity, 
  AlertTriangle, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Award, 
  BarChart3, 
  BookOpen, 
  Calendar, 
  ExternalLink, 
  Trash2, 
  Sparkles, 
  Coffee, 
  Check, 
  LayoutDashboard, 
  ListTodo, 
  Flame, 
  Eye,
  PenTool,
  Brain,
  Zap,
  Droplets,
  HelpCircle,
  FileSpreadsheet
} from 'lucide-react';
import { db } from '../lib/db';
import { auth } from '../lib/auth';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useStore } from '../store';
import { getISTYMD } from '../lib/dateUtils';

export interface ExamLogRecord {
  id: string;
  subjectId: string;
  subjectCode?: string;
  subjectName?: string;
  paperName: string;
  paperType?: string;
  paperUrl?: string;
  maxMarks: number;
  timeSpentSeconds: number;
  evaluation: {
    workingNotes: number; // out of 20
    reference: number;    // out of 20
    coreConcept: number;  // out of 40
    presentation: number; // out of 20
  };
  totalScore: number;
  reviewNotes?: string;
  breaksCount?: number;
  createdAt: string; // YYYY-MM-DD HH:mm
  syncedToCloud?: boolean;
}

interface ExamSimulatorModalProps {
  onClose?: () => void;
  subjects: any[];
  isFullPage?: boolean;
  onNavigateTab?: (tab: string) => void;
  onUpdateStudyHours?: (hours: number) => void;
}

export const ExamSimulatorModal: React.FC<ExamSimulatorModalProps> = ({ 
  onClose, 
  subjects,
  isFullPage = false,
  onNavigateTab,
  onUpdateStudyHours
}) => {
  const store = useStore();
  const setSubjects = store.setSubjects;

  // View Sub-Tabs within Exam Simulator
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'logs' | 'strategy'>('simulator');

  // Exam Lifecycle Step
  const [step, setStep] = useState<'setup' | 'reading' | 'writing' | 'evaluation'>('setup');

  // Form / Setup State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [paperName, setPaperName] = useState<string>('FR MTP-1 Nov 2026');
  const [paperType, setPaperType] = useState<string>('MTP (Mock Test Paper)');
  const [paperUrl, setPaperUrl] = useState<string>('');
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [targetScore, setTargetScore] = useState<number>(60);
  const [difficulty, setDifficulty] = useState<'Standard ICAI' | 'Lengthy & Tricky' | 'Concept Heavy'>('Standard ICAI');

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);

  // Audio Alerts State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Exam Scratchpad & Breaks State
  const [scratchpad, setScratchpad] = useState<string>('');
  const [breaksCount, setBreaksCount] = useState<number>(0);
  const [showBreakToast, setShowBreakToast] = useState<boolean>(false);

  // Self Evaluation Rubric State
  const [evaluation, setEvaluation] = useState({
    workingNotes: 14, // out of 20
    reference: 14,    // out of 20
    coreConcept: 28,  // out of 40
    presentation: 14  // out of 20
  });
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [syncToStudyLog, setSyncToStudyLog] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Past Logs State
  const [examLogs, setExamLogs] = useState<ExamLogRecord[]>(() => {
    const saved = localStorage.getItem('ca_companion_exam_logs');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedLogFilter, setSelectedLogFilter] = useState<string>('all');
  const [selectedLogDetail, setSelectedLogDetail] = useState<ExamLogRecord | null>(null);

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle ESC key press & Scroll Lock for Modal Viewport
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    if (!isFullPage && onClose) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullPage, onClose]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // -------------------------------------------------------------
  // PRESET PAPERS
  // -------------------------------------------------------------
  const paperPresets = [
    { name: 'FR MTP Series-1 (Nov 2026)', type: 'MTP (Mock Test Paper)', url: 'https://boslive.icai.org/' },
    { name: 'AFM MTP Series-1 (Nov 2026)', type: 'MTP (Mock Test Paper)', url: 'https://boslive.icai.org/' },
    { name: 'Audit MTP Series-1 (Nov 2026)', type: 'MTP (Mock Test Paper)', url: 'https://boslive.icai.org/' },
    { name: 'Direct Tax (DT) RTP Nov 2026', type: 'RTP (Revision Test Paper)', url: 'https://boslive.icai.org/' },
    { name: 'IDT / GST RTP Nov 2026', type: 'RTP (Revision Test Paper)', url: 'https://boslive.icai.org/' },
    { name: 'IBS Integrated Case Study Mock-1', type: 'Past ICAI Exam Paper', url: 'https://boslive.icai.org/' }
  ];

  // Selected Subject Object
  const selectedSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId) || subjects[0] || { id: '', code: 'FR', name: 'Financial Reporting' };
  }, [subjects, selectedSubjectId]);

  // Load Past Logs from Firebase Firestore on Mount
  useEffect(() => {
    const fetchCloudLogs = async () => {
      if (!auth.currentUser) return;
      try {
        const logsRef = collection(db, 'users', auth.currentUser.uid, 'ca_final_state', 'master_data', 'exam_logs');
        const q = query(logsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetched: ExamLogRecord[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            subjectId: data.subjectId || '',
            subjectCode: data.subjectCode || 'CA',
            subjectName: data.subjectName || 'CA Final Subject',
            paperName: data.paperName || 'Mock Paper',
            paperType: data.paperType || 'MTP',
            paperUrl: data.paperUrl || '',
            maxMarks: data.maxMarks || 100,
            timeSpentSeconds: data.timeSpentSeconds || 10800,
            evaluation: data.evaluation || { workingNotes: 0, reference: 0, coreConcept: 0, presentation: 0 },
            totalScore: data.totalScore || 0,
            reviewNotes: data.reviewNotes || '',
            breaksCount: data.breaksCount || 0,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.dateStr || new Date().toISOString()),
            syncedToCloud: true
          });
        });
        if (fetched.length > 0) {
          setExamLogs(fetched);
          localStorage.setItem('ca_companion_exam_logs', JSON.stringify(fetched));
        }
      } catch (err) {
        console.warn("Using local exam logs fallback:", err);
      }
    };
    fetchCloudLogs();
  }, []);

  // Save Local Exam Logs
  useEffect(() => {
    localStorage.setItem('ca_companion_exam_logs', JSON.stringify(examLogs));
  }, [examLogs]);

  // Autosave Active Exam State to localStorage (Prevents losing active exam on accidental refresh)
  useEffect(() => {
    if (step === 'reading' || step === 'writing') {
      const activeState = {
        step,
        selectedSubjectId,
        paperName,
        paperType,
        paperUrl,
        maxMarks,
        timeLeft,
        endTime,
        scratchpad,
        breaksCount,
        timeSpentSeconds
      };
      localStorage.setItem('ca_companion_active_exam', JSON.stringify(activeState));
    } else {
      localStorage.removeItem('ca_companion_active_exam');
    }
  }, [step, selectedSubjectId, paperName, paperType, paperUrl, maxMarks, timeLeft, endTime, scratchpad, breaksCount, timeSpentSeconds]);

  // Timer Interval Engine
  useEffect(() => {
    let timer: any = null;
    if (isRunning && endTime) {
      timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setTimeLeft(remaining);
        setTimeSpentSeconds(prev => prev + 1);

        // Audio chimes at milestone intervals
        if (remaining === 60 && step === 'reading') {
          playChime(880, 0.4); // 1 min left in reading
        } else if (remaining === 3600 && step === 'writing') {
          playChime(587.33, 0.6); // 1 Hour left
          showToast("⏰ 1 Hour Remaining in Exam! Finalize main questions.");
        } else if (remaining === 1800 && step === 'writing') {
          playChime(659.25, 0.7); // 30 Mins left
          showToast("⚠️ 30 Minutes Left! Start working on presentation & final totals.");
        } else if (remaining === 600 && step === 'writing') {
          playChime(783.99, 0.8); // 10 Mins left
          showToast("🚨 10 Minutes Warning! Double check question numbers & working notes.");
        }

        if (remaining <= 0) {
          handlePhaseCompletion();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, endTime, step]);

  // Play Sound Effect via Web Audio API
  const playChime = (freq: number = 523.25, duration: number = 0.5) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const handlePhaseCompletion = () => {
    setIsRunning(false);
    setEndTime(null);
    playChime(1046.50, 1.2); // Victory / Phase Finish Bell

    if (step === 'reading') {
      showToast("📖 15-Minute Reading Time Complete! 3-Hour Writing Time Started. All the best!");
      setStep('writing');
      setTimeLeft(180 * 60); // 180 Mins
      setEndTime(Date.now() + 180 * 60 * 1000);
      setIsRunning(true);
    } else if (step === 'writing') {
      showToast("🛑 TIME UP! Please step away from pen and evaluate your answer sheet.");
      setStep('evaluation');
    }
  };

  const startReading = () => {
    if (!selectedSubjectId || !paperName) return;
    setStep('reading');
    setTimeLeft(15 * 60); // 15 Mins
    setEndTime(Date.now() + 15 * 60 * 1000);
    setIsRunning(true);
    showToast("📖 15-Minute Official ICAI Reading Time Started! Review questions & plan strategy.");
  };

  const skipToWriting = () => {
    setStep('writing');
    setTimeLeft(180 * 60); // 180 Mins
    setEndTime(Date.now() + 180 * 60 * 1000);
    setIsRunning(true);
    showToast("✍️ 3-Hour Writing Mode Activated! Focus & maintain high writing velocity.");
  };

  const handleStartPause = () => {
    if (isRunning) {
      setIsRunning(false);
      setEndTime(null);
    } else {
      setIsRunning(true);
      setEndTime(Date.now() + timeLeft * 1000);
    }
  };

  const handleWaterBreak = () => {
    setBreaksCount(prev => prev + 1);
    setShowBreakToast(true);
    playChime(600, 0.2);
    setTimeout(() => setShowBreakToast(false), 3000);
  };

  const endExamEarly = () => {
    setIsRunning(false);
    setEndTime(null);
    setStep('evaluation');
    showToast("✍️ Exam Session Ended. Time for honest ICAI Step-Marking Self Evaluation!");
  };

  const resetExam = () => {
    if (window.confirm("Are you sure you want to reset this exam session? Current progress will be cleared.")) {
      setIsRunning(false);
      setEndTime(null);
      setStep('setup');
      setTimeLeft(0);
      setScratchpad('');
      setBreaksCount(0);
      setTimeSpentSeconds(0);
    }
  };

  // Submit Self Evaluation Rubric
  const submitEvaluation = async () => {
    setIsSaving(true);
    try {
      const totalScore = evaluation.workingNotes + evaluation.reference + evaluation.coreConcept + evaluation.presentation;
      const nowStr = new Date().toISOString();
      const newRecord: ExamLogRecord = {
        id: Date.now().toString(),
        subjectId: selectedSubject.id,
        subjectCode: selectedSubject.code,
        subjectName: selectedSubject.name,
        paperName,
        paperType,
        paperUrl,
        maxMarks,
        timeSpentSeconds,
        evaluation,
        totalScore,
        reviewNotes,
        breaksCount,
        createdAt: nowStr,
        syncedToCloud: false
      };

      // Save to Firebase Firestore if logged in
      if (auth.currentUser) {
        try {
          const logsRef = collection(db, 'users', auth.currentUser.uid, 'ca_final_state', 'master_data', 'exam_logs');
          const docRef = await addDoc(logsRef, {
            subjectId: selectedSubject.id,
            subjectCode: selectedSubject.code,
            subjectName: selectedSubject.name,
            paperName,
            paperType,
            paperUrl,
            maxMarks,
            timeSpentSeconds,
            evaluation,
            totalScore,
            reviewNotes,
            breaksCount,
            createdAt: serverTimestamp()
          });
          newRecord.id = docRef.id;
          newRecord.syncedToCloud = true;
        } catch (cloudErr) {
          console.warn("Cloud save failed, saved locally:", cloudErr);
        }
      }

      // Add to local state
      setExamLogs(prev => [newRecord, ...prev]);

      // Sync duration to study log if enabled
      if (syncToStudyLog) {
        const hoursToAdd = Number((timeSpentSeconds / 3600).toFixed(2));
        if (hoursToAdd > 0) {
          store.logStudyActivity({
            dateStr: getISTYMD(),
            subject: `${selectedSubject.code}: ${selectedSubject.name}`,
            subjectId: selectedSubject.id,
            durationHours: hoursToAdd,
            sourceType: 'EXAM_SIMULATOR',
            chapterTitle: `${paperName} Mock Exam (Score: ${totalScore}/${maxMarks})`
          });
          
          // Also mark MTP/PYQ progress in subject tracker if matching
          setSubjects(prev => prev.map(s => {
            if (s.id !== selectedSubject.id) return s;
            return {
              ...s,
              mtpProgress: s.mtpProgress?.map(m => {
                if (m.title.toLowerCase().includes(paperName.toLowerCase()) || paperName.toLowerCase().includes(m.title.toLowerCase())) {
                  return { ...m, completed: true, score: totalScore };
                }
                return m;
              })
            };
          }));
        }
      }

      showToast(`🏆 Mock Exam Saved! Score: ${totalScore}/${maxMarks} (${totalScore >= 60 ? 'EXEMPTION!' : totalScore >= 40 ? 'PASS' : 'REVISE'})`);
      setActiveSubTab('logs');
      setStep('setup');
    } catch (err) {
      console.error("Error submitting evaluation:", err);
      showToast("❌ Could not save exam log. Saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!window.confirm("Are you sure you want to delete this exam log?")) return;
    try {
      if (auth.currentUser) {
        try {
          const docRef = doc(db, 'users', auth.currentUser.uid, 'ca_final_state', 'master_data', 'exam_logs', logId);
          await deleteDoc(docRef);
        } catch (e) {}
      }
      setExamLogs(prev => prev.filter(l => l.id !== logId));
      if (selectedLogDetail?.id === logId) setSelectedLogDetail(null);
      showToast("Exam log deleted.");
    } catch (e) {
      showToast("Error deleting log.");
    }
  };

  // Time Formatter
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Performance Stats
  const totalMocksTaken = examLogs.length;
  const avgScore = totalMocksTaken > 0 ? Math.round(examLogs.reduce((a, b) => a + b.totalScore, 0) / totalMocksTaken) : 0;
  const exemptionsCount = examLogs.filter(l => l.totalScore >= 60).length;
  const totalExamHours = (examLogs.reduce((a, b) => a + (b.timeSpentSeconds || 10800), 0) / 3600).toFixed(1);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    if (selectedLogFilter === 'all') return examLogs;
    if (selectedLogFilter === 'exemption') return examLogs.filter(l => l.totalScore >= 60);
    return examLogs.filter(l => l.subjectId === selectedLogFilter);
  }, [examLogs, selectedLogFilter]);

  const modalContent = (
    <div className={isFullPage ? "w-full max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-500" : "fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0B1528] text-slate-100 shadow-2xl selection:bg-amber-500/30 animate-in fade-in duration-200"}>
      <div className={isFullPage ? "w-full" : "w-full h-full flex flex-col justify-between"}>
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-amber-500 text-slate-950 px-6 py-3 rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-3 font-bold text-xs sm:text-sm">
              <Sparkles className="w-5 h-5 text-slate-950 animate-spin" />
              {toastMessage}
            </div>
          </div>
        )}

        {/* TOP HEADER */}
        <div className="p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/80 border-b border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-400">
              <Activity className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  OFFICIAL ICAI SIMULATOR
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  3-Hour ICAI Exam Simulator
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Simulate 15-Min Reading + 180-Min Writing under real exam pressure with ICAI Step-Marking Evaluation
              </p>
            </div>
          </div>

          {/* Quick Interconnected Navigation & Close Button */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {onNavigateTab && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onNavigateTab('master-summary')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
                <button
                  onClick={() => onNavigateTab('timer')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Focus Room</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                soundEnabled ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'
              }`}
              title={soundEnabled ? 'Audio Chimes Enabled' : 'Mute Sound'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
                title="Close Modal (ESC)"
              >
                <X className="w-4 h-4" />
                <span>✕ Close (ESC)</span>
              </button>
            )}
          </div>
        </div>

        {/* SUB-TABS NAVIGATION BAR */}
        <div className="bg-slate-950 px-5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('simulator')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'simulator' 
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Exam Simulator</span>
              {(step === 'reading' || step === 'writing') && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('logs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'logs' 
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Award className="w-4 h-4 text-amber-400" />
              <span>Past Test Logs ({totalMocksTaken})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('strategy')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSubTab === 'strategy' 
                  ? 'bg-amber-500 text-slate-950 shadow-lg font-black' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Brain className="w-4 h-4 text-cyan-400" />
              <span>ICAI Strategy Guide</span>
            </button>
          </div>

          {/* Quick Summary Pill */}
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>Avg Score: <strong className="text-amber-300">{avgScore}/100</strong></span>
            <span>Exemptions (60+): <strong className="text-emerald-400">{exemptionsCount}</strong></span>
            <span>Total Exam Practiced: <strong className="text-cyan-300">{totalExamHours} hrs</strong></span>
          </div>
        </div>

        {/* MAIN BODY CONTENT */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-6">

          {/* ========================================================= */}
          {/* SUB-TAB 1: EXAM SIMULATOR (SETUP, READING, WRITING, EVALUATION) */}
          {/* ========================================================= */}
          {activeSubTab === 'simulator' && (
            <div>

              {/* STEP 1: EXAM SETUP */}
              {step === 'setup' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Left Column: Config */}
                    <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-4">
                      <h3 className="text-sm font-mono font-bold text-amber-300 uppercase flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-400" /> 1. Select Subject & Paper
                      </h3>

                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-300 mb-1.5">
                          CA Final Subject:
                        </label>
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          className="w-full bg-slate-900 border border-white/15 rounded-xl p-3 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code}: {s.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono font-bold text-slate-300 mb-1.5">
                          Mock Paper / Test Name:
                        </label>
                        <input
                          type="text"
                          value={paperName}
                          onChange={(e) => setPaperName(e.target.value)}
                          placeholder="e.g. FR MTP Series 1 Nov 2026"
                          className="w-full bg-slate-900 border border-white/15 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-mono font-bold text-slate-400 mb-1">
                            Paper Type:
                          </label>
                          <select
                            value={paperType}
                            onChange={(e) => setPaperType(e.target.value)}
                            className="w-full bg-slate-900 border border-white/15 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="MTP (Mock Test Paper)">MTP (Mock Paper)</option>
                            <option value="RTP (Revision Test Paper)">RTP (Revision Paper)</option>
                            <option value="Past ICAI Exam Paper">Past ICAI Exam Paper</option>
                            <option value="Custom Chapter Test">Custom Chapter Test</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-mono font-bold text-slate-400 mb-1">
                            Difficulty Level:
                          </label>
                          <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/15 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="Standard ICAI">Standard ICAI Level</option>
                            <option value="Lengthy & Tricky">Lengthy & Tricky</option>
                            <option value="Concept Heavy">Concept Heavy</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono font-bold text-slate-400 mb-1 flex items-center justify-between">
                          <span>Paper Link / Drive URL:</span>
                          <span className="text-[10px] text-slate-500 font-normal">(Optional)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={paperUrl}
                            onChange={(e) => setPaperUrl(e.target.value)}
                            placeholder="https://boslive.icai.org/... or Drive Link"
                            className="flex-1 bg-slate-900 border border-white/15 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
                          />
                          {paperUrl && (
                            <a
                              href={paperUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Open</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Presets & Exam Rules */}
                    <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-4 flex flex-col justify-between">
                      <div>
                        <h3 className="text-sm font-mono font-bold text-amber-300 uppercase flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-amber-400" /> Quick Paper Presets
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {paperPresets.map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setPaperName(preset.name);
                                setPaperType(preset.type);
                                setPaperUrl(preset.url);
                                showToast(`Loaded preset: ${preset.name}`);
                              }}
                              className="p-2.5 bg-white/[0.03] hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/40 rounded-xl text-left transition-all cursor-pointer group"
                            >
                              <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 block truncate">
                                {preset.name}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {preset.type}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Official ICAI Exam Conditions Box */}
                      <div className="bg-amber-950/30 border border-amber-500/30 p-4 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Official ICAI Exam Protocol:</span>
                        </div>
                        <ul className="text-[11px] text-slate-300 space-y-1 list-disc list-inside">
                          <li><strong>1:45 PM to 2:00 PM:</strong> 15 Minutes Reading Time (Pick Question 1 & optional questions).</li>
                          <li><strong>2:00 PM to 5:00 PM:</strong> 3 Hours (180 Mins) Writing Time.</li>
                          <li><strong>Rule of 1.8 Mins/Mark:</strong> 20 marks question = 36 minutes max limit.</li>
                        </ul>
                      </div>

                      {/* Launch Buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={startReading}
                          disabled={!selectedSubjectId || !paperName}
                          className="flex-1 py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Start 15-Min Reading Time</span>
                        </button>

                        <button
                          onClick={skipToWriting}
                          disabled={!selectedSubjectId || !paperName}
                          className="py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-amber-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <PenTool className="w-4 h-4" />
                          <span>Skip to 3-Hr Writing</span>
                        </button>
                      </div>

                    </div>

                  </div>
                </div>
              )}

              {/* STEP 2 & 3: READING OR WRITING PHASE */}
              {(step === 'reading' || step === 'writing') && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  
                  {/* Top Live Banner */}
                  <div className="bg-slate-950/90 p-6 rounded-3xl border border-amber-500/40 shadow-2xl flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                      <Activity className="w-64 h-64 text-amber-400" />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-widest ${
                        step === 'reading' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse' : 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                      }`}>
                        {step === 'reading' ? '📖 15-MIN READING TIME IN PROGRESS' : '✍️ 3-HOUR WRITING TIME IN PROGRESS'}
                      </span>
                    </div>

                    {/* BIG DIGITAL CLOCK */}
                    <div className="text-6xl sm:text-7xl lg:text-8xl font-black font-mono tracking-tight text-white tabular-nums drop-shadow-lg">
                      {formatTime(timeLeft)}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">
                        Subject: <strong className="text-white">{selectedSubject.code} - {selectedSubject.name}</strong>
                      </span>
                      <span className="text-slate-600">•</span>
                      <span className="text-xs text-slate-400 font-mono">
                        Paper: <strong className="text-amber-300">{paperName}</strong>
                      </span>
                      {breaksCount > 0 && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs text-cyan-300 font-mono">💧 Breaks Taken: {breaksCount}</span>
                        </>
                      )}
                    </div>

                    {/* CONTROL ACTION BUTTONS */}
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2 z-10">
                      <button
                        onClick={handleStartPause}
                        className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                          isRunning ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        }`}
                      >
                        {isRunning ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pause Timer</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Resume Timer</span>
                          </>
                        )}
                      </button>

                      {step === 'reading' && (
                        <button
                          onClick={skipToWriting}
                          className="px-5 py-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>Start Writing Mode (180m)</span>
                        </button>
                      )}

                      <button
                        onClick={handleWaterBreak}
                        className="px-4 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Log a 2-minute water/bio break"
                      >
                        <Droplets className="w-4 h-4" />
                        <span>Bio Break 💧</span>
                      </button>

                      <button
                        onClick={endExamEarly}
                        className="px-5 py-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-red-400" />
                        <span>End Exam & Self-Evaluate</span>
                      </button>

                      <button
                        onClick={resetExam}
                        className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-colors cursor-pointer"
                        title="Reset Session"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>

                    {showBreakToast && (
                      <div className="text-xs text-cyan-300 font-bold animate-bounce pt-1">
                        💧 Bio break logged! Deep breath & continue writing with full clarity.
                      </div>
                    )}
                  </div>

                  {/* BOTTOM EXAM TOOLS: QUESTION TIME ALLOCATION & SCRATCHPAD */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* LEFT 5 COLS: Question Time Strategy Matrix */}
                    <div className="lg:col-span-5 bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-4">
                      <h3 className="text-xs font-mono font-bold text-amber-300 uppercase flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-amber-400" /> Question Time Allocation Guide
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">1.8 Mins / Mark</span>
                      </h3>

                      <div className="space-y-2">
                        {[
                          { q: 'Question 1 (Compulsory)', marks: 20, time: '36 Mins', tip: 'Start here if strong; complete by 2:36 PM' },
                          { q: 'Question 2', marks: 20, time: '36 Mins', tip: 'Target completion by 3:12 PM' },
                          { q: 'Question 3', marks: 20, time: '36 Mins', tip: 'Target completion by 3:48 PM' },
                          { q: 'Question 4', marks: 20, time: '36 Mins', tip: 'Target completion by 4:24 PM' },
                          { q: 'Question 5', marks: 20, time: '36 Mins', tip: 'Final 36 Mins & Revision before 5:00 PM' }
                        ].map((qObj, idx) => (
                          <div key={idx} className="p-2.5 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-slate-200 block">{qObj.q}</span>
                              <span className="text-[10px] text-slate-400">{qObj.tip}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-amber-300 block">{qObj.time}</span>
                              <span className="text-[10px] text-slate-500">{qObj.marks} Marks</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {paperUrl && (
                        <a
                          href={paperUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open Question Paper PDF in New Tab</span>
                        </a>
                      )}
                    </div>

                    {/* RIGHT 7 COLS: Scratchpad Notepad & Working Notes */}
                    <div className="lg:col-span-7 bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-mono font-bold text-amber-300 uppercase flex items-center gap-1.5">
                            <PenTool className="w-4 h-4 text-amber-400" /> Exam Rough Scratchpad & Key Notes
                          </h3>
                          <span className="text-[10px] text-slate-500">Autosaved</span>
                        </div>
                        <textarea
                          value={scratchpad}
                          onChange={(e) => setScratchpad(e.target.value)}
                          placeholder="Jot down rough calculations, section numbers, formula steps, or question order plan here..."
                          className="w-full h-48 bg-slate-900 border border-white/15 rounded-xl p-3 text-xs text-amber-100 font-mono focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                        />
                      </div>

                      <div className="text-[11px] text-slate-400 italic">
                        💡 Tip: Highlighting assumptions in your working notes carries up to 20% weightage in ICAI evaluation!
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* STEP 4: SELF EVALUATION STEP-MARKING RUBRIC */}
              {step === 'evaluation' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="bg-amber-950/30 border border-amber-500/30 p-5 rounded-2xl space-y-2">
                    <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                      <Award className="w-5 h-5 text-amber-400" /> ICAI Official Step-Marking Self Evaluation
                    </h3>
                    <p className="text-xs text-slate-300">
                      Score your written paper honestly based on ICAI's official step marking guidelines.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { 
                        key: 'workingNotes', 
                        label: '1. Working Notes & Assumptions', 
                        max: 20, 
                        desc: 'Cross-referencing, calculation steps, and explicit statutory assumptions.' 
                      },
                      { 
                        key: 'reference', 
                        label: '2. Section / IND AS / SA Citations', 
                        max: 20, 
                        desc: 'Accurate mention of standard names, sections, and case law references.' 
                      },
                      { 
                        key: 'coreConcept', 
                        label: '3. Core Concept & Calculation Accuracy', 
                        max: 40, 
                        desc: 'Numerical totals, journal entries, balance sheet matching, & legal conclusions.' 
                      },
                      { 
                        key: 'presentation', 
                        label: '4. Presentation, Formatting & Handwriting', 
                        max: 20, 
                        desc: 'Underlined key terms, clean tabular layout, margin alignment, and legibility.' 
                      }
                    ].map(crit => (
                      <div key={crit.key} className="bg-slate-950/70 p-4 rounded-2xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-100 text-xs sm:text-sm">{crit.label}</label>
                          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                            Max {crit.max} Marks
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">{crit.desc}</p>
                        
                        <div className="flex items-center gap-3 pt-1">
                          <input
                            type="range"
                            min="0"
                            max={crit.max}
                            value={(evaluation as any)[crit.key]}
                            onChange={(e) => setEvaluation({ ...evaluation, [crit.key]: parseInt(e.target.value) || 0 })}
                            className="flex-1 accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                          />
                          <input
                            type="number"
                            min="0"
                            max={crit.max}
                            value={(evaluation as any)[crit.key]}
                            onChange={(e) => setEvaluation({ ...evaluation, [crit.key]: Math.min(crit.max, Math.max(0, parseInt(e.target.value) || 0)) })}
                            className="w-16 bg-slate-900 border border-white/15 rounded-lg p-1.5 text-center font-mono font-bold text-amber-300 text-xs focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SCORE VERDICT BANNER */}
                  {(() => {
                    const total = evaluation.workingNotes + evaluation.reference + evaluation.coreConcept + evaluation.presentation;
                    const isExemption = total >= 60;
                    const isPass = total >= 40;
                    return (
                      <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                        isExemption 
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200' 
                          : isPass 
                          ? 'bg-blue-950/60 border-blue-500/40 text-blue-200' 
                          : 'bg-red-950/60 border-red-500/40 text-red-200'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <Award className="w-6 h-6 text-amber-400" />
                            <span className="text-xl font-black font-mono">
                              Total Score: {total} / {maxMarks}
                            </span>
                          </div>
                          <p className="text-xs mt-1">
                            {isExemption && "🌟 EXEMPTION SECURED! Exceptional performance & command over concepts."}
                            {!isExemption && isPass && "✅ PASS ACHIEVED! Solid performance, refine speed for exemption zone."}
                            {!isPass && "⚠️ REVISION NEEDED. Revisit weak chapters & practice step presentation."}
                          </p>
                        </div>

                        <div className="text-center sm:text-right">
                          <span className={`px-4 py-1.5 rounded-xl font-black text-xs uppercase tracking-widest border ${
                            isExemption ? 'bg-emerald-500 text-slate-950 border-emerald-300' : isPass ? 'bg-blue-500 text-slate-950 border-blue-300' : 'bg-red-500 text-slate-950 border-red-300'
                          }`}>
                            {isExemption ? 'Exemption (60+)' : isPass ? 'Pass (40+)' : 'Needs Practice'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* REVIEW NOTES & SYNC OPTIONS */}
                  <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-4">
                    <div>
                      <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                        Post-Exam Review Notes & Self Feedback:
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="What went well? Where did you lose marks or time? Which chapters need immediate revision?"
                        className="w-full h-24 bg-slate-900 border border-white/15 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="syncToStudyLog"
                        checked={syncToStudyLog}
                        onChange={(e) => setSyncToStudyLog(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer rounded"
                      />
                      <label htmlFor="syncToStudyLog" className="text-xs text-slate-300 font-bold cursor-pointer">
                        Sync exam duration ({(timeSpentSeconds / 3600).toFixed(1)} hrs) to Today's Study Log
                      </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={submitEvaluation}
                        disabled={isSaving}
                        className="flex-1 py-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-5 h-5 fill-current" />
                        <span>{isSaving ? 'Saving to Cloud...' : 'Submit & Save Exam Log'}</span>
                      </button>

                      <button
                        onClick={() => setStep('setup')}
                        className="px-5 py-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs border border-white/10 transition-colors cursor-pointer"
                      >
                        Discard & Reset
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 2: PAST EXAM ATTEMPT LOGS & PERFORMANCE ANALYTICS */}
          {/* ========================================================= */}
          {activeSubTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Filter Bar & Performance KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/70 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Mocks</span>
                  <span className="text-xl font-black text-white font-mono">{totalMocksTaken}</span>
                </div>
                <div className="bg-slate-950/70 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Average Score</span>
                  <span className="text-xl font-black text-amber-300 font-mono">{avgScore} / 100</span>
                </div>
                <div className="bg-slate-950/70 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Exemptions (60+)</span>
                  <span className="text-xl font-black text-emerald-400 font-mono">{exemptionsCount}</span>
                </div>
                <div className="bg-slate-950/70 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">Total Hours</span>
                  <span className="text-xl font-black text-cyan-300 font-mono">{totalExamHours} hrs</span>
                </div>
              </div>

              {/* Logs Table Header & Filter Dropdown */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-sm font-mono font-bold text-white uppercase flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" /> Exam Logs History ({filteredLogs.length})
                </h3>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">Filter:</span>
                  <select
                    value={selectedLogFilter}
                    onChange={(e) => setSelectedLogFilter(e.target.value)}
                    className="bg-slate-900 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Subjects & Mocks</option>
                    <option value="exemption">🌟 Exemption Papers (60+)</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code}: {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* LOGS LIST */}
              {filteredLogs.length === 0 ? (
                <div className="p-12 text-center bg-slate-950/50 border border-white/10 rounded-2xl space-y-3">
                  <Activity className="w-12 h-12 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No exam logs recorded yet!</p>
                  <p className="text-xs text-slate-500">Take a 3-hour mock exam in the Simulator tab to track your step-marking scores.</p>
                  <button
                    onClick={() => setActiveSubTab('simulator')}
                    className="px-4 py-2 bg-amber-500 text-slate-950 font-bold text-xs rounded-xl hover:bg-amber-400 transition-colors"
                  >
                    Start First Exam
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => {
                    const isExemption = log.totalScore >= 60;
                    const isPass = log.totalScore >= 40;
                    return (
                      <div
                        key={log.id}
                        className="bg-slate-950/70 border border-white/10 hover:border-amber-500/30 p-4 rounded-2xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold border border-amber-500/30">
                              {log.subjectCode || 'CA'}
                            </span>
                            <h4 className="text-sm font-bold text-white">{log.paperName}</h4>
                            <span className="text-[10px] text-slate-400">({log.paperType})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-mono">
                            <span>📅 {new Date(log.createdAt).toLocaleDateString()}</span>
                            <span>⏱️ {(log.timeSpentSeconds / 3600).toFixed(1)} hrs</span>
                            {log.breaksCount ? <span>💧 {log.breaksCount} breaks</span> : null}
                          </div>
                          {log.reviewNotes && (
                            <p className="text-xs text-slate-300 italic pt-1">
                              "{log.reviewNotes}"
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-white/10">
                          <div className="text-right">
                            <span className="text-lg font-black font-mono text-white block">
                              {log.totalScore} / {log.maxMarks}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${
                              isExemption ? 'text-emerald-400' : isPass ? 'text-blue-400' : 'text-red-400'
                            }`}>
                              {isExemption ? 'Exemption' : isPass ? 'Passed' : 'Needs Practice'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedLogDetail(log)}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>

                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/80 text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                              title="Delete log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LOG DETAILS MODAL / POPUP */}
              {selectedLogDetail && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {selectedLogDetail.subjectCode}: {selectedLogDetail.subjectName}
                        </span>
                        <h3 className="text-base font-bold text-white">{selectedLogDetail.paperName}</h3>
                      </div>
                      <button onClick={() => setSelectedLogDetail(null)} className="p-1.5 text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2 font-mono bg-slate-950 p-3 rounded-xl border border-white/10">
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Total Score</span>
                          <span className="text-base font-bold text-amber-300">{selectedLogDetail.totalScore} / {selectedLogDetail.maxMarks}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block uppercase">Date</span>
                          <span className="text-slate-200">{new Date(selectedLogDetail.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <span className="font-bold text-slate-300 block">Rubric Breakdown:</span>
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Working Notes:</span>
                            <span className="font-bold text-white">{selectedLogDetail.evaluation.workingNotes} / 20</span>
                          </div>
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Citations & Law:</span>
                            <span className="font-bold text-white">{selectedLogDetail.evaluation.reference} / 20</span>
                          </div>
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Calculations:</span>
                            <span className="font-bold text-white">{selectedLogDetail.evaluation.coreConcept} / 40</span>
                          </div>
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <span className="text-[10px] text-slate-400 block">Presentation:</span>
                            <span className="font-bold text-white">{selectedLogDetail.evaluation.presentation} / 20</span>
                          </div>
                        </div>
                      </div>

                      {selectedLogDetail.reviewNotes && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-white/10">
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Review Notes</span>
                          <p className="text-slate-200 italic mt-0.5">{selectedLogDetail.reviewNotes}</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedLogDetail(null)}
                      className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700"
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* SUB-TAB 3: ICAI EXAM DAY STRATEGY & TIME ALLOCATION GUIDE */}
          {/* ========================================================= */}
          {activeSubTab === 'strategy' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-slate-950/70 p-6 rounded-3xl border border-white/10 space-y-4">
                <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-amber-400" /> The 1.8-Minute Rule for CA Final Exams
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  ICAI papers are notorious for being lengthy. The key to securing exemptions (60+) is strict time discipline:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl">
                    <span className="text-[10px] text-amber-400 uppercase block font-bold">1 Mark = 1.8 Mins</span>
                    <p className="text-slate-200 mt-1">Never exceed 1.8 minutes per mark. A 20-mark question MUST be done in 36 mins.</p>
                  </div>
                  <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl">
                    <span className="text-[10px] text-cyan-400 uppercase block font-bold">Compulsory Question 1</span>
                    <p className="text-slate-200 mt-1">First 36 minutes should be dedicated to Q1 to build momentum and calm nerves.</p>
                  </div>
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
                    <span className="text-[10px] text-emerald-400 uppercase block font-bold">Step Marking Scheme</span>
                    <p className="text-slate-200 mt-1">Even if final calculation is wrong, clear working notes save 60-70% of the marks!</p>
                  </div>
                </div>
              </div>

              {/* Subject Specific Strategy Guidance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-emerald-300 uppercase">
                    📊 Practical Papers Strategy (FR / AFM)
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>Draw proper T-accounts, Journal tables, and NPV schedules.</li>
                    <li>Always state IND AS / Financial Management assumptions clearly.</li>
                    <li>Cross-reference Working Notes (e.g. "Refer W.N. 1").</li>
                  </ul>
                </div>

                <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-amber-300 uppercase">
                    📜 Theory & Law Strategy (Audit / DT / IDT)
                  </h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>Structure answers: Provision, Analysis, and Conclusion.</li>
                    <li>Quote exact SA / Income Tax / GST Sections where confident.</li>
                    <li>Underline key technical keywords for ICAI evaluators.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );

  return isFullPage ? modalContent : createPortal(modalContent, document.body);
};
