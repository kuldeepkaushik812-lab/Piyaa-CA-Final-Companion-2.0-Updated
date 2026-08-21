import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Coffee, 
  BookOpen, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Heart, 
  CheckCircle2, 
  Shield, 
  AlertTriangle,
  TreePine,
  Sprout,
  Flower2,
  Calendar,
  LayoutDashboard,
  BarChart3,
  ListTodo,
  CalendarDays,
  Clock,
  Flame,
  ChevronRight,
  Droplets,
  Palette,
  Sun,
  Moon,
  Zap,
  Check,
  Award,
  ExternalLink,
  Tv,
  Maximize2,
  X,
  Info
} from 'lucide-react';
import { CASubject, TimetableSlot } from '../types';
import { useStore } from '../store';
import { getISTYMD, getISTDate, getISTTimeString } from '../lib/dateUtils';
import { parseSlotHours, parseTimeStr, parseTimeToMinutes } from '../utils/timeUtils';
import { FocusEfficiencyChart } from './FocusEfficiencyChart';

interface ForestTreeRecord {
  id: string;
  subjectCode: string;
  subjectName: string;
  topicTitle?: string;
  minutes: number;
  plantedAt: string; // YYYY-MM-DD
  timeString: string;
}

interface StudyTimerProps {
  studyHoursToday: number;
  targetStudyHours: number;
  subjects: CASubject[];
  timetable?: TimetableSlot[];
  initialSubjectId?: string;
  onSessionComplete: (minutes: number, subjectId: string, topicId?: string) => void;
  onSetCurrentSubject?: (subj: string) => void;
  isStrictMode?: boolean;
  onNavigateTab?: (tab: string) => void;
}

type ColorTheme = 'emerald' | 'aurora' | 'amber' | 'ocean';

