import { getISTDate, getISTYMD } from "../lib/dateUtils";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, AlertTriangle, Heart, Activity, Users, Search, Calendar, Flame, Clock, Sparkles, BookOpen, MessageCircle, Layers, Award, LogIn, LogOut, Radar, PenTool, Brain, Target, FileSpreadsheet, ChevronDown, Zap, CloudCheck, Cloud, CloudOff, Download, Menu, X, Smartphone, ShieldCheck, Home } from 'lucide-react';
import { onAuthUserChanged, googleSignIn, logout, syncAccessControlFromCloud, isAuthorizedEmail, PRIMARY_AUTHORIZED_EMAIL } from '../lib/auth';
import { User } from 'firebase/auth';
import { stopRealtimeCloudSyncAndWipe } from '../lib/db';
import { useStore } from '../store';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { TodayStudyBreakdownModal } from './TodayStudyBreakdownModal';
import { OverallSyllabusAuditModal } from './OverallSyllabusAuditModal';

interface HeaderProps {
  activeTab: 'master-summary' | 'subjects-hub' | 'chat' | 'timetable' | 'timer' | 'subjects' | 'analytics' | 'radar' | 'motivation' | 'evaluator' | 'flashcards' | 'calendar-tracker' | 'study-buddy' | 'exam-simulator' | 'study-history';
  setActiveTab: (tab: 'master-summary' | 'subjects-hub' | 'chat' | 'timetable' | 'timer' | 'subjects' | 'analytics' | 'radar' | 'motivation' | 'evaluator' | 'flashcards' | 'calendar-tracker' | 'study-buddy' | 'exam-simulator' | 'study-history') => void;
  studyHoursToday: number;
  targetStudyHours: number;
  completedCount: number;
  totalChapters: number;
  isStrictMode: boolean;
  setIsStrictMode: (val: boolean) => void;
  onSaveToCloud: () => void;
  isSavingToCloud?: boolean;
  onExportToExcel?: () => void;
  onDownloadBackupJson?: () => void;
  onLogout?: () => void;
  setStreakDays?: React.Dispatch<React.SetStateAction<number>>;
}

