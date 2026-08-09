import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  Calendar, Clock, CheckCircle2, Circle, Sparkles, RefreshCw, 
  Award, BookOpen, ChevronLeft, ChevronRight, Copy, Play, 
  CheckSquare, Plus, Trash2, Edit3, Save, Layers, Search, 
  Lock, Unlock, Ban, Settings, RotateCcw, Zap, X, Heart, Smile
} from 'lucide-react';
import { TimetableSlot, GeneratedTimetable, SlotStatus, TimetablePreset, CASubject } from '../types';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr, sanitizeAndMergeConsecutiveBreaks } from '../utils/timeUtils';
import { fetchWithRetry } from '../lib/api';
import { useStore } from '../store';
import { getISTDate, getISTYMD, addDaysToYMD, formatDisplayDate } from '../lib/dateUtils';

const commonStartTimes = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM', '02:00 PM', '03:00 PM', '04:00 PM'
];

const commonStudyDurations = [
  '1.0 Hours', '1.25 Hours', '1.5 Hours', '1.75 Hours', '2.0 Hours', '2.25 Hours', '2.5 Hours', '2.75 Hours', '3.0 Hours', '3.5 Hours', '4.0 Hours', '4.5 Hours', '5.0 Hours'
];

const commonLunchDurations = [
  'N/A', '15 mins', '20 mins', '25 mins', '30 mins', '35 mins', '40 mins', '45 mins', '50 mins', '55 mins', '60 mins', '75 mins', '90 mins', '120 mins'
];

const commonDinnerDurations = [
  'N/A', '15 mins', '20 mins', '25 mins', '30 mins', '35 mins', '40 mins', '45 mins', '50 mins', '55 mins', '60 mins', '75 mins', '90 mins', '120 mins'
];

interface WeeklyPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: CASubject[];
  isStrictMode?: boolean;
}

