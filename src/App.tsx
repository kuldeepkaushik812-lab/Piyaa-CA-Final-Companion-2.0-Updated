import { useStore } from "./store";
import { getISTDate, getISTYMD, syncInternetTime } from "./lib/dateUtils";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from './components/Header';
import { CompanionChat } from './components/CompanionChat';
import { TimetablePlanner } from './components/TimetablePlanner';
import { StudyTimer } from './components/StudyTimer';
import { SubjectTracker } from './components/SubjectTracker';
import { MotivationDeck } from './components/MotivationDeck';
import { CalendarTracker } from './components/CalendarTracker';
import { SubjectKPIHub } from './components/SubjectKPIHub';
import { runStoreDiagnostic, repairOrphanedLogs } from "./utils/diagnostics";
import { BoSRadarWidget } from './components/BoSRadarWidget';
import { MasterSummary } from "./components/MasterSummary";
import { ProgressAnalyticsHub } from './components/ProgressAnalyticsHub';
import { AIAnswerEvaluator } from './components/AIAnswerEvaluator';
import { FlashcardVault } from './components/FlashcardVault';
import { DEFAULT_CA_SUBJECTS, INITIAL_TIMETABLE } from './data/caData';
import { CASubject, TimetableSlot } from './types';
import { parseSlotHours } from './utils/timeUtils';
import { Sparkles, X, MessageCircle, FileSpreadsheet, Download } from 'lucide-react';
import { saveProgressToCloud, setupRealtimeCloudSync } from './lib/db';
import { onAuthUserChanged, auth, isAuthorizedEmail, subscribeAccessControlCloud, syncAccessControlFromCloud } from './lib/auth';
import { exportToExcel } from './lib/excelExport';
import { usePWAInstall } from './hooks/usePWAInstall';
import { ExamSimulatorModal } from "./components/ExamSimulatorModal";
import { StudyBuddyHub } from "./components/StudyBuddyHub";
import { StudyHistoryHub } from "./components/StudyHistoryHub";
import { CommandPalette } from "./components/CommandPalette";
import { ProfileModal } from "./components/ProfileModal";
import { HelpDocumentationModal } from "./components/HelpDocumentationModal";
import { PreDeployCheckModal } from "./components/PreDeployCheckModal";
import { FloatingActionDock } from "./components/FloatingActionDock";