export const StudyTimer: React.FC<StudyTimerProps> = ({ 
  subjects,
  timetable = [], 
  initialSubjectId,
  studyHoursToday,
  targetStudyHours,
  onSessionComplete, 
  onSetCurrentSubject,
  isStrictMode = false,
  onNavigateTab
}) => {
  const store = useStore();
  const getSubjectStreak = store.getSubjectStreak;
  const getSubjectHoursToday = store.getSubjectHoursToday;
  const setSubjects = store.setSubjects;
  const isIdleGuardEnabled = store.isIdleGuardEnabled;
  const setIsIdleGuardEnabled = store.setIsIdleGuardEnabled;

  const [showIdleOverlay, setShowIdleOverlay] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  const getInitialTimerState = () => {
    try {
      const saved = localStorage.getItem('ca_companion_active_timer_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isRunning && parsed.endTime) {
          const remaining = Math.max(0, Math.ceil((parsed.endTime - Date.now()) / 1000));
          if (remaining > 0) {
            return {
              workMinutes: parsed.workMinutes || 25,
              breakMinutes: parsed.breakMinutes || 5,
              mode: parsed.mode || 'work',
              timeLeft: remaining,
              endTime: parsed.endTime,
              isRunning: true,
              selectedSubjectId: parsed.selectedSubjectId || '',
              selectedTopicId: parsed.selectedTopicId || '',
              pauseStartTime: null,
              sessionStartTime: parsed.sessionStartTime || null,
              accumulatedPauseMs: parsed.accumulatedPauseMs || 0
            };
          }
        } else if (!parsed.isRunning && parsed.timeLeft) {
            return {
              workMinutes: parsed.workMinutes || 25,
              breakMinutes: parsed.breakMinutes || 5,
              mode: parsed.mode || 'work',
              timeLeft: parsed.timeLeft,
              endTime: null,
              isRunning: false,
              selectedSubjectId: parsed.selectedSubjectId || '',
              selectedTopicId: parsed.selectedTopicId || '',
              pauseStartTime: parsed.pauseStartTime || null,
              sessionStartTime: parsed.sessionStartTime || null,
              accumulatedPauseMs: parsed.accumulatedPauseMs || 0
            };
        }
      }
    } catch (e) {}
    return null;
  };

  const initialState = getInitialTimerState();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialState?.selectedSubjectId || initialSubjectId || subjects[0]?.id || ''
  );


  useEffect(() => {
    const targetSlotId = store.timerTargetSlotId;
    if (targetSlotId) {
      const todayStr = getISTYMD();
      const allSlots = store.getScheduleForDate(todayStr);
      const slot = allSlots.find(s => s.id === targetSlotId);
      if (slot) {
        const matchSubj = subjects.find(sub => 
          sub.name.toLowerCase().includes(slot.subject.toLowerCase()) || 
          sub.code.toLowerCase().includes(slot.subject.toLowerCase())
        );
        if (matchSubj) {
          setSelectedSubjectId(matchSubj.id);
          if (onSetCurrentSubject) onSetCurrentSubject(matchSubj.id);
        }
        setSelectedTopicId(`slot-${slot.id}`);
        const totalHrs = slot.totalDurationHours || parseSlotHours(slot.time) || 2;
        const studiedHrs = slot.studiedDurationHours || ((slot.progress || 0) * totalHrs / 100) || (slot.completed ? totalHrs : 0);
        const remainingHours = Math.max(0, totalHrs - studiedHrs);
        let finalMins = Math.round(remainingHours * 60);
        const parsed = parseTimeStr(slot.time);
        if (parsed) {
          const istNow = getISTDate();
          let currentMins = istNow.getHours() * 60 + istNow.getMinutes();
          if (currentMins <= 5 * 60) currentMins += 1440;
          let endMins = parsed.end;
          if (endMins < parsed.start) endMins += 1440;
          if (currentMins >= parsed.start && currentMins < endMins) {
            // Calculate dynamic remaining time based strictly on real-world IST slot end time
            finalMins = endMins - currentMins;
          }
        }
        if (finalMins <= 0) finalMins = 0;

        if (finalMins > 0) {
          setWorkMinutes(finalMins);
          setTimeLeft(finalMins * 60);
          setMode('work');
          setIsRunning(false);
          setEndTime(null);
        }
      }
      store.setTimerTargetSlotId(null);
    }
  }, [store.timerTargetSlotId, timetable, subjects]);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(initialState?.selectedTopicId || '');
  
  const [workMinutes, setWorkMinutes] = useState<number>(initialState?.workMinutes || 25);
  const [breakMinutes, setBreakMinutes] = useState<number>(initialState?.breakMinutes || 5);
  const [mode, setMode] = useState<'work' | 'break'>(initialState?.mode || 'work');
  
  const [timeLeft, setTimeLeft] = useState<number>(initialState?.timeLeft || 25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(initialState?.isRunning || false);
  const [endTime, setEndTime] = useState<number | null>(initialState?.endTime || null);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(initialState?.pauseStartTime || null);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(initialState?.sessionStartTime || null);
  const [accumulatedPauseMs, setAccumulatedPauseMs] = useState<number>(initialState?.accumulatedPauseMs || 0);

  const [sessionSummary, setSessionSummary] = useState<{
    totalElapsedMs: number;
    effectiveMs: number;
    subjectName: string;
    topicName: string;
  } | null>(null);

  const [showStrictModal, setShowStrictModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showForestModal, setShowForestModal] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [showPipFallbackToast, setShowPipFallbackToast] = useState(false);

  // Format MS for summary
  const formatMs = (ms: number) => {
    const totalMins = Math.round(ms / (1000 * 60));
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Automatically close PiP window on unmount
  useEffect(() => {
    return () => {
      if (pipWindow) {
        try { pipWindow.close(); } catch (e) {}
      }
    };
  }, [pipWindow]);
  
  // Theme state
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() => {
    return (localStorage.getItem('ca_companion_focus_theme') as ColorTheme) || 'emerald';
  });

  const handleThemeChange = (newTheme: ColorTheme) => {
    setColorTheme(newTheme);
    localStorage.setItem('ca_companion_focus_theme', newTheme);
  };

  // Tree watering visual effect
  const [isWatering, setIsWatering] = useState(false);
  const [waterCount, setWaterCount] = useState(0);

  const wakeLockRef = useRef<any>(null);
  const isEndingSessionRef = useRef(false);

  useEffect(() => {
    let active = true;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          if (isRunning) {
            // @ts-ignore
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
              if (active) {
                console.log('Wake Lock was released');
              }
            });
        
          } else {
            if (wakeLockRef.current) {
              await wakeLockRef.current.release();
              wakeLockRef.current = null;
            }
          }
        } catch (err: any) {
          console.warn('Wake Lock error:', err);
        }
      }
    };

    requestWakeLock();

    return () => {
      active = false;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(console.warn);
        wakeLockRef.current = null;
      }
    };
  }, [isRunning]);



  // Persist active timer session when running or paused
  useEffect(() => {
    if (isRunning && endTime) {
      localStorage.setItem('ca_companion_active_timer_session', JSON.stringify({
        isRunning: true,
        endTime,
        mode,
        workMinutes,
        breakMinutes,
        selectedSubjectId,
        selectedTopicId,
        sessionStartTime,
        accumulatedPauseMs
      }));
    } else if (!isRunning && timeLeft > 0 && timeLeft !== workMinutes * 60 && timeLeft !== breakMinutes * 60) {
      // Save paused state
      localStorage.setItem('ca_companion_active_timer_session', JSON.stringify({
        isRunning: false,
        timeLeft,
        mode,
        workMinutes,
        breakMinutes,
        selectedSubjectId,
        selectedTopicId,
        pauseStartTime,
        sessionStartTime,
        accumulatedPauseMs
      }));
    } else {
      localStorage.removeItem('ca_companion_active_timer_session');
    }
  }, [isRunning, endTime, mode, workMinutes, breakMinutes, selectedSubjectId, selectedTopicId, timeLeft, pauseStartTime, sessionStartTime, accumulatedPauseMs]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        if (isRunning && endTime) {
          const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
          setTimeLeft(remaining);
          if (remaining <= 0) {
            handleSessionEnd();
          }
        }

        if (isRunning && 'wakeLock' in navigator) {
          if (!wakeLockRef.current || wakeLockRef.current.released) {
            try {
               // @ts-ignore
               wakeLockRef.current = await navigator.wakeLock.request('screen');
            } catch (err: any) {
               console.warn('Wake Lock visibility error:', err);
            }
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, endTime]);

  // Pep talk state
  const [pepTalkIndex, setPepTalkIndex] = useState(0);

  const pepTalks = [
    "Babu, pure single-minded focus! Distractions zero. Tumhara ek ek minute CA Final rank ki taraf le jaa raha hai! 💕",
    "Believe in yourself! Every formula, section, and standard you master today is building your CA dream! 🌟",
    "Concentration is your superpower. Deep breath, calm mind, and solve one concept at a time. I'm so proud of you! ☕",
    "Quiet environment, strong intention. You are unstoppable when you step into the Deep Work Room! 🏆",
    "Take it step by step, babu. Big goals are achieved through consistent 25-minute focus blocks! 🚀"
  ];

  // Focus Forest Planted Trees Storage
  const [plantedTrees, setPlantedTrees] = useState<ForestTreeRecord[]>(() => {
    const saved = localStorage.getItem('ca_companion_focus_forest');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('ca_companion_focus_forest', JSON.stringify(plantedTrees));
  }, [plantedTrees]);

  // Scroll lock & ESC key handler for StudyTimer modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showForestModal) setShowForestModal(false);
        if (showStrictModal) setShowStrictModal(false);
        if (showIdleOverlay) setShowIdleOverlay(false);
      }
    };
    if (showForestModal || showStrictModal || showIdleOverlay) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showForestModal, showStrictModal, showIdleOverlay]);

  // Ambient sound synthesizer generator
  const [soundType, setSoundType] = useState<'none' | 'Soft Rain' | 'Forest Breeze' | 'Lofi Beats' | 'Ocean Waves' | 'Zen Bowl'>('none');
  const [soundVolume, setSoundVolume] = useState<number>(0.15);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodeRef = useRef<any>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const selectedSubject = useMemo(() => {
    return subjects.find(s => s.id === selectedSubjectId) || subjects[0] || {
      id: '',
      code: '',
      name: '',
      topics: []
    };
  }, [subjects, selectedSubjectId]);

  const pendingTopics = useMemo(() => {
    return selectedSubject?.topics?.filter(t => !t.completed) || [];
  }, [selectedSubject]);

  const subjectTimetableSlots = useMemo(() => {
    return timetable.filter(s => 
      s.category === 'study' && 
      !s.completed && 
      (s.subject === selectedSubject?.name || selectedSubject?.name?.includes(s.subject) || s.subject?.includes(selectedSubject?.name || ''))
    );
  }, [timetable, selectedSubject]);

  const activeTopicObj = useMemo(() => {
    if (!selectedTopicId) return null;
    const cleanId = selectedTopicId.startsWith('topic-') ? selectedTopicId.replace('topic-', '') : selectedTopicId;
    return selectedSubject?.topics?.find(t => t.id === cleanId) || null;
  }, [selectedSubject, selectedTopicId]);

  const subjectStreak = getSubjectStreak(selectedSubject.id);
  const subjectHoursToday = getSubjectHoursToday(selectedSubject.id);

  const [liveNow, setLiveNow] = useState<number>(Date.now());
  useEffect(() => {
    let ticker: any = null;
    if (sessionStartTime) {
      ticker = setInterval(() => setLiveNow(Date.now()), 1000);
    }
    return () => clearInterval(ticker);
  }, [sessionStartTime]);

  const { currentSessionElapsedMs, currentSessionPausedMs, currentSessionActiveMs } = useMemo(() => {
    if (!sessionStartTime) return { currentSessionElapsedMs: 0, currentSessionPausedMs: 0, currentSessionActiveMs: 0 };
    const elapsed = liveNow - sessionStartTime;
    let paused = accumulatedPauseMs;
    if (pauseStartTime) {
      paused += (liveNow - pauseStartTime);
    }
    let active = elapsed - paused;
    if (active < 0) active = 0;
    return { currentSessionElapsedMs: elapsed, currentSessionPausedMs: paused, currentSessionActiveMs: active };
  }, [sessionStartTime, accumulatedPauseMs, pauseStartTime, liveNow]);

  // Timer Countdown Logic
  useEffect(() => {
    let timer: any = null;
    if (isRunning && endTime) {
      timer = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          handleSessionEnd();
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, endTime, mode]);

  // Broadcast live pomodoro state to Header and across app
  useEffect(() => {
    const payload = {
      isRunning,
      timeLeft,
      mode,
      workMinutes,
      breakMinutes,
      subjectCode: selectedSubject?.code,
      subjectName: selectedSubject?.name,
    };
    window.dispatchEvent(new CustomEvent('pomodoro-state-changed', { detail: payload }));
    try {
      sessionStorage.setItem('ca_companion_live_pomodoro', JSON.stringify(payload));
    } catch (e) {}
  }, [isRunning, timeLeft, mode, selectedSubject, workMinutes, breakMinutes]);

  // Idle-Screen Anti-Cheat Guard (20 min inactivity check)
  useEffect(() => {
    if (!isRunning || !isIdleGuardEnabled || mode !== 'work') {
      return;
    }

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    // Check for 20 continuous minutes (1,200,000 ms) of zero activity
    const idleCheckInterval = setInterval(() => {
      const elapsedIdle = Date.now() - lastActivityRef.current;
      if (elapsedIdle >= 20 * 60 * 1000) {
        setIsRunning(false);
        setEndTime(null);
        setShowIdleOverlay(true);
        setPauseStartTime(lastActivityRef.current);
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(idleCheckInterval);
    };
  }, [isRunning, isIdleGuardEnabled, mode]);

  // Calculate Timer Progress Percentage
  const totalSessionSec = (mode === 'work' ? workMinutes : breakMinutes) * 60;
  const progressPct = Math.min(100, Math.max(0, Math.round(((totalSessionSec - timeLeft) / totalSessionSec) * 100)));

  // Chotu Tree Stage (0 to 4)
  const treeStage = useMemo(() => {
    if (mode === 'break') return 4; // Full tree relaxing during break
    if (progressPct < 15) return 0; // Seed in soil
    if (progressPct < 40) return 1; // Sprout
    if (progressPct < 70) return 2; // Young plant
    if (progressPct < 95) return 3; // Growing tree
    return 4; // Full blooming tree
  }, [progressPct, mode]);

  const handleSessionEnd = () => {
    if (isEndingSessionRef.current) return;
    isEndingSessionRef.current = true;
    setTimeout(() => { isEndingSessionRef.current = false; }, 2000);
    setIsRunning(false);
    setEndTime(null);
    setPauseStartTime(null);
    
    // Play soothing completion bell
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.6); // C6
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.2);
    } catch (e) {}

    if (mode === 'work') {
      let topicIdToPass = selectedTopicId;
      if (selectedTopicId.startsWith('topic-')) {
        topicIdToPass = selectedTopicId.replace('topic-', '');
      } else if (selectedTopicId.startsWith('slot-')) {
        topicIdToPass = selectedTopicId;
      }
      
      // Show summary before clearing session start time
      if (sessionStartTime) {
        const totalElapsedMs = Date.now() - sessionStartTime;
        let finalEffectiveMs = totalElapsedMs - accumulatedPauseMs;
        if (finalEffectiveMs < 0) finalEffectiveMs = 0;
        
        setSessionSummary({
           totalElapsedMs,
           effectiveMs: finalEffectiveMs,
           subjectName: selectedSubject?.name || 'General Subject',
           topicName: activeTopicObj?.title || 'Deep Study Session'
        });
        
        store.addFocusSession({
          dateStr: getISTYMD(),
          subjectName: selectedSubject?.name || 'General Subject',
          topicName: activeTopicObj?.title || 'Deep Study Session',
          effectiveMs: finalEffectiveMs,
          totalElapsedMs
        });
      }
      
      setSessionStartTime(null);
      setAccumulatedPauseMs(0);

      onSessionComplete(workMinutes, selectedSubjectId, topicIdToPass || undefined);

      // Plant a new tree in Focus Forest!
      const now = getISTDate();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const newTree: ForestTreeRecord = {
        id: Date.now().toString(),
        subjectCode: selectedSubject.code,
        subjectName: selectedSubject.name,
        topicTitle: activeTopicObj?.title || 'General Deep Study',
        minutes: workMinutes,
        plantedAt: getISTYMD(),
        timeString: timeStr
      };
      setPlantedTrees(prev => [newTree, ...prev]);

      setMode('break');
      setTimeLeft(breakMinutes * 60);
      showToast(`🌳 Magnificent! Tree Grown & ${workMinutes} mins logged to Cloud!`);
    } else {
      setMode('work');
      setTimeLeft(workMinutes * 60);
      showToast("🌿 Refreshing break complete! Ready for next Deep Work block.");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handleStartPause = () => {
    if (isRunning) {
      setIsRunning(false);
      setEndTime(null);
      setPauseStartTime(Date.now());
    } else {
      let currentAccumulatedPause = accumulatedPauseMs;
      
      // If we are resuming from a pause, accumulate the pause time
      if (pauseStartTime) {
        currentAccumulatedPause += (Date.now() - pauseStartTime);
        setAccumulatedPauseMs(currentAccumulatedPause);
      }
      
      if (!sessionStartTime && mode === 'work') {
        setSessionStartTime(Date.now());
      }

      // Only shrink time if we are resuming a work session linked to a timetable slot
      const isSlotLinked = selectedTopicId && selectedTopicId.startsWith('slot-');
      
      if (pauseStartTime && mode === 'work' && isSlotLinked) {
        const pausedMs = Date.now() - pauseStartTime;
        const pausedS = Math.floor(pausedMs / 1000);
        
        // Cap the reduction to whatever timeLeft currently is
        const reductionS = Math.min(pausedS, timeLeft);
        const reductionMins = Math.floor(reductionS / 60);
        
        const newTimeLeft = timeLeft - reductionS;
        const newWorkMinutes = Math.max(0, workMinutes - reductionMins);
        
        setWorkMinutes(newWorkMinutes);
        setTimeLeft(newTimeLeft);
        
        setIsRunning(true);
        setEndTime(Date.now() + newTimeLeft * 1000);
        setPauseStartTime(null);
      } else {
        setIsRunning(true);
        setEndTime(Date.now() + timeLeft * 1000);
        setPauseStartTime(null);
      }
    }
  };

  const handleStopAndLog = () => {
    if (mode === 'work') {
      const elapsedMins = workMinutes - Math.ceil(timeLeft / 60);
      if (elapsedMins > 0) {
        let topicIdToPass = selectedTopicId;
        if (selectedTopicId.startsWith('topic-')) {
          topicIdToPass = selectedTopicId.replace('topic-', '');
        } else if (selectedTopicId.startsWith('slot-')) {
          topicIdToPass = selectedTopicId;
        }

        if (sessionStartTime) {
          const totalElapsedMs = Date.now() - sessionStartTime;
          let finalEffectiveMs = totalElapsedMs - accumulatedPauseMs;
          if (finalEffectiveMs < 0) finalEffectiveMs = 0;
          
          setSessionSummary({
             totalElapsedMs,
             effectiveMs: finalEffectiveMs,
             subjectName: selectedSubject?.name || 'General Subject',
             topicName: activeTopicObj?.title || 'Deep Study Session'
          });
        
        store.addFocusSession({
          dateStr: getISTYMD(),
          subjectName: selectedSubject?.name || 'General Subject',
          topicName: activeTopicObj?.title || 'Deep Study Session',
          effectiveMs: finalEffectiveMs,
          totalElapsedMs
        });
        }

        onSessionComplete(elapsedMins, selectedSubjectId, topicIdToPass || undefined);
        showToast(`Logged ${elapsedMins} mins early.`);
      }
    }
    
    setSessionStartTime(null);
    setAccumulatedPauseMs(0);
    forceReset();
  };

  const handleReset = () => {
    if (isRunning && isStrictMode && mode === 'work') {
      setShowStrictModal(true);
      return;
    }
    forceReset();
  };

  const forceReset = () => {
    setIsRunning(false);
    setEndTime(null);
    setPauseStartTime(null);
    setSessionStartTime(null);
    setAccumulatedPauseMs(0);
    setTimeLeft(mode === 'work' ? workMinutes * 60 : breakMinutes * 60);
    setShowStrictModal(false);
  };

  const handleWaterTree = () => {
    setIsWatering(true);
    setWaterCount(prev => prev + 1);
    showToast("💧 Chotu Tree Watered! Glowing with fresh focus energy.");
    setTimeout(() => setIsWatering(false), 1200);
  };

  const handlePresetSelect = (wMins: number, bMins: number) => {
    if (isRunning) return;
    setWorkMinutes(wMins);
    setBreakMinutes(bMins);
    if (mode === 'work') {
      setTimeLeft(wMins * 60);
    } else {
      setTimeLeft(bMins * 60);
    }
  };

  const togglePip = async () => {
    if (pipWindow) {
      try { pipWindow.close(); } catch (e) {}
      setPipWindow(null);
      return;
    }

    if (!('documentPictureInPicture' in window)) {
      setShowPipFallbackToast(true);
      setTimeout(() => setShowPipFallbackToast(false), 5000);
      return;
    }

    try {
      // @ts-ignore
      const pipWin = await window.documentPictureInPicture.requestWindow({
        width: 360,
        height: 220,
      });

      // Copy document stylesheets & font links into Picture-in-Picture window
      Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((styleEl) => {
        try {
          pipWin.document.head.appendChild(styleEl.cloneNode(true));
        } catch (e) {}
      });

      const fallbackStyle = pipWin.document.createElement('style');
      fallbackStyle.textContent = `
        body {
          margin: 0;
          padding: 0;
          background-color: #020617;
          color: #f8fafc;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          overflow: hidden;
        }
      `;
      pipWin.document.head.appendChild(fallbackStyle);

      pipWin.document.body.className = 'bg-slate-950 text-slate-100 font-sans antialiased m-0 p-0 overflow-hidden select-none';
      pipWin.document.title = 'Piyaa Floating Mini Timer';

      pipWin.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(pipWin);
    } catch (err) {
      console.warn('Failed to open Document Picture-in-Picture window:', err);
    }
  };

  // Ambient audio synthesizer
  useEffect(() => {
    if (soundType === 'none') {
      if (soundNodeRef.current) {
        try { soundNodeRef.current.stop(); } catch (e) {}
        soundNodeRef.current = null;
      }
      return;
    }
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (soundNodeRef.current) {
        try { soundNodeRef.current.stop(); } catch (e) {}
      }
      
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      
      let filter = ctx.createBiquadFilter();
      let gain = ctx.createGain();
      gainNodeRef.current = gain;
      gain.gain.value = soundVolume;
      
      if (soundType === 'Soft Rain') {
        filter.type = 'lowpass';
        filter.frequency.value = 450;
      } else if (soundType === 'Forest Breeze') {
        filter.type = 'bandpass';
        filter.frequency.value = 600;
      } else if (soundType === 'Lofi Beats') {
        filter.type = 'bandpass';
        filter.frequency.value = 850;
      } else if (soundType === 'Ocean Waves') {
        filter.type = 'lowpass';
        filter.frequency.value = 320;
      } else if (soundType === 'Zen Bowl') {
        filter.type = 'lowshelf';
        filter.frequency.value = 220;
      }
      
      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(0);
      soundNodeRef.current = whiteNoise;
    } catch (e) {}
  }, [soundType]);

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(soundVolume, audioCtxRef.current.currentTime);
    }
  }, [soundVolume]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayStr = getISTYMD();
  const treesPlantedToday = plantedTrees.filter(t => t.plantedAt === todayStr);

  // Dynamic Theme Colors
  const themeStyles = useMemo(() => {
    switch (colorTheme) {
      case 'aurora':
        return {
          bannerBg: 'bg-indigo-950/80 border-indigo-500/30',
          accentBadge: 'bg-indigo-950 border-indigo-400 text-indigo-300',
          accentBtn: 'bg-indigo-500 hover:bg-indigo-400 text-slate-950',
          cardBg: 'bg-slate-950/90 border-indigo-500/30',
          glowLeft: 'bg-indigo-600/15',
          glowRight: 'bg-purple-600/15',
          primaryText: 'text-indigo-300',
          borderAccent: 'border-indigo-500/40',
          ringColor: 'border-indigo-400/40',
          treeCanopy: '#6366f1',
          treeCanopy2: '#a855f7'
        };
      case 'amber':
        return {
          bannerBg: 'bg-amber-950/80 border-amber-500/30',
          accentBadge: 'bg-amber-950 border-amber-400 text-amber-300',
          accentBtn: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
          cardBg: 'bg-slate-950/90 border-amber-500/30',
          glowLeft: 'bg-amber-600/15',
          glowRight: 'bg-rose-600/15',
          primaryText: 'text-amber-300',
          borderAccent: 'border-amber-500/40',
          ringColor: 'border-amber-400/40',
          treeCanopy: '#f59e0b',
          treeCanopy2: '#fbbf24'
        };
      case 'ocean':
        return {
          bannerBg: 'bg-slate-950/80 border-cyan-500/30',
          accentBadge: 'bg-cyan-950 border-cyan-400 text-cyan-300',
          accentBtn: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
          cardBg: 'bg-slate-950/90 border-cyan-500/30',
          glowLeft: 'bg-cyan-600/15',
          glowRight: 'bg-blue-600/15',
          primaryText: 'text-cyan-300',
          borderAccent: 'border-cyan-500/40',
          ringColor: 'border-cyan-400/40',
          treeCanopy: '#06b6d4',
          treeCanopy2: '#38bdf8'
        };
      case 'emerald':
      default:
        return {
          bannerBg: 'bg-slate-900/80 border-emerald-500/25',
          accentBadge: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300',
          accentBtn: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
          cardBg: 'bg-slate-900/90 border-emerald-500/30',
          glowLeft: 'bg-emerald-500/15',
          glowRight: 'bg-teal-500/15',
          primaryText: 'text-emerald-300',
          borderAccent: 'border-emerald-500/40',
          ringColor: 'border-emerald-400/40',
          treeCanopy: '#10b981',
          treeCanopy2: '#34d399'
        };
    }
  }, [colorTheme]);

  const todaySessions = store.focusSessions?.filter(s => s.dateStr === getISTYMD()) || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 pb-16">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-emerald-600 text-slate-950 px-6 py-3 rounded-2xl shadow-2xl border border-emerald-300 flex items-center gap-3 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Strict Mode Modal */}
      {showStrictModal && (
        <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-amber-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
              <div className="flex items-center gap-3 text-amber-300">
                <div className="p-2.5 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-300 shadow-inner">
                  <AlertTriangle className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Strict Mode Active</h3>
                  <p className="text-xs text-amber-300/80 hidden sm:block">Focus guard warning</p>
                </div>
              </div>
              <button
                onClick={() => setShowStrictModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer text-slate-300"
              >
                ✕ Close (ESC)
              </button>
            </header>

            <main className="flex-1 w-full max-w-lg mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="p-5 rounded-3xl bg-amber-950/40 border border-amber-500/30 shadow-2xl space-y-4">
                <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto" />
                <h3 className="text-2xl font-black text-white">Strict Focus Warning</h3>
                <p className="text-sm text-amber-200 leading-relaxed">
                  Abandoning this focus block now means your Chotu Tree won't bloom and session minutes won't log to your daily target.
                </p>
              </div>
            </main>

            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-center gap-4 sticky bottom-0 z-20 bg-[#0A121E]/90">
              <button 
                onClick={() => setShowStrictModal(false)} 
                className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm cursor-pointer transition-colors"
              >
                Keep Focus
              </button>
              <button 
                onClick={forceReset} 
                className="px-6 py-2.5 rounded-xl border border-amber-500/50 text-amber-300 font-bold text-xs sm:text-sm hover:bg-amber-950/40 cursor-pointer transition-colors"
              >
                Reset Anyway
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Idle Guard Anti-Cheat Overlay Modal */}
      {showIdleOverlay && (
        <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-indigo-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
              <div className="flex items-center gap-3 text-indigo-300">
                <div className="p-2.5 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 shadow-inner text-xl">
                  🌸
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Idle Guard Protection</h3>
                  <p className="text-xs text-indigo-300/80 hidden sm:block">Session auto-paused due to inactivity</p>
                </div>
              </div>
            </header>

            <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="bg-slate-950/60 border-2 border-indigo-500/80 rounded-3xl p-8 shadow-2xl space-y-5">
                <div className="w-20 h-20 rounded-2xl bg-indigo-950 border border-indigo-400/80 flex items-center justify-center mx-auto text-4xl shadow-lg animate-bounce">
                  🌸
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white">
                    My love, are you still at your desk?
                  </h3>
                  <p className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    🛡️ Idle Guard Auto-Paused Your Session
                  </p>
                </div>
                <p className="text-xs font-medium text-slate-300 leading-relaxed bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
                  No activity was detected for 20 continuous minutes. Unattended idle time was not added to your study metrics. Click below when you are back at your desk!
                </p>
              </div>
            </main>

            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-center sticky bottom-0 z-20 bg-[#0A121E]/90">
              <button
                onClick={() => {
                  setShowIdleOverlay(false);
                  lastActivityRef.current = Date.now();
                  const newEndTime = Date.now() + timeLeft * 1000;
                  setEndTime(newEndTime);
                  setIsRunning(true);
                }}
                className="w-full max-w-md py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-black rounded-xl shadow-xl transition-all cursor-pointer text-sm tracking-wide uppercase flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>I'm Back! Resume Study 💕</span>
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* TOP HEADER & INTERCONNECTED NAVIGATION BAR */}
      <div className={`p-5 rounded-2xl backdrop-blur-md shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border transition-all ${themeStyles.bannerBg}`}>
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-600/20 rounded-xl border border-emerald-500/40 text-emerald-300">
            <TreePine className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${themeStyles.accentBadge}`}>
                SOOTHING SANCTUARY
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Deep Work & Focus Room</h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Quiet hyper-focus space with growing Chotu Tree, calm audio & seamless sync across all CA subjects
            </p>
          </div>
        </div>

        {/* Color Palette Switcher & Interconnected Navigation */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          
          {/* Color Theme Selector */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => handleThemeChange('emerald')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                colorTheme === 'emerald' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title="Emerald Zen Theme"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Emerald</span>
            </button>
            <button
              onClick={() => handleThemeChange('aurora')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                colorTheme === 'aurora' ? 'bg-indigo-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title="Cosmic Aurora Theme"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span>Aurora</span>
            </button>
            <button
              onClick={() => handleThemeChange('amber')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                colorTheme === 'amber' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title="Golden Sunset Theme"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Sunset</span>
            </button>
            <button
              onClick={() => handleThemeChange('ocean')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                colorTheme === 'ocean' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
              title="Deep Ocean Theme"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span>Ocean</span>
            </button>
          </div>

          {/* Idle Guard Anti-Cheat Toggle Button */}
          <button
            onClick={() => setIsIdleGuardEnabled(!isIdleGuardEnabled)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 shadow-md ${
              isIdleGuardEnabled
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 hover:bg-emerald-900'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title={
              isIdleGuardEnabled
                ? "🛡️ Idle Guard ACTIVE (Screen-Study Mode): Auto-pauses after 20 mins of no input to prevent unearned hours."
                : "🛡️ Idle Guard OFF (Physical Book / Practice Mode): Uninterrupted timer for offline reading away from keyboard."
            }
          >
            <Shield className={`w-3.5 h-3.5 ${isIdleGuardEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Idle Guard:</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold ${
              isIdleGuardEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              {isIdleGuardEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Quick Nav Links */}
          {onNavigateTab && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onNavigateTab('master-summary')}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Jump to Master Summary"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => onNavigateTab('subjects-hub')}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Jump to Subject Summary Hub"
              >
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span>KPI Hub</span>
              </button>

              <button
                onClick={() => onNavigateTab('subjects')}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Jump to Syllabus Chapter Tracker"
              >
                <ListTodo className="w-3.5 h-3.5 text-emerald-400" />
                <span>Syllabus</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setShowForestModal(true)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${themeStyles.accentBadge}`}
          >
            <TreePine className="w-3.5 h-3.5" />
            <span>Forest ({treesPlantedToday.length} 🌳)</span>
          </button>
        </div>
      </div>

      {/* INTERCONNECTED LIVE STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Today's Study</span>
            <span className="text-sm font-bold text-white font-mono">
              {studyHoursToday.toFixed(1)}h / {targetStudyHours}h Target
            </span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">{selectedSubject.code} Streak</span>
            <span className="text-sm font-bold text-amber-300 font-mono">
              🔥 {subjectStreak} Days Active
            </span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Subject Hours Today</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">
              {subjectHoursToday.toFixed(1)} Hours
            </span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3.5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-500/15 text-teal-400">
            <TreePine className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Focus Forest Trees</span>
            <span className="text-sm font-bold text-teal-300 font-mono">
              🌳 {plantedTrees.length} Total Grown
            </span>
          </div>
        </div>
      </div>

      {/* MAIN CALM TIMER & CHOTU TREE STAGE CARD */}
      <div className={`rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl relative overflow-hidden border transition-all ${themeStyles.cardBg}`}>
        
        {/* Soft Ambient Radial Background Glows */}
        <div className={`absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${themeStyles.glowLeft}`} />
        <div className={`absolute top-1/2 right-1/4 translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none ${themeStyles.glowRight}`} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          
          {/* LEFT 5 COLS: Dynamic Chotu Tree Visualizer */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 bg-slate-950/70 p-6 rounded-2xl border border-white/10 relative">
            <div className="flex items-center justify-between w-full text-xs font-mono">
              <span className={`font-bold flex items-center gap-1.5 ${themeStyles.primaryText}`}>
                <Sprout className="w-4 h-4" /> Chotu Tree Stage
              </span>
              <span className="text-slate-300 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                {mode === 'work' ? `${progressPct}% Grown` : 'Relaxing Tree ☕'}
              </span>
            </div>

            {/* SVG CHOTU TREE ILLUSTRATION CANVAS */}
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center my-2">
              
              {/* Water Splash Overlay Effect */}
              {isWatering && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-in zoom-in duration-300">
                  <div className="text-4xl animate-bounce">💧✨💧</div>
                </div>
              )}

              <svg className="w-full h-full drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]" viewBox="0 0 200 200">
                {/* Pot / Soil Base */}
                <ellipse cx="100" cy="170" rx="45" ry="12" fill="#2d1b0e" />
                <path d="M 60 170 L 68 190 Q 100 196 132 190 L 140 170 Z" fill="#4a2e1b" stroke="#6e452a" strokeWidth="2" />
                
                {/* Stage 0: Seed / Tiny Seedling */}
                {treeStage === 0 && (
                  <g className="animate-bounce" style={{ animationDuration: '3s' }}>
                    <circle cx="100" cy="165" r="5" fill="#f59e0b" />
                    <path d="M 100 165 Q 102 155 104 150" stroke="#10b981" strokeWidth="3" fill="none" strokeLinecap="round" />
                    <ellipse cx="105" cy="148" rx="4" ry="2" fill="#34d399" transform="rotate(-30 105 148)" />
                  </g>
                )}

                {/* Stage 1: Sprout */}
                {treeStage === 1 && (
                  <g className="animate-pulse">
                    <path d="M 100 170 Q 100 140 100 130" stroke="#059669" strokeWidth="4" fill="none" strokeLinecap="round" />
                    <path d="M 100 135 Q 85 125 80 120 Q 92 120 100 135" fill={themeStyles.treeCanopy2} />
                    <path d="M 100 135 Q 115 125 120 120 Q 108 120 100 135" fill={themeStyles.treeCanopy} />
                  </g>
                )}

                {/* Stage 2: Young Bushy Plant */}
                {treeStage === 2 && (
                  <g>
                    <path d="M 100 170 Q 98 130 100 105" stroke="#047857" strokeWidth="6" fill="none" strokeLinecap="round" />
                    <path d="M 100 130 Q 80 115 75 110" stroke="#047857" strokeWidth="3" fill="none" />
                    <path d="M 100 120 Q 120 105 125 100" stroke="#047857" strokeWidth="3" fill="none" />
                    <circle cx="75" cy="108" r="14" fill={themeStyles.treeCanopy} opacity="0.9" />
                    <circle cx="125" cy="98" r="14" fill={themeStyles.treeCanopy2} opacity="0.9" />
                    <circle cx="100" cy="95" r="18" fill={themeStyles.treeCanopy} />
                  </g>
                )}

                {/* Stage 3: Growing Tree */}
                {treeStage === 3 && (
                  <g>
                    <path d="M 100 170 Q 95 120 100 80" stroke="#78350f" strokeWidth="10" fill="none" strokeLinecap="round" />
                    <path d="M 98 120 Q 70 95 60 90" stroke="#78350f" strokeWidth="5" fill="none" />
                    <path d="M 100 105 Q 130 85 140 80" stroke="#78350f" strokeWidth="5" fill="none" />
                    <circle cx="60" cy="85" r="22" fill={themeStyles.treeCanopy} />
                    <circle cx="140" cy="75" r="22" fill={themeStyles.treeCanopy2} />
                    <circle cx="100" cy="65" r="32" fill={themeStyles.treeCanopy} />
                    <circle cx="100" cy="55" r="24" fill={themeStyles.treeCanopy2} opacity="0.8" />
                  </g>
                )}

                {/* Stage 4: Lush Blooming Tree with Fruits & Sparkles */}
                {treeStage === 4 && (
                  <g className="animate-in zoom-in duration-700">
                    <path d="M 100 170 Q 92 110 100 70" stroke="#582f0e" strokeWidth="12" fill="none" strokeLinecap="round" />
                    <path d="M 98 115 Q 65 85 50 80" stroke="#582f0e" strokeWidth="6" fill="none" />
                    <path d="M 100 100 Q 135 75 150 70" stroke="#582f0e" strokeWidth="6" fill="none" />
                    <circle cx="50" cy="75" r="26" fill={themeStyles.treeCanopy} />
                    <circle cx="150" cy="65" r="26" fill={themeStyles.treeCanopy2} />
                    <circle cx="100" cy="50" r="42" fill={themeStyles.treeCanopy} />
                    <circle cx="80" cy="40" r="28" fill={themeStyles.treeCanopy2} />
                    <circle cx="120" cy="40" r="28" fill={themeStyles.treeCanopy2} opacity="0.9" />
                    <circle cx="70" cy="50" r="5" fill="#f59e0b" />
                    <circle cx="120" cy="55" r="5" fill="#fbbf24" />
                    <circle cx="95" cy="30" r="5" fill="#f59e0b" />
                    <circle cx="135" cy="70" r="4" fill="#fbbf24" />
                    <circle cx="60" cy="80" r="4" fill="#f59e0b" />
                  </g>
                )}
              </svg>

              {/* Sparkling overlay when complete or growing */}
              {isRunning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-full h-full rounded-full border-2 border-dashed ${themeStyles.ringColor} animate-spin`} style={{ animationDuration: '20s' }} />
                </div>
              )}
            </div>

            {/* Growth Stage Progress Bar */}
            <div className="w-full space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Growth Stage {treeStage + 1}/5</span>
                <span>{waterCount > 0 ? `💧 Watered ${waterCount}x` : 'Nurture Tree'}</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/10">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" 
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full pt-1">
              <button
                onClick={handleWaterTree}
                className="flex-1 py-1.5 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                <span>Water Tree 💧</span>
              </button>
            </div>

            <div className="text-center space-y-1">
              <span className={`text-xs font-bold ${themeStyles.primaryText}`}>
                {treeStage === 0 && "🌱 Seed Planted in Calm Soil..."}
                {treeStage === 1 && "🌿 Fresh Sprout Appearing..."}
                {treeStage === 2 && "🪴 Young Plant Growing Strong..."}
                {treeStage === 3 && "🌲 Branches Expanding in Deep Focus..."}
                {treeStage === 4 && "🌳 Masterpiece Blooming Forest Tree!"}
              </span>
              <p className="text-[11px] text-slate-400">
                Keep studying undisturbed to bloom your tree into the Focus Forest.
              </p>
            </div>
          </div>

          {/* RIGHT 7 COLS: Timer Controls & Subject Selection */}
          <div className="lg:col-span-7 flex flex-col space-y-5">
            
            {/* Mode Selector & Big Clock Display */}
            <div className="bg-slate-950/70 p-5 rounded-2xl border border-white/10 space-y-4">
              
              {/* Quick Preset Pomodoro Pills */}
              <div className="flex items-center justify-between text-xs font-mono mb-1">
                <span className="text-slate-400 font-bold">Quick Focus Presets:</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => handlePresetSelect(25, 5)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[11px] transition-colors cursor-pointer"
                  >
                    25m Focus
                  </button>
                  <button 
                    onClick={() => handlePresetSelect(50, 10)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-amber-300 hover:text-white border border-amber-500/30 text-[11px] transition-colors cursor-pointer"
                  >
                    50m Deep
                  </button>
                  <button 
                    onClick={() => handlePresetSelect(90, 15)}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] transition-colors cursor-pointer"
                  >
                    90m Ultradian
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                <button
                  onClick={() => {
                    if (isRunning) return;
                    setMode('work');
                    setTimeLeft(workMinutes * 60);
                  }}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'work' ? themeStyles.accentBtn : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🌿 Focus Deep Work
                </button>
                <button
                  onClick={() => {
                    if (isRunning) return;
                    setMode('break');
                    setTimeLeft(breakMinutes * 60);
                  }}
                  disabled={isRunning}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'break' ? 'bg-amber-400 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ☕ Serene Break
                </button>
              </div>

              {/* Digital Clock */}
              <div className="text-center py-2">
                <div className={`text-5xl sm:text-6xl font-black font-mono tracking-tight text-white ${isRunning && isStrictMode ? 'animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.6)] text-red-50' : 'drop-shadow-md'}`}>
                  {formatTime(timeLeft)}
                </div>
                <div className={`text-xs font-mono font-bold mt-2 tracking-wider uppercase ${themeStyles.primaryText}`}>
                  {mode === 'work' ? `Focusing on ${selectedSubject.code}` : 'Rest & Recharge Mind'}
                </div>
                
                {/* Active vs Paused Segment Breakdown */}
                {sessionStartTime && (
                  <div className="mt-4 px-4 pb-2">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1.5 uppercase tracking-wider font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Active: {formatMs(currentSessionActiveMs)}
                      </span>
                      <span className="flex items-center gap-1.5 text-amber-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Paused: {formatMs(currentSessionPausedMs)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 flex overflow-hidden border border-white/5">
                      <div 
                        className="bg-emerald-500 h-full transition-all duration-300" 
                        style={{ width: `${(currentSessionActiveMs / (currentSessionElapsedMs || 1)) * 100}%` }}
                      />
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300" 
                        style={{ width: `${(currentSessionPausedMs / (currentSessionElapsedMs || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Control Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStartPause}
                  className={`flex-1 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer ${
                    isRunning 
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950' 
                      : themeStyles.accentBtn
                  }`}
                >
                  {isRunning ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause Session</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Deep Focus</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleReset}
                  className="p-3.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all cursor-pointer"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={togglePip}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    pipWindow 
                      ? 'bg-indigo-500 text-slate-950 border-indigo-400 font-bold shadow-lg' 
                      : 'bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border-indigo-500/40 hover:border-indigo-400'
                  }`}
                  title={pipWindow ? "Dock Floating Mini Timer back to main window" : "Pop-out Floating Mini Timer (Always-on-Top Document Picture-in-Picture)"}
                >
                  <Tv className="w-4 h-4 text-indigo-300" />
                  <span className="text-xs font-bold whitespace-nowrap hidden sm:inline">
                    {pipWindow ? 'Dock In' : 'Pop-Out'}
                  </span>
                </button>

                <button
                  onClick={handleStopAndLog}
                  className="p-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white rounded-xl border border-rose-500/30 transition-all cursor-pointer"
                  title="Stop & Log Early"
                >
                  <span className="text-xs font-bold whitespace-nowrap">Stop & Log</span>
                </button>
              </div>
            </div>

            {/* Subject & Topic Selector */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 mb-1">
                  Select CA Subject to Study:
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedTopicId('');
                    if (onSetCurrentSubject) onSetCurrentSubject(e.target.value);
                  }}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                      {s.code}: {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-amber-300 mb-1 flex items-center justify-between">
                  <span>📖 Specific Chapter / Topic:</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <select
                  value={selectedTopicId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedTopicId(val);
                    
                    const updateTimerFromSlot = (slotTime: string) => {
                      const hrs = parseSlotHours(slotTime);
                      const mins = Math.round(hrs * 60);
                      setWorkMinutes(mins);
                      setMode('work');
                      setTimeLeft(mins * 60);
                      setIsRunning(false);
                    };

                    if (val.startsWith('slot-')) {
                      const slotId = val.replace('slot-', '');
                      const slot = subjectTimetableSlots.find(s => s.id === slotId);
                      if (slot) updateTimerFromSlot(slot.time);
                    } else if (val.startsWith('topic-')) {
                      const topicId = val.replace('topic-', '');
                      const topic = pendingTopics.find(t => t.id === topicId);
                      if (topic) {
                        const todayStr = getISTYMD();
                        const todaySlots = store.getScheduleForDate(todayStr);
                        // Find matching slot for this topic
                        const activeSubObj = subjects.find(s => s.id === selectedSubjectId);
                        const matchingSlot = todaySlots.find(s => 
                          s.subject === activeSubObj?.name && 
                          s.activity.toLowerCase().includes(topic.title.toLowerCase())
                        );
                        if (matchingSlot) {
                          updateTimerFromSlot(matchingSlot.time);
                        }
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-amber-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400">-- General Subject Study Block --</option>
                  {subjectTimetableSlots.length > 0 && (
                    <optgroup label="📅 Scheduled Slots Today" className="bg-slate-900 text-emerald-300 font-bold">
                      {subjectTimetableSlots.map(slot => (
                        <option key={`slot-${slot.id}`} value={`slot-${slot.id}`} className="bg-slate-900 text-emerald-100">
                          [Today {slot.time}] {slot.activity}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {pendingTopics.length > 0 && (
                    <optgroup label="📚 Pending Syllabus Chapters" className="bg-slate-900 text-amber-300 font-bold">
                      {pendingTopics.map(t => (
                        <option key={`topic-${t.id}`} value={`topic-${t.id}`} className="bg-slate-900 text-amber-100">
                          {t.title} {t.category ? `[${t.category}]` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Quick Chapter Action Button */}
                {activeTopicObj && (
                  <div className="mt-2 p-2.5 bg-slate-950/80 rounded-xl border border-amber-500/30 flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold truncate max-w-[200px]">
                      {activeTopicObj.title}
                    </span>
                    <button
                      onClick={() => {
                        const isCompleting = !activeTopicObj.completed;
                        setSubjects((prevSubjects) =>
                          prevSubjects.map((s) => {
                            if (s.id !== selectedSubject.id) return s;
                            return {
                              ...s,
                              topics: s.topics.map((t) =>
                                t.id === activeTopicObj.id ? { ...t, completed: isCompleting } : t
                              )
                            };
                          })
                        );
                        showToast(`✓ Topic "${activeTopicObj.title}" status updated in Syllabus!`);
                        
                        if (isCompleting && isRunning && mode === 'work') {
                           handleStopAndLog();
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      <span>{activeTopicObj.completed ? 'Completed ✓' : 'Mark Completed'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Time Duration & Soundscape Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
              {/* Duration Inputs */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block">Duration (Minutes)</span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-500 block">Work</span>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={workMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 25;
                        setWorkMinutes(val);
                        if (mode === 'work' && !isRunning) setTimeLeft(val * 60);
                      }}
                      className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-center font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-500 block">Break</span>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={breakMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 5;
                        setBreakMinutes(val);
                        if (mode === 'break' && !isRunning) setTimeLeft(val * 60);
                      }}
                      className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1 text-center font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Ambient Soundscapes & Volume */}
              <div className="bg-slate-950/50 p-3 rounded-xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase block flex items-center gap-1 justify-between">
                  <span className="flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-emerald-400" /> Calm Ambient Sound
                  </span>
                  {soundType !== 'none' && (
                    <span className="text-[9px] text-emerald-300">{Math.round(soundVolume * 100)}%</span>
                  )}
                </span>
                
                <select
                  value={soundType}
                  onChange={(e) => setSoundType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-white/15 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 cursor-pointer"
                >
                  <option value="none">Off (Silent Sanctuary)</option>
                  <option value="Soft Rain">Soft Rain 🌧️</option>
                  <option value="Forest Breeze">Forest Breeze & Birds 🍃</option>
                  <option value="Lofi Beats">Lofi Study Beats 🎧</option>
                  <option value="Ocean Waves">Ocean Waves 🌊</option>
                  <option value="Zen Bowl">Zen Temple Bowl 🧘</option>
                </select>

                {soundType !== 'none' && (
                  <input
                    type="range"
                    min="0"
                    max="0.5"
                    step="0.01"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                )}
              </div>
            </div>

            {/* Piyaa's Comforting Guidance Box with Interactive Pep Talk Switch */}
            <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/30 p-3.5 rounded-xl flex items-start gap-3 text-xs text-emerald-200">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400 shrink-0 animate-pulse mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Piyaa's Loving Focus Note:</span>
                  <button
                    onClick={() => setPepTalkIndex((prev) => (prev + 1) % pepTalks.length)}
                    className="text-[10px] text-rose-300 hover:text-white underline font-mono cursor-pointer"
                  >
                    Next Pep Talk 💕
                  </button>
                </div>
                <p className="italic text-emerald-100/90 text-[11px] mt-1">
                  "{pepTalks[pepTalkIndex]}"
                </p>
              </div>
            </div>

          </div>

        </div>
      </div>

<FocusEfficiencyChart sessions={todaySessions} />

      {/* Session Summary Modal */}
      {sessionSummary && (
        <div className="fixed inset-0 z-[10000] w-screen h-screen flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center gap-3 text-emerald-400 mb-2">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-xl font-semibold">Session Complete</h3>
            </div>
            
            <div className="mb-6 space-y-1">
              <p className="text-slate-200 font-medium text-lg">{sessionSummary.subjectName}</p>
              <p className="text-slate-400 text-sm">{sessionSummary.topicName}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider font-semibold">Effective Time</p>
                <p className="text-2xl font-bold text-emerald-400">{formatMs(sessionSummary.effectiveMs)}</p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider font-semibold">Total Elapsed</p>
                <p className="text-2xl font-bold text-slate-200">{formatMs(sessionSummary.totalElapsedMs)}</p>
              </div>
            </div>
            
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 mb-6 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-300 leading-relaxed">
                <strong>Productivity Insight:</strong> You paused for <strong className="text-indigo-200">{formatMs(sessionSummary.totalElapsedMs - sessionSummary.effectiveMs)}</strong> during this block.
              </p>
            </div>

            <button
              onClick={() => setSessionSummary(null)}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors cursor-pointer"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* FOCUS FOREST GARDEN MODAL */}
      {showForestModal && (
        <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-emerald-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            
            {/* Modal Header */}
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
              <div className="flex items-center gap-3 text-emerald-300">
                <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 shadow-inner">
                  <TreePine className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">Your Focus Forest Garden</h3>
                  <p className="text-xs text-emerald-300/80 hidden sm:block">Track your deep study sessions grown as blooming trees</p>
                </div>
              </div>
              <button
                onClick={() => setShowForestModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            {/* Modal Content */}
            <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-5 bg-slate-950/50 border border-emerald-500/30 rounded-2xl shadow-xl">
                  <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Trees Planted Today</span>
                  <span className="text-2xl font-black text-emerald-300 mt-1 block">{treesPlantedToday.length} 🌳</span>
                </div>
                <div className="p-5 bg-slate-950/50 border border-teal-500/30 rounded-2xl shadow-xl">
                  <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Total Lifetime Forest</span>
                  <span className="text-2xl font-black text-teal-300 mt-1 block">{plantedTrees.length} 🌲</span>
                </div>
              </div>

              <div className="bg-slate-950/40 p-6 rounded-3xl border border-white/5 space-y-4">
                <h4 className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-widest border-b border-emerald-500/20 pb-2">Planted Tree History</h4>
                {plantedTrees.length > 0 ? (
                  <div className="space-y-3">
                    {plantedTrees.map((tree) => (
                      <div key={tree.id} className="p-4 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-between text-xs hover:border-emerald-500/40 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">🌳</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-500/30 text-[10px]">
                                {tree.subjectCode}
                              </span>
                              <span className="font-bold text-white">{tree.topicTitle}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono block mt-1">
                              {tree.plantedAt} at {tree.timeString}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-emerald-300 text-xs px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 shadow-inner">
                          +{tree.minutes} mins
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500 font-mono">
                    No trees planted yet! Start a Deep Focus session to grow your first Chotu Tree.
                  </div>
                )}
              </div>
            </main>

            {/* Modal Footer */}
            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-end sticky bottom-0 z-20 bg-[#0A121E]/90">
              <button
                onClick={() => setShowForestModal(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer shadow-lg transition-all"
              >
                Back to Deep Work
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* Fallback Toast when Document PiP is not supported */}
      {showPipFallbackToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="bg-slate-900 text-amber-300 px-6 py-3.5 rounded-2xl shadow-2xl border border-amber-500/50 flex items-center gap-3 font-bold text-xs sm:text-sm max-w-md">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-extrabold text-white">Document Picture-in-Picture Not Supported</p>
              <p className="text-[11px] text-amber-200/80 font-normal mt-0.5">
                Your browser does not support the Floating Mini Window API. Please use Google Chrome 111+ or Microsoft Edge for always-on-top floating timer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PICTURE-IN-PICTURE FLOATING MINI TIMER PORTAL */}
      {pipWindow && createPortal(
        <div className="w-full h-screen bg-slate-950 text-slate-100 p-3.5 flex flex-col justify-between select-none font-sans box-border bg-gradient-to-br from-slate-950 via-[#0a121e] to-slate-900 border-2 border-indigo-500/50">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="p-1 rounded-lg bg-indigo-950 border border-indigo-500/40 text-indigo-300 shrink-0 text-xs">
                🌸
              </div>
              <div className="truncate">
                <div className="text-[11px] font-black uppercase tracking-wide text-indigo-200 truncate">
                  {selectedSubject?.code || 'CA FINAL'} • {selectedSubject?.name || 'Subject'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                  <span>{mode === 'work' ? '🌿 Deep Focus' : '☕ Serene Break'}</span>
                  <span>•</span>
                  <span className={isRunning ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {isRunning ? '● LIVE' : '⏸ PAUSED'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                try { pipWindow.close(); } catch (e) {}
                setPipWindow(null);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 text-xs font-bold"
              title="Dock back to main window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Big Digital Countdown Clock */}
          <div className="text-center py-2">
            <div className={`text-4xl sm:text-5xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.6)] ${isRunning && isStrictMode ? 'animate-pulse text-red-200' : ''}`}>
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Action Control Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <button
              onClick={handleStartPause}
              className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer ${
                isRunning
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>START</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700/60 transition-all cursor-pointer flex items-center gap-1"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>,
        pipWindow.document.body
      )}

    </div>
  );
};