interface DayConfig {
  schedulingMode: 'UNIFORM' | 'VARIABLE' | 'MANUAL';
  availableHours: number;
  startTimePreference: string;
  endTimePreference: string;
  slotTimePreference: string;
  variableDurations: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  manualSlots: TimetableSlot[];
  shortBreakDuration: string;
  lunchStartTime: string;
  lunchDuration: string;
  dinnerStartTime: string;
  dinnerDuration: string;
  primarySubject: string;
  secondarySubject: string;
  splitRatio: number;
  selectedPrimaryChapterIds: string[];
  selectedSecondaryChapterIds: string[];
  customInstructions: string;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type DayName = typeof DAYS_OF_WEEK[number];

export const WeeklyPlannerModal: React.FC<WeeklyPlannerModalProps> = ({
  isOpen,
  onClose,
  subjects = [],
  isStrictMode = false,
}) => {
  // 1. Scroll-Lock on Body (Requirement 1)
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 2. ESC Key Close Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const {
    setScheduleForDate,
    setDailyTarget,
    customTimetablePresets = [],
    addTimetablePreset,
    deleteTimetablePreset,
    getTotalBacklogDebtHours,
    settleAllBacklogDebt,
    isTodaySyncedWithWeekly,
    setIsTodaySyncedWithWeekly
  } = useStore();

  // 3. Week Selection Offset (0: This Week, 1: Next Week)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [activeDayTab, setActiveDayTab] = useState<DayName>('Monday');
  const [absorbBacklog, setAbsorbBacklog] = useState<boolean>(false);

  // Load dates for the selected week
  const weekDates = useMemo(() => {
    const now = getISTDate();
    const day = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    // Distance to current week's Monday
    const distanceToMonday = (day === 0 ? -6 : 1 - day) + (weekOffset * 7);
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    return DAYS_OF_WEEK.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return getISTYMD(d);
    });
  }, [weekOffset]);

  const dateForActiveDay = useMemo(() => {
    const idx = DAYS_OF_WEEK.indexOf(activeDayTab);
    return weekDates[idx];
  }, [activeDayTab, weekDates]);

  const isPastDay = useMemo(() => {
    return dateForActiveDay < getISTYMD();
  }, [dateForActiveDay]);

  const isToday = useMemo(() => {
    return dateForActiveDay === getISTYMD();
  }, [dateForActiveDay]);

  // Initial template state for one day
  const createDefaultDayConfig = (day: DayName): DayConfig => {
    return {
      schedulingMode: 'UNIFORM',
      availableHours: 8,
      startTimePreference: '09:00 AM',
      endTimePreference: '11:00 PM',
      slotTimePreference: '2.0 Hours',
      variableDurations: {
        morning: '2.0 Hours',
        afternoon: '2.0 Hours',
        evening: '1.5 Hours',
      },
      manualSlots: [],
      shortBreakDuration: '15 mins',
      lunchStartTime: '01:00 PM',
      lunchDuration: '45 mins',
      dinnerStartTime: '08:30 PM',
      dinnerDuration: '45 mins',
      primarySubject: subjects[0]?.name || 'Financial Reporting (FR)',
      secondarySubject: 'N/A',
      splitRatio: 60,
      selectedPrimaryChapterIds: [],
      selectedSecondaryChapterIds: [],
      customInstructions: '',
    };
  };

  // 4. Record configuration for all 7 days
  const [daysConfig, setDaysConfig] = useState<Record<DayName, DayConfig>>(() => {
    const initial: Partial<Record<DayName, DayConfig>> = {};
    DAYS_OF_WEEK.forEach((day) => {
      initial[day] = createDefaultDayConfig(day);
    });
    return initial as Record<DayName, DayConfig>;
  });

  const activeConfig = daysConfig[activeDayTab];

  // Helper to update active day configuration
  const updateActiveConfig = (updates: Partial<DayConfig>) => {
    setDaysConfig((prev) => ({
      ...prev,
      [activeDayTab]: {
        ...prev[activeDayTab],
        ...updates,
      },
    }));
  };

  // Auto-calculate availableHours based on start and end times
  useEffect(() => {
    const parseTime = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (!match) return 0;
      let hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const period = match[3] ? match[3].toUpperCase() : 'AM';
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + mins;
    };
    const startMins = parseTime(activeConfig.startTimePreference);
    const endMins = parseTime(activeConfig.endTimePreference);
    if (startMins > 0 && endMins > 0) {
      let spanMins = endMins - startMins;
      if (spanMins < 0) spanMins += 24 * 60; // handle overnight
      
      const lunchMins = activeConfig.lunchDuration === 'N/A' ? 0 : parseInt(activeConfig.lunchDuration) || 0;
      const dinnerMins = activeConfig.dinnerDuration === 'N/A' ? 0 : parseInt(activeConfig.dinnerDuration) || 0;
      
      const netMins = Math.max(0, spanMins - lunchMins - dinnerMins);
      // Roughly assume 10 mins break per hour (85% efficiency)
      const netHours = netMins / 60;
      const estimatedStudyHours = Math.max(1, Math.round((netHours * 0.85) * 2) / 2);
      if (activeConfig.availableHours !== estimatedStudyHours) {
        setDaysConfig((prev) => ({
          ...prev,
          [activeDayTab]: {
            ...prev[activeDayTab],
            availableHours: estimatedStudyHours,
          },
        }));
      }
    }
  }, [activeConfig.startTimePreference, activeConfig.endTimePreference, activeConfig.lunchDuration, activeConfig.dinnerDuration, activeDayTab]);

  // Helper to save current configuration as preset
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    addTimetablePreset({
      name: presetNameInput.trim(),
      startTime: activeConfig.startTimePreference,
      mode: activeConfig.schedulingMode,
      slotTimePreference: activeConfig.slotTimePreference,
      variableDurations: activeConfig.variableDurations,
      shortBreakDuration: activeConfig.shortBreakDuration,
      mealBreakDuration: activeConfig.lunchDuration, // map to lunchDuration
      availableHours: activeConfig.availableHours,
      manualSlots: activeConfig.manualSlots,
    });
    setPresetNameInput('');
    setShowSavePresetModal(false);
  };

  const handleLoadPreset = (preset: TimetablePreset) => {
    updateActiveConfig({
      startTimePreference: preset.startTime || '09:00 AM',
      endTimePreference: preset.endTime || '11:00 PM',
      schedulingMode: preset.mode || 'UNIFORM',
      slotTimePreference: preset.slotTimePreference || '2.0 Hours',
      variableDurations: preset.variableDurations || { morning: '2.0 Hours', afternoon: '2.0 Hours', evening: '1.5 Hours' },
      shortBreakDuration: preset.shortBreakDuration || '15 mins',
      lunchDuration: preset.mealBreakDuration || '45 mins',
      dinnerDuration: preset.mealBreakDuration || '45 mins',
      availableHours: preset.availableHours || 8,
      manualSlots: preset.manualSlots || [],
    });
  };

  // CTA Requirement 3: Copy current selected day's config to all Mon-Sat weekdays
  const handleCopyToAllWeekdays = () => {
    setDaysConfig((prev) => {
      const source = prev[activeDayTab];
      const updated = { ...prev };
      DAYS_OF_WEEK.forEach((day) => {
        if (day !== 'Sunday') {
          updated[day] = {
            ...source,
          };
        }
      });
      return updated;
    });
  };

  // Live Math Parity for current day
  const previewMath = useMemo(() => {
    let targetDailyHours = activeConfig.availableHours || 8;
    let slotMins = 120; // default 2.0h

    if (activeConfig.schedulingMode === 'UNIFORM') {
      slotMins = (parseFloat(activeConfig.slotTimePreference.replace(' Hours', '')) || 2.0) * 60;
    } else if (activeConfig.schedulingMode === 'VARIABLE') {
      const m = (parseFloat(activeConfig.variableDurations.morning.replace(' Hours', '')) || 2.0) * 60;
      const a = (parseFloat(activeConfig.variableDurations.afternoon.replace(' Hours', '')) || 2.0) * 60;
      const e = (parseFloat(activeConfig.variableDurations.evening.replace(' Hours', '')) || 1.5) * 60;
      slotMins = (m + a + e) / 3;
    } else if (activeConfig.schedulingMode === 'MANUAL') {
      const totalManualMins = activeConfig.manualSlots.reduce((acc, slot) => {
        if (slot.category === 'break') return acc;
        return acc + (parseSlotHours(slot.time) * 60);
      }, 0);
      if (totalManualMins > 0) {
        targetDailyHours = totalManualMins / 60;
        const studySlotCount = Math.max(1, activeConfig.manualSlots.filter(s => s.category !== 'break').length);
        slotMins = totalManualMins / studySlotCount;
      }
    }

    const shortBreakMins = parseInt(activeConfig.shortBreakDuration.replace(' mins', '')) || 15;
    const lunchMins = activeConfig.lunchDuration === 'N/A' ? 0 : (parseInt(activeConfig.lunchDuration.replace(' mins', '')) || 0);
    const dinnerMins = activeConfig.dinnerDuration === 'N/A' ? 0 : (parseInt(activeConfig.dinnerDuration.replace(' mins', '')) || 0);
    const mealBreakMins = lunchMins + dinnerMins;

    const totalSlotsNeeded = activeConfig.schedulingMode === 'MANUAL'
      ? Math.max(1, activeConfig.manualSlots.filter(s => s.category !== 'break').length)
      : Math.max(1, Math.ceil(targetDailyHours / (slotMins / 60)));

    const totalBreaksNeeded = totalSlotsNeeded > 1 ? (totalSlotsNeeded - 1) : 0;
    const totalSpanMinutes = Math.round(
      (totalSlotsNeeded * slotMins) + (totalBreaksNeeded * shortBreakMins) + mealBreakMins
    );

    const startMatch = activeConfig.startTimePreference.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    let startMinutes = 360; // 06:00 AM default
    if (startMatch) {
      let hours = parseInt(startMatch[1]);
      const mins = parseInt(startMatch[2]);
      const period = startMatch[3] ? startMatch[3].toUpperCase() : 'AM';
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      startMinutes = hours * 60 + mins;
    }

    const projectedEndMinutes = startMinutes + totalSpanMinutes;
    const endHour24 = Math.floor((projectedEndMinutes % (24 * 60)) / 60);
    const endMin = Math.round(projectedEndMinutes % 60);
    const endAmpm = endHour24 >= 12 ? 'PM' : 'AM';
    const endHour12 = endHour24 % 12 || 12;
    const projectedEndTimeStr = `${endHour12.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')} ${endAmpm}`;

    const remainingSleepAndFreeHours = Math.max(0, Math.round((24 - (totalSpanMinutes / 60)) * 10) / 10);
    const isHighBurnoutRisk = remainingSleepAndFreeHours < 6.0;

    const spanHours = Math.floor(totalSpanMinutes / 60);
    const spanMins = totalSpanMinutes % 60;

    return {
      totalSlotsNeeded,
      totalBreaksNeeded: totalBreaksNeeded + 2,
      totalSpanMinutes,
      spanHours,
      spanMins,
      projectedEndTimeStr,
      remainingSleepAndFreeHours,
      isHighBurnoutRisk,
    };
  }, [activeConfig]);

  // Subject allocation helpers for display
  const pSubObj = useMemo(() => subjects.find(s => s.name === activeConfig.primarySubject), [subjects, activeConfig.primarySubject]);
  const sSubObj = useMemo(() => subjects.find(s => s.name === activeConfig.secondarySubject), [subjects, activeConfig.secondarySubject]);

  const allocatedPrimaryHours = useMemo(() => {
    if (activeConfig.secondarySubject === 'N/A') return activeConfig.availableHours;
    return (activeConfig.availableHours * activeConfig.splitRatio) / 100;
  }, [activeConfig.availableHours, activeConfig.secondarySubject, activeConfig.splitRatio]);

  const allocatedSecondaryHours = useMemo(() => {
    if (activeConfig.secondarySubject === 'N/A') return 0;
    return activeConfig.availableHours - allocatedPrimaryHours;
  }, [activeConfig.availableHours, allocatedPrimaryHours, activeConfig.secondarySubject]);

  // Manual study list helpers
  const handleAddManualSlot = (category: 'study' | 'break') => {
    const defaultTime = activeConfig.startTimePreference;
    const defaultSub = category === 'study' ? activeConfig.primarySubject : 'Break Time';
    const defaultAct = category === 'study' ? 'Specific chapter or task' : 'Refreshment & Stretch ☕';
    
    const newSlot: TimetableSlot = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: `${defaultTime} - 2.0 Hours`,
      subject: defaultSub,
      activity: defaultAct,
      category,
      completed: false,
    };

    updateActiveConfig({
      manualSlots: [...activeConfig.manualSlots, newSlot]
    });
  };

  const handleUpdateManualSlot = (id: string, updates: Partial<TimetableSlot>) => {
    const updated = activeConfig.manualSlots.map((s) => s.id === id ? { ...s, ...updates } : s);
    updateActiveConfig({ manualSlots: updated });
  };

  const handleRemoveManualSlot = (id: string) => {
    const filtered = activeConfig.manualSlots.filter((s) => s.id !== id);
    updateActiveConfig({ manualSlots: filtered });
  };

  // Weekly generation implementation
  const [isGeneratingWeekly, setIsGeneratingWeekly] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ currentDay: DayName; index: number; total: number } | null>(null);

  const handleGenerateWeeklyTimetable = async () => {
    setIsGeneratingWeekly(true);
    try {
      for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
        const day = DAYS_OF_WEEK[i];
        setGenerationProgress({ currentDay: day, index: i + 1, total: 7 });

        const config = daysConfig[day];
        const targetDate = weekDates[i];

        const isSunday = day === 'Sunday';
        const backlogHours = getTotalBacklogDebtHours ? getTotalBacklogDebtHours() : 0;
        const absorbedHours = (isSunday && absorbBacklog) ? Math.max(0, Math.min(backlogHours, 16.0 - config.availableHours)) : 0;
        const effectiveStudyHours = config.availableHours + absorbedHours;

        if (config.schedulingMode === 'MANUAL') {
          const formattedManualSlots = sanitizeAndMergeConsecutiveBreaks(config.manualSlots.map((s, idx) => ({
            ...s,
            id: s.id || `manual-${targetDate}-${idx}-${Date.now()}`
          })));
          setScheduleForDate(targetDate, formattedManualSlots);
          setDailyTarget(targetDate, config.availableHours);
          if (isSunday && absorbBacklog) {
            settleAllBacklogDebt();
          }
          continue;
        }

        const primarySubObj = subjects.find(s => s.name === config.primarySubject);
        const secondarySubObj = config.secondarySubject === 'N/A' ? null : subjects.find(s => s.name === config.secondarySubject);

        const pSelChapters = primarySubObj?.topics
          ?.filter((t) => config.selectedPrimaryChapterIds.includes(t.id))
          ?.map((t) => t.title) || [];

        const sSelChapters = secondarySubObj?.topics
          ?.filter((t) => config.selectedSecondaryChapterIds.includes(t.id))
          ?.map((t) => t.title) || [];

        const mergedInstructions = `
Target Date: ${targetDate}.
Scheduling Mode: ${config.schedulingMode}.
${config.primarySubject} Selected Chapters: ${pSelChapters.length > 0 ? pSelChapters.join('; ') : 'All chapters'}.
${config.secondarySubject === 'N/A' ? 'SECONDARY SUBJECT: None (Solo Focus Mode)' : `${config.secondarySubject} Selected Chapters: ${sSelChapters.length > 0 ? sSelChapters.join('; ') : 'All chapters'}`}.
Short Break Duration Preference: ${config.shortBreakDuration}
${config.lunchDuration === 'N/A' ? 'Lunch Break: DO NOT schedule any lunch break break today (Omitted / Skip Break).' : `Lunch Break: Start EXACTLY at ${config.lunchStartTime} for ${config.lunchDuration}.`}
${config.dinnerDuration === 'N/A' ? 'Dinner Break: DO NOT schedule any dinner break break today (Omitted / Skip Break).' : `Dinner Break: Start EXACTLY at ${config.dinnerStartTime} for ${config.dinnerDuration}.`}
User Note: ${config.customInstructions || 'None'}
        `.trim();

        let routineText = '';
        if (config.schedulingMode === 'VARIABLE') {
          routineText = `Mode: VARIABLE DAY-PARTING. First Slot Start Time: ${config.startTimePreference}. Last Slot End Time: ${config.endTimePreference}. Morning Slot Duration (06 AM - 01 PM): ${config.variableDurations.morning}. Afternoon Slot Duration (02 PM - 07 PM): ${config.variableDurations.afternoon}. Evening Slot Duration (08 PM - 12 AM): ${config.variableDurations.evening}. Short Break: ${config.shortBreakDuration}`;
        } else {
          routineText = `First Slot Start Time: ${config.startTimePreference}, Last Slot End Time: ${config.endTimePreference}, Preferred Slot Duration: ${config.slotTimePreference}, Short Break Duration: ${config.shortBreakDuration}`;
        }

        // Call the generation API
        const res = await fetchWithRetry('/api/generate-timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeoutMs: 180000,
          body: JSON.stringify({
            groupOption: 'Both Groups (G1 + G2)',
            availableHours: isSunday && absorbBacklog ? effectiveStudyHours : config.availableHours,
            primarySubject: config.primarySubject,
            secondarySubject: config.secondarySubject,
            splitRatio: config.secondarySubject === 'N/A' ? 100 : config.splitRatio,
            routineAndStartTime: routineText,
            weakSubjects: 'Financial Reporting & Direct Tax',
            examMonth: 'Nov 2026 ICAI Attempt',
            customInstructions: isSunday && absorbBacklog && absorbedHours > 0
              ? `${mergedInstructions}\n\nCRITICAL SYSTEM REQUIREMENT: You MUST allocate exactly ${absorbedHours.toFixed(1)} hours as high-priority "Backlog Revision & Mock Practice" slots (marked with category 'revision' or 'mock') in Sunday's timetable. Total study hours for Sunday must be exactly ${effectiveStudyHours.toFixed(1)} hours. The subject for these slots must be named "Backlog Revision & Mock Practice".`
              : mergedInstructions,
            lunchStartTime: config.lunchStartTime,
            lunchDuration: config.lunchDuration,
            dinnerStartTime: config.dinnerStartTime,
            dinnerDuration: config.dinnerDuration,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to generate schedule for ${day}`);

        if (data.schedule) {
          const gen: GeneratedTimetable = data.schedule;
          const newSlots: TimetableSlot[] = gen.timeSlots.map((ts, idx) => ({
            id: `gen-${targetDate}-${idx}-${Date.now()}`,
            time: ts.time,
            subject: ts.subject,
            activity: ts.activity,
            category: ts.category as any,
            companionTip: ts.companionTip,
            completed: false,
          }));

          setScheduleForDate(targetDate, newSlots);
          setDailyTarget(targetDate, isSunday && absorbBacklog ? effectiveStudyHours : config.availableHours);

          if (isSunday && absorbBacklog) {
            settleAllBacklogDebt();
          }
        }
      }
      onClose();
    } catch (err: any) {
      alert(`Error during weekly timetable generation: ${err.message}`);
    } finally {
      setIsGeneratingWeekly(false);
      setGenerationProgress(null);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col justify-between bg-[#0B1528] text-slate-100 selection:bg-indigo-500/30 font-sans antialiased animate-in fade-in duration-200">
      
      {/* 1. STICKY GLASSMorphic HEADER (shrink-0) */}
      <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0B1528]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 shadow-inner">
            <Calendar className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-emerald-100 tracking-wide">
              📅 CA Final Weekly Timetable Strategy Generator
            </h3>
            <p className="text-xs text-emerald-300/75 font-medium hidden sm:block">
              Plan and schedule your entire week starting strictly from Monday to Sunday!
            </p>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyToAllWeekdays}
            className="px-4 py-1.5 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/60 border border-slate-700/60 font-mono text-sm transition-all cursor-pointer flex items-center gap-2 text-emerald-300"
            title="Copy current day's routine to Monday-Saturday"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>⚡ Copy to All Weekdays</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
            title="Close Modal (Esc)"
          >
            <X className="w-4 h-4" />
            <span>Close (ESC)</span>
          </button>
        </div>
      </header>

      {/* 2. DYNAMIC WEEK SELECTION & TAB NAVIGATION BAR */}
      <div className="px-6 sm:px-8 py-3 bg-slate-950/40 border-b border-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        {/* Week Selector Toggle */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => { setWeekOffset(0); setActiveDayTab('Monday'); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${weekOffset === 0 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            This Week
          </button>
          <button
            onClick={() => { setWeekOffset(1); setActiveDayTab('Monday'); }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${weekOffset === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Next Week
          </button>
        </div>

        {/* Monday - Sunday Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          {DAYS_OF_WEEK.map((day, i) => {
            const isSelected = activeDayTab === day;
            const dateStr = weekDates[i];
            const todayStr = getISTYMD();
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const isFuture = dateStr > todayStr;
            const [y, m, d] = dateStr.split('-');
            const displayDate = `${d}/${m}`;
            return (
              <button
                key={day}
                onClick={() => setActiveDayTab(day)}
                className={`px-3.5 py-1.5 rounded-xl border font-mono text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected 
                    ? (isToday ? 'bg-emerald-950 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : isPast ? 'bg-red-950 border-red-400 text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.2)]'
                      : 'bg-yellow-950 border-yellow-400 text-yellow-200 shadow-[0_0_12px_rgba(250,204,21,0.2)]')
                    : (isToday ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-500 hover:text-emerald-400 hover:border-emerald-700'
                      : isPast ? 'bg-red-950/30 border-red-900/50 text-red-500 hover:text-red-400 hover:border-red-700'
                      : 'bg-yellow-950/30 border-yellow-900/50 text-yellow-500 hover:text-yellow-400 hover:border-yellow-700')
                }`}
              >
                <span>{day.substring(0, 3)}</span>
                <span className={`text-[10px] ${isSelected ? 'opacity-80' : 'opacity-60'}`}>({displayDate})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MODAL BODY SCROLLABLE GRID WRAPPER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/20 p-4 sm:p-6 rounded-3xl border border-white/5">
          
          {/* Glassmorphic Lock Badge */}
          {isPastDay && (
            <div className="lg:col-span-12 p-5 rounded-2xl bg-slate-900/90 border border-slate-700/60 backdrop-blur-md flex items-center justify-center gap-2.5 shadow-xl select-none animate-in fade-in zoom-in-95 duration-200">
              <span className="text-xs sm:text-sm font-extrabold text-slate-300 flex items-center gap-2 font-mono uppercase tracking-wider">
                🔒 Historical Day — Read-Only (Completed Progress Protected)
              </span>
            </div>
          )}

          {/* Left Column: Day Settings (col-span-5) */}
          <div className={`lg:col-span-5 space-y-5 flex flex-col ${isPastDay ? 'opacity-75 grayscale-[30%] pointer-events-none' : ''}`}>
            
            {/* Decouple / Sync Toggle */}
            {isToday && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 space-y-2.5 shadow-inner">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                    ⚙️ Today's Sync Status
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTodaySyncedWithWeekly(!isTodaySyncedWithWeekly)}
                    className="bg-slate-900/90 border border-slate-700 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95"
                  >
                    {isTodaySyncedWithWeekly ? '🔓 Unlink Today from Weekly Plan' : '🔗 Re-link & Restore Weekly Plan'}
                  </button>
                </div>
                <div>
                  {isTodaySyncedWithWeekly ? (
                    <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/20 px-2 py-1 rounded-lg block">
                      ✨ Synced: Modifications made here instantly update Today's Dashboard.
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/20 px-2 py-1 rounded-lg block">
                      ⚡ Independent Today Routine (Weekly Blueprint Protected)
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="text-xs font-black uppercase text-emerald-400 tracking-widest border-b border-emerald-500/10 pb-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Config for {activeDayTab} ({formatDisplayDate(dateForActiveDay)})</span>
            </div>

            {/* Target Date Selector */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Date:
              </label>
              <div className="text-xs font-mono font-black text-amber-300 bg-slate-900 px-3 py-2.5 rounded-xl border border-slate-800">
                {formatDisplayDate(dateForActiveDay)}
              </div>
            </div>

            {/* Scheduling Mode Selector */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-2 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Scheduling Engine Mode:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveConfig({ schedulingMode: 'UNIFORM' })}
                  className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                    activeConfig.schedulingMode === 'UNIFORM'
                      ? 'bg-emerald-950/60 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)] font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  ⚖️ Uniform
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveConfig({ schedulingMode: 'VARIABLE' })}
                  className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                    activeConfig.schedulingMode === 'VARIABLE'
                      ? 'bg-emerald-950/60 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)] font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  🌅 Variable
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveConfig({ schedulingMode: 'MANUAL' })}
                  className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                    activeConfig.schedulingMode === 'MANUAL'
                      ? 'bg-emerald-950/60 border border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)] font-black'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  🛠️ Manual
                </button>
              </div>
            </div>

            {/* Target hours slider: max capped to 16.0h (Requirement 2) */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3.5 shadow-inner">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  Target study hours:
                </label>
                <span className="text-xs font-black text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40 shadow-sm font-mono">
                  {activeConfig.availableHours.toFixed(1)} Hours
                </span>
              </div>
              <input
                type="range"
                min={4}
                max={16}
                step={1}
                value={activeConfig.availableHours}
                onChange={(e) => updateActiveConfig({ availableHours: Number(e.target.value) })}
                className="w-full accent-emerald-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>4h (Light)</span>
                <span className="text-emerald-300 font-bold">8h (Optimal)</span>
                <span>16h (Strict limit)</span>
              </div>

              {/* Crimson Warning */}
              {previewMath.isHighBurnoutRisk && (
                <div className="text-[10px] text-red-300 font-bold bg-red-950/50 border border-red-500/30 p-2.5 rounded-xl mt-2 animate-pulse">
                  ⚠️ Crimson Alert: Burnout risk high! Remaining sleep & free window is below 6.0h ({previewMath.remainingSleepAndFreeHours}h).
                </div>
              )}
            </div>

            {/* Sunday Backlog Debt Toggle */}
            {(() => {
              const backlogHours = getTotalBacklogDebtHours ? getTotalBacklogDebtHours() : 0;
              if (activeDayTab !== 'Sunday' || backlogHours <= 0) return null;
              return (
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-emerald-500/30 space-y-2.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={absorbBacklog}
                        onChange={(e) => setAbsorbBacklog(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-emerald-500 focus:ring-emerald-400 focus:ring-offset-slate-900 bg-slate-950 border-slate-700 cursor-pointer"
                      />
                      <span>⚡ Absorb Weekly Backlog Debt</span>
                    </label>
                    <span className="text-[11px] font-mono font-black text-rose-300 bg-rose-950/80 border border-rose-500/40 px-2.5 py-0.5 rounded-lg shadow-sm font-semibold">
                      +{backlogHours.toFixed(1)}h Debt Pool
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                    When enabled, cumulative unstudied/lapsed hours from this week are absorbed as high-priority "Backlog Revision & Mock Practice" slots into Sunday's schedule (capped at 16.0h max).
                  </p>
                  {absorbBacklog && (
                    <div className="text-[10px] text-emerald-300 font-bold bg-emerald-950/40 border border-emerald-500/20 p-2.5 rounded-xl">
                      📈 Sunday Target increased from <span className="font-mono">{activeConfig.availableHours.toFixed(1)}h</span> to <span className="font-mono text-emerald-200">{Math.min(16, activeConfig.availableHours + backlogHours).toFixed(1)}h</span> (Absorbing <span className="font-mono text-emerald-200">{Math.min(backlogHours, 16 - activeConfig.availableHours).toFixed(1)}h</span> debt)
                    </div>
                  )}
                </div>
              );
            })()}

            {/* First Slot Start Time & Last Slot End Time */}
            {activeConfig.schedulingMode !== 'MANUAL' && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 shadow-inner grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-emerald-300 uppercase block">1st Slot Start Time</span>
                  <input
                    type="text"
                    value={activeConfig.startTimePreference}
                    onChange={(e) => updateActiveConfig({ startTimePreference: e.target.value })}
                    placeholder="e.g. 09:00 AM"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-1">
                    {['AM', 'PM'].map(p => {
                      const isActive = activeConfig.startTimePreference.toUpperCase().includes(p);
                      return (
                        <button
                          key={`start-period-${p}`}
                          type="button"
                          onClick={() => {
                            const base = activeConfig.startTimePreference.replace(/\s*(AM|PM)/i, '').trim() || '09:00';
                            updateActiveConfig({ startTimePreference: `${base} ${p}` });
                          }}
                          className={`flex-1 py-1 text-[9px] font-mono rounded-lg border transition-all ${
                            isActive 
                              ? 'bg-amber-950/40 border-amber-500 text-amber-200' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-emerald-300 uppercase block">Last Slot End Time</span>
                  <input
                    type="text"
                    value={activeConfig.endTimePreference}
                    onChange={(e) => updateActiveConfig({ endTimePreference: e.target.value })}
                    placeholder="e.g. 11:00 PM"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-1">
                    {['AM', 'PM'].map(p => {
                      const isActive = activeConfig.endTimePreference.toUpperCase().includes(p);
                      return (
                        <button
                          key={`end-period-${p}`}
                          type="button"
                          onClick={() => {
                            const base = activeConfig.endTimePreference.replace(/\s*(AM|PM)/i, '').trim() || '11:00';
                            updateActiveConfig({ endTimePreference: `${base} ${p}` });
                          }}
                          className={`flex-1 py-1 text-[9px] font-mono rounded-lg border transition-all ${
                            isActive 
                              ? 'bg-amber-950/40 border-amber-500 text-amber-200' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Sizing Details */}
            {activeConfig.schedulingMode === 'UNIFORM' && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase">Uniform Study Slot Duration</span>
                <input
                  type="text"
                  value={activeConfig.slotTimePreference}
                  onChange={(e) => updateActiveConfig({ slotTimePreference: e.target.value })}
                  placeholder="e.g. 2.0 Hours"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Variable Blocks */}
            {activeConfig.schedulingMode === 'VARIABLE' && (
              <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 animate-in fade-in duration-200">
                <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                  🌅 Variable Day-Parting Block Durations
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-300">🌅 Morning Block (06:00 AM - 01:00 PM)</span>
                    <input
                      type="text"
                      value={activeConfig.variableDurations.morning}
                      onChange={(e) => updateActiveConfig({ variableDurations: { ...activeConfig.variableDurations, morning: e.target.value } })}
                      placeholder="e.g. 2.0 Hours"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-300">☀️ Afternoon Block (02:00 PM - 07:00 PM)</span>
                    <input
                      type="text"
                      value={activeConfig.variableDurations.afternoon}
                      onChange={(e) => updateActiveConfig({ variableDurations: { ...activeConfig.variableDurations, afternoon: e.target.value } })}
                      placeholder="e.g. 2.0 Hours"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-emerald-300 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Requirement 3: Manual meal input picker controls */}
            {activeConfig.schedulingMode !== 'MANUAL' && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-4 shadow-inner">
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider block">
                  🍽️ Manual Meal Allocations
                </span>

                {/* Lunch Group */}
                <div className="space-y-2 border-b border-slate-800/60 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-300">🥪 Lunch Time & Duration</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-[9px] text-slate-400 font-mono block">Start Time</span>
                      <input
                        type="text"
                        value={activeConfig.lunchStartTime}
                        onChange={(e) => updateActiveConfig({ lunchStartTime: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 01:00 PM"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[9px] text-slate-400 font-mono block">Duration</span>
                      <input
                        type="text"
                        value={activeConfig.lunchDuration}
                        onChange={(e) => updateActiveConfig({ lunchDuration: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 45 mins"
                      />
                    </div>
                  </div>
                </div>

                {/* Dinner Group */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-300">🍛 Dinner Time & Duration</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-[9px] text-slate-400 font-mono block">Start Time</span>
                      <input
                        type="text"
                        value={activeConfig.dinnerStartTime}
                        onChange={(e) => updateActiveConfig({ dinnerStartTime: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 08:30 PM"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-[9px] text-slate-400 font-mono block">Duration</span>
                      <input
                        type="text"
                        value={activeConfig.dinnerDuration}
                        onChange={(e) => updateActiveConfig({ dinnerDuration: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. 45 mins"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manual Slots table builder */}
            {activeConfig.schedulingMode === 'MANUAL' && (
              <div className="space-y-3 bg-slate-900/90 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-bold text-amber-300">🛠️ Manual Slots</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddManualSlot('study')}
                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      ➕ Study
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddManualSlot('break')}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      ➕ Break
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {activeConfig.manualSlots.length === 0 ? (
                    <p className="text-[10px] text-slate-500 font-medium text-center py-4">No manual slots added yet. Let's create your perfect schedule babu! 💕</p>
                  ) : (
                    activeConfig.manualSlots.map((slot, idx) => (
                      <div key={slot.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 relative">
                        <button
                          type="button"
                          onClick={() => handleRemoveManualSlot(slot.id)}
                          className="absolute right-1.5 top-1.5 p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={slot.time}
                            onChange={(e) => handleUpdateManualSlot(slot.id, { time: e.target.value })}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-100 font-mono"
                          />
                          <select
                            value={slot.category}
                            onChange={(e) => handleUpdateManualSlot(slot.id, { category: e.target.value as any })}
                            className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-100"
                          >
                            <option value="study">🎓 Study</option>
                            <option value="break">☕ Break</option>
                            <option value="revision">🔄 Revision</option>
                            <option value="mock">📝 Mock Exam</option>
                          </select>
                        </div>
                        <input
                          type="text"
                          value={slot.subject}
                          onChange={(e) => handleUpdateManualSlot(slot.id, { subject: e.target.value })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-100"
                          placeholder="Subject"
                        />
                        <input
                          type="text"
                          value={slot.activity}
                          onChange={(e) => handleUpdateManualSlot(slot.id, { activity: e.target.value })}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-300"
                          placeholder="Activity details"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Presets manager strip */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider block">
                  💾 Timetable Presets
                </span>
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-400 font-bold text-[10px] border border-emerald-500/30"
                >
                  Save Preset
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                {customTimetablePresets.length === 0 ? (
                  <span className="text-[10px] text-slate-500">No saved presets yet</span>
                ) : (
                  customTimetablePresets.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleLoadPreset(p)}
                        className="text-[10px] text-emerald-300 hover:text-white font-bold"
                      >
                        {p.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTimetablePreset(p.id)}
                        className="text-slate-500 hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Subjects & Custom instructions (col-span-7) */}
          <div className={`lg:col-span-7 space-y-5 ${isPastDay ? 'opacity-75 grayscale-[30%] pointer-events-none' : ''}`}>
            <div className="text-xs font-black uppercase text-emerald-400 tracking-widest border-b border-emerald-500/10 pb-2">
              2. Subject Pairing & Chapters Selection
            </div>

            {/* Subjects Pairing */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Select Study Subjects:
              </label>

              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-300">Primary Subject:</span>
                  <select
                    value={activeConfig.primarySubject}
                    onChange={(e) => updateActiveConfig({ primarySubject: e.target.value })}
                    className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                  >
                    {subjects.map((s) => (
                      <option key={`p-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-300/80">Secondary Subject:</span>
                  <select
                    value={activeConfig.secondarySubject}
                    onChange={(e) => updateActiveConfig({ secondarySubject: e.target.value })}
                    className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                  >
                    <option value="N/A">🚫 N/A (Solo Focus Mode - No Secondary Subject)</option>
                    {subjects
                      .filter((s) => s.name !== activeConfig.primarySubject)
                      .map((s) => (
                        <option key={`s-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Split Ratio Slider */}
            {activeConfig.secondarySubject !== 'N/A' && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                    Split Ratio (Primary : Secondary)
                  </label>
                  <span className="text-xs font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                    {activeConfig.splitRatio} : {100 - activeConfig.splitRatio}
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={5}
                  value={activeConfig.splitRatio}
                  onChange={(e) => updateActiveConfig({ splitRatio: Number(e.target.value) })}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="text-center font-bold text-xs text-emerald-300 bg-emerald-950/50 py-1.5 px-3 rounded-xl border border-emerald-500/10">
                  ⚡ {pSubObj?.code || 'Primary'}: {allocatedPrimaryHours.toFixed(1)} hrs | {sSubObj?.code || 'Secondary'}: {allocatedSecondaryHours.toFixed(1)} hrs
                </div>
              </div>
            )}

            {/* Chapter selectors */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Select Target Chapters:
              </label>

              <div className="grid grid-cols-2 gap-4">
                {/* Primary Subject chapters list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-300">{pSubObj?.code || 'Primary'} Chapters:</span>
                  <div className="max-h-[160px] overflow-y-auto border border-slate-800 rounded-xl p-2 space-y-1.5 bg-slate-900/60 pr-1">
                    {pSubObj?.topics && pSubObj.topics.length > 0 ? (
                      pSubObj.topics.map((t) => {
                        const isSelected = activeConfig.selectedPrimaryChapterIds.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-start gap-1.5 text-[10px] text-slate-300 cursor-pointer hover:text-emerald-300 font-medium select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updated = isSelected 
                                  ? activeConfig.selectedPrimaryChapterIds.filter(id => id !== t.id)
                                  : [...activeConfig.selectedPrimaryChapterIds, t.id];
                                updateActiveConfig({ selectedPrimaryChapterIds: updated });
                              }}
                              className="accent-emerald-400 mt-0.5"
                            />
                            <span>{t.title}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-500">No chapters found</span>
                    )}
                  </div>
                </div>

                {/* Secondary Subject chapters list */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-300">{sSubObj?.code || 'Secondary'} Chapters:</span>
                  <div className="max-h-[160px] overflow-y-auto border border-slate-800 rounded-xl p-2 space-y-1.5 bg-slate-900/60 pr-1">
                    {activeConfig.secondarySubject === 'N/A' ? (
                      <span className="text-[10px] text-slate-500 italic block py-4 text-center">Solo Mode (N/A)</span>
                    ) : sSubObj?.topics && sSubObj.topics.length > 0 ? (
                      sSubObj.topics.map((t) => {
                        const isSelected = activeConfig.selectedSecondaryChapterIds.includes(t.id);
                        return (
                          <label key={t.id} className="flex items-start gap-1.5 text-[10px] text-slate-300 cursor-pointer hover:text-emerald-300 font-medium select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updated = isSelected 
                                  ? activeConfig.selectedSecondaryChapterIds.filter(id => id !== t.id)
                                  : [...activeConfig.selectedSecondaryChapterIds, t.id];
                                updateActiveConfig({ selectedSecondaryChapterIds: updated });
                              }}
                              className="accent-emerald-400 mt-0.5"
                            />
                            <span>{t.title}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-slate-500">No chapters found</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Notes */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Additional Custom Instructions / Specific Goals:
              </label>
              <textarea
                value={activeConfig.customInstructions}
                onChange={(e) => updateActiveConfig({ customInstructions: e.target.value })}
                placeholder="✍️ e.g. Assign extra time to mock test practice, write out critical Law provisions, etc."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 transition-colors shadow-inner resize-none min-h-[70px]"
              />
            </div>

          </div>
        </div>
      </main>

      {/* 4. FOOTER PREVIEW BAR AND ACTIVATE (shrink-0 pb-safe) */}
      <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex flex-col md:flex-row items-center justify-between gap-4 sticky bottom-0 z-20 bg-[#0B1528] pb-safe">
        
        {/* Progress and status */}
        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          {isGeneratingWeekly ? (
            <div className="flex items-center gap-2 text-xs font-black text-amber-300 animate-pulse bg-amber-950/60 px-4 py-2 rounded-xl border border-amber-500/40">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
              <span>Optimizing {generationProgress?.currentDay} schedule ({generationProgress?.index}/{generationProgress?.total}). Please wait babu! 💕</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider bg-slate-800 px-2 py-0.5 rounded-md">Live Preview ({activeDayTab}):</span>
                <span className="font-mono text-slate-100 font-bold">Slots: {previewMath.totalSlotsNeeded} ({previewMath.totalBreaksNeeded} breaks)</span>
                <span>•</span>
                <span className="font-mono text-slate-100 font-bold">Span: {previewMath.spanHours}h {previewMath.spanMins}m</span>
                <span>•</span>
                <span className="font-mono text-slate-100 font-bold">Ends: {previewMath.projectedEndTimeStr}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Sleep/Free:</span>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${previewMath.isHighBurnoutRisk ? 'bg-red-950/80 border-red-500/80 text-red-300 animate-pulse' : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'}`}>
                  🌙 {previewMath.remainingSleepAndFreeHours}h
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Generate / Apply Weekly Plan Button */}
        <button
          onClick={handleGenerateWeeklyTimetable}
          disabled={isGeneratingWeekly}
          className="w-full md:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:opacity-95 text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>{isGeneratingWeekly ? 'Generating Full Week...' : '⚡ Generate & Save Weekly Timetable'}</span>
        </button>
      </footer>

      {/* Save Custom Timetable Preset Modal (Nested inside Portal) */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
              💾 Save Timetable Preset
            </h4>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-300 uppercase">Preset Name</label>
              <input
                type="text"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                placeholder="e.g. Early Bird, Night Owl"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetNameInput.trim()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};