export default function App() {
  const { isStandalone } = usePWAInstall();
  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const [isStrictMode, setIsStrictMode] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(() => !sessionStorage.getItem('checked_in'));
  const [activeModal, setActiveModal] = useState<'excel' | 'json' | 'exam-simulator' | null>(null);
  const [clockDesyncMsg, setClockDesyncMsg] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isPreDeployCheckOpen, setIsPreDeployCheckOpen] = useState(false);


  useEffect(() => {
    // Run diagnostic checks and repair any legacy or orphaned logs
    setTimeout(() => {
      runStoreDiagnostic();
      repairOrphanedLogs();
      runStoreDiagnostic(); // Run again to verify repair
    }, 1000);
  }, []);

  useEffect(() => {
    const handleOpenProfile = () => setIsProfileModalOpen(true);
    const handleOpenHelp = () => setIsHelpModalOpen(true);
    const handleOpenPreDeploy = () => setIsPreDeployCheckOpen(true);

    window.addEventListener('open-profile-modal', handleOpenProfile);
    window.addEventListener('open-help-modal', handleOpenHelp);
    window.addEventListener('open-predeploy-modal', handleOpenPreDeploy);

    return () => {
      window.removeEventListener('open-profile-modal', handleOpenProfile);
      window.removeEventListener('open-help-modal', handleOpenHelp);
      window.removeEventListener('open-predeploy-modal', handleOpenPreDeploy);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?') {
        const activeEl = document.activeElement;
        if (
          activeEl && 
          (activeEl.tagName === 'INPUT' || 
           activeEl.tagName === 'TEXTAREA' || 
           activeEl.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        e.preventDefault();
        setIsHelpModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    recalculateAllMetrics(getISTYMD());
  }, []);

  useEffect(() => {
    syncInternetTime();
    const interval = setInterval(syncInternetTime, 3600 * 1000); // sync every hour
    
    const handleClockDesync = (e: any) => {
      if (e.detail && e.detail.message) {
        setClockDesyncMsg(e.detail.message);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncInternetTime();
        recalculateAllMetrics(getISTYMD());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ca_companion_active_timer_session' || e.key === 'ca-final-companion-storage') {
        recalculateAllMetrics(getISTYMD());
      }
    };

    window.addEventListener('clock-desync', handleClockDesync);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('clock-desync', handleClockDesync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  useEffect(() => {
    const handleOpenExam = () => setActiveModal('exam-simulator');
    window.addEventListener('open-exam-simulator', handleOpenExam);
    return () => window.removeEventListener('open-exam-simulator', handleOpenExam);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    const handleOpenCommandPalette = () => setIsCommandPaletteOpen(true);
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-command-palette', handleOpenCommandPalette);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-command-palette', handleOpenCommandPalette);
    };
  }, []);

  // Enforce body scroll locking when any global modal is open
  const isAnyGlobalModalOpen = Boolean(activeModal) || showCheckinModal || isCommandPaletteOpen || isProfileModalOpen || isHelpModalOpen;

  useEffect(() => {
    if (isAnyGlobalModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyGlobalModalOpen]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatDimensions, setChatDimensions] = useState({ width: 450, height: window.innerHeight * 0.78 });

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = chatDimensions.width;
    const startHeight = chatDimensions.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(window.innerWidth - 32, startWidth - (moveEvent.clientX - startX)));
      const newHeight = Math.max(400, Math.min(window.innerHeight - 32, startHeight - (moveEvent.clientY - startY)));
      setChatDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const [isSavingToCloud, setIsSavingToCloud] = useState(false);

  const handleCheckIn = (energy: string) => {
    sessionStorage.setItem('checked_in', 'true');
    setShowCheckinModal(false);
    if (energy === 'low') {
      alert("Piyaa says: Babu, take it easy today. Start with light Law/Audit theory or watch revision videos! 💖");
    } else {
      alert("Piyaa says: Energy is high! Let's crush those heavy AFM & DT practical sums! 🔥");
    }
  };

  // Curriculum & Timetable State via Zustand Store with automatic local storage persistence & hydration
  const subjects = useStore(state => state.subjects);
  const setSubjects = useStore(state => state.setSubjects);
  const timetable = useStore(state => state.timetable);
  const setTimetable = useStore(state => state.setTimetable);
  const targetStudyHours = useStore(state => state.targetStudyHours);
  const setTargetStudyHours = useStore(state => state.setTargetStudyHours);
  const exportBackupJson = useStore(state => state.exportBackupJson);
  const studyHistoryLogs = useStore(state => state.studyHistoryLogs || []);
  const logStudyActivity = useStore(state => state.logStudyActivity);
  const deleteStudyHistoryLog = useStore(state => state.deleteStudyHistoryLog);
  const recalculateAllMetrics = useStore(state => state.recalculateAllMetrics);
  const selectedDateStr = useStore(state => state.selectedDateStr);

  const studyLogs = useStore(state => state.studyLogs);
  const studyHoursToday = useMemo(() => {
    const today = getISTYMD();
    return studyLogs
      .filter((l) => l.date === today)
      .reduce((acc, log) => acc + log.hours, 0);
  }, [studyLogs]);
  const currentSubject = useStore(state => state.currentSubject);
  const setCurrentSubject = useStore(state => state.setCurrentSubject);

  // Lock document body scroll when modal active & listen to ESC key (Requirement 2)
  useEffect(() => {
    if (activeModal || showCheckinModal || isProfileModalOpen || isHelpModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [activeModal, showCheckinModal, isProfileModalOpen, isHelpModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeModal) setActiveModal(null);
        if (showCheckinModal) setShowCheckinModal(false);
        setIsProfileModalOpen(false);
        setIsHelpModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, showCheckinModal]);

  // Instant Tab Switching: Render immediately at top of viewport (Requirement 3)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Global Keyboard Shortcut Ctrl+K / Cmd+K to switch to ✨ AI Mentor tab (Requirement 4)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('chat');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Data Validation & Purge Sweep on Load / Hydration (Rule 4)
  const hasValidatedOnLoad = useRef(false);
  useEffect(() => {
    if (hasValidatedOnLoad.current) return;
    if (!subjects || subjects.length === 0) return;
    hasValidatedOnLoad.current = true;

    let mutated = false;
    const validated = subjects.map(s => {
      let subjMutated = false;
      const topicsValidated = s.topics.map(t => {
        let topicMutated = false;
        
        // Revert invalid completion states to pending if interaction timestamps are missing
        let nextCompleted = t.completed;
        if (t.completed && !t.completedAt) {
          nextCompleted = false;
          topicMutated = true;
        }

        let nextRev1 = t.rev1;
        if (t.rev1 && !t.rev1At) {
          nextRev1 = false;
          topicMutated = true;
        }

        let nextRev2 = t.rev2;
        if (t.rev2 && !t.rev2At) {
          nextRev2 = false;
          topicMutated = true;
        }

        let nextRev3 = t.rev3;
        if (t.rev3 && !t.rev3At) {
          nextRev3 = false;
          topicMutated = true;
        }

        let nextLdr = t.ldr;
        if (t.ldr && !t.ldrAt) {
          nextLdr = false;
          topicMutated = true;
        }

        // Standardize completedDates set
        const datesSet = new Set<string>();
        if (nextCompleted && t.completedAt) datesSet.add(t.completedAt);
        if (nextRev1 && t.rev1At) datesSet.add(t.rev1At);
        if (nextRev2 && t.rev2At) datesSet.add(t.rev2At);
        if (nextRev3 && t.rev3At) datesSet.add(t.rev3At);
        if (nextLdr && t.ldrAt) datesSet.add(t.ldrAt);

        const nextCompletedDates = Array.from(datesSet).sort();
        const nextLastCompletedDate = nextCompletedDates.length > 0 ? nextCompletedDates[nextCompletedDates.length - 1] : undefined;

        const currentCompletedDates = t.completedDates || [];
        const isDatesArrayIdentical = currentCompletedDates.length === nextCompletedDates.length &&
          currentCompletedDates.every((val, index) => val === nextCompletedDates[index]);

        if (
          topicMutated || 
          !isDatesArrayIdentical || 
          t.lastCompletedDate !== nextLastCompletedDate ||
          t.completed !== nextCompleted ||
          t.rev1 !== nextRev1 ||
          t.rev2 !== nextRev2 ||
          t.rev3 !== nextRev3 ||
          t.ldr !== nextLdr
        ) {
          subjMutated = true;
          mutated = true;
          return {
            ...t,
            completed: nextCompleted,
            rev1: nextRev1,
            rev2: nextRev2,
            rev3: nextRev3,
            ldr: nextLdr,
            completedDates: nextCompletedDates,
            lastCompletedDate: nextLastCompletedDate
          };
        }
        return t;
      });

      if (subjMutated) {
        return {
          ...s,
          topics: topicsValidated,
          completedChapters: topicsValidated.filter(t => t.completed).length
        };
      }
      return s;
    });

    if (mutated) {
      console.log("🧹 [Syllabus Validation Check] Reverted phantom topics & synchronized completedDates!");
      setSubjects(validated);
    }
  }, [subjects]);

  // Cloud Sync & Access Control Listener Setup
  useEffect(() => {
    // Initial fetch of authorized email list from Cloud Firestore
    syncAccessControlFromCloud();

    // Realtime listener for authorized email list updates
    const unsubscribeAccess = subscribeAccessControlCloud();

    const unsubscribeAuth = onAuthUserChanged((user) => {
      if (user && isAuthorizedEmail(user.email)) {
        setupRealtimeCloudSync(user.uid);
      }
    });

    return () => {
      unsubscribeAccess();
      unsubscribeAuth();
    };
  }, []);

  const handleSaveToCloud = async () => {
    if (!auth.currentUser) {
      alert('🔑 Please sign in with Google using the button in the top-right header to enable real-time Cloud Sync across your devices!');
      return;
    }
    setIsSavingToCloud(true);
    try {
      // Force immediate write to Cloud Firestore
      const saved = await saveProgressToCloud();
      if (saved !== false) {
        alert('✅ Progress Saved to Cloud Firestore!');
      }
    } catch (err: any) {
      alert('⚠️ Cloud Save Error: ' + (err.message || 'Error saving data'));
      console.error(err);
    } finally {
      setIsSavingToCloud(false);
    }
  };

  // Topic Completion Handler
  const handleToggleTopic = (subjectId: string, topicId: string) => {
    const todayKey = getISTYMD();
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const updatedTopics = s.topics.map((t) => {
          if (t.id === topicId) {
            const nextCompleted = !t.completed;
            const nextCompletedAt = nextCompleted ? todayKey : undefined;

            const datesSet = new Set<string>();
            if (nextCompleted && nextCompletedAt) datesSet.add(nextCompletedAt);
            if (t.rev1 && t.rev1At) datesSet.add(t.rev1At);
            if (t.rev2 && t.rev2At) datesSet.add(t.rev2At);
            if (t.rev3 && t.rev3At) datesSet.add(t.rev3At);
            if (t.ldr && t.ldrAt) datesSet.add(t.ldrAt);

            const completedDates = Array.from(datesSet).sort();
            const lastCompletedDate = completedDates.length > 0 ? completedDates[completedDates.length - 1] : undefined;

            return {
              ...t,
              completed: nextCompleted,
              completedAt: nextCompletedAt,
              completedDates,
              lastCompletedDate
            };
          }
          return t;
        });
        const completedChapters = updatedTopics.filter((t) => t.completed).length;
        return {
          ...s,
          topics: updatedTopics,
          completedChapters,
        };
      })
    );
  };

  // Topic Revision Toggle Handler
  const handleToggleTopicRevision = (subjectId: string, topicId: string, revNum: 1 | 2 | 3 | 4) => {
    const todayKey = getISTYMD();
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const updatedTopics = s.topics.map((t) => {
          if (t.id === topicId) {
            const field = revNum === 4 ? 'ldr' : `rev${revNum}`;
            const dateField = revNum === 4 ? 'ldrAt' : `rev${revNum}At`;
            const nextVal = !t[field as keyof typeof t];
            const nextDateVal = nextVal ? todayKey : undefined;

            const updatedTopic = {
              ...t,
              [field]: nextVal,
              [dateField]: nextDateVal
            };

            const datesSet = new Set<string>();
            if (updatedTopic.completed && updatedTopic.completedAt) datesSet.add(updatedTopic.completedAt);
            if (updatedTopic.rev1 && updatedTopic.rev1At) datesSet.add(updatedTopic.rev1At);
            if (updatedTopic.rev2 && updatedTopic.rev2At) datesSet.add(updatedTopic.rev2At);
            if (updatedTopic.rev3 && updatedTopic.rev3At) datesSet.add(updatedTopic.rev3At);
            if (updatedTopic.ldr && updatedTopic.ldrAt) datesSet.add(updatedTopic.ldrAt);

            const completedDates = Array.from(datesSet).sort();
            const lastCompletedDate = completedDates.length > 0 ? completedDates[completedDates.length - 1] : undefined;

            return {
              ...updatedTopic,
              completedDates,
              lastCompletedDate
            };
          }
          return t;
        });
        return {
          ...s,
          topics: updatedTopics
        };
      })
    );
  };

  // Revision counter handler
  const handleUpdateRevision = (subjectId: string, delta: number) => {
    setSubjects((prev) =>
      prev.map((s) => {
        if (s.id !== subjectId) return s;
        const newCount = Math.max(0, s.revisionCount + delta);
        return { ...s, revisionCount: newCount };
      })
    );
  };

  // RTP/MTP Toggle Handler
  const handleToggleRtpMtp = (subjectId: string) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, rtpMtpDone: !s.rtpMtpDone } : s))
    );
  };

  // Timetable Slot Toggle Handler
  const togglingSlotsRef = useRef<Set<string>>(new Set());

  const handleSlotToggle = (slotId: string) => {
    if (togglingSlotsRef.current.has(slotId)) return;
    togglingSlotsRef.current.add(slotId);

    const slot = timetable.find(s => s.id === slotId);
    if (slot && slot.category !== 'break') {
      const hours = parseSlotHours(slot.time);
      const matchSubj = subjects.find(sub => sub.name.toLowerCase().includes(slot.subject.toLowerCase()) || sub.code.toLowerCase().includes(slot.subject.toLowerCase()));
      const subjectId = matchSubj ? matchSubj.id : 'general';
      const subjName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : `General (${slot.subject})`;
      
      if (slot.completed) {
        // Unchecking a completed slot -> remove from study history logs if present
        const matchingLog = studyHistoryLogs.find(
          log => log.sourceType === 'TIME_TABLE' && 
                 log.subjectId === subjectId && 
                 log.chapterTitle === slot.activity &&
                 log.dateStr === (selectedDateStr || getISTYMD())
        );
        if (matchingLog) {
          deleteStudyHistoryLog(matchingLog.id);
        } else {
          addStudyLog(subjectId, -hours);
        }
      } else {
        // Log completion in study history & audit ledger
        logStudyActivity({
          dateStr: selectedDateStr || getISTYMD(),
          subject: subjName,
          subjectId,
          durationHours: hours,
          sourceType: 'TIME_TABLE',
          chapterTitle: slot.activity
        });
      }
    }

    setTimetable((prev) => prev.map((s) => (s.id === slotId ? { ...s, completed: !s.completed } : s)));
    
    setTimeout(() => {
      togglingSlotsRef.current.delete(slotId);
    }, 300);
  };

  // Session finished
  const addStudyLog = useStore(state => state.addStudyLog);
  const addPomodoroProgressToSlot = useStore(state => state.addPomodoroProgressToSlot);
  const getScheduleForDate = useStore(state => state.getScheduleForDate);

  const handleSessionComplete = (minutes: number, subjectId: string, topicId?: string) => {
    const hours = Number((minutes / 60).toFixed(2));
    const todayStr = getISTYMD();
    
    // Timetable Tab handling (Explicit selection or implicit "Live Now")
    const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const todaySchedule = getScheduleForDate(todayStr);
    
    let targetSlotId: string | null = null;
    let targetSlot = null;
    if (topicId?.startsWith('slot-')) {
      targetSlotId = topicId.replace('slot-', '');
      targetSlot = todaySchedule.find(s => s.id === targetSlotId);
    } else {
      // Find implicit slot
      const implicitSlot = todaySchedule.find(slot => {
        const parts = slot.time.split(' - ');
        return parts.length === 2 && nowStr >= parts[0] && nowStr <= parts[1] && slot.category === 'study';
      });
      if (implicitSlot) {
        targetSlotId = implicitSlot.id;
        targetSlot = implicitSlot;
      }
    }
    
    const matchSubj = subjects.find(s => s.id === subjectId);
    const subjName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : 'General Study';
    
    let chapTitle = topicId && !topicId.startsWith('slot-') ? matchSubj?.topics.find(t => t.id === topicId)?.title : 'Pomodoro Session';
    let finalSourceType = 'POMODORO';
    
    // If Timetable slot matches, it provides the chapter title
    if (targetSlot) {
      chapTitle = targetSlot.activity || chapTitle;
    }

    // Log to study history (this automatically adds hours to studyLogs too!)
    logStudyActivity({
      dateStr: todayStr,
      subject: subjName,
      subjectId: subjectId || 'general',
      chapterId: topicId,
      chapterTitle: chapTitle || 'Pomodoro Session',
      durationHours: hours,
      sourceType: finalSourceType as any
    });
        
    if (targetSlotId) {
      addPomodoroProgressToSlot(todayStr, targetSlotId, hours);
    }

    // Syllabus Tab: append/log against chapter/log against chapter
    if (topicId && !topicId.startsWith('slot-')) {
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        const updatedTopics = subject.topics.map(t => {
          if (t.id === topicId) {
            return { ...t, timeSpent: (t.timeSpent || 0) + hours };
          }
          return t;
        });
        setSubjects(prev => prev.map(s => s.id === subjectId ? { ...s, topics: updatedTopics } : s));
      }
    }
  };

  // Totals for metrics
  const totalChapters = subjects.reduce((acc, s) => acc + s.topics.length, 0);
  const completedCount = subjects.reduce((acc, s) => acc + s.topics.filter((t) => t.completed).length, 0);

  return (
    <div className={`min-h-screen flex flex-col ${isStandalone ? 'pb-safe' : ''} ${isStrictMode ? 'strict-theme bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-red-950/30 to-slate-950' : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950'} text-slate-100 font-sans selection:bg-mentor-500 selection:text-white transition-colors duration-700`}>
      {clockDesyncMsg && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-between shadow-md z-[9999] relative shrink-0">
          <span>{clockDesyncMsg}</span>
          <button onClick={() => setClockDesyncMsg(null)} className="ml-4 hover:bg-rose-500 rounded p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-white/5 blur-[140px] rounded-full" />
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        studyHoursToday={studyHoursToday}
        targetStudyHours={targetStudyHours}
        completedCount={completedCount}
        totalChapters={totalChapters}
        
        isStrictMode={isStrictMode}
        setIsStrictMode={setIsStrictMode}
        onSaveToCloud={handleSaveToCloud}
        isSavingToCloud={isSavingToCloud}
        onExportToExcel={() => setActiveModal('excel')}
        onDownloadBackupJson={() => setActiveModal('json')}
        
      />

      {/* Main Content Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'chat' && (
          <CompanionChat
            isFullPage={true}
            currentSubject={currentSubject}
            studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours}
            
            isStrictMode={isStrictMode}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onTimetableRequest={() => setActiveTab('timetable')}
          />
        )}

        {activeTab === "master-summary" && (
          <MasterSummary subjects={subjects} isStrictMode={isStrictMode} />
        )}
        {activeTab === 'radar' && (
          <BoSRadarWidget onAskPiyaa={() => setActiveTab('chat')} />
        )}

        {activeTab === 'subjects-hub' && (
          <SubjectKPIHub 
            subjects={subjects} 
            studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours}
            onUpdateStudyHours={(delta) => addStudyLog(null, delta)}
            onUpdateTargetHours={(delta) => setTargetStudyHours(prev => Math.max(1, prev + delta))}
            onNavigateToSyllabus={(subjectId) => { setActiveTab("subjects"); setCurrentSubject(subjectId); }}
          />
        )}

        {activeTab === 'timetable' && (
          <TimetablePlanner isStrictMode={isStrictMode}
            subjects={subjects}
            initialSlots={timetable}
            onUpdateTargetHours={(newTarget) => setTargetStudyHours(newTarget)}
            onSlotToggle={handleSlotToggle}
            onUpdateSchedule={(newSlots) => {
              setTimetable(newSlots);
              // studyHoursToday remains unchanged on schedule update
            }}
          />
        )}

        {activeTab === 'timer' && (
          <StudyTimer
            subjects={subjects}
            timetable={timetable}
            initialSubjectId={currentSubject}
            studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours}
            onSessionComplete={handleSessionComplete}
            onSetCurrentSubject={(subj) => setCurrentSubject(subj)}
            isStrictMode={isStrictMode}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
          />
        )}

        {activeTab === 'subjects' && (
          <SubjectTracker
            subjects={subjects}
            initialSubjectId={currentSubject}
            onToggleTopic={handleToggleTopic}
            onToggleTopicRevision={handleToggleTopicRevision}
            onUpdateRevision={handleUpdateRevision}
            onToggleRtpMtp={handleToggleRtpMtp}
            onUpdateMtp={(subjectId, mtpId, updates) => {
              setSubjects(prev => prev.map(s => {
                if (s.id !== subjectId) return s;
                return {
                  ...s,
                  mtpProgress: s.mtpProgress?.map(m => m.id === mtpId ? { ...m, ...updates } : m)
                };
              }));
            }}
            onUpdatePyq={(subjectId, pyqId, updates) => {
              setSubjects(prev => prev.map(s => {
                if (s.id !== subjectId) return s;
                return {
                  ...s,
                  pyqProgress: s.pyqProgress?.map(m => m.id === pyqId ? { ...m, ...updates } : m)
                };
              }));
            }}
          />
        )}

        {activeTab === 'analytics' && (
          <ProgressAnalyticsHub subjects={subjects} timetable={timetable} 
            isStrictMode={isStrictMode} />
        )}

        {activeTab === 'study-buddy' && (
          <div className="max-w-7xl mx-auto space-y-6 animate-fadeIn">
            <StudyBuddyHub currentUserStats={{
              hoursLoggedToday: studyHoursToday,
              firstReadPercent: totalChapters > 0 ? Math.round((subjects.reduce((acc, s) => acc + s.topics.filter(t => t.completed).length, 0) / totalChapters) * 100) : 0,
              rev1Percent: totalChapters > 0 ? Math.round((subjects.reduce((acc, s) => acc + s.topics.filter(t => t.rev1).length, 0) / totalChapters) * 100) : 0,
              streakDays: Math.max(0, ...Object.values(useStore.getState().subjectStreaks).map(s => s || 0)),
            }} />
          </div>
        )}

        {activeTab === 'motivation' && (
          <MotivationDeck 
            subjects={subjects}
            
            studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'evaluator' && <AIAnswerEvaluator />}
        {activeTab === 'flashcards' && <FlashcardVault />}
        {activeTab === 'calendar-tracker' && <CalendarTracker studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours} 
            isStrictMode={isStrictMode} completedCount={completedCount} totalChapters={totalChapters} />}
        {activeTab === 'exam-simulator' && (
          <ExamSimulatorModal 
            subjects={subjects} 
            isFullPage={true} 
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onUpdateStudyHours={(hours) => addStudyLog(null, hours)}
          />
        )}
        {activeTab === 'study-history' && <StudyHistoryHub />}
      </main>

      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onToggleStrictMode={() => setIsStrictMode(prev => !prev)}
        isStrictMode={isStrictMode}
        onOpenExamSimulator={() => setActiveModal('exam-simulator')}
        onOpenExportExcel={() => setActiveModal('excel')}
        onOpenExportJson={() => setActiveModal('json')}
        onToggleChat={() => setIsChatOpen(prev => !prev)}
        isChatOpen={isChatOpen}
      />

      {/* Export Excel Centered Pop-up Modal (Requirement 2) */}
      {activeModal === 'exam-simulator' && (
        <ExamSimulatorModal 
          onClose={() => setActiveModal(null)} 
          subjects={subjects} 
          isFullPage={false}
          onNavigateTab={(tab) => {
            setActiveModal(null);
            setActiveTab(tab as any);
          }}
          onUpdateStudyHours={(hours) => addStudyLog(null, hours)}
        />
      )}

      {activeModal === 'excel' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0B1528]/95 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#0B1528] shadow-2xl p-6 text-slate-100 relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-cyan-500/20 border border-cyan-500/40 rounded-xl text-cyan-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Export Study Data to Excel</h2>
                <p className="text-xs text-cyan-300">Generate a comprehensive .xlsx workbook for offline analysis</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">
              <div className="bg-slate-900/60 p-3 rounded-xl border border-cyan-500/20 shadow-inner">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Subjects</span>
                <p className="text-lg font-bold text-cyan-200">{subjects.length} Subjects</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-cyan-500/20 shadow-inner">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Timetable Slots</span>
                <p className="text-lg font-bold text-teal-200">{timetable.length} Slots</p>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-xl border border-cyan-500/20 col-span-2 sm:col-span-1 shadow-inner">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Chapters Completed</span>
                <p className="text-lg font-bold text-amber-200">{completedCount} / {totalChapters}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              This export generates structured Excel worksheets containing your complete CA Final timetable, chapter completion progress, RTP/MTP logs, and daily study hours.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  exportToExcel(subjects, timetable, useStore.getState().studyLogs);
                  setActiveModal(null);
                }}
                className="mentor-button px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                <FileSpreadsheet className="w-4 h-4 text-cyan-200" />
                <span>Download Excel Workbook</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Backup JSON Centered Pop-up Modal (Requirement 2) */}
      {activeModal === 'json' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0B1528]/95 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-teal-500/30 bg-[#0B1528] shadow-2xl p-6 text-slate-100 relative">
            <button
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-teal-500/20 border border-teal-500/40 rounded-xl text-teal-400">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Backup CA Companion JSON</h2>
                <p className="text-xs text-teal-300">Create a complete offline backup file of your entire application state</p>
              </div>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-xl border border-teal-500/20 my-5 space-y-2 shadow-inner">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Database Schema Version:</span>
                <span className="font-mono text-teal-300 font-bold">2.0 (Zustand Persistent)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Total Subjects & Topics:</span>
                <span className="font-mono text-teal-300 font-bold">{subjects.length} Subjects ({totalChapters} Chapters)</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Study Logs Tracked:</span>
                <span className="font-mono text-teal-300 font-bold">{useStore.getState().studyLogs.length} Sessions</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Save this backup JSON file to safely store your custom timetable schedules, chapter revision statuses, and study logs locally on your machine.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-slate-800 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  exportBackupJson();
                  setActiveModal(null);
                }}
                className="bg-teal-600 hover:bg-teal-500 border border-teal-400/40 px-5 py-2.5 rounded-xl text-white font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                <Download className="w-4 h-4 text-teal-100" />
                <span>Download Backup JSON File</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Daily Check-in Modal */}
      {showCheckinModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0B1528]/95 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#0B1528] p-6 shadow-2xl text-center relative text-slate-100">
            <button onClick={() => setShowCheckinModal(false)} className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white cursor-pointer min-h-[44px]" title="Close (ESC)">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 bg-cyan-950/80 rounded-full flex items-center justify-center mx-auto mb-4 border border-mentor-400/40">
              <Sparkles className="w-8 h-8 text-amber-300" />
            </div>
            {(() => {
              const hour = new Date().getHours();
              let greeting = "Good evening";
              if (hour < 12) greeting = "Good morning";
              else if (hour < 17) greeting = "Good afternoon";
              return <h2 className="text-xl font-bold text-white mb-2">{greeting}, My love! 💕</h2>;
            })()}
            <p className="text-sm text-cyan-100 mb-6">Aaj energy level kaisa hai? Piyaa is ready to plan your study sessions based on how you feel!</p>
            
            <div className="flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-4">
              <button 
                type="button"
                onClick={() => handleCheckIn('high')}
                className="mentor-button text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 cursor-pointer min-h-[44px]"
              >
                <span>🔥 High Energy! Ready to crush practicals!</span>
              </button>
              <button 
                type="button"
                onClick={() => handleCheckIn('low')}
                className="text-cyan-200 bg-slate-900 border border-cyan-500/30 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 hover:bg-cyan-900/30 cursor-pointer min-h-[44px]"
              >
                <span>💖 Low Energy. Let's do some light theory today.</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      {/* Floating Chat Window */}
      {isChatOpen && activeTab !== 'chat' && (
        <div 
          style={{ width: `${chatDimensions.width}px`, height: `${chatDimensions.height}px` }}
          className="fixed bottom-0 sm:bottom-20 right-0 sm:right-6 z-50 transition-all duration-300 origin-bottom-right"
        >
          <div className="relative w-full h-full flex flex-col">
            <button
              onClick={() => setIsChatOpen(false)}
              className="absolute -top-12 sm:-top-4 -right-2 sm:-right-4 z-50 p-2 rounded-full bg-slate-900/80 text-slate-300 hover:text-white border border-mentor-500/30 backdrop-blur-md shadow-lg transition-transform hover:scale-110 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div 
              onMouseDown={handleResizeMouseDown}
              className="absolute -top-1 -left-1 w-6 h-6 z-50 cursor-nwse-resize"
            >
              <div className="w-full h-full border-t-2 border-l-2 border-cyan-400 rounded-tl-xl opacity-50 hover:opacity-100" />
            </div>
            <div className="flex-1 w-full h-full overflow-hidden">
              <CompanionChat
                isFullPage={false}
                currentSubject={currentSubject}
                studyHoursToday={studyHoursToday}
            targetStudyHours={targetStudyHours}
                
            isStrictMode={isStrictMode}
                onNavigateTab={(tab) => { setActiveTab(tab as any); setIsChatOpen(false); }}
                onTimetableRequest={() => { setActiveTab("timetable"); setIsChatOpen(false); }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={auth.currentUser}
        onLogout={async () => {
          try {
            await auth.signOut();
            window.location.reload();
          } catch (err) {
            console.error(err);
          }
        }}
        onOpenHelpDocumentation={() => setIsHelpModalOpen(true)}
        isStrictMode={isStrictMode}
        setIsStrictMode={setIsStrictMode}
      />

      {/* Help & System Architecture Documentation Modal */}
      <HelpDocumentationModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      <PreDeployCheckModal
        isOpen={isPreDeployCheckOpen}
        onClose={() => setIsPreDeployCheckOpen(false)}
      />

      {/* Glassmorphic Floating Quick Action Dock & Ambient Soundscape Control */}
      <FloatingActionDock />

    </div>
  );
}