function LiveISTClock() {
  const [timeStr, setTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const localTime = d.getTime();
      const localOffset = d.getTimezoneOffset() * 60000;
      const utc = localTime + localOffset;
      const offset = 5.5; // IST
      const bombay = utc + (3600000 * offset);
      const nd = new Date(bombay);
      const str = nd.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTimeStr(str);
    };
    updateTime();
    const iv = setInterval(updateTime, 1000);
    return () => clearInterval(iv);
  }, []);
  return (
    <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-slate-800/50 border border-slate-700/60 shadow-inner hidden sm:flex" title="Real-Time IST Clock">
      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
      <span className="font-mono text-xs font-black tracking-wider text-slate-200">{timeStr}</span>
    </div>
  );
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  studyHoursToday: propStudyHoursToday,
  targetStudyHours: propTargetStudyHours,
  completedCount,
  totalChapters,
  isStrictMode,
  setIsStrictMode,
  onSaveToCloud,
  isSavingToCloud = false,
  onExportToExcel,
  onDownloadBackupJson,
  onLogout,
  setStreakDays,
}) => {
  const isForceOfflineMode = useStore((state) => state.isForceOfflineMode);
  const setForceOfflineMode = useStore((state) => state.setForceOfflineMode);
  const subjects = useStore((state) => state.subjects);
  const selectedDateStr = useStore((state) => state.selectedDateStr) || getISTYMD();
  const dailyTargets = useStore((state) => state.dailyTargets) || {};
  const storeStudyLogs = useStore((state) => state.studyLogs) || [];
  const schedulesByDate = useStore((state) => state.schedulesByDate) || {};
  const storeTimetable = useStore((state) => state.timetable) || [];
  const getTotalHoursForDate = useStore((state) => state.getTotalHoursForDate);

  const todayTargetHours = dailyTargets[selectedDateStr] ?? 12.0;

  const todayCompletedHours = useMemo(() => {
    if (getTotalHoursForDate) {
      return getTotalHoursForDate(selectedDateStr);
    }
    return storeStudyLogs
      .filter((l) => l.date === selectedDateStr)
      .reduce((acc, log) => acc + log.hours, 0);
  }, [schedulesByDate, storeTimetable, storeStudyLogs, selectedDateStr, getTotalHoursForDate]);

  const totalSyllabusChapters = useMemo(() => {
    return subjects.reduce((acc, s) => acc + (s.topics?.length || 0), 0);
  }, [subjects]);

  const totalCompletedChapters = useMemo(() => {
    return subjects.reduce((acc, s) => acc + (s.topics?.filter((t) => t.completed).length || 0), 0);
  }, [subjects]);

  const completionPercent = Math.round((totalCompletedChapters / (totalSyllabusChapters || 1)) * 100);

  // Override props with reactive store values for downstream compatibility
  const studyHoursToday = todayCompletedHours;
  const targetStudyHours = todayTargetHours;

  // Exam target calculation (default target exam: Nov 1, 2026)
  const [examDate, setExamDate] = useState<string>('2026-11-01');
  const [daysLeft, setDaysLeft] = useState<number>(0);

  // Live Header Pomodoro Widget State
  const [pomodoroState, setPomodoroState] = useState<{
    isRunning: boolean;
    timeLeft: number;
    mode: 'work' | 'break';
    subjectCode?: string;
    subjectName?: string;
  }>(() => {
    try {
      const saved = sessionStorage.getItem('ca_companion_live_pomodoro');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { isRunning: false, timeLeft: 25 * 60, mode: 'work' };
  });

  useEffect(() => {
    const handlePomodoroUpdate = (e: any) => {
      if (e.detail) {
        setPomodoroState(e.detail);
      }
    };
    window.addEventListener('pomodoro-state-changed', handlePomodoroUpdate);
    return () => window.removeEventListener('pomodoro-state-changed', handlePomodoroUpdate);
  }, []);

  const prepWindowTotalDays = 300;
  const prepElapsedDays = Math.max(0, prepWindowTotalDays - daysLeft);
  const prepWindowPct = Math.min(100, Math.max(0, Math.round((prepElapsedDays / prepWindowTotalDays) * 100)));
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showStreakDropdown, setShowStreakDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'syllabus' | 'execution' | 'analytics' | 'settings' | null>(null);

  const cloudSyncStatus = useStore((state) => state.cloudSyncStatus);
  const getTotalBacklogDebtHours = useStore((state) => state.getTotalBacklogDebtHours);
  const getBacklogDebtDetails = useStore((state) => state.getBacklogDebtDetails);
  const quickAddMicroLog = useStore((state) => state.quickAddMicroLog);
  const setSelectedDateStr = useStore((state) => state.setSelectedDateStr);
  const totalBacklogDebt = getTotalBacklogDebtHours ? getTotalBacklogDebtHours() : 0;

  const [isBacklogModalOpen, setIsBacklogModalOpen] = useState(false);
  const [backlogSearchQuery, setBacklogSearchQuery] = useState('');
  const [isTodayModalOpen, setIsTodayModalOpen] = useState(false);
  const [isOverallModalOpen, setIsOverallModalOpen] = useState(false);

  useEffect(() => {
    const handleOpenBacklog = () => setIsBacklogModalOpen(true);
    const handleOpenToday = () => setIsTodayModalOpen(true);
    const handleOpenOverall = () => setIsOverallModalOpen(true);

    window.addEventListener('open-backlog-modal', handleOpenBacklog);
    window.addEventListener('open-today-breakdown-modal', handleOpenToday);
    window.addEventListener('open-overall-audit-modal', handleOpenOverall);

    return () => {
      window.removeEventListener('open-backlog-modal', handleOpenBacklog);
      window.removeEventListener('open-today-breakdown-modal', handleOpenToday);
      window.removeEventListener('open-overall-audit-modal', handleOpenOverall);
    };
  }, []);

  const backlogItems = useMemo(() => {
    return getBacklogDebtDetails ? getBacklogDebtDetails() : [];
  }, [getBacklogDebtDetails, totalBacklogDebt]);

  const filteredBacklogItems = useMemo(() => {
    if (!backlogSearchQuery.trim()) return backlogItems;
    const q = backlogSearchQuery.toLowerCase();
    return backlogItems.filter(
      (item) =>
        item.subject.toLowerCase().includes(q) ||
        item.activity.toLowerCase().includes(q) ||
        item.dateStr.includes(q)
    );
  }, [backlogItems, backlogSearchQuery]);

  const [clockDriftWarning, setClockDriftWarning] = useState<string | null>(null);

  useEffect(() => {
    const handleClockDesync = (e: any) => {
      if (e.detail && e.detail.warning) {
        setClockDriftWarning(e.detail.message);
      } else {
        setClockDriftWarning(null);
      }
    };
    window.addEventListener('clock-desync', handleClockDesync);
    return () => window.removeEventListener('clock-desync', handleClockDesync);
  }, []);

  const [showSyncToast, setShowSyncToast] = useState(false);
  const [offlineToast, setOfflineToast] = useState(false);

  useEffect(() => {
    const handleSyncSuccess = () => {
      setShowSyncToast(true);
      setTimeout(() => setShowSyncToast(false), 3000);
    };
    const handleOffline = () => {
      setOfflineToast(true);
      setTimeout(() => setOfflineToast(false), 4000);
    };
    window.addEventListener('offline-sync-success', handleSyncSuccess);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('offline-sync-success', handleSyncSuccess);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const streakDropdownRef = useRef<HTMLDivElement>(null);

  const { isInstallable, isStandalone, installApp } = usePWAInstall();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      if (streakDropdownRef.current && !streakDropdownRef.current.contains(event.target as Node)) {
        setShowStreakDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await syncAccessControlFromCloud();
      const res = await googleSignIn();
      if (res && res.user) {
        if (isAuthorizedEmail(res.user.email)) {
          alert(`✅ Welcome ${res.user.displayName || res.user.email?.split('@')[0] || 'Aspirant'}! Access Granted & Cloud Sync Active.`);
        } else {
          await logout();
          alert(`🔒 Access Restricted!\n\nYour Google account (${res.user.email}) is not on the authorized access list.\n\nPlease ask the Primary Administrator to add your email address to the authorized access list.`);
        }
      }
    } catch (err: any) {
      if (err?.code !== 'auth/unauthorized-domain') {
        console.error('Login failed:', err);
      }
      if (err?.code === 'auth/unauthorized-domain') {
        alert("Google Login blocked by Firebase:\n\nThe current domain is not authorized. To fix this, open your Firebase Console -> Authentication -> Settings -> Authorized domains, and add this app's URL.");
      } else {
        alert('Google Login failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogoutAction = async () => {
    setShowUserMenu(false);
    try {
      sessionStorage.removeItem('master_pin_unlocked');
      stopRealtimeCloudSyncAndWipe();
      await logout();
      if (onLogout) onLogout();
      alert('Logged out & App locked successfully! App state cleared safely.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  useEffect(() => {
    const calculateDays = () => {
      const [year, month, day] = examDate.split("-").map(Number); 
      const target = new Date(year, month - 1, day).getTime();
      const todayYmd = getISTYMD();
      const [cy, cm, cd] = todayYmd.split('-').map(Number);
      const now = new Date(cy, cm - 1, cd).getTime();
      const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff > 0 ? diff : 0);
    };
    calculateDays();
    const interval = setInterval(calculateDays, 60000);
    return () => clearInterval(interval);
  }, [examDate]);

  const logStudyActivity = useStore((state) => state.logStudyActivity);

  // Scroll lock & ESC key handler for Backlog Debt Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBacklogModalOpen) {
        setIsBacklogModalOpen(false);
      }
    };
    if (isBacklogModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isBacklogModalOpen]);

  const handleLogQuickActivity = () => {
    // Add 1.0 hr quick study log for general
    logStudyActivity({
      dateStr: selectedDateStr,
      subjectId: 'general',
      subject: 'General (Streak Saver)',
      chapterTitle: 'Quick Study / Revisions',
      durationHours: 1.0,
      sourceType: 'MANUAL'
    });

    if (setStreakDays) {
      setStreakDays((prev) => prev + 1);
    }

    // Show success toast
    // Hide warning alert

    // Auto-hide success after 5 seconds
    setTimeout(() => {
    }, 5000);
  };


  // Check active state for grouped dropdowns
  const isSyllabusGroupActive = ['subjects', 'subjects-hub'].includes(activeTab);
  const isExecutionGroupActive = ['timetable', 'timer', 'calendar-tracker'].includes(activeTab);
  const isAnalyticsGroupActive = ['analytics', 'radar', 'study-history'].includes(activeTab);

  const accentColor = isStrictMode ? "text-red-400" : "text-sky-400";
  const accentBg = isStrictMode ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-[#2dd4bf]/20 text-[#2dd4bf] border-[#2dd4bf]/30";


  const activeTabClasses = isStrictMode 
    ? "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/40 border-red-400 ring-2 ring-red-400 ring-offset-2 ring-offset-black scale-[1.03]" 
    : "bg-gradient-to-r from-sky-600 to-teal-500 text-white shadow-lg shadow-sky-500/40 border-sky-400 ring-2 ring-sky-400 ring-offset-2 ring-offset-[#040D17] scale-[1.03]";

  return (
    <>
    <header className={`sticky top-0 z-40 w-full text-white backdrop-blur-xl border-b shadow-xl transition-all duration-500 overflow-visible relative ${
      isStrictMode
        ? 'bg-[#0D0404]/80 border-red-500/20 shadow-red-950/10'
        : 'bg-[#090d16]/80 border-indigo-500/20 shadow-indigo-950/10'
    }`}>
      <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${isStrictMode ? 'bg-red-500/5 blur-[120px]' : 'bg-indigo-500/5 blur-[120px]'}`}></div>
      
      {showSyncToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass-card bg-sky-950/90 border-sky-500/50 px-4 py-2 rounded-xl text-sky-200 text-sm font-bold flex items-center gap-2 shadow-2xl shadow-sky-500/20 animate-fadeIn pointer-events-none">
          <CloudCheck className="w-5 h-5 text-indigo-300" />
          ✅ Offline Queue Synced!
        </div>
      )}
      {offlineToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] glass-card bg-rose-950/95 border-rose-500/50 px-4 py-2 rounded-xl text-rose-200 text-sm font-bold flex items-center gap-2 shadow-2xl shadow-rose-500/20 animate-in slide-in-from-bottom-5 fade-in pointer-events-none">
          <CloudOff className="w-5 h-5 text-rose-400 animate-pulse" />
          Network Offline. You can continue studying! Changes will be queued.
        </div>
      )}
      <div className="relative max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2.5">

        {/* Top Branding & Status Row */}
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 md:flex-auto">
            <div className="relative group shrink-0">
              <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr p-0.5 shadow-lg group-hover:scale-105 transition-transform ${isStrictMode ? 'from-red-500 via-red-300 to-white/80 shadow-red-500/30' : 'from-indigo-500 via-sky-400 to-indigo-300 shadow-indigo-500/30'}`}>
                <div className={`w-full h-full rounded-[14px] flex items-center justify-center overflow-hidden backdrop-blur-md ${isStrictMode ? 'bg-red-950/80' : 'bg-slate-950/80'}`}>
                  <span className={`text-lg sm:text-2xl drop-shadow-[0_0_8px_rgba(129,140,248,0.8)] ${isStrictMode ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : ''}`}>🌱🏼</span>
                </div>
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-slate-950 rounded-full animate-pulse ${isStrictMode ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-indigo-400 shadow-[0_0_10px_#818cf8]'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className={`text-base sm:text-xl md:text-2xl font-black tracking-tight drop-shadow truncate ${isStrictMode ? 'strict-gradient-text' : 'nature-gradient-text'}`}>
                  Piyaa 💕 CA Final Companion
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300/90 flex items-center gap-1 mt-0.5 font-medium truncate">
                <Heart className={`w-3 h-3 ${accentColor} fill-current animate-pulse shrink-0`} />
                <span className="truncate">"Aapki Piyaa aapke har step par aapke sath hai, My love! 🍃✨"</span>
              </p>
            </div>
          </div>

          {/* Streamlined Compact Metrics Bar (Option 1 Decluttered Capsule) */}
          <div className="flex items-center justify-center md:justify-end shrink-0 order-3 w-full md:w-auto md:flex-1 md:order-2 mt-2 md:mt-0">
            <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl glass-card border border-indigo-500/30 shadow-lg bg-slate-900/80 backdrop-blur-md">
              {/* Daily Progress Quick Trigger */}
              <button
                onClick={() => setIsTodayModalOpen(true)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl hover:bg-indigo-500/20 text-slate-100 transition-all cursor-pointer text-xs font-semibold active:scale-95"
                title="Click for Today's Detailed Study Microscope 🔍"
              >
                <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 -rotate-90 transform" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-white/10" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-indigo-400 transition-all duration-1000" strokeWidth="3.5" strokeDasharray="100" strokeDashoffset={100 - Math.min(100, (studyHoursToday / (targetStudyHours || 1)) * 100)} strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-[8px] font-mono font-bold text-indigo-300">{Math.round(Math.min(100, (studyHoursToday / (targetStudyHours || 1)) * 100))}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold hidden sm:inline">Today</span>
                  <span className="font-mono text-xs font-bold text-indigo-300">{studyHoursToday.toFixed(1)}/{targetStudyHours.toFixed(1)}h</span>
                </div>
              </button>

              <span className="text-slate-700 select-none text-xs">|</span>

              {/* Overall Syllabus Audit Trigger */}
              <button
                onClick={() => setIsOverallModalOpen(true)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl hover:bg-sky-500/20 text-slate-100 transition-all cursor-pointer text-xs font-semibold active:scale-95"
                title="Click for Overall CA Final Syllabus Audit 📊"
              >
                <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 -rotate-90 transform" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-white/10" strokeWidth="3.5" />
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-sky-400 transition-all duration-1000" strokeWidth="3.5" strokeDasharray="100" strokeDashoffset={100 - Math.min(100, completionPercent)} strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-[8px] font-mono font-bold text-sky-400">{completionPercent}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold hidden sm:inline">Overall</span>
                  <span className="font-mono text-xs font-bold text-sky-300">{totalCompletedChapters}/{totalSyllabusChapters}ch</span>
                </div>
              </button>

              <span className="text-slate-700 select-none text-xs">|</span>

              {/* 🎯 Exam Countdown Progress Meter */}
              <button
                onClick={() => {
                  const newDate = prompt("Enter Target CA Final Exam Date (YYYY-MM-DD):", examDate);
                  if (newDate && /^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
                    setExamDate(newDate);
                  }
                }}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl hover:bg-amber-500/20 text-slate-100 transition-all cursor-pointer text-xs font-semibold active:scale-95"
                title="Click to set CA Final Exam Date | Exam Timeline Progress 🎯"
              >
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1 leading-tight">
                    <Target className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-mono text-xs font-black text-amber-300">{daysLeft}d</span>
                    <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">Left</span>
                  </div>
                  <div className="w-14 sm:w-18 bg-slate-800 rounded-full h-1 mt-0.5 overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 via-teal-400 to-[#2dd4bf] transition-all duration-700 rounded-full shadow-[0_0_6px_rgba(45,212,191,0.6)]"
                      style={{ width: `${prepWindowPct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] font-mono font-extrabold text-amber-300/90 hidden sm:inline">{prepWindowPct}%</span>
              </button>

              <span className="text-slate-700 select-none text-xs hidden sm:inline">|</span>
              <LiveISTClock />

              {/* ⏱️ Live Header Pomodoro Widget (Top Metrics Capsule) */}
              {(pomodoroState.isRunning || pomodoroState.timeLeft < 25 * 60) && (
                <>
                  <span className="text-slate-700 select-none text-xs">|</span>
                  <button
                    onClick={() => setActiveTab('timer')}
                    className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl transition-all cursor-pointer text-xs font-mono font-black active:scale-95 ${
                      pomodoroState.isRunning
                        ? 'bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-cyan-950/90 border border-[#2dd4bf] text-emerald-300 shadow-[0_0_12px_rgba(45,212,191,0.4)] animate-pulse'
                        : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                    title="Click to view live Pomodoro Timer in Focus Room ⏳"
                  >
                    <Clock className={`w-3.5 h-3.5 ${pomodoroState.isRunning ? 'text-[#2dd4bf] animate-spin' : 'text-slate-400'}`} style={{ animationDuration: '4s' }} />
                    <span className="text-xs">{pomodoroState.mode === 'break' ? '☕' : '⏳'}</span>
                    <span className="font-mono font-black text-slate-100">
                      {Math.floor(pomodoroState.timeLeft / 60).toString().padStart(2, '0')}:
                      {(pomodoroState.timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                    {pomodoroState.subjectCode && (
                      <span className="text-[9px] font-sans font-bold text-teal-300 bg-teal-500/20 px-1 rounded hidden lg:inline">
                        {pomodoroState.subjectCode}
                      </span>
                    )}
                  </button>
                </>
              )}

              {/* Backlog Debt Trigger */}
              {totalBacklogDebt > 0 && (
                <>
                  <span className="text-slate-700 select-none text-xs">|</span>
                  <button
                    onClick={() => setIsBacklogModalOpen(true)}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-950/70 hover:bg-rose-900/90 border border-rose-500/40 text-rose-200 transition-all cursor-pointer text-xs font-mono font-black shrink-0 active:scale-95"
                    title="Click to view Backlog Debt Pool 🎒"
                  >
                    <span>🎒</span>
                    <span className="text-rose-300">+{totalBacklogDebt.toFixed(1)}h</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 md:order-3">
            {/* Settings & Profile Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800/95 border border-[#2dd4bf]/50 hover:border-[#2dd4bf] text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.4)] ring-1 ring-white/10 transition-all duration-200 cursor-pointer active:scale-98 min-h-[36px] sm:min-h-[40px]"
              >
                <div className="relative shrink-0">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt={currentUser.displayName || 'User'} className="w-7 h-7 rounded-full border border-[#2dd4bf] object-cover shrink-0 shadow-sm" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2dd4bf] to-teal-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-md shrink-0">
                      {currentUser ? (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase() : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                    </div>
                  )}
                  {/* Status Indicator Dot */}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                    clockDriftWarning || cloudSyncStatus === 'error' ? 'bg-rose-500 animate-ping' :
                    cloudSyncStatus === 'saving' || cloudSyncStatus === 'offline_queued' || isForceOfflineMode ? 'bg-amber-400 animate-pulse' :
                    'bg-emerald-400'
                  }`} title={`Status: ${cloudSyncStatus} ${clockDriftWarning ? '(Time Desync)' : ''}`} />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-extrabold text-slate-100 truncate max-w-[90px] sm:max-w-[110px] leading-tight">
                    {currentUser ? (currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || 'Account') : 'Menu'}
                  </span>
                  <span className="text-[9px] font-bold text-[#2dd4bf] tracking-wider uppercase leading-none mt-0.5">Profile</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#2dd4bf] shrink-0 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-950/98 border border-[#2dd4bf]/40 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-3 z-50 ring-1 ring-white/10 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* User Profile Header Card */}
                  {currentUser ? (
                    <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80 shadow-inner">
                      <div className="flex items-center gap-2.5">
                        {currentUser.photoURL ? (
                          <img src={currentUser.photoURL} alt="" className="w-9 h-9 rounded-full border border-[#2dd4bf]/60 object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2dd4bf] to-teal-400 text-slate-950 flex items-center justify-center font-black text-sm shrink-0">
                            {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold text-slate-100 text-xs truncate">{currentUser.displayName || 'CA Final Aspirant'}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{currentUser.email}</p>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                        <div className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-xl border ${
                          cloudSyncStatus === 'synced' ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]' :
                          cloudSyncStatus === 'saving' ? 'text-amber-300 bg-amber-950/80 border-amber-500/40 animate-pulse' :
                          'text-rose-300 bg-rose-950/80 border-rose-500/40'
                        }`}>
                          {cloudSyncStatus === 'synced' && <CloudCheck className="w-3 h-3 text-emerald-400" />}
                          {cloudSyncStatus === 'saving' && <Cloud className="w-3 h-3 text-amber-400" />}
                          {(cloudSyncStatus === 'error' || cloudSyncStatus === 'offline_queued' || cloudSyncStatus === 'idle') && <CloudOff className="w-3 h-3 text-rose-400" />}
                          <span>Cloud Sync: {cloudSyncStatus === 'synced' ? 'Synced & Secure' : cloudSyncStatus === 'saving' ? 'Syncing...' : cloudSyncStatus === 'offline_queued' ? 'Queued Offline' : 'Offline'}</span>
                        </div>
                        {clockDriftWarning && (
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-rose-300 bg-rose-950/80 px-2.5 py-1 rounded-xl border border-rose-500/40">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span className="truncate">{clockDriftWarning}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/80">
                      <p className="font-extrabold text-slate-100 text-xs">CA Final Companion</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Sign in with Google to sync study progress</p>
                      <button
                        onClick={() => { handleLogin(); setShowUserMenu(false); }}
                        disabled={isLoggingIn}
                        className="mt-2.5 w-full bg-white hover:bg-slate-100 text-slate-950 px-3 py-2 rounded-xl flex items-center justify-center gap-2 border border-slate-200 transition-all font-black shadow-md cursor-pointer active:scale-98 text-xs"
                      >
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>{isLoggingIn ? 'Signing in...' : 'Sign in with Google'}</span>
                      </button>
                    </div>
                  )}

                  {/* Search Button moved inside Profile Menu */}
                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-command-palette'));
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500/20 via-sky-500/15 to-emerald-500/20 hover:from-teal-500/35 hover:to-emerald-500/35 border border-[#2dd4bf]/50 hover:border-[#2dd4bf] text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(45,212,191,0.2)] hover:shadow-[0_0_22px_rgba(45,212,191,0.4)] cursor-pointer group active:scale-98"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-[#2dd4bf]/20 text-[#2dd4bf] group-hover:scale-110 transition-transform">
                        <Search className="w-3.5 h-3.5" />
                      </div>
                      <span className="tracking-wide">Quick Search & Commands</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono text-slate-300 bg-slate-900/90 rounded-md border border-[#2dd4bf]/40 shadow-inner">⌘K</span>
                  </button>

                  {isInstallable && (
                    <button
                      onClick={() => {
                        installApp();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600/90 to-cyan-600/90 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs transition-all border border-emerald-400/40 shadow-[0_0_14px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer text-left active:scale-98"
                    >
                      <Smartphone className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span className="truncate">📲 Install Standalone App</span>
                    </button>
                  )}

                  {/* Settings & Controls Group */}
                  <div className="p-2.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#2dd4bf] font-black mb-1.5 px-1">Aspirant Controls</p>
                      <div className="space-y-1.5">
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-profile-modal'));
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-xs font-bold text-cyan-200 cursor-pointer transition-all"
                        >
                          <span className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                            <span>View Profile & Manual</span>
                          </span>
                          <span className="text-[10px] text-cyan-400 font-mono">📖</span>
                        </button>

                        <button
                          onClick={() => setIsStrictMode(!isStrictMode)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-[#2dd4bf]/60 text-xs font-bold text-slate-200 cursor-pointer transition-all"
                        >
                          <span className="flex items-center gap-2">
                            {isStrictMode ? <Flame className="w-3.5 h-3.5 text-red-400" /> : <Heart className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                            <span>{isStrictMode ? 'Strict Mode (Crimson)' : 'Chill Mode (Emerald)'}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">Toggle</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <p className="text-[10px] uppercase tracking-wider text-[#2dd4bf] font-black mb-1.5 px-1">Cloud & Data</p>
                      <div className="space-y-1.5">
                        <button
                          onClick={() => {
                            const newMode = !isForceOfflineMode;
                            setForceOfflineMode(newMode);
                            if (newMode) {
                              useStore.getState().setCloudSyncStatus('offline_queued');
                            } else {
                              if (navigator.onLine) {
                                useStore.getState().setCloudSyncStatus('idle');
                                onSaveToCloud();
                              }
                            }
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs font-bold text-slate-200 cursor-pointer transition-all"
                        >
                          <span className="flex items-center gap-2">
                            {isForceOfflineMode ? <CloudOff className="w-3.5 h-3.5 text-amber-400" /> : <Cloud className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                            <span>{isForceOfflineMode ? 'Offline Mode Active' : 'Go Offline Mode'}</span>
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">Toggle</span>
                        </button>

                        <button
                          onClick={() => {
                            onSaveToCloud();
                            setShowUserMenu(false);
                          }}
                          disabled={isSavingToCloud || cloudSyncStatus === 'saving'}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-sky-900/50 hover:text-white transition-all text-left cursor-pointer border border-transparent hover:border-sky-500/30"
                        >
                          {isSavingToCloud || cloudSyncStatus === 'saving' ? (
                            <div className="w-3.5 h-3.5 rounded-full border-2 border-[#2dd4bf] border-t-transparent animate-spin" />
                          ) : cloudSyncStatus === 'error' ? (
                            <CloudOff className="w-3.5 h-3.5 text-red-400" />
                          ) : cloudSyncStatus === 'offline_queued' ? (
                            <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <CloudCheck className="w-3.5 h-3.5 text-[#2dd4bf]" />
                          )}
                          <span>Cloud Sync ({cloudSyncStatus})</span>
                        </button>
                        
                        {onExportToExcel && (
                          <button
                            onClick={() => {
                              onExportToExcel();
                              setShowUserMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-sky-900/50 hover:text-white transition-all text-left cursor-pointer border border-transparent hover:border-sky-500/30"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-[#2dd4bf]" />
                            <span>Export Excel Dashboard</span>
                          </button>
                        )}
                        
                        {onDownloadBackupJson && (
                          <button
                            onClick={() => {
                              onDownloadBackupJson();
                              setShowUserMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-teal-200 hover:bg-teal-900/50 hover:text-white transition-all text-left cursor-pointer border border-transparent hover:border-teal-500/30"
                          >
                            <Download className="w-3.5 h-3.5 text-teal-300" />
                            <span>Backup JSON File</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("open-predeploy-modal"));
                            setShowUserMenu(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold text-emerald-300 hover:bg-emerald-950/60 transition-all text-left cursor-pointer border border-emerald-500/30 bg-emerald-950/30 shadow-sm"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Pre-Deploy Audit Check</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {currentUser && (
                    <button
                      onClick={handleLogoutAction}
                      className="w-full text-left px-3.5 py-2.5 text-xs font-black text-rose-300 bg-rose-950/30 hover:bg-rose-900/50 border border-rose-500/30 rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-98"
                    >
                      <div className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Logout & Clear Session</span>
                      </div>
                      <span className="text-[10px] text-rose-400 font-mono">→</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button (Requirement 1) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 min-h-[32px] sm:min-h-[40px] min-w-[40px] rounded-xl glass-card glass-card-hover border border-[#2dd4bf]/40 text-slate-100 hover:text-white flex items-center justify-center cursor-pointer shadow-md active:scale-95"
              aria-label="Toggle Navigation Drawer"
            >
              {isMobileMenuOpen ? (
                <X className={`w-5 h-5 ${accentColor}`} />
              ) : (
                <Menu className="w-5 h-5 text-[#2dd4bf]" />
              )}
            </button>
          </div>
        </div>


        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 pt-2 border-t border-[#2dd4bf]/30 space-y-2.5 pb-3 animate-in fade-in slide-in-from-top-2 max-h-[80vh] overflow-y-auto px-0.5 relative z-50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#2dd4bf] px-2 flex items-center justify-between">
              <span>Navigation Menu</span>
              <span className="text-slate-400">Select Section</span>
            </div>

            {isInstallable && (
              <button
                onClick={() => {
                  installApp();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3.5 py-1.5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/90 to-cyan-600/90 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:shadow-[0_0_16px_rgba(16,185,129,0.4)] cursor-pointer transition-all border border-emerald-400/40 min-h-[44px]"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>📲 Install Standalone App</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md bg-black/40 text-[10px] font-mono border border-white/30 uppercase ${accentColor}`}>Install</span>
              </button>
            )}

            {/* 0. ✨ AI Mentor Primary Mobile Button */}
            <button
              onClick={() => {
                setActiveTab("chat");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-1.5 sm:py-2.5 rounded-xl font-extrabold text-sm min-h-[44px] transition-all text-left cursor-pointer border shadow-lg ${
                activeTab === "chat"
                  ? activeTabClasses
                  : isStrictMode
                    ? "bg-red-950/40 border-red-500/60 text-red-200 hover:bg-red-900/60 shadow-red-500/10"
                    : "bg-sky-950/40 border-[#2dd4bf]/60 text-slate-100 hover:bg-sky-900/60 shadow-[#2dd4bf]/10"
              }`}
            >
              <Sparkles className={`w-4.5 h-4.5 ${accentColor} animate-pulse shrink-0`} />
              <span className="flex-1 font-black">✨ AI Mentor</span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 ${accentColor} border border-amber-400/30 font-bold`}>AI Hub</span>
            </button>

            {/* 1. Master Summary */}
            <button
              onClick={() => {
                setActiveTab("master-summary");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-1.5 sm:py-2.5 rounded-xl font-bold text-sm min-h-[44px] transition-all text-left cursor-pointer ${
                activeTab === "master-summary"
                  ? "bg-gradient-to-r from-[#2dd4bf] to-teal-600 text-white shadow-md"
                  : "glass-card glass-card-hover text-slate-100 hover:bg-sky-900/40"
              }`}
            >
              <Target className={`w-4 h-4 ${accentColor}`} />
              <span>Master Summary</span>
            </button>

            {/* 2. Syllabus & Subjects Group */}
            <div className="bg-slate-900/80 rounded-xl p-2 border border-[#2dd4bf]/20 space-y-1">
              <p className="text-[11px] font-bold text-[#2dd4bf]/80 px-2 py-1 flex items-center gap-1.5">
                <BookOpen className={`w-3.5 h-3.5 ${accentColor}`} />
                <span>📚 Syllabus & Subjects</span>
              </p>
              <button
                onClick={() => {
                  setActiveTab('subjects');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'subjects'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <BookOpen className={`w-3.5 h-3.5 ${accentColor}`} />
                <span>ICAI Syllabus Checklists</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('subjects-hub');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'subjects-hub'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-teal-300" />
                <span>Subjects Hub & Analytics</span>
              </button>
            </div>

            {/* 3. Daily Execution Group */}
            <div className="bg-slate-900/80 rounded-xl p-2 border border-[#2dd4bf]/20 space-y-1">
              <p className="text-[11px] font-bold text-[#2dd4bf]/80 px-2 py-1 flex items-center gap-1.5">
                <Zap className={`w-3.5 h-3.5 ${accentColor}`} />
                <span>⚡ Daily Execution</span>
              </p>
              <button
                onClick={() => {
                  setActiveTab('timetable');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'timetable'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Calendar className={`w-3.5 h-3.5 ${accentColor}`} />
                <span>Time Table Schedule</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('timer');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'timer'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-[#2dd4bf]" />
                <span>Focus Pomodoro Timer</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('calendar-tracker');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'calendar-tracker'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                <span>Daily Sync Tracker</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setActiveTab('exam-simulator');
                  window.dispatchEvent(new CustomEvent('open-exam-simulator'));
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'exam-simulator'
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50 font-bold'
                    : 'text-slate-200 hover:bg-orange-900/50'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-red-400" />
                <span className="text-orange-300 font-bold">🛑 3-Hr Exam Mode</span>
              </button>

            </div>

            {/* 4. Analytics & Radar Group */}
            <div className="bg-slate-900/80 rounded-xl p-2 border border-[#2dd4bf]/20 space-y-1">
              <p className="text-[11px] font-bold text-[#2dd4bf]/80 px-2 py-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>📊 Analytics & Radar</span>
              </p>
              <button
                onClick={() => {
                  setActiveTab('analytics');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Analytics Hub</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('radar');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'radar'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Radar className="w-3.5 h-3.5 text-blue-400" />
                <span>ICAI Live Radar</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('study-history');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] transition-all text-left cursor-pointer ${
                  activeTab === 'study-history'
                    ? 'bg-[#2dd4bf]/30 text-slate-100 border border-[#2dd4bf]/40 font-bold'
                    : 'text-slate-200 hover:bg-sky-900/50'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>📚 Study Audit Ledger</span>
              </button>
            </div>

            {/* 5. Motivation Pill */}
            <button
              onClick={() => {
                setActiveTab('motivation');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-1.5 sm:py-2.5 rounded-xl font-bold text-sm min-h-[44px] transition-all text-left cursor-pointer ${
                activeTab === 'motivation'
                  ? activeTabClasses
                  : "glass-card glass-card-hover text-red-200 hover:bg-red-950/40 border border-amber-500/30"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${accentColor} animate-pulse`} />
              <span>✨ Motivation Corner</span>
            </button>

            {/* 6. 🤝 Study Buddy Room */}
            <button
              onClick={() => {
                setActiveTab('study-buddy');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-1.5 sm:py-2.5 rounded-xl font-bold text-sm min-h-[44px] transition-all text-left cursor-pointer ${
                activeTab === 'study-buddy'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30"
                  : "glass-card glass-card-hover text-blue-200 hover:bg-blue-950/40 border border-blue-500/30"
              }`}
            >
              <Users className="w-4 h-4 text-blue-300 shrink-0" />
              <span>🤝 Study Buddy Room</span>
            </button>

            {/* 7. ⚙️ Settings & Secondary Tools Group */}
            <div className="bg-slate-900/90 rounded-xl p-2.5 border border-[#2dd4bf]/30 space-y-1.5">
              <p className="text-[11px] font-bold text-[#2dd4bf] px-1 flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>⚙️ Settings & Tools</span>
              </p>

              {onExportToExcel && (
                <button
                  onClick={() => {
                    onExportToExcel();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-sky-900/50 min-h-[40px] text-left cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#2dd4bf]" />
                  <span>Export Excel Dashboard</span>
                </button>
              )}

              {onDownloadBackupJson && (
                <button
                  onClick={() => {
                    onDownloadBackupJson();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-teal-200 hover:bg-teal-900/50 min-h-[40px] text-left cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-teal-300" />
                  <span>Download Backup JSON</span>
                </button>
              )}

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-predeploy-modal"));
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-950/50 min-h-[40px] text-left cursor-pointer border border-emerald-500/30"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pre-Deploy Audit Check</span>
              </button>

              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-profile-modal"));
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-cyan-200 hover:bg-cyan-950/50 min-h-[40px] text-left cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                <span>View Profile & Manual</span>
              </button>

              <button
                onClick={() => {
                  setIsStrictMode(!isStrictMode);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-slate-800/80 min-h-[40px] cursor-pointer border border-slate-700/50"
              >
                <span className="flex items-center gap-2">
                  {isStrictMode ? <Flame className="w-3.5 h-3.5 text-red-400" /> : <Heart className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                  <span>{isStrictMode ? "Strict Mode (Crimson)" : "Chill Mode (Emerald)"}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Toggle</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Segmented Glass Dock Navigation Bar (Desktop Only) */}
        <div className="hidden md:block mt-2.5 pt-1.5" ref={dropdownRef}>
          <nav className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-6xl mx-auto p-1.5 rounded-full bg-slate-900/70 backdrop-blur-xl border border-[#2dd4bf]/25 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-white/10">
            
            {/* 0. Default Home Tab: Home Icon */}
            <button
              onClick={() => {
                setActiveTab("master-summary");
                setOpenDropdown(null);
              }}
              className={`flex items-center justify-center px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                activeTab === "master-summary"
                  ? "bg-gradient-to-r from-[#2dd4bf] to-teal-600 text-white shadow-[0_0_18px_rgba(45,212,191,0.5)] border border-[#2dd4bf]/80 scale-[1.05]"
                  : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
              }`}
              title="Home (Master Summary)"
            >
              <Home className={`w-4 h-4 ${activeTab === "master-summary" ? "text-white" : accentColor}`} />
            </button>

            {/* 1. ✨ AI Mentor Assistant */}
            <button
              onClick={() => {
                setActiveTab("chat");
                setOpenDropdown(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeTab === "chat"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_18px_rgba(45,212,191,0.5)] border border-[#2dd4bf]/80 scale-[1.02]"
                  : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === "chat" ? "text-white" : `${accentColor} animate-pulse`}`} />
              <span className="tracking-wide">✨ AI Mentor</span>
            </button>

            {/* ⏱️ Live Pomodoro Mini Badge in Navigation Dock */}
            {pomodoroState.isRunning && (
              <button
                onClick={() => {
                  setActiveTab('timer');
                  setOpenDropdown(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500/30 via-emerald-500/20 to-cyan-500/30 border border-[#2dd4bf] text-emerald-300 font-extrabold text-xs sm:text-sm shadow-[0_0_15px_rgba(45,212,191,0.35)] animate-pulse cursor-pointer hover:scale-105 transition-all"
                title="Live Pomodoro Session Active - Click to open Focus Room ⏳"
              >
                <Clock className="w-3.5 h-3.5 text-[#2dd4bf] animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-xs">{pomodoroState.mode === 'break' ? '☕' : '⏳'}</span>
                <span className="font-mono font-extrabold text-white">
                  {Math.floor(pomodoroState.timeLeft / 60).toString().padStart(2, '0')}:
                  {(pomodoroState.timeLeft % 60).toString().padStart(2, '0')}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#2dd4bf] text-slate-950 font-black tracking-wider uppercase font-sans">
                  LIVE
                </span>
              </button>
            )}

            {/* 2. Grouped Dropdown: Syllabus & Subjects */}
            <div className="relative group">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(prev => prev === 'syllabus' ? null : 'syllabus');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isSyllabusGroupActive
                    ? "bg-gradient-to-r from-[#2dd4bf] to-teal-600 text-white shadow-[0_0_18px_rgba(45,212,191,0.5)] border border-[#2dd4bf]/80 scale-[1.02]"
                    : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
                }`}
              >
                <BookOpen className={`w-4 h-4 ${isSyllabusGroupActive ? "text-white" : accentColor}`} />
                <span>📚 Syllabus & Subjects</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180 ${openDropdown === 'syllabus' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute left-0 top-full pt-2 w-56 z-50 transition-all duration-150 ${
                openDropdown === 'syllabus' ? 'block opacity-100' : 'hidden group-hover:block group-hover:opacity-100'
              }`}>
                <div className="bg-slate-950/95 backdrop-blur-2xl border border-[#2dd4bf]/40 rounded-2xl p-2 shadow-2xl ring-1 ring-[#2dd4bf]/20 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('subjects');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'subjects' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <BookOpen className={`w-3.5 h-3.5 ${accentColor}`} />
                    <span>ICAI Syllabus</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('subjects-hub');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'subjects-hub' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-teal-300" />
                    <span>Subjects Hub</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Grouped Dropdown: Daily Execution */}
            <div className="relative group">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(prev => prev === 'execution' ? null : 'execution');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isExecutionGroupActive
                    ? "bg-gradient-to-r from-[#2dd4bf] to-teal-600 text-white shadow-[0_0_18px_rgba(45,212,191,0.5)] border border-[#2dd4bf]/80 scale-[1.02]"
                    : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
                }`}
              >
                <Zap className={`w-4 h-4 ${isExecutionGroupActive ? "text-white" : accentColor}`} />
                <span>⚡ Daily Execution</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180 ${openDropdown === 'execution' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute left-0 top-full pt-2 w-56 z-50 transition-all duration-150 ${
                openDropdown === 'execution' ? 'block opacity-100' : 'hidden group-hover:block group-hover:opacity-100'
              }`}>
                <div className="bg-slate-950/95 backdrop-blur-2xl border border-[#2dd4bf]/40 rounded-2xl p-2 shadow-2xl ring-1 ring-[#2dd4bf]/20 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('timetable');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'timetable' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Calendar className={`w-3.5 h-3.5 ${accentColor}`} />
                    <span>Time Table</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('timer');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'timer' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#2dd4bf]" />
                    <span>Focus Pomodoro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('calendar-tracker');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'calendar-tracker' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-300" />
                    <span>Daily Tracker</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOpenDropdown(null);
                      setActiveTab('exam-simulator');
                      window.dispatchEvent(new CustomEvent('open-exam-simulator'));
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'exam-simulator'
                        ? 'bg-amber-500/30 text-amber-200 font-bold border border-amber-500/50'
                        : 'text-slate-300 hover:bg-orange-900/60 hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-orange-300 font-bold">🛑 3-Hr Exam Mode</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Grouped Dropdown: Analytics & Radar */}
            <div className="relative group">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(prev => prev === 'analytics' ? null : 'analytics');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isAnalyticsGroupActive
                    ? "bg-gradient-to-r from-[#2dd4bf] to-teal-600 text-white shadow-[0_0_18px_rgba(45,212,191,0.5)] border border-[#2dd4bf]/80 scale-[1.02]"
                    : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
                }`}
              >
                <Layers className={`w-4 h-4 ${isAnalyticsGroupActive ? "text-white" : "text-purple-400"}`} />
                <span>📊 Analytics & Radar</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180 ${openDropdown === 'analytics' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute left-0 top-full pt-2 w-56 z-50 transition-all duration-150 ${
                openDropdown === 'analytics' ? 'block opacity-100' : 'hidden group-hover:block group-hover:opacity-100'
              }`}>
                <div className="bg-slate-950/95 backdrop-blur-2xl border border-[#2dd4bf]/40 rounded-2xl p-2 shadow-2xl ring-1 ring-[#2dd4bf]/20 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('analytics');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'analytics' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Analytics Hub</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('radar');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'radar' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Radar className="w-3.5 h-3.5 text-blue-400" />
                    <span>ICAI Live Radar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('study-history');
                      setOpenDropdown(null);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                      activeTab === 'study-history' 
                        ? 'bg-[#2dd4bf]/30 text-white font-bold border border-[#2dd4bf]/50 shadow-[0_0_12px_rgba(45,212,191,0.25)]' 
                        : 'text-slate-300 hover:bg-sky-900/60 hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>📚 Study Audit Ledger</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Direct Accent Pill: Motivation */}
            <button
              onClick={() => {
                setActiveTab('motivation');
                setOpenDropdown(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeTab === 'motivation'
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-[0_0_18px_rgba(245,158,11,0.5)] border border-amber-400/80 scale-[1.02]"
                  : "bg-slate-800/40 text-amber-200/90 border border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-100 hover:border-amber-400/60 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] hover:backdrop-blur-lg"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${activeTab === "motivation" ? "text-white" : `${accentColor} animate-pulse`}`} />
              <span>✨ Motivation</span>
            </button>

            {/* 6. Direct Accent Pill: Study Buddy */}
            <button
              onClick={() => {
                setActiveTab('study-buddy');
                setOpenDropdown(null);
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                activeTab === 'study-buddy'
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.5)] border border-blue-400/80 scale-[1.02]"
                  : "bg-slate-800/40 text-blue-200/90 border border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-100 hover:border-blue-400/60 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:backdrop-blur-lg"
              }`}
            >
              <Users className={`w-4 h-4 ${activeTab === "study-buddy" ? "text-white" : "text-blue-300"}`} />
              <span>🤝 Study Buddy</span>
            </button>

            {/* 7. Collapsible Secondary Dropdown: Settings & More */}
            <div className="relative group">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenDropdown(prev => prev === 'settings' ? null : 'settings');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  openDropdown === 'settings'
                    ? "bg-slate-800/90 text-white border border-[#2dd4bf]/70 shadow-[0_0_15px_rgba(45,212,191,0.3)]"
                    : "bg-slate-800/40 text-slate-300 border border-slate-700/40 hover:bg-[#2dd4bf]/20 hover:text-white hover:border-[#2dd4bf]/60 hover:shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:backdrop-blur-lg"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>⚙️ Settings & More</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180 ${openDropdown === 'settings' ? 'rotate-180' : ''}`} />
              </button>

              <div className={`absolute right-0 top-full pt-2 w-64 z-50 transition-all duration-150 ${
                openDropdown === 'settings' ? 'block opacity-100' : 'hidden group-hover:block group-hover:opacity-100'
              }`}>
                <div className="bg-slate-950/95 backdrop-blur-2xl border border-[#2dd4bf]/40 rounded-2xl p-2.5 shadow-2xl ring-1 ring-[#2dd4bf]/20 space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="px-2 py-1 border-b border-slate-800/80 text-[10px] uppercase tracking-wider font-bold text-slate-400 flex items-center justify-between">
                    <span>Tools & System</span>
                    <span className="text-[#2dd4bf]">Config</span>
                  </div>

                  {onExportToExcel && (
                    <button
                      type="button"
                      onClick={() => {
                        onExportToExcel();
                        setOpenDropdown(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-sky-900/60 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#2dd4bf]" />
                      <span>Export Excel Dashboard</span>
                    </button>
                  )}

                  {onDownloadBackupJson && (
                    <button
                      type="button"
                      onClick={() => {
                        onDownloadBackupJson();
                        setOpenDropdown(null);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-teal-200 hover:bg-teal-900/60 hover:text-white transition-all text-left cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-300" />
                      <span>Download Backup JSON</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("open-predeploy-modal"));
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-300 hover:bg-emerald-950/60 hover:text-emerald-100 transition-all text-left cursor-pointer border border-emerald-500/30 bg-emerald-950/20"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Pre-Deploy Audit Check</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("open-profile-modal"));
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-cyan-200 hover:bg-cyan-950/60 hover:text-cyan-100 transition-all text-left cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                    <span>View Profile & Manual</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsStrictMode(!isStrictMode);
                      setOpenDropdown(null);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-slate-900 hover:text-white transition-all cursor-pointer border border-slate-800/80"
                  >
                    <span className="flex items-center gap-2">
                      {isStrictMode ? <Flame className="w-3.5 h-3.5 text-red-400" /> : <Heart className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                      <span>{isStrictMode ? "Strict Mode (Crimson)" : "Chill Mode (Emerald)"}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Toggle</span>
                  </button>
                </div>
              </div>
            </div>

          </nav>
        </div>
      </div>

      {/* Backlog Debt Details Modal */}
      {isBacklogModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-rose-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            
            {/* Modal Header */}
            <header className="h-16 px-6 sm:px-8 border-b border-rose-500/30 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-300 shadow-inner">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-rose-100 tracking-tight flex items-center gap-2">
                    <span>🎒 Backlog Debt & Lapsed Study Details</span>
                  </h3>
                  <p className="text-xs text-rose-300 font-semibold hidden sm:block">
                    Complete time, subject, and topic breakdown of all missed or partial slots
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBacklogModalOpen(false)} 
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
                title="Close Modal"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            {/* Modal Body */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
                  <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider block">Total Debt Hours</span>
                  <span className="text-2xl font-mono font-black text-rose-100 mt-1 block">+{totalBacklogDebt.toFixed(1)} hrs</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Lapsed Slots</span>
                  <span className="text-2xl font-mono font-black text-slate-200 mt-1 block">{backlogItems.length} slots</span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 shadow-lg sm:col-span-1">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">Recovery Action</span>
                  <span className="text-xs text-slate-300 font-semibold mt-1 block">Log extra micro-time or allocate Sunday recovery!</span>
                </div>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by subject name, chapter, or date (e.g. Auditing, Ind AS)..."
                  value={backlogSearchQuery}
                  onChange={(e) => setBacklogSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/60 transition-all shadow-inner"
                />
              </div>

              {/* Itemized List */}
              <div className="space-y-3">
                {filteredBacklogItems.length === 0 ? (
                  <div className="text-center py-12 bg-slate-950/50 rounded-3xl border border-slate-800/80 p-8 space-y-3">
                    <span className="text-4xl">🎉</span>
                    <h4 className="text-base font-bold text-slate-200">No Lapsed Slots Found!</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {backlogSearchQuery ? "No debt items match your search." : "All study slots are fully completed or up to date. Excellent work!"}
                    </p>
                  </div>
                ) : (
                  filteredBacklogItems.map((item) => (
                    <div key={`${item.dateStr}-${item.id}`} className="bg-slate-950/60 border border-rose-500/30 hover:border-rose-500/60 rounded-3xl p-5 space-y-3 transition-all shadow-xl">
                      
                      {/* Date & Time Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-2 text-slate-300 font-mono font-bold">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs">
                            📅 {item.dateStr}
                          </span>
                          <span className="text-rose-300 text-xs">
                            ⏱️ Time Slot: {item.time}
                          </span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'FAILED' ? 'bg-red-950 text-red-300 border border-red-500/40' :
                          item.status === 'PARTIALLY_COMPLETED' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                          'bg-purple-950 text-purple-300 border border-purple-500/40'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>

                      {/* Subject & Activity Details */}
                      <div>
                        <h5 className="text-base font-extrabold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                          <span>{item.subject}</span>
                        </h5>
                        <p className="text-xs font-semibold text-slate-300 mt-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                          📖 <strong className="text-rose-200">Topic / Chapter Studied:</strong> {item.activity || 'General Study Session'}
                        </p>
                      </div>

                      {/* Progress & Debt Hours */}
                      <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-4 font-mono">
                          <span className="text-slate-400">Total Slot: <strong className="text-slate-200">{item.totalDurationHours}h</strong></span>
                          <span className="text-emerald-400">Studied: <strong className="text-emerald-300">{item.studiedDurationHours}h</strong></span>
                        </div>
                        <span className="font-mono font-black text-rose-300 bg-rose-950/80 px-3 py-1 rounded-xl border border-rose-500/40">
                          🎒 Remaining Debt: +{item.debtHours}h
                        </span>
                      </div>

                      {/* Micro-Log Action Bar */}
                      <div className="flex items-center justify-between gap-2 pt-2 flex-wrap border-t border-slate-800/80">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase text-indigo-300 mr-1">Micro-Log Recovery:</span>
                          <button
                            onClick={() => {
                              quickAddMicroLog(item.dateStr, item.id, 0.25);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-950 hover:bg-indigo-900 border border-indigo-400/60 text-indigo-200 transition-all cursor-pointer active:scale-95 shadow-sm"
                            title="Log +15m studied time to reduce debt"
                          >
                            +15m
                          </button>
                          <button
                            onClick={() => {
                              quickAddMicroLog(item.dateStr, item.id, 0.5);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-950 hover:bg-indigo-900 border border-indigo-400/60 text-indigo-200 transition-all cursor-pointer active:scale-95 shadow-sm"
                            title="Log +30m studied time to reduce debt"
                          >
                            +30m
                          </button>
                          <button
                            onClick={() => {
                              quickAddMicroLog(item.dateStr, item.id, 1.0);
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-950 hover:bg-indigo-900 border border-indigo-400/60 text-indigo-200 transition-all cursor-pointer active:scale-95 shadow-sm"
                            title="Log +1h studied time to reduce debt"
                          >
                            +1h
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedDateStr(item.dateStr);
                            setActiveTab('timetable');
                            setIsBacklogModalOpen(false);
                          }}
                          className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 ml-auto"
                          title="Open this date in Timetable view"
                        >
                          <span>Go to Date 🗓️</span>
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </main>

            {/* Modal Footer */}
            <footer className="px-6 sm:px-8 py-4 border-t border-rose-500/30 backdrop-blur-md shrink-0 flex items-center justify-between gap-3 sticky bottom-0 z-20 bg-[#0A121E]/90">
              <button
                onClick={() => setIsBacklogModalOpen(false)}
                className="px-5 py-1.5 sm:py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setActiveTab('timetable');
                  setIsBacklogModalOpen(false);
                }}
                className="px-6 py-1.5 sm:py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-black text-xs hover:from-rose-500 hover:to-pink-500 shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <span>Open Timetable Planner 🗓️</span>
              </button>
            </footer>

          </div>
        </div>,
        document.body
      )}

      {/* Today's Granular Hour-by-Hour Breakdown Modal */}
      <TodayStudyBreakdownModal
        isOpen={isTodayModalOpen}
        onClose={() => setIsTodayModalOpen(false)}
        onLaunchNextSlot={() => {
          setIsTodayModalOpen(false);
          setActiveTab('timetable');
        }}
      />

      {/* Overall CA Final Syllabus & ROI Ledger Audit Modal */}
      <OverallSyllabusAuditModal
        isOpen={isOverallModalOpen}
        onClose={() => setIsOverallModalOpen(false)}
        onOpenSyllabusTable={() => {
          setIsOverallModalOpen(false);
          setActiveTab('subjects');
        }}
      />
    </header>
    </>
  );
};

