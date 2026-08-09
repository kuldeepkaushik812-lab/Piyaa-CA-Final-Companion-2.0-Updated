import { getISTDate, createRealDateFromIST, formatDisplayDate, getISTYMD, addDaysToYMD, getISTTimeString } from "../lib/dateUtils";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {  
  Calendar, Clock, CheckCircle2, Circle, Sparkles, RefreshCw, 
  Award, BookOpen, FileSpreadsheet, ChevronLeft, ChevronRight, 
  CalendarDays, Copy, Play, CheckSquare, Plus, Trash2, Edit3, Save, Layers,
  Search, Lock, Unlock, Ban, Settings, RotateCcw, Zap } from 'lucide-react';
import { TimetableSlot, GeneratedTimetable, SlotStatus, TimetablePreset } from '../types';
import { WeeklyPlannerModal } from './WeeklyPlannerModal';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr } from '../utils/timeUtils';
import { CASubject } from '../types';
import { exportTimetableDashboardToExcel } from '../lib/excelExport';
import { fetchWithRetry } from '../lib/api';
import { useStore } from '../store';

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

interface TimetablePlannerProps {
  isStrictMode?: boolean;
  subjects: CASubject[];
  initialSlots: TimetableSlot[];
  targetStudyHours?: number;
  onUpdateTargetHours?: (newTarget: number) => void;
  onSlotToggle: (slotId: string) => void;
  onUpdateSchedule: (newSlots: TimetableSlot[]) => void;
}

const getRequiredDailyHours = (subjects: CASubject[]): number => {
  const examDateStr = localStorage.getItem('ca_exam_date') || '2026-11-01';
  const [year, month, day] = examDateStr.split('-').map(Number);
  const targetTime = new Date(year, month - 1, day).getTime();
  
  const todayYmd = getISTYMD();
  const [cy, cm, cd] = todayYmd.split('-').map(Number);
  const nowTime = new Date(cy, cm - 1, cd).getTime();

  const daysLeft = Math.max(1, Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24)));

  let pendingR1Chapters = 0;
  let pendingR2Chapters = 0;

  (subjects || []).forEach((subject) => {
    const topics = subject.topics || [];
    topics.forEach((t) => {
      if (!t.rev1) pendingR1Chapters++;
      if (!t.rev2) pendingR2Chapters++;
    });
  });

  const totalR1Hours = pendingR1Chapters * 3.0;
  const totalR2Hours = pendingR2Chapters * 1.5;
  const remainingTotalTargetHours = totalR1Hours + totalR2Hours;

  const requiredDailyHours = Math.round((remainingTotalTargetHours / daysLeft) * 10) / 10;
  // Cap at 16.0h max and floor at 4.0h
  return Math.min(16.0, Math.max(4.0, requiredDailyHours));
};

export const TimetablePlanner: React.FC<TimetablePlannerProps> = ({
  isStrictMode,
  subjects = [],
  initialSlots,
  targetStudyHours = 8,
  onUpdateTargetHours,
  onUpdateSchedule,
}) => {
  const { 
    getScheduleForDate, 
    setScheduleForDate, 
    applyScheduleToFutureRange, 
    addStudyLog,
    getDailyTarget,
    setDailyTarget,
    selectedDateStr,
    setSelectedDateStr,
    clearStudyLogsForDate,
    recalculateAllMetrics,
    logStudyActivity,
    deleteStudyHistoryLog,
    studyHistoryLogs,
    setTimerTargetSlotId,
    setActiveTab,
    dailyShiftMinutes,
    shiftScheduleCascading,
    splitSlotAndMorphSubject,
    quickAddMicroLog,
    getTotalBacklogDebtHours,
    pushScheduleHistory,
    undoLastScheduleAction,
    canUndoScheduleAction,
    customTimetablePresets = [],
    addTimetablePreset,
    deleteTimetablePreset,
    isTodaySyncedWithWeekly,
    setIsTodaySyncedWithWeekly
  } = useStore();

  const [morphingSlotId, setMorphingSlotId] = useState<string | null>(null);
  const [selectedMorphSubject, setSelectedMorphSubject] = useState<string>('');
  const [morphTopic, setMorphTopic] = useState<string>('');
  const [shiftToast, setShiftToast] = useState<string | null>(null);
  const [generatingSubTasksFor, setGeneratingSubTasksFor] = useState<string | null>(null);

  const handleGenerateSubTasks = async (slot: TimetableSlot) => {
    if (generatingSubTasksFor) return;
    setGeneratingSubTasksFor(slot.id);
    try {
      const slotHrs = slot.totalDurationHours || parseSlotHours(slot.time);
      const res = await fetchWithRetry('/api/generate-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotDurationHours: slotHrs,
          subjectName: slot.subject,
          topicName: slot.activity
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      const updated = slots.map(s => {
        if (s.id === slot.id) {
          return { ...s, subTasks: data.subTasks };
        }
        return s;
      });
      saveSlots(updated);
    } catch (err: any) {
      setShiftToast(err.message || 'Failed to generate sub-tasks');
      setTimeout(() => setShiftToast(null), 3000);
    } finally {
      setGeneratingSubTasksFor(null);
    }
  };

  const handleToggleSubTask = (slotId: string, subTaskId: string) => {
    const updated = slots.map(s => {
      if (s.id === slotId && s.subTasks) {
        return {
          ...s,
          subTasks: s.subTasks.map(st => st.id === subTaskId ? { ...st, completed: !st.completed } : st)
        };
      }
      return s;
    });
    saveSlots(updated);
  };

  // Load schedule for selected date directly from store
  const schedulesByDate = useStore(state => state.schedulesByDate);
  const globalTimetable = useStore(state => state.timetable);
  const slots = schedulesByDate?.[selectedDateStr] || globalTimetable || [];
  const [now, setNow] = useState(getISTDate());
  const todayStr = getISTYMD(now);
  const isPastDate = selectedDateStr < todayStr;


  const hasEveningSlots = useMemo(() => {
    return (slots || []).some(s => {
      if (!s.time || !s.time.includes('-')) return false;
      const parts = s.time.split('-').map(str => str.trim());
      if (parts.length !== 2) return false;
      const startMinutes = parseTimeToMinutes(parts[0]);
      return startMinutes >= 18 * 60;
    });
  }, [slots]);

  let effectiveNowDate = todayStr;
  const istNowStr = getISTTimeString(now);
  let effectiveCurrentMinutes = parseTimeToMinutes(istNowStr);

  if (effectiveCurrentMinutes <= 5 * 60) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    effectiveNowDate = getISTYMD(yesterday);
    effectiveCurrentMinutes += 1440;
  }

  // REAL-TIME CLOCK SYNCHRONIZATION & AUTOMATIC LAPSING (Strict Lapsed-Hours Accounting)
  useEffect(() => {
    if (!slots || slots.length === 0) return;
    let hasChanges = false;
    
    
    const updatedSlots = slots.map(slot => {
      if (slot.category !== 'study') return slot;
      // If user explicitly unlocked this slot, preserve unlocked status
      if (slot.isUnlocked) {
        return slot;
      }

      // Do not re-evaluate if it's already in a final state and frozen
      if (slot.isFrozen || slot.status === 'COMPLETED' || slot.status === 'PARTIALLY_COMPLETED' || slot.status === 'FAILED') {
        return slot;
      }
      
      if (!slot.time || !slot.time.includes('-')) return slot;
      const parts = slot.time.split('-').map(str => str.trim());
      if (parts.length !== 2) return slot;
      let start = parseTimeToMinutes(parts[0]);
      let end = parseTimeToMinutes(parts[1]);
      if (end < start) end += 1440;
      
      if (hasEveningSlots && end <= 5 * 60) {
        end += 1440;
      }
      if (hasEveningSlots && start <= 5 * 60) {
        start += 1440;
      }
      
      const isPast = selectedDateStr < effectiveNowDate || (selectedDateStr === effectiveNowDate && effectiveCurrentMinutes > end);
      
      // Automatic Unlocking of Incorrectly Frozen Slots
      if (!isPast && !slot.isUnlocked && (slot.status as any) === 'FAILED') {
         hasChanges = true;
         return {
           ...slot,
           status: 'PENDING' as any,
           isFrozen: false
         };
      }
      
      if (isPast) {
        hasChanges = true;
        const totalSlotHours = parseSlotHours(slot.time) || 2;
        const studied = slot.studiedDurationHours || ((slot.progress || 0) * totalSlotHours / 100) || 0;
        
        let newStatus = 'FAILED';
        if (studied >= totalSlotHours) {
           newStatus = 'COMPLETED';
        } else if (studied >= totalSlotHours * 0.5) {
           newStatus = 'PARTIALLY_COMPLETED';
        }

        return {
          ...slot,
          totalDurationHours: totalSlotHours,
          studiedDurationHours: studied,
          status: newStatus as "COMPLETED" | "PARTIALLY_COMPLETED" | "FAILED",
          completed: newStatus === 'COMPLETED' || newStatus === 'PARTIALLY_COMPLETED',
          isFrozen: true
        };
      }
      
      return slot;
    });

    if (hasChanges) {
      setScheduleForDate(selectedDateStr, updatedSlots);
    }
  }, [now, slots, selectedDateStr, effectiveNowDate, effectiveCurrentMinutes, hasEveningSlots]);

  useEffect(() => {
    const timer = setInterval(() => {
      const newNow = getISTDate();
      setNow(newNow);
      // Auto-advance selectedDateStr if it was on the old 'today'
      const newTodayStr = getISTYMD(newNow);
      if (todayStr !== newTodayStr && selectedDateStr === todayStr) {
        setSelectedDateStr(newTodayStr);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [todayStr, selectedDateStr]);



  const [isGenerating, setIsGenerating] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ 
    subject: '', 
    activity: '', 
    startTime: '09:00 AM', 
    duration: 1.5,
    category: 'study' as 'study' | 'break' | 'revision' | 'mock' | 'na',
    status: 'PENDING' as SlotStatus
  });

  const [openMenuSlotId, setOpenMenuSlotId] = useState<string | null>(null);

  // Manual Override Drawer State
  const [showManualDrawer, setShowManualDrawer] = useState(false);
  const [newSlotForm, setNewSlotForm] = useState({
    subject: subjects[0]?.name || 'Financial Reporting (FR)',
    activity: '',
    startTime: '09:00 AM',
    duration: 1.5,
    category: 'study' as 'study' | 'break' | 'revision' | 'mock',
    status: 'PENDING' as SlotStatus
  });

  // Modal State for Apply Range
  const [showApplyRangeModal, setShowApplyRangeModal] = useState(false);
  const [rangeStartDate, setRangeStartDate] = useState<string>(selectedDateStr);
  const [rangeDaysCount, setRangeDaysCount] = useState<number>(14);
  const [rangeSuccessMsg, setRangeSuccessMsg] = useState<string | null>(null);

  // Modal State for AI Plan Generator
  const [showModal, setShowModal] = useState(false);
  const [isMidDayUpdate, setIsMidDayUpdate] = useState(false);
  const [groupOption, setGroupOption] = useState<string>('Both Groups (G1 + G2)');
  const [primarySubject, setPrimarySubject] = useState<string>(subjects[0]?.name || 'Financial Reporting (FR)');
  const [secondarySubject, setSecondarySubject] = useState<string>(subjects[3]?.name || subjects[1]?.name || 'Direct Tax & International Tax (DT)');
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<'all' | 'primary' | 'secondary' | 'breaks'>('all');
  const [availableHours, setAvailableHours] = useState<number>(targetStudyHours || 8);
  const [splitRatio, setSplitRatio] = useState<number>(60);
  const [startTimePreference, setStartTimePreference] = useState<string>('09:00 AM');
  const [endTimePreference, setEndTimePreference] = useState<string>('11:00 PM');
  const [slotTimePreference, setSlotTimePreference] = useState<string>('1.5 Hours');

  // 4 Scheduling Customization Engines State
  const [schedulingMode, setSchedulingMode] = useState<'UNIFORM' | 'VARIABLE' | 'MANUAL'>('UNIFORM');
  const [variableDurations, setVariableDurations] = useState<{ morning: string; afternoon: string; evening: string }>({
    morning: '2.0 Hours',
    afternoon: '2.0 Hours',
    evening: '1.5 Hours',
  });

  const [manualSlots, setManualSlots] = useState<TimetableSlot[]>([
    {
      id: `manual-1`,
      time: '06:00 AM - 08:30 AM',
      subject: subjects[0]?.name ? `${subjects[0].code}: ${subjects[0].name}` : 'Paper 1: Financial Reporting (FR)',
      activity: 'Ind AS 115 - Revenue from Contracts with Customers',
      category: 'study',
      companionTip: 'Focus on 5-step model & transaction price allocation',
      completed: false
    },
    {
      id: `manual-2`,
      time: '08:30 AM - 09:00 AM',
      subject: 'Break',
      activity: 'Breakfast & Refreshment Break 🍳',
      category: 'break',
      companionTip: 'Stay hydrated!',
      completed: false
    },
    {
      id: `manual-3`,
      time: '09:00 AM - 11:30 AM',
      subject: subjects[3]?.name ? `${subjects[3].code}: ${subjects[3].name}` : 'Paper 7: Direct Tax & International Tax (DT)',
      activity: 'Transfer Pricing & Arm Length Price',
      category: 'study',
      companionTip: 'Solve ICAI PYQ illustration',
      completed: false
    }
  ]);

  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState('');

  const handleSavePreset = () => {
    if (!presetNameInput.trim()) return;
    addTimetablePreset({
      name: presetNameInput.trim(),
      startTime: startTimePreference,
      endTime: endTimePreference,
      mode: schedulingMode,
      slotTimePreference,
      variableDurations,
      shortBreakDuration,
      mealBreakDuration: lunchDuration, // backward compatibility mapping
      availableHours,
      manualSlots
    });
    setPresetNameInput('');
    setShowSavePresetModal(false);
  };

  const handleLoadPreset = (preset: TimetablePreset) => {
    if (preset.startTime) setStartTimePreference(preset.startTime);
    if (preset.endTime) setEndTimePreference(preset.endTime);
    if (preset.mode) setSchedulingMode(preset.mode);
    if (preset.slotTimePreference) setSlotTimePreference(preset.slotTimePreference);
    if (preset.variableDurations) setVariableDurations(preset.variableDurations);
    if (preset.shortBreakDuration) setShortBreakDuration(preset.shortBreakDuration);
    if (preset.mealBreakDuration) {
      setLunchDuration(preset.mealBreakDuration);
      setDinnerDuration(preset.mealBreakDuration);
    }
    if (preset.availableHours) setAvailableHours(preset.availableHours);
    if (preset.manualSlots && preset.manualSlots.length > 0) setManualSlots(preset.manualSlots);
  };

  const handleAddManualSlot = (category: 'study' | 'break') => {
    const lastSlot = manualSlots[manualSlots.length - 1];
    let newStartMins = 360;
    if (lastSlot) {
      const parts = lastSlot.time.split('-').map(s => s.trim());
      if (parts.length === 2) {
        newStartMins = parseTimeToMinutes(parts[1]);
      }
    }
    const durMins = category === 'study' ? 120 : 15;
    const newEndMins = newStartMins + durMins;
    const startStr = formatMinutesToTimeStr(newStartMins);
    const endStr = formatMinutesToTimeStr(newEndMins);

    const newSlot: TimetableSlot = {
      id: `manual-slot-${Date.now()}`,
      time: `${startStr} - ${endStr}`,
      subject: category === 'study' ? (primarySubject || 'Paper 1: Financial Reporting (FR)') : 'Break',
      activity: category === 'study' ? 'Chapter / Study Session Topic' : 'Refreshment & Reset Break ☕',
      category,
      companionTip: category === 'study' ? 'Focus on key ICAI concept illustrations' : 'Recharge & stay fresh',
      completed: false
    };

    setManualSlots(prev => [...prev, newSlot]);
  };

  const handleUpdateManualSlot = (id: string, updates: Partial<TimetableSlot>) => {
    setManualSlots(prev => {
      const index = prev.findIndex(s => s.id === id);
      if (index === -1) return prev;
      let updatedList = prev.map(s => s.id === id ? { ...s, ...updates } : s);

      if (updates.time) {
        updatedList.sort((a, b) => {
          const aStart = parseTimeToMinutes(a.time.split('-')[0].trim());
          const bStart = parseTimeToMinutes(b.time.split('-')[0].trim());
          return aStart - bStart;
        });
      }

      const newIndex = updatedList.findIndex(s => s.id === id);

      // Automatically ripple adjust subsequent manual slots if time or duration is changed
      if (updates.time && newIndex !== -1 && newIndex < updatedList.length - 1) {
        const parts = updatedList[newIndex].time.split('-').map(str => str.trim());
        if (parts.length === 2) {
          let currentEndMin = parseTimeToMinutes(parts[1]);
          for (let i = newIndex + 1; i < updatedList.length; i++) {
            const slot = updatedList[i];
            const slotDurationMin = Math.round(parseSlotHours(slot.time) * 60);
            const newStartStr = formatMinutesToTimeStr(currentEndMin);
            const newEndMin = currentEndMin + slotDurationMin;
            const newEndStr = formatMinutesToTimeStr(newEndMin);
            updatedList[i] = { ...slot, time: `${newStartStr} - ${newEndStr}` };
            currentEndMin = newEndMin;
          }
        }
      }
      return updatedList;
    });
  };

  const handleDeleteManualSlot = (id: string) => {
    setManualSlots(prev => {
      const delIndex = prev.findIndex(s => s.id === id);
      const filtered = prev.filter(s => s.id !== id);
      if (delIndex !== -1 && delIndex < filtered.length) {
        let currentEndMin = 360;
        if (delIndex > 0 && filtered[delIndex - 1]) {
          const prevParts = filtered[delIndex - 1].time.split('-').map(str => str.trim());
          if (prevParts.length === 2) {
            currentEndMin = parseTimeToMinutes(prevParts[1]);
          }
        }
        for (let i = delIndex; i < filtered.length; i++) {
          const slot = filtered[i];
          const slotDurationMin = Math.round(parseSlotHours(slot.time) * 60);
          const newStartStr = formatMinutesToTimeStr(currentEndMin);
          const newEndMin = currentEndMin + slotDurationMin;
          const newEndStr = formatMinutesToTimeStr(newEndMin);
          filtered[i] = { ...slot, time: `${newStartStr} - ${newEndStr}` };
          currentEndMin = newEndMin;
        }
      }
      return filtered;
    });
  };

  // Guard to force active tab in modal chapter selection when Secondary is N/A
  useEffect(() => {
    if (secondarySubject === 'N/A') {
      setActiveModalChapterTab('primary');
    }
  }, [secondarySubject]);

  // Handle ESC key press & Scroll Lock for Timetable Modals
  const isAnyTimetableModalOpen = showModal || showApplyRangeModal || Boolean(editingSlotId) || showManualDrawer;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showModal) setShowModal(false);
        else if (showApplyRangeModal) setShowApplyRangeModal(false);
        else if (editingSlotId) setEditingSlotId(null);
        else if (showManualDrawer) setShowManualDrawer(false);
      }
    };
    if (isAnyTimetableModalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnyTimetableModalOpen, showModal, showApplyRangeModal, editingSlotId, showManualDrawer]);

  // Sync availableHours with daily target or default target hours
  const currentDailyTarget = getDailyTarget(selectedDateStr);

  useEffect(() => {
    if (showModal) {
      const liveRequiredHours = getRequiredDailyHours(subjects);
      setAvailableHours(currentDailyTarget || liveRequiredHours);
    }
  }, [showModal, currentDailyTarget, subjects]);

  // Listen to open-ai-plan-modal custom event to trigger the AI modal instantly
  useEffect(() => {
    const handleOpenAIPlan = () => {
      setShowModal(true);
    };
    window.addEventListener('open-ai-plan-modal', handleOpenAIPlan);
    return () => window.removeEventListener('open-ai-plan-modal', handleOpenAIPlan);
  }, []);

  const [weakSubjects, setWeakSubjects] = useState<string>('Financial Reporting & Direct Tax');
  const [examMonth, setExamMonth] = useState<string>('Nov 2026 ICAI Attempt');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [shortBreakDuration, setShortBreakDuration] = useState<string>('15 mins');
  const [lunchStartTime, setLunchStartTime] = useState<string>('01:00 PM');
  const [lunchDuration, setLunchDuration] = useState<string>('45 mins');
  const [dinnerStartTime, setDinnerStartTime] = useState<string>('08:30 PM');
  const [dinnerDuration, setDinnerDuration] = useState<string>('45 mins');
  const [customAiInstruction, setCustomAiInstruction] = useState<string>('');
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState<boolean>(false);
  const [showProjection, setShowProjection] = useState<boolean>(false);

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
    const startMins = parseTime(startTimePreference);
    const endMins = parseTime(endTimePreference);
    if (startMins > 0 && endMins > 0) {
      let spanMins = endMins - startMins;
      if (spanMins < 0) spanMins += 24 * 60; // handle overnight
      
      const lunchMins = lunchDuration === 'N/A' ? 0 : parseInt(lunchDuration) || 0;
      const dinnerMins = dinnerDuration === 'N/A' ? 0 : parseInt(dinnerDuration) || 0;
      
      const netMins = Math.max(0, spanMins - lunchMins - dinnerMins);
      // Roughly assume 10 mins break per hour
      const netHours = netMins / 60;
      const estimatedStudyHours = Math.max(1, Math.round((netHours * 0.85) * 2) / 2); // 85% efficiency
      setAvailableHours(estimatedStudyHours);
    }
  }, [startTimePreference, endTimePreference, lunchDuration, dinnerDuration]);

  // Live Slot-Count & Sleep Reality Preview Badge Math
  const previewMath = useMemo(() => {
    let targetDailyHours = availableHours || 8;
    let slotMins = 120; // default 2.0h

    if (schedulingMode === 'UNIFORM') {
      slotMins = (parseFloat(slotTimePreference.replace(' Hours', '')) || 2.0) * 60;
    } else if (schedulingMode === 'VARIABLE') {
      const m = (parseFloat(variableDurations.morning.replace(' Hours', '')) || 2.0) * 60;
      const a = (parseFloat(variableDurations.afternoon.replace(' Hours', '')) || 2.0) * 60;
      const e = (parseFloat(variableDurations.evening.replace(' Hours', '')) || 1.5) * 60;
      slotMins = (m + a + e) / 3;
    } else if (schedulingMode === 'MANUAL') {
      const totalManualMins = manualSlots.reduce((acc, slot) => {
        if (slot.category === 'break') return acc;
        return acc + (parseSlotHours(slot.time) * 60);
      }, 0);
      if (totalManualMins > 0) {
        targetDailyHours = totalManualMins / 60;
        const studySlotCount = Math.max(1, manualSlots.filter(s => s.category !== 'break').length);
        slotMins = totalManualMins / studySlotCount;
      }
    }

    const shortBreakMins = parseInt(shortBreakDuration.replace(' mins', '')) || 15;
    const lunchMins = lunchDuration === 'N/A' ? 0 : (parseInt(lunchDuration.replace(' mins', '')) || 0);
    const dinnerMins = dinnerDuration === 'N/A' ? 0 : (parseInt(dinnerDuration.replace(' mins', '')) || 0);
    const mealBreakMins = lunchMins + dinnerMins;

    const totalSlotsNeeded = schedulingMode === 'MANUAL'
      ? Math.max(1, manualSlots.filter(s => s.category !== 'break').length)
      : Math.max(1, Math.ceil(targetDailyHours / (slotMins / 60)));

    const totalBreaksNeeded = totalSlotsNeeded > 1 ? (totalSlotsNeeded - 1) : 0;
    const totalSpanMinutes = Math.round(
      (totalSlotsNeeded * slotMins) + (totalBreaksNeeded * shortBreakMins) + mealBreakMins
    );

    const startMatch = startTimePreference.match(/(\d+):(\d+)\s*(AM|PM)?/i);
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
  }, [availableHours, schedulingMode, slotTimePreference, variableDurations, manualSlots, shortBreakDuration, lunchDuration, dinnerDuration, startTimePreference]);

  const [selectedPrimaryChapterIds, setSelectedPrimaryChapterIds] = useState<string[]>([]);
  const [selectedSecondaryChapterIds, setSelectedSecondaryChapterIds] = useState<string[]>([]);

  const [primaryFilter, setPrimaryFilter] = useState<'all' | 'pending' | 'catA' | 'revision'>('all');
  const [secondaryFilter, setSecondaryFilter] = useState<'all' | 'pending' | 'catA' | 'revision'>('all');

  const [primarySearch, setPrimarySearch] = useState<string>('');
  const [secondarySearch, setSecondarySearch] = useState<string>('');
  const [activeModalChapterTab, setActiveModalChapterTab] = useState<'primary' | 'secondary'>('primary');

  const pSubObj = useMemo(() => {
    return subjects.find(
      (s) => s.name === primarySubject || primarySubject.includes(s.name) || s.name.includes(primarySubject)
    );
  }, [subjects, primarySubject]);

  const sSubObj = useMemo(() => {
    if (secondarySubject === 'N/A') return null;
    return subjects.find(
      (s) => s.name === secondarySubject || secondarySubject.includes(s.name) || s.name.includes(secondarySubject)
    );
  }, [subjects, secondarySubject]);

  const getEstimatedHoursForTopic = (topic: any) => {
    if (topic.category === 'Category A') return 5.0;
    if (topic.category === 'Category B') return 3.5;
    if (topic.category === 'Category C') return 2.0;
    if (topic.important) return 4.5;
    return 3.0;
  };

  const allocatedPrimaryHours = useMemo(() => {
    if (secondarySubject === 'N/A') {
      return availableHours;
    }
    return (availableHours * splitRatio) / 100;
  }, [availableHours, secondarySubject, splitRatio]);

  const allocatedSecondaryHours = useMemo(() => {
    if (secondarySubject === 'N/A') return 0;
    return availableHours - allocatedPrimaryHours;
  }, [availableHours, secondarySubject, allocatedPrimaryHours]);

  const totalEstimatedPrimaryHours = useMemo(() => {
    if (!pSubObj) return 0;
    return selectedPrimaryChapterIds.reduce((sum, id) => {
      const topic = pSubObj.topics.find((t) => t.id === id);
      return sum + (topic ? getEstimatedHoursForTopic(topic) : 0);
    }, 0);
  }, [pSubObj, selectedPrimaryChapterIds]);

  const totalEstimatedSecondaryHours = useMemo(() => {
    if (!sSubObj) return 0;
    return selectedSecondaryChapterIds.reduce((sum, id) => {
      const topic = sSubObj.topics.find((t) => t.id === id);
      return sum + (topic ? getEstimatedHoursForTopic(topic) : 0);
    }, 0);
  }, [sSubObj, selectedSecondaryChapterIds]);

  useEffect(() => {
    if (pSubObj) {
      const pendingIds = pSubObj.topics.filter(t => !t.completed).map(t => t.id);
      setSelectedPrimaryChapterIds(pendingIds.length > 0 ? pendingIds : pSubObj.topics.map(t => t.id));
    }
    setPrimarySearch('');
  }, [primarySubject, pSubObj]);

  useEffect(() => {
    if (sSubObj) {
      const pendingIds = sSubObj.topics.filter(t => !t.completed).map(t => t.id);
      setSelectedSecondaryChapterIds(pendingIds.length > 0 ? pendingIds : sSubObj.topics.map(t => t.id));
    }
    setSecondarySearch('');
  }, [secondarySubject, sSubObj]);

  const primaryTopicsToDisplay = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
      const matchesFilter = 
        primaryFilter === 'pending' ? !t.completed :
        primaryFilter === 'catA' ? (t.category === 'Category A' || t.important) : true;
      const matchesSearch = t.title.toLowerCase().includes(primarySearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [pSubObj, primaryFilter, primarySearch]);

  const secondaryTopicsToDisplay = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
      const matchesFilter = 
        secondaryFilter === 'pending' ? !t.completed :
        secondaryFilter === 'catA' ? (t.category === 'Category A' || t.important) : true;
      const matchesSearch = t.title.toLowerCase().includes(secondarySearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [sSubObj, secondaryFilter, secondarySearch]);

  const togglePrimaryTopic = (id: string) => {
    setSelectedPrimaryChapterIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSecondaryTopic = (id: string) => {
    setSelectedSecondaryChapterIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const [aiAdvice, setAiAdvice] = useState<string>(
    'Piyaa\'s Strategy: Subah fresh mind se Primary Subject padho. Post-lunch Secondary Subject & revision/mock practice karo. 2 Subjects daily = Perfect Balance! 💕'
  );

  const [milestones, setMilestones] = useState<string[]>([
    '1st Comprehensive Revision of All 6 Subjects',
    'RTP & MTP Practice Questions for Current Attempt',
    'ICAI Past 3 Attempt Question Papers under Exam Conditions',
    '2nd Quick Formula & Standards Revision',
    '2 Full Length Mock Test Series (3 Hours Each)',
  ]);

  // Sync edited slots to store for selectedDateStr
  const saveSlots = (newSlots: TimetableSlot[]) => {
    let mergedSlots = newSlots;
    if (newSlots.length > 1) {
      mergedSlots = [];
      let currentSlot = newSlots[0];
      for (let i = 1; i < newSlots.length; i++) {
        const nextSlot = newSlots[i];
        if (currentSlot.category === 'break' && nextSlot.category === 'break') {
          // Merge consecutive breaks
          const startStr = currentSlot.time.split('-')[0]?.trim() || '';
          const endStr = nextSlot.time.split('-')[1]?.trim() || '';
          const currentDur = Number(currentSlot.totalDurationHours) || 0;
          const nextDur = Number(nextSlot.totalDurationHours) || 0;
          const currentStudied = Number(currentSlot.studiedDurationHours) || 0;
          const nextStudied = Number(nextSlot.studiedDurationHours) || 0;
          currentSlot = {
            ...currentSlot,
            time: `${startStr} - ${endStr}`,
            totalDurationHours: currentDur + nextDur,
            studiedDurationHours: currentStudied + nextStudied,
            activity: `${currentSlot.activity} & ${nextSlot.activity}`,
            completed: currentSlot.completed && nextSlot.completed,
            status: (currentSlot.completed && nextSlot.completed) ? 'COMPLETED' : 'PENDING'
          };
        } else {
          mergedSlots.push(currentSlot);
          currentSlot = nextSlot;
        }
      }
      mergedSlots.push(currentSlot);
    }

    pushScheduleHistory(selectedDateStr);
    setScheduleForDate(selectedDateStr, mergedSlots);
    if (selectedDateStr === todayStr) {
      onUpdateSchedule(mergedSlots);
    }
  };

  // Toggle slot completion and automatically interlink study log!
  const handleToggle = (id: string, overrideFrozen: boolean = false) => {
    const updated = slots.map((s) => {
      if (s.id === id) {
        if (s.isFrozen && !overrideFrozen) return s; // Cannot toggle a frozen slot unless explicitly overridden
        
        const nextCompleted = !s.completed;
        if (s.category !== 'break') {
          const slotHrs = parseSlotHours(s.time);
          const matchSubj = subjects.find(sub => sub.name.toLowerCase().includes(s.subject.toLowerCase()) || sub.code.toLowerCase().includes(s.subject.toLowerCase()));
          const subjectId = matchSubj ? matchSubj.id : 'general';
          const subjName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : `General (${s.subject})`;
          
          if (s.completed) {
            // Unchecking completed slot -> remove from history ONLY if we manually added a TIME_TABLE log
            const matchingLogs = (studyHistoryLogs || []).filter(
              log => log.sourceType === 'TIME_TABLE' && 
                     log.subjectId === subjectId && 
                     log.chapterTitle === s.activity && 
                     log.dateStr === selectedDateStr
            );
            
            let totalManualHours = 0;
            matchingLogs.forEach(log => {
              totalManualHours += log.durationHours;
              deleteStudyHistoryLog(log.id);
            });
            
            const manualProgressPct = (totalManualHours / slotHrs) * 100;
            const newProgress = Math.max(0, (s.progress || 0) - manualProgressPct);
            const newStudied = Math.max(0, (s.studiedDurationHours || 0) - totalManualHours);
            
            return { 
              ...s, 
              completed: false, 
              progress: newProgress,
              studiedDurationHours: newStudied,
              status: (newStudied > 0 ? 'IN_PROGRESS' : 'PENDING') as SlotStatus
            };
          } else {
            // Logging check in history - only log remaining hours
            const currentStudied = s.studiedDurationHours || ((s.progress || 0) * slotHrs / 100);
            const remainingHours = slotHrs - currentStudied;
            if (remainingHours > 0.05) {
              logStudyActivity({
                dateStr: selectedDateStr,
                subject: subjName,
                subjectId,
                durationHours: Number(remainingHours.toFixed(2)),
                sourceType: 'TIME_TABLE',
                chapterTitle: s.activity
              });
            }
            return { 
              ...s, 
              completed: true, 
              progress: 100,
              studiedDurationHours: slotHrs,
              totalDurationHours: slotHrs,
              status: 'COMPLETED' as SlotStatus,
              isFrozen: true,
              isUnlocked: false
            };
          }
        }
        return { ...s, completed: nextCompleted, progress: nextCompleted ? 100 : 0, isFrozen: nextCompleted ? true : s.isFrozen, isUnlocked: nextCompleted ? false : s.isUnlocked, status: (nextCompleted ? 'COMPLETED' : 'PENDING') as SlotStatus };
      }
      return s;
    });
    saveSlots(updated);
  };
  
  const handleToggleFreeze = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = slots.map(s => {
      if (s.id === id) {
        return { ...s, isFrozen: !s.isFrozen, isUnlocked: s.isFrozen };
      }
      return s;
    });
    saveSlots(updated);
  };

  const handleOverrideAndUnlock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = slots.map(s => {
      if (s.id === id) {
        return {
          ...s,
          isFrozen: false,
          isUnlocked: true,
          status: (s.studiedDurationHours && s.studiedDurationHours > 0 ? 'IN_PROGRESS' : 'PENDING') as SlotStatus
        };
      }
      return s;
    });
    saveSlots(updated);
    recalculateAllMetrics(selectedDateStr);
  };

  
  const isSlotPassed = (dateStr: string, timeStr: string) => {
    if (dateStr < effectiveNowDate) return true;
    if (dateStr > effectiveNowDate) return false;
    const parts = timeStr.split('-').map(s => s.trim());
    if (parts.length !== 2) return false;
    let endMinutes = parseTimeToMinutes(parts[1]);
    const startMinutes = parseTimeToMinutes(parts[0]);
    if (endMinutes < startMinutes) endMinutes += 1440;
    
    if (hasEveningSlots && endMinutes <= 5 * 60) {
      endMinutes += 1440;
    }
    
    return effectiveCurrentMinutes > endMinutes;
  };

  const handleToggleNA = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = slots.map((s) => {
      if (s.id === id) {
        const isNA = s.status === 'NA' || s.category === 'na';
        if (isNA) {
          return {
            ...s,
            status: 'PENDING' as SlotStatus,
            category: s.category === 'na' ? ('study' as const) : s.category,
            completed: false,
            isFrozen: false,
          };
        } else {
          return {
            ...s,
            status: 'NA' as SlotStatus,
            category: 'na' as const,
            completed: false,
            progress: 0,
            studiedDurationHours: 0,
            isFrozen: true,
          };
        }
      }
      return s;
    });
    saveSlots(updated);
    recalculateAllMetrics(selectedDateStr);
  };

  const handleAddCustomSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const isPastDate = selectedDateStr < getISTYMD();
    const startMin = parseTimeToMinutes(newSlotForm.startTime);
    const durationMins = Math.round(newSlotForm.duration * 60);
    const endMin = startMin + durationMins;
    const timeStr = `${newSlotForm.startTime} - ${formatMinutesToTimeStr(endMin)}`;
    
    const newSlot: TimetableSlot = {
      id: `manual-slot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      time: timeStr,
      subject: newSlotForm.subject,
      activity: newSlotForm.activity.trim() || 'Custom Study Session',
      category: newSlotForm.category,
      status: newSlotForm.status,
      completed: newSlotForm.status === 'COMPLETED',
      progress: newSlotForm.status === 'COMPLETED' ? 100 : 0,
      totalDurationHours: Number(newSlotForm.duration.toFixed(2)),
      studiedDurationHours: newSlotForm.status === 'COMPLETED' ? Number(newSlotForm.duration.toFixed(2)) : 0
    };
    
    let updatedSlots = [...slots, newSlot].sort((a, b) => {
      const aStart = parseTimeToMinutes(a.time.split('-')[0].trim());
      const bStart = parseTimeToMinutes(b.time.split('-')[0].trim());
      return aStart - bStart;
    });

    if (!isPastDate) {
      const newSlotIdx = updatedSlots.findIndex(s => s.id === newSlot.id);
      if (newSlotIdx !== -1 && newSlotIdx < updatedSlots.length - 1) {
        let currentEndMin = endMin;
        for (let i = newSlotIdx + 1; i < updatedSlots.length; i++) {
          const s = updatedSlots[i];
          if (s.completed || s.status === 'COMPLETED' || s.status === 'NA' || s.isFrozen || isSlotPassed(selectedDateStr, s.time)) {
            const parts = s.time.split('-').map(p => p.trim());
            if (parts.length === 2) currentEndMin = parseTimeToMinutes(parts[1]);
            continue;
          }
          const durMin = Math.round(parseSlotHours(s.time) * 60);
          const newStartStr = formatMinutesToTimeStr(currentEndMin);
          const newEndMin = currentEndMin + durMin;
          const newEndStr = formatMinutesToTimeStr(newEndMin);
          updatedSlots[i] = { ...s, time: `${newStartStr} - ${newEndStr}` };
          currentEndMin = newEndMin;
        }
      }
    }
    
    saveSlots(updatedSlots);
    recalculateAllMetrics(selectedDateStr);

    setNewSlotForm(prev => ({
      ...prev,
      activity: '',
      startTime: formatMinutesToTimeStr(endMin)
    }));
  };

  const handleStartEdit = (slot: TimetableSlot) => {
    const hours = parseSlotHours(slot.time);
    const startStr = slot.time.split('-')[0].trim() || '09:00 AM';
    setEditingSlotId(slot.id);
    setEditForm({
      subject: slot.subject,
      activity: slot.activity,
      startTime: startStr,
      duration: hours,
      category: slot.category,
      status: slot.status || (slot.completed ? 'COMPLETED' : 'PENDING')
    });
  };

  const saveEdit = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const oldSlot = slots.find(s => s.id === slotId);
    if (!oldSlot) {
      setEditingSlotId(null);
      return;
    }

    const isPastDate = selectedDateStr < getISTYMD();

    const startMin = parseTimeToMinutes(editForm.startTime);
    const endMin = startMin + Math.round(editForm.duration * 60);
    const timeStr = `${editForm.startTime} - ${formatMinutesToTimeStr(endMin)}`;

    const isNAStatus = editForm.status === 'NA' || editForm.category === 'na';

    const newSlot: TimetableSlot = {
      ...oldSlot,
      subject: editForm.subject,
      activity: editForm.activity,
      time: timeStr,
      category: editForm.category,
      status: editForm.status,
      completed: isNAStatus ? false : (editForm.status === 'COMPLETED' ? true : oldSlot.completed),
      isFrozen: isNAStatus ? true : oldSlot.isFrozen
    };

    const getSubjectIdFromName = (name: string): string | null => {
      const matchSubj = subjects.find(sub => 
        sub.name.toLowerCase().includes(name.toLowerCase()) || 
        sub.code.toLowerCase().includes(name.toLowerCase())
      );
      return matchSubj ? matchSubj.id : null;
    };

    const oldSubjId = getSubjectIdFromName(oldSlot.subject) || 'general';
    const newSubjId = getSubjectIdFromName(newSlot.subject) || 'general';

    // If it was completed and now it's not, remove the manual TIME_TABLE logs for the old slot
    if (oldSlot.completed && oldSlot.category !== 'break' && (!newSlot.completed || oldSlot.subject !== newSlot.subject)) {
      const matchingLogs = studyHistoryLogs.filter(
        log => log.sourceType === 'TIME_TABLE' && 
               log.subjectId === oldSubjId && 
               log.chapterTitle === oldSlot.activity && 
               log.dateStr === selectedDateStr
      );
      matchingLogs.forEach(log => {
        deleteStudyHistoryLog(log.id);
      });
      newSlot.studiedDurationHours = 0; // reset manual progress
      newSlot.progress = 0;
    }

    // If it is now completed and wasn't before, log the remaining time
    if (newSlot.completed && newSlot.category !== 'break' && !oldSlot.completed) {
      const slotHrs = parseSlotHours(newSlot.time);
      const currentStudied = newSlot.studiedDurationHours || ((newSlot.progress || 0) * slotHrs / 100) || 0;
      const remainingHours = slotHrs - currentStudied;
      if (remainingHours > 0.05) {
        logStudyActivity({
          dateStr: selectedDateStr,
          subject: newSlot.subject,
          subjectId: newSubjId,
          durationHours: Number(remainingHours.toFixed(2)),
          sourceType: 'TIME_TABLE',
          chapterTitle: newSlot.activity
        });
      }
      newSlot.studiedDurationHours = slotHrs;
      newSlot.progress = 100;
    }

    let updated = slots.map(s => s.id === slotId ? newSlot : s);

    // Sort array in case time was changed out of order
    updated.sort((a, b) => {
      const aStart = parseTimeToMinutes(a.time.split('-')[0].trim());
      const bStart = parseTimeToMinutes(b.time.split('-')[0].trim());
      return aStart - bStart;
    });

    const newEditIndex = updated.findIndex(s => s.id === slotId);
    
    // Auto-update ripple effect for subsequent pending slots ONLY if NOT a past date
    if (!isPastDate && newEditIndex !== -1 && newEditIndex < updated.length - 1) {
      let currentEndMin = endMin;
      for (let i = newEditIndex + 1; i < updated.length; i++) {
        const slot = updated[i];
        if (slot.completed || slot.status === 'COMPLETED' || slot.status === 'NA' || slot.isFrozen || isSlotPassed(selectedDateStr, slot.time)) {
          const parts = slot.time.split('-').map(p => p.trim());
          if (parts.length === 2) currentEndMin = parseTimeToMinutes(parts[1]);
          continue;
        }
        const slotDurationMin = Math.round(parseSlotHours(slot.time) * 60);
        const newStartStr = formatMinutesToTimeStr(currentEndMin);
        const newEndMin = currentEndMin + slotDurationMin;
        const newEndStr = formatMinutesToTimeStr(newEndMin);
        updated[i] = { ...slot, time: `${newStartStr} - ${newEndStr}` };
        currentEndMin = newEndMin;
      }
    }

    saveSlots(updated);
    setEditingSlotId(null);
  };

  const handleDeleteSlot = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isPastDate = selectedDateStr < getISTYMD();
    const targetSlot = slots.find(s => s.id === id);
    if (targetSlot && targetSlot.category !== 'break') {
      const matchSubj = subjects.find(sub => 
        sub.name.toLowerCase().includes(targetSlot.subject.toLowerCase()) || 
        sub.code.toLowerCase().includes(targetSlot.subject.toLowerCase())
      );
      const subjId = matchSubj ? matchSubj.id : 'general';

      // Remove ALL study history logs tied to this slot (both POMODORO and TIME_TABLE) to prevent orphaned logs
      const matchingLogs = studyHistoryLogs.filter(
        log => log.subjectId === subjId && 
               log.chapterTitle === targetSlot.activity && 
               log.dateStr === selectedDateStr
      );
      matchingLogs.forEach(log => {
        deleteStudyHistoryLog(log.id);
      });
    }
    const delIndex = slots.findIndex(s => s.id === id);
    let updated = slots.filter(s => s.id !== id);

    if (!isPastDate && delIndex !== -1 && delIndex < updated.length) {
      let currentEndMin = 7 * 60; // 07:00 AM default
      if (delIndex > 0 && slots[delIndex - 1]) {
        const prevParts = slots[delIndex - 1].time.split('-').map(p => p.trim());
        if (prevParts.length === 2) {
          currentEndMin = parseTimeToMinutes(prevParts[1]);
        }
      } else if (slots[delIndex]) {
        const currParts = slots[delIndex].time.split('-').map(p => p.trim());
        if (currParts.length === 2) {
          currentEndMin = parseTimeToMinutes(currParts[0]);
        }
      }

      for (let i = delIndex; i < updated.length; i++) {
        const slot = updated[i];
        if (slot.completed || slot.status === 'COMPLETED' || slot.status === 'NA' || slot.isFrozen || isSlotPassed(selectedDateStr, slot.time)) {
          const parts = slot.time.split('-').map(p => p.trim());
          if (parts.length === 2) currentEndMin = parseTimeToMinutes(parts[1]);
          continue;
        }
        const slotDurationMin = Math.round(parseSlotHours(slot.time) * 60);
        const newStartStr = formatMinutesToTimeStr(currentEndMin);
        const newEndMin = currentEndMin + slotDurationMin;
        const newEndStr = formatMinutesToTimeStr(newEndMin);
        updated[i] = { ...slot, time: `${newStartStr} - ${newEndStr}` };
        currentEndMin = newEndMin;
      }
    }

    saveSlots(updated);
    recalculateAllMetrics(selectedDateStr);
  };

  const handlePushSlot = (startIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPastDate = selectedDateStr < getISTYMD();
    if (isPastDate) return;

    const updated = [...slots];
    for (let i = startIndex; i < updated.length; i++) {
      if (updated[i].completed || updated[i].status === 'COMPLETED' || updated[i].status === 'NA' || updated[i].isFrozen) {
        continue;
      }
      const parsed = parseTimeStr(updated[i].time);
      if (parsed) {
        const { start, end } = parsed;
        start.setMinutes(start.getMinutes() + 30);
        end.setMinutes(end.getMinutes() + 30);
        
        const formatTime = (d: Date) => {
          let hrs = d.getHours();
          const mins = d.getMinutes().toString().padStart(2, '0');
          const ampm = hrs >= 12 ? 'PM' : 'AM';
          hrs = hrs % 12;
          hrs = hrs ? hrs : 12;
          return `${hrs.toString().padStart(2, '0')}:${mins} ${ampm}`;
        };
        updated[i] = { ...updated[i], time: `${formatTime(start)} - ${formatTime(end)}` };
      }
    }
    saveSlots(updated);
  };

  const handleApplyRangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyScheduleToFutureRange(slots, rangeStartDate, rangeDaysCount);
    setRangeSuccessMsg(`✅ Schedule successfully copied to ${rangeDaysCount} days starting from ${formatDisplayDate(rangeStartDate)}!`);
    setTimeout(() => {
      setRangeSuccessMsg(null);
      setShowApplyRangeModal(false);
    }, 2000);
  };

  const parseTimeStr = (timeStr: string): { start: Date, end: Date } | null => {
    try {
      const parts = timeStr.split('-');
      if (parts.length !== 2) return null;
      
      const startPart = parts[0].trim();
      const endPart = parts[1].trim();

      const parseSingle = (tStr: string) => {
        const match = tStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return null;
        let hours = parseInt(match[1]);
        const mins = parseInt(match[2]);
        const period = match[3] ? match[3].toUpperCase() : 'AM';
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        const istNow = getISTDate();
        return createRealDateFromIST(istNow.getFullYear(), istNow.getMonth(), istNow.getDate(), hours, mins);
      };

      const start = parseSingle(startPart);
      const end = parseSingle(endPart);

      if (start && end) return { start, end };
      return null;
    } catch {
      return null;
    }
  };

  const handleGeneratePlan = async () => {
    if (schedulingMode === 'MANUAL') {
      let preservedSlots: TimetableSlot[] = [];
      if (isMidDayUpdate) {
        preservedSlots = slots.filter(s => s.status === 'COMPLETED' || s.status === 'PARTIALLY_COMPLETED' || s.completed);
      } else {
        clearStudyLogsForDate(selectedDateStr);
        recalculateAllMetrics(selectedDateStr);
      }
      const formattedManualSlots = manualSlots.map((s, idx) => ({
        ...s,
        id: s.id || `manual-${selectedDateStr}-${idx}-${Date.now()}`
      }));
      saveSlots([...preservedSlots, ...formattedManualSlots]);
      setDailyTarget(selectedDateStr, availableHours);
      if (onUpdateTargetHours) {
        onUpdateTargetHours(availableHours);
      }
      setShowModal(false);
      return;
    }

    setIsGenerating(true);
    try {
      const pSubObj = subjects.find(
        (s) => s.name === primarySubject || primarySubject.includes(s.name) || s.name.includes(primarySubject)
      );
      const isSolo = secondarySubject === 'N/A';
      const sSubObj = isSolo ? null : subjects.find(
        (s) => s.name === secondarySubject || secondarySubject.includes(s.name) || s.name.includes(secondarySubject)
      );

      const pSelChapters = pSubObj?.topics
        ?.filter((t) => selectedPrimaryChapterIds.includes(t.id))
        ?.map((t) => t.title) || [];

      const sSelChapters = sSubObj?.topics
        ?.filter((t) => selectedSecondaryChapterIds.includes(t.id))
        ?.map((t) => t.title) || [];

      // SPEC 4: Smart Mid-Day Preservation Logic
      let preservedSlots: TimetableSlot[] = [];
      let hrsToGenerate = availableHours;
      let aiStartTime = startTimePreference;

      if (isMidDayUpdate) {
        preservedSlots = slots.filter(s => s.status === 'COMPLETED' || s.status === 'PARTIALLY_COMPLETED' || s.completed);
        const studiedHrs = preservedSlots.reduce((acc, s) => {
          if (s.category === 'break') return acc;
          return acc + (s.studiedDurationHours || parseSlotHours(s.time) || 0);
        }, 0);
        hrsToGenerate = Math.max(0.5, availableHours - studiedHrs); // Minimum 30 mins remaining
        
        const now = getISTDate();
        const mins = now.getMinutes();
        const nextQuarter = Math.ceil(mins / 15) * 15;
        now.setMinutes(nextQuarter, 0, 0);
        aiStartTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }

      const mergedInstructions = `
Target Date: ${selectedDateStr}.
Scheduling Mode: ${schedulingMode}.
${primarySubject} Selected Chapters: ${pSelChapters.length > 0 ? pSelChapters.join('; ') : 'All chapters'}.
${isSolo ? 'SECONDARY SUBJECT: None (Solo Focus Mode)' : `${secondarySubject} Selected Chapters: ${sSelChapters.length > 0 ? sSelChapters.join('; ') : 'All chapters'}`}.
Short Break Duration Preference: ${shortBreakDuration}
${lunchDuration === 'N/A' ? 'Lunch Break: DO NOT schedule any lunch break today (Omitted / Skip Break).' : `Lunch Break: Start EXACTLY at ${lunchStartTime} for ${lunchDuration}.`}
${dinnerDuration === 'N/A' ? 'Dinner Break: DO NOT schedule any dinner break today (Omitted / Skip Break).' : `Dinner Break: Start EXACTLY at ${dinnerStartTime} for ${dinnerDuration}.`}
User Note: ${customInstructions || 'None'}
${customAiInstruction ? `CRITICAL USER MID-DAY ADVICE TO APPLY TO REMAINING FUTURE SLOTS: ${customAiInstruction}` : ''}
      `.trim();

      let routineText = '';
      if (schedulingMode === 'VARIABLE') {
        routineText = `Mode: VARIABLE DAY-PARTING. First Slot Start Time: ${startTimePreference}. Last Slot End Time: ${endTimePreference}. Morning Slot Duration (06 AM - 01 PM): ${variableDurations.morning}. Afternoon Slot Duration (02 PM - 07 PM): ${variableDurations.afternoon}. Evening Slot Duration (08 PM - 12 AM): ${variableDurations.evening}. Short Break: ${shortBreakDuration}`;
      } else {
        routineText = isMidDayUpdate 
          ? `MID-DAY RESCHEDULE! User clicked Update/Re-plan. Start generating slots EXACTLY from ${aiStartTime} onwards until ${endTimePreference}. Preferred Slot Duration: ${slotTimePreference}, Short Break: ${shortBreakDuration}`
          : `First Slot Start Time: ${startTimePreference}, Last Slot End Time: ${endTimePreference}, Preferred Slot Duration: ${slotTimePreference}, Short Break Duration: ${shortBreakDuration}`;
      }

      const res = await fetchWithRetry('/api/generate-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 180000,
        body: JSON.stringify({
          groupOption,
          availableHours: hrsToGenerate,
          primarySubject,
          secondarySubject: isSolo ? 'N/A' : secondarySubject,
          splitRatio: isSolo ? 100 : splitRatio,
          routineAndStartTime: routineText,
          weakSubjects,
          examMonth,
          customInstructions: mergedInstructions,
          lunchStartTime,
          lunchDuration,
          dinnerStartTime,
          dinnerDuration,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate schedule');

      if (data.schedule) {
        const gen: GeneratedTimetable = data.schedule;
        const newSlots: TimetableSlot[] = gen.timeSlots.map((ts, idx) => ({
          id: `gen-${selectedDateStr}-${idx}-${Date.now()}`,
          time: ts.time,
          subject: ts.subject,
          activity: ts.activity,
          category: ts.category as any,
          companionTip: ts.companionTip,
          completed: false,
        }));

        // Check if there are any completed slots in the previous schedule for selectedDateStr
        const oldSlots = getScheduleForDate(selectedDateStr) || [];
        const anyCompleted = oldSlots.some((s) => s.completed);
        if (!anyCompleted && !isMidDayUpdate) {
          clearStudyLogsForDate(selectedDateStr);
          recalculateAllMetrics(selectedDateStr);
        }

        saveSlots([...preservedSlots, ...newSlots]);
        setDailyTarget(selectedDateStr, availableHours);

        if (onUpdateTargetHours) {
          onUpdateTargetHours(availableHours);
        }

        setAiAdvice(gen.overallAdvice);
        if (gen.revisionMilestones && gen.revisionMilestones.length > 0) {
          setMilestones(gen.revisionMilestones);
        }
        setShowModal(false);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error generating plan: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const studySlots = slots.filter(s => s.category !== 'break');
  const loggedStudyHours = studySlots.reduce((acc, s) => {
    if (s.status === 'COMPLETED' || s.status === 'PARTIALLY_COMPLETED') {
      return acc + (s.studiedDurationHours || parseSlotHours(s.time));
    }
    if (s.completed && !s.status) {
       return acc + parseSlotHours(s.time);
    }
    return acc;
  }, 0);
  const progressPercent = Math.min(100, Math.round((loggedStudyHours / (currentDailyTarget || 1)) * 100));

  const filteredSlots = slots.filter((slot) => {
    if (activeSubjectFilter === 'all') return true;
    if (activeSubjectFilter === 'breaks') return slot.category === 'break';
    if (activeSubjectFilter === 'primary') {
      const pNorm = primarySubject.toLowerCase();
      const sNorm = slot.subject.toLowerCase();
      return sNorm.includes(pNorm) || pNorm.includes(sNorm) || slot.category === 'study';
    }
    if (activeSubjectFilter === 'secondary') {
      if (secondarySubject === 'N/A') return false;
      const secNorm = secondarySubject.toLowerCase();
      const sNorm = slot.subject.toLowerCase();
      return sNorm.includes(secNorm) || secNorm.includes(sNorm) || slot.category === 'study';
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Date Selector & Target Range Banner */}
      <div className="glass-panel p-5 rounded-3xl border border-indigo-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
        
        {/* Date Navigator */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-2xl border border-indigo-500/30">
            <CalendarDays className="w-5 h-5 text-indigo-400 shrink-0 ml-1" />
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
              className="bg-transparent text-sm font-extrabold text-white cursor-pointer focus:outline-none px-1"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const freshNow = getISTDate();
                setNow(freshNow);
                setSelectedDateStr(getISTYMD(freshNow));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDateStr === todayStr
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => {
                setSelectedDateStr(addDaysToYMD(todayStr, 1));
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedDateStr !== todayStr
                  ? 'bg-indigo-500 text-white font-black shadow-md shadow-indigo-500/20'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              Future Date
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full md:w-auto">
          {selectedDateStr === todayStr && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsTodaySyncedWithWeekly(!isTodaySyncedWithWeekly)}
                className="bg-slate-900/90 border border-slate-700 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                title={isTodaySyncedWithWeekly ? "Click to unlink Today's timetable from standard Weekly Plan" : "Click to restore Weekly Plan routine for Today"}
              >
                {isTodaySyncedWithWeekly ? '🔓 Unlink Today' : '🔗 Re-link & Restore'}
              </button>
              {!isTodaySyncedWithWeekly && (
                <span className="bg-slate-900/90 border border-slate-700 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-xl font-mono text-xs transition-all select-none">
                  ⚡ Independent Today Routine (Weekly Blueprint Protected)
                </span>
              )}
            </div>
          )}

          {!isPastDate && (
            <>
              <button
                onClick={() => {
                  setRangeStartDate(selectedDateStr);
                  setShowApplyRangeModal(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 cursor-pointer transition-all"
                title="Apply this timetable to future dates automatically so you don't have to create it daily!"
              >
                <Layers className="w-4 h-4" />
                <span>Apply to Future Dates 🚀</span>
              </button>

              <button
                onClick={() => {
                  setIsMidDayUpdate(false);
                  setShowModal(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>AI Plan 💕</span>
              </button>

              <button
                onClick={() => {
                  setShowManualDrawer(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/60 border border-slate-700/60 text-slate-200 font-mono text-sm transition-all cursor-pointer flex items-center gap-2 font-bold"
              >
                <Settings className="w-4 h-4 text-cyan-400" />
                <span>⚙️ Manually Edit / Override Today</span>
              </button>
            </>
          )}

          <button
            onClick={() => {
              setIsWeeklyModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 hover:border-emerald-500/60 border border-slate-700/60 text-emerald-300 font-mono text-sm transition-all cursor-pointer flex items-center gap-2 font-bold"
          >
            <span>📅 Weekly Plan</span>
          </button>

          <button
            onClick={() => exportTimetableDashboardToExcel(slots, { targetHours: currentDailyTarget }, subjects)}
            className="p-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Export Excel"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Strategy Banner */}
      <div className="glass-panel p-4 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 flex items-center gap-3">
        <span className="text-xl shrink-0">💡</span>
        <p className="text-xs text-indigo-200/90 font-medium">
          {aiAdvice}
        </p>
      </div>

      {/* Progress Bar & Target Hours Adjuster */}
      <div className="glass-card p-4 rounded-2xl border border-indigo-500/30 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <div className="flex-1 w-full">
            <div className="flex justify-between text-xs font-bold text-indigo-200 mb-1.5">
              <span>Progress for {formatDisplayDate(selectedDateStr)}</span>
              <span>{loggedStudyHours.toFixed(1)}h / {currentDailyTarget.toFixed(1)}h ({progressPercent}%)</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-indigo-500/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-teal-400 to-amber-300 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Linked Target Hours Config */}
          <div 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-slate-900/80 hover:bg-slate-800/95 px-3.5 py-2 rounded-xl border border-amber-500/30 hover:border-amber-400/80 text-xs font-bold shrink-0 transition-all cursor-pointer hover:scale-[1.02] shadow-md shadow-amber-500/5 group"
            title="Click to generate custom timetable & set target via AI Plan! 🪄"
          >
            <Clock className="w-4 h-4 text-amber-300 group-hover:animate-bounce shrink-0" />
            <span className="text-slate-300">Target Study: <strong className="text-amber-300 text-sm font-black">{currentDailyTarget}h</strong></span>
            <span className="text-[10px] text-amber-400 font-extrabold bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.5 rounded-md ml-1 animate-pulse flex items-center gap-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              AI Plan
            </span>
            <div className="flex items-center gap-1 ml-1 border-l border-amber-500/20 pl-2 shrink-0">
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const val = Math.max(1, currentDailyTarget - 1);
                  setDailyTarget(selectedDateStr, val);
                  if (onUpdateTargetHours) onUpdateTargetHours(val);
                }}
                className="w-5 h-5 bg-slate-950 hover:bg-slate-800 text-indigo-300 rounded flex items-center justify-center font-black text-xs border border-indigo-500/30"
              >
                -
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const val = currentDailyTarget + 1;
                  setDailyTarget(selectedDateStr, val);
                  if (onUpdateTargetHours) onUpdateTargetHours(val);
                }}
                className="w-5 h-5 bg-slate-950 hover:bg-slate-800 text-indigo-300 rounded flex items-center justify-center font-black text-xs border border-indigo-500/30"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Real-World Resilience Summary Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-indigo-500/20 text-xs">
          <span className="px-2.5 py-1 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-200 font-extrabold flex items-center gap-1.5 shadow-sm">
            <span>⏸️ Emergency Shifts Used:</span>
            <span className="font-mono font-black text-amber-300">{((dailyShiftMinutes || {})[selectedDateStr] || 0)}m / 45m max</span>
          </span>

          {getTotalBacklogDebtHours && getTotalBacklogDebtHours() > 0 && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-backlog-modal'))}
              className="px-2.5 py-1 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 hover:border-rose-300 font-extrabold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all hover:scale-105 active:scale-95"
              title="Click to view complete time, subject, and topic details for all backlog debt slots!"
            >
              <span>🎒 Backlog Debt Pool:</span>
              <span className="font-mono font-black text-rose-300">+{getTotalBacklogDebtHours().toFixed(1)}h</span>
            </button>
          )}


        </div>
      </div>

      {/* Smart Balance Alert for whole timetable */}
      {(() => {
        const totalPlannedHours = slots.reduce((sum, s) => s.category !== 'break' ? sum + parseSlotHours(s.time) : sum, 0);
        const currentDailyTarget = getDailyTarget(selectedDateStr);
        if (totalPlannedHours > currentDailyTarget) {
          return (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 animate-pulse mb-3">
              <span>⚡ Planned: {totalPlannedHours.toFixed(1)}h / {currentDailyTarget.toFixed(1)}h Target (+{(totalPlannedHours - currentDailyTarget).toFixed(1)}h over)</span>
            </div>
          );
        }
        return null;
      })()}

      {/* Slots Timeline Grid */}
      <div className={`grid grid-cols-1 gap-3.5 ${isPastDate ? 'pointer-events-none opacity-80 grayscale-[20%]' : ''}`}>
        {filteredSlots.map((slot, slotIndex) => {
          let start = 0, end = 0;
          let hasValidTime = false;
          if (slot.time && slot.time.includes('-')) {
            const parts = slot.time.split('-').map(s => s.trim());
            if (parts.length === 2) {
              start = parseTimeToMinutes(parts[0]);
              end = parseTimeToMinutes(parts[1]);
              if (end < start) end += 1440;
              hasValidTime = true;
            }
          }
          
          if (hasEveningSlots && end <= 5 * 60) {
            end += 1440;
          }
          if (hasEveningSlots && start <= 5 * 60) {
            start += 1440;
          }
          
          const isLiveNow = selectedDateStr === effectiveNowDate && hasValidTime && effectiveCurrentMinutes >= start && effectiveCurrentMinutes <= end;
          const isFailed = slot.status === 'FAILED' && !slot.isUnlocked;
          const isLocked = slot.isFrozen && !slot.isUnlocked;
          const isCompleted = slot.status === 'COMPLETED' || slot.completed;
          const isPartial = slot.status === 'PARTIALLY_COMPLETED';
          const isNA = slot.status === 'NA' || slot.category === 'na';
          const isBreak = slot.category === 'break' || slot.subject.toLowerCase() === 'break' || slot.activity.toLowerCase().includes('break');

          const totalHrs = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
          const studiedHrs = slot.studiedDurationHours || ((slot.progress || 0) * totalHrs / 100) || (isCompleted ? totalHrs : 0);

          // SPEC 3: Distinct, Muted & Slim Break Slots
          if (isBreak) {
            return (
              <div
                key={slot.id}
                className="bg-amber-950/10 border border-amber-500/25 rounded-xl h-12 px-4 py-2 flex items-center justify-between text-amber-200/80 transition-all shadow-sm hover:border-amber-500/40"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(slot.id); }}
                    className="cursor-pointer text-amber-400 hover:text-amber-300 shrink-0"
                  >
                    {slot.completed ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-amber-400/60" />}
                  </button>
                  <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-lg shrink-0">
                    {slot.time}
                  </span>
                  <span className={`text-xs font-bold truncate ${slot.completed ? 'line-through text-slate-400' : 'text-amber-200/90'}`}>
                    ☕ {slot.activity || slot.subject || 'Rest Break'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggle(slot.id); }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      slot.completed 
                        ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' 
                        : 'bg-amber-950/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/40'
                    }`}
                  >
                    {slot.completed ? "↺ Undo" : "✓ Done"}
                  </button>
                </div>
              </div>
            );
          }

          const isPastSlot = isPastDate || isSlotPassed(selectedDateStr, slot.time);
          const canEdit = !isLocked && !isPastSlot;

          // SPEC 1 & 2: Apple/Linear Border-Glow Glassmorphic Theme (Eliminate Full-Card Background Color Flooding)
          let containerClasses = '';
          if (isNA) {
            containerClasses = 'bg-[#0A121E]/60 border border-slate-800/80 border-l-4 border-l-slate-600 text-slate-400 backdrop-blur-md shadow-md opacity-70';
          } else if (isCompleted) {
            containerClasses = 'bg-[#0A121E]/80 border-2 border-emerald-500/75 border-l-4 border-l-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.18)] text-slate-100';
          } else if (isPartial) {
            containerClasses = 'bg-[#0A121E]/80 border-2 border-amber-500/75 border-l-4 border-l-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.18)] text-slate-100';
          } else if (isFailed) {
            containerClasses = 'bg-[#0A121E]/80 border-2 border-red-500/75 border-l-4 border-l-red-500 shadow-[0_0_18px_rgba(239,68,68,0.18)] opacity-90 text-slate-100';
          } else {
            containerClasses = 'bg-[#0A121E]/70 border border-slate-700/80 border-l-4 border-l-cyan-500/50 hover:border-cyan-500/50 transition-all shadow-md text-slate-100';
          }

          if (isLiveNow && !isFailed && !isCompleted && !isNA) {
            containerClasses += ' ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950 animate-pulse-slow';
          }

          return (
            <div
              key={slot.id}
              className={`flex flex-col justify-between py-3.5 px-5 gap-3 rounded-2xl transition-all group relative backdrop-blur-md ${containerClasses}`}
            >
              {/* SPEC 5: Card Header (Time Badge + Subject & Activity Title) */}
              <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-white/10">
                {/* Left: Status Indicator + Monospace Time Badge + Status Badges */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
                    ) : isPartial ? (
                      <CheckCircle2 className="w-5 h-5 text-amber-400 stroke-[2.5]" />
                    ) : isFailed ? (
                      <Lock className="w-5 h-5 text-red-400" />
                    ) : isNA ? (
                      <Ban className="w-5 h-5 text-slate-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-cyan-400/70" />
                    )}
                  </div>

                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-950/80 border border-white/10 text-cyan-300 shrink-0">
                    {slot.time}
                  </span>

                  {/* Status Badges */}
                  {isCompleted && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                      ✅ COMPLETED
                    </span>
                  )}
                  {isPartial && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                      🟡 PARTIAL (50%+)
                    </span>
                  )}
                  {isFailed && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0">
                      🔴 LAPSED
                    </span>
                  )}
                  {isLiveNow && !isFailed && !isCompleted && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-extrabold flex items-center gap-1 shrink-0 animate-pulse">
                      🔴 LIVE — {Math.max(0, end - effectiveCurrentMinutes)}m left
                    </span>
                  )}
                </div>

                {/* Center: Bold Subject & Chapter Title */}
                <div className="min-w-0 flex-1 text-left truncate px-2">
                  <span className="font-extrabold text-sm text-slate-100 truncate block">
                    {slot.subject}
                  </span>
                  <span className="text-xs text-slate-300/80 truncate block">
                    {slot.activity}
                  </span>
                </div>

                {/* Right: Settings Menu */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuSlotId(openMenuSlotId === slot.id ? null : slot.id)}
                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    title="Slot Settings"
                  >
                    <Settings className={`w-4 h-4 transition-transform duration-300 ${openMenuSlotId === slot.id ? 'rotate-90 text-white' : ''}`} />
                  </button>

                  {openMenuSlotId === slot.id && (
                    <>
                      <div 
                        className="fixed inset-0 z-30 cursor-default" 
                        onClick={() => setOpenMenuSlotId(null)} 
                      />
                      <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl p-2 z-40 space-y-1 text-xs animate-fadeIn">
                        {isFailed && (
                          <button
                            onClick={(e) => { setOpenMenuSlotId(null); handleOverrideAndUnlock(slot.id, e); }}
                            className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-500/20 text-red-300 font-semibold flex items-center gap-2 cursor-pointer"
                          >
                            <Unlock className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-red-400'}`} />
                            <span>Override & Unlock</span>
                          </button>
                        )}
                        {canEdit && (
                          <>
                            <button
                              onClick={() => { setOpenMenuSlotId(null); handleStartEdit(slot); }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-cyan-500/20 text-cyan-200 font-semibold flex items-center gap-2 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Switch Subject & Topic</span>
                            </button>
                            <button
                              onClick={() => { setOpenMenuSlotId(null); handleToggleNA(slot.id); }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-300 font-semibold flex items-center gap-2 cursor-pointer"
                            >
                              <Ban className="w-3.5 h-3.5 text-slate-400" />
                              <span>{isNA ? "Remove N/A" : "Mark as N/A"}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                setOpenMenuSlotId(null);
                                const res = shiftScheduleCascading(selectedDateStr, slot.id, 30);
                                setShiftToast(res.message);
                                setTimeout(() => setShiftToast(null), 4000);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-amber-500/20 text-amber-200 font-semibold flex items-center gap-2 cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Shift Schedule (+30m)</span>
                            </button>
                            <button
                              onClick={(e) => { setOpenMenuSlotId(null); handleDeleteSlot(slot.id, e); }}
                              className="w-full text-left px-3 py-2 rounded-xl hover:bg-rose-950/40 text-rose-300 font-semibold flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>Delete Slot</span>
                            </button>
                          </>
                        )}
                        {!canEdit && !isFailed && (
                          <div className="px-3 py-2 text-slate-500 italic text-[10px] text-center">
                            Past/Locked slots cannot be modified.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* NEW: Micro-Tasking UI */}
              {!isNA && slot.category === 'study' && (
                <div className="py-2 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Micro-Tasks
                    </span>
                    {(!slot.subTasks || slot.subTasks.length === 0) && !isCompleted && !isLocked && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleGenerateSubTasks(slot); }}
                        disabled={generatingSubTasksFor === slot.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold transition-all border border-indigo-500/30 cursor-pointer disabled:opacity-50"
                      >
                        {generatingSubTasksFor === slot.id ? (
                          <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                        )}
                        <span>AI Breakdown</span>
                      </button>
                    )}
                  </div>
                  
                  {slot.subTasks && slot.subTasks.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {slot.subTasks.map(st => (
                        <div 
                          key={st.id} 
                          onClick={(e) => { e.stopPropagation(); if(!isCompleted && !isLocked) handleToggleSubTask(slot.id, st.id); }}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                            st.completed 
                              ? 'bg-emerald-950/20 border-emerald-500/30 opacity-70' 
                              : 'bg-slate-900/40 border-white/10 hover:border-indigo-500/40 cursor-pointer'
                          } ${isCompleted || isLocked ? 'cursor-default opacity-60' : ''}`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${
                            st.completed ? 'bg-emerald-500 border-emerald-400' : 'border-slate-500'
                          }`}>
                            {st.completed && <CheckSquare className="w-2.5 h-2.5 text-slate-950 stroke-[3]" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-[11px] block truncate font-medium ${st.completed ? 'text-emerald-300 line-through' : 'text-slate-300'}`}>
                              {st.title}
                            </span>
                          </div>
                          <span className={`text-[9px] font-mono font-bold shrink-0 ${st.completed ? 'text-emerald-500/70' : 'text-slate-500'}`}>
                            {st.durationMins}m
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SPEC 4 & 5: Bottom Action Footer */}
              {!isNA && (
                <div className="pt-2 border-t border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {isLocked ? (
                    <div className="flex items-center justify-between w-full">
                      <div className={`text-xs font-bold flex items-center gap-2 ${isCompleted ? 'text-emerald-300' : 'text-red-300'}`}>
                        <Lock className={`w-4 h-4 shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-red-400'}`} />
                        {isCompleted ? (<span>🔒 Completed & Locked — {studiedHrs.toFixed(1)}h / {totalHrs.toFixed(1)}h</span>) : (<span>🔒 Time Lapsed — {studiedHrs.toFixed(1)}h / {totalHrs.toFixed(1)}h Counted</span>)}
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleOverrideAndUnlock(slot.id); }}
                        className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0 ${isCompleted ? 'bg-emerald-950 hover:bg-emerald-900 border-emerald-500/50 text-emerald-200 hover:text-white' : 'bg-red-950 hover:bg-red-900 border-red-500/50 text-red-200 hover:text-white'}`}
                      >
                        <Unlock className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : 'text-red-400'}`} />
                        <span>🔓 Override & Unlock</span>
                      </button>
                    </div>
                  ) : isCompleted ? (
                    /* SPEC 4: Completed Card Footer — strictly 2.0h / 2.0h and ↺ Undo Completed button */
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs font-bold text-emerald-300 bg-slate-950/80 border border-emerald-500/30 px-3 py-1 rounded-xl">
                        {studiedHrs.toFixed(1)}h / {totalHrs.toFixed(1)}h
                      </span>

                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span>↺ Undo Completed</span>
                      </button>
                    </div>
                  ) : (
                    /* SPEC 4: Active / Pending Card Footer — strictly ⚡ Start Timer, Switch Subject, +15m/+30m/+1h micro-logs, and ✓ Mark Done */
                    <>
                      {/* Left: Quick Actions Group */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Micro-log Pills */}
                        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/10">
                          <span className="text-[10px] font-black uppercase text-cyan-400 px-1">⏱️ Log:</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickAddMicroLog(selectedDateStr, slot.id, 0.25);
                              setShiftToast(`+15m logged for ${slot.subject}!`);
                              setTimeout(() => setShiftToast(null), 3000);
                            }}
                            className="px-2 py-0.5 rounded-lg text-xs font-bold text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Quick add +15 minutes"
                          >
                            +15m
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickAddMicroLog(selectedDateStr, slot.id, 0.5);
                              setShiftToast(`+30m logged for ${slot.subject}!`);
                              setTimeout(() => setShiftToast(null), 3000);
                            }}
                            className="px-2 py-0.5 rounded-lg text-xs font-bold text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Quick add +30 minutes"
                          >
                            +30m
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              quickAddMicroLog(selectedDateStr, slot.id, 1.0);
                              setShiftToast(`+1h logged for ${slot.subject}!`);
                              setTimeout(() => setShiftToast(null), 3000);
                            }}
                            className="px-2 py-0.5 rounded-lg text-xs font-bold text-slate-200 hover:bg-cyan-500/20 hover:text-cyan-300 transition-colors cursor-pointer"
                            title="Quick add +1 hour"
                          >
                            +1h
                          </button>
                        </div>

                        {/* Start Pomodoro Focus Timer */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTimerTargetSlotId(slot.id);
                            setActiveTab('timer');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold text-amber-300 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Start Pomodoro Focus Timer"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span>⚡ Start Timer</span>
                        </button>

                        {/* Switch Subject & Topic Mid-session Morph */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMorphingSlotId(slot.id);
                            const defaultSub = subjects[0]?.name || slot.subject;
                            setSelectedMorphSubject(defaultSub);
                            const matchedSubObj = subjects.find(s => s.name === defaultSub);
                            setMorphTopic(matchedSubObj?.topics?.[0]?.title || '');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-teal-950/80 hover:bg-teal-900 border border-teal-500/40 text-xs font-bold text-teal-200 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Switch Subject & Topic Mid-session"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                          <span>Switch Subject</span>
                        </button>

                        {/* Emergency Cascading Shift (+15m) */}
                        {!isSlotPassed(selectedDateStr, slot.time) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const res = shiftScheduleCascading(selectedDateStr, slot.id, 15);
                              setShiftToast(res.message);
                              setTimeout(() => setShiftToast(null), 4000);
                            }}
                            className="px-2 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs font-bold text-slate-300 flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                            title="Emergency Cascading Shift (+15m)"
                          >
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Shift +15m</span>
                          </button>
                        )}
                      </div>

                      {/* Right: Monospace Progress Counter + Primary Mark Done Button */}
                      <div className="flex items-center gap-3 shrink-0 ml-auto">
                        <span className="font-mono text-xs font-bold text-cyan-300 bg-slate-950/80 border border-white/10 px-2.5 py-1 rounded-xl">
                          {studiedHrs.toFixed(1)}h / {totalHrs.toFixed(1)}h
                        </span>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }}
                          className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />
                          <span>✓ Mark Done</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast Notification for Emergency Cascading Shifts */}
      {shiftToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-slate-900 border-2 border-amber-500/80 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 max-w-md text-xs font-bold">
            <span className="text-base">⏸️</span>
            <span>{shiftToast}</span>
          </div>
        </div>
      )}

      {/* Mid-Slot Subject Morphing Modal */}
      {morphingSlotId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-teal-500/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-teal-500/30 pb-3">
              <h3 className="text-sm font-black uppercase text-teal-300 tracking-wider flex items-center gap-2">
                <span>🔄 Mid-Slot Split & Switch Focus</span>
              </h3>
              <button onClick={() => setMorphingSlotId(null)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
              You've logged studied time on this slot! Switching subjects now will cap your completed study duration as <strong>COMPLETED</strong> and morph the remaining time into a new subject & chapter slot.
            </p>

            {/* Select New Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-teal-200 uppercase tracking-wider">1. Select New Subject:</label>
              <select
                value={selectedMorphSubject}
                onChange={(e) => {
                  const nextSub = e.target.value;
                  setSelectedMorphSubject(nextSub);
                  const subObj = subjects.find(s => s.name === nextSub);
                  if (subObj && subObj.topics.length > 0) {
                    setMorphTopic(subObj.topics[0].title);
                  } else {
                    setMorphTopic('');
                  }
                }}
                className="w-full bg-slate-950 border border-teal-500/40 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-teal-400"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            {/* Select or Enter Topic / Chapter */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-teal-200 uppercase tracking-wider">2. Select or Enter Topic / Chapter:</label>
              {(() => {
                const matchedSub = subjects.find(s => s.name === selectedMorphSubject);
                const topicsList = matchedSub?.topics || [];
                return (
                  <div className="space-y-2">
                    {topicsList.length > 0 && (
                      <select
                        value={morphTopic}
                        onChange={(e) => setMorphTopic(e.target.value)}
                        className="w-full bg-slate-950 border border-teal-500/30 rounded-xl px-3 py-2 text-xs text-teal-100 font-semibold focus:outline-none focus:border-teal-400"
                      >
                        {topicsList.map(t => (
                          <option key={t.id} value={t.title}>
                            {t.title} ({t.category || 'Core'})
                          </option>
                        ))}
                        <option value="__CUSTOM__">✍️ Custom Topic / Chapter...</option>
                      </select>
                    )}

                    {(topicsList.length === 0 || morphTopic === '__CUSTOM__') && (
                      <input
                        type="text"
                        placeholder="e.g. Chapter 4: Special Audits & Standards"
                        value={morphTopic === '__CUSTOM__' ? '' : morphTopic}
                        onChange={(e) => setMorphTopic(e.target.value)}
                        className="w-full bg-slate-950 border border-teal-500/40 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-teal-400"
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setMorphingSlotId(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const finalTopic = morphTopic === '__CUSTOM__' ? `Switched Focus: ${selectedMorphSubject}` : (morphTopic || `Switched Focus: ${selectedMorphSubject}`);
                  splitSlotAndMorphSubject(selectedDateStr, morphingSlotId, selectedMorphSubject, finalTopic);
                  setMorphingSlotId(null);
                  setShiftToast(`✅ Slot split! Continued remaining time with ${selectedMorphSubject} - ${finalTopic}.`);
                  setTimeout(() => setShiftToast(null), 4000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-black text-xs hover:from-teal-500 hover:to-emerald-500 shadow-md cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5"
              >
                <span>Confirm Switch 🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Timetable Slot Details */}
      {editingSlotId && createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col justify-between bg-[#0B1528] text-slate-100 selection:bg-indigo-500/30 font-sans antialiased animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0B1528]/95">
              <h3 className="text-base font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <span>Edit Timetable Slot</span>
              </h3>
              <button
                onClick={() => setEditingSlotId(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300 min-h-[44px]"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
              {/* Smart Balance Alert inside modal */}
              {(() => {
                const hypoTotal = slots.reduce((sum, s) => {
                  if (s.id === editingSlotId) {
                    return editForm.category !== 'break' ? sum + editForm.duration : sum;
                  }
                  return s.category !== 'break' ? sum + parseSlotHours(s.time) : sum;
                }, 0);
                const currentDailyTarget = getDailyTarget(selectedDateStr);
                if (hypoTotal > currentDailyTarget) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs animate-pulse flex items-center gap-1.5 shadow-lg">
                      <span>⚡ Planned: {hypoTotal.toFixed(1)}h / {currentDailyTarget.toFixed(1)}h Target (+{(hypoTotal - currentDailyTarget).toFixed(1)}h over)</span>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="space-y-4 bg-slate-950/40 p-6 rounded-3xl border border-white/5 shadow-2xl">
                <div>
                  <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Subject</label>
                  <select
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                    className="w-full mt-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.code} - {s.name}</option>
                    ))}
                    <option value="General Study">General Study</option>
                    <option value="Break / Relaxation">Break / Relaxation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Activity / Slot Title</label>
                  <input
                    type="text"
                    value={editForm.activity}
                    onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                    className="w-full mt-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                    placeholder="e.g. Solve Ind AS 115 questions"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                      className="w-full mt-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                    >
                      <option value="study">Study</option>
                      <option value="revision">Revision</option>
                      <option value="mock">Mock Test</option>
                      <option value="break">Break</option>
                      <option value="na">N/A (Not Applicable)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Status</label>
                    <select
                      value={editForm.status || 'PENDING'}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value as SlotStatus })}
                      className="w-full mt-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                      <option value="FAILED">Failed</option>
                      <option value="NA">N/A (Not Applicable)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Start Time</label>
                  <input
                    type="text"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                    className="w-full mt-1.5 bg-slate-900 border border-indigo-500/30 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                    placeholder="e.g. 09:00 AM"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex justify-between">
                    <span>Duration</span>
                    <span className="text-amber-300 font-mono font-bold">
                      {Math.floor(editForm.duration)}h {Math.round((editForm.duration % 1) * 60)}m
                    </span>
                  </label>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        max="12"
                        value={Math.floor(editForm.duration)}
                        onChange={(e) => {
                          const hrs = parseInt(e.target.value) || 0;
                          const mins = Math.round((editForm.duration % 1) * 60);
                          setEditForm({ ...editForm, duration: hrs + mins / 60 });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-mono">hrs</span>
                    </div>
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={Math.round((editForm.duration % 1) * 60)}
                        onChange={(e) => {
                          const hrs = Math.floor(editForm.duration);
                          const mins = parseInt(e.target.value) || 0;
                          setEditForm({ ...editForm, duration: hrs + mins / 60 });
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                      />
                      <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-mono">min</span>
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-end gap-3 sticky bottom-0 z-20 bg-[#0B1528] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
              <button
                type="button"
                onClick={() => setEditingSlotId(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => saveEdit(editingSlotId, e)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-500/20 cursor-pointer min-h-[44px] flex items-center justify-center"
              >
                Save Changes
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Apply Schedule to Future Range */}
      {showApplyRangeModal && createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col justify-between bg-[#0B1528] text-slate-100 selection:bg-emerald-500/30 font-sans antialiased animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0B1528]/95">
              <h3 className="text-base font-bold text-emerald-300 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span>Apply Schedule to Future Date Range</span>
              </h3>
              <button
                onClick={() => setShowApplyRangeModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300 min-h-[44px]"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-4 rounded-2xl border border-emerald-500/20">
                Copy this current timetable schedule across multiple upcoming days so you don't have to rebuild your timetable daily!
              </p>

              {rangeSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 font-bold text-xs animate-fadeIn shadow-lg">
                  {rangeSuccessMsg}
                </div>
              )}

              <form id="apply-range-form" onSubmit={handleApplyRangeSubmit} className="space-y-6 bg-slate-950/40 p-6 rounded-3xl border border-white/5 shadow-2xl">
                <div>
                  <label className="text-xs font-bold text-emerald-300 uppercase">Start Date</label>
                  <input
                    type="date"
                    value={rangeStartDate}
                    onChange={(e) => setRangeStartDate(e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-emerald-500/40 rounded-xl p-3 text-xs text-white focus:outline-none min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-300 uppercase">Repeat Duration</label>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    {[7, 14, 30].map(days => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setRangeDaysCount(days)}
                        className={`py-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                          rangeDaysCount === days
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-emerald-500/30'
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            </main>

            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-end gap-3 sticky bottom-0 z-20 bg-[#0B1528] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
              <button
                type="button"
                onClick={() => setShowApplyRangeModal(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors min-h-[44px] flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="apply-range-form"
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg hover:from-emerald-400 cursor-pointer transition-all min-h-[44px] flex items-center justify-center"
              >
                Copy Schedule to Next {rangeDaysCount} Days
              </button>
            </footer>
          </div>
        </div>,
        document.body
      )}

      {/* AI Plan Generator Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col justify-between bg-[#0B1528] text-slate-100 selection:bg-indigo-500/30 font-sans antialiased animate-in fade-in duration-200 shadow-2xl">
          <div className="w-full h-full flex flex-col justify-between">
            
            {/* Layer 1: Sticky Glassmorphic Header */}
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0B1528]/95">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-amber-300 shadow-inner">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-indigo-100 tracking-wide">
                    ⚡ CA Final AI Timetable Strategy Generator
                  </h3>
                  <p className="text-xs text-indigo-300/75 font-medium hidden sm:block">
                    Configure your daily target & let Piyaa optimize your day with precision ICAI slotting
                  </p>
                </div>
              </div>

              {/* Center Dynamic Context Pill */}
              <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-indigo-500/30 text-amber-300 font-mono text-xs font-bold shadow-inner">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Target: {availableHours.toFixed(1)} Hours/Day</span>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
                title="Close Modal (Esc)"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            {/* Layer 2: Modal Body Grid Wrapper */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/20 p-4 sm:p-6 rounded-3xl border border-white/5">
              
              {/* Left Column: Settings Panel (col-span-5) */}
              <div className="lg:col-span-5 space-y-5 flex flex-col">
                
                {/* Section Title */}
                <div className="text-xs font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500/10 pb-2">
                  1. Study Strategy & Target
                </div>

                {/* Target Date Input */}
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
                  <label className="block text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                    Target Study Date:
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-indigo-400" />
                    <input
                      type="date"
                      value={selectedDateStr}
                      onChange={(e) => setSelectedDateStr(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Group attempt selector */}
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-1.5 shadow-inner">
                  <label className="block text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                    Select Group Attempt:
                  </label>
                  <select
                    value={groupOption}
                    onChange={(e) => setGroupOption(e.target.value)}
                    className="w-full text-slate-200 text-xs font-bold rounded-xl px-3 py-3 focus:border-indigo-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                  >
                    <option value="Both Groups (G1 + G2)">Both Groups (G1 + G2) - 6 Papers</option>
                    <option value="Group 1 Only">Group 1 Only (FR, AFM, Audit)</option>
                    <option value="Group 2 Only">Group 2 Only (DT, IDT, IBS)</option>
                  </select>
                </div>

                {/* Bi-directional Target Study Slider */}
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3.5 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-300" />
                      Target study hours:
                    </label>
                    <span className="text-xs font-black text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-500/40 shadow-sm animate-pulse">
                      {availableHours} Hours / Day
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={16}
                    step={1}
                    value={availableHours}
                    onChange={(e) => {
                      const nextHrs = Number(e.target.value);
                      setAvailableHours(nextHrs);
                      setDailyTarget(selectedDateStr, nextHrs);
                      if (onUpdateTargetHours) {
                        onUpdateTargetHours(nextHrs);
                      }
                    }}
                    className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>4h (Light)</span>
                    <span className="text-indigo-300 font-bold">8h (Optimal)</span>
                    <span>16h (Strict Daily Limit)</span>
                  </div>
                  
                  <div className="pt-2.5 border-t border-slate-900 flex items-center justify-between">
                    <span className="text-[10px] text-indigo-300/80 font-bold uppercase tracking-wider">Required Pace (Master Progress):</span>
                    <span className="text-[10px] font-black font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg shadow-sm">
                      ⚡ {getRequiredDailyHours(subjects).toFixed(1)} Hours / Day
                    </span>
                  </div>
                  {/* Sleep Boundary Guard */}
                  {(() => {
                    const startMatch = startTimePreference.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                    if (startMatch) {
                      let hours = parseInt(startMatch[1]);
                      const mins = parseInt(startMatch[2]);
                      const period = startMatch[3] ? startMatch[3].toUpperCase() : 'AM';
                      if (period === 'PM' && hours < 12) hours += 12;
                      if (period === 'AM' && hours === 12) hours = 0;

                      let totalMins = hours * 60 + mins;
                      totalMins += availableHours * 60;
                      
                      const slotHrs = parseFloat(slotTimePreference.replace(' Hours', '')) || 2;
                      const numSlots = Math.ceil(availableHours / slotHrs);
                      const shortBreakVal = parseInt(shortBreakDuration.replace(' mins', '')) || 15;
                      totalMins += (numSlots > 1 ? (numSlots - 1) * shortBreakVal : 0);

                      const lunchVal = lunchDuration === 'N/A' ? 0 : (parseInt(lunchDuration.replace(' mins', '')) || 0);
                      const dinnerVal = dinnerDuration === 'N/A' ? 0 : (parseInt(dinnerDuration.replace(' mins', '')) || 0);
                      totalMins += lunchVal + dinnerVal;

                      if (totalMins > 26 * 60) {
                        return (
                          <div className="mt-2 bg-amber-950/60 border border-amber-500/40 rounded-lg p-2.5 flex items-start gap-2">
                            <span className="text-[10px]">⚠️</span>
                            <span className="text-[10px] text-amber-200 font-semibold leading-relaxed">
                              Daily cap reached. Scheduled slots may cross 02:00 AM. Consider reducing target hours or starting earlier.
                            </span>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>

                {isMidDayUpdate && (
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-indigo-500/30 space-y-3 shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🤖</span>
                      <span className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                        Ask Custom AI Assistant
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Type your mid-day study/break adjustments (e.g., "I have a headache, convert my remaining study slots into light theory"). Piyaa will adapt only the uncompleted future slots!
                    </p>
                    <textarea
                      value={customAiInstruction}
                      onChange={(e) => setCustomAiInstruction(e.target.value)}
                      placeholder="Type your mid-day constraints or instruction here..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 min-h-[60px] resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleGeneratePlan}
                      disabled={isGenerating || !customAiInstruction.trim()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>⚡ Apply AI Advice to Remaining Slots</span>
                    </button>
                  </div>
                )}

                {/* AI Plan Timetable Config (Strict User Controls) */}
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-4 shadow-inner">
                  <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                    <span className="text-xs font-black uppercase text-indigo-400 tracking-widest">
                      2. AI Routine & Customization Engines
                    </span>
                  </div>

                  {/* Preset Manager Strip */}
                  <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        💾 Custom Timetable Presets ({customTimetablePresets.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSavePresetModal(true)}
                        className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                      >
                        <span>💾 Save Current Setting as Preset</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setStartTimePreference('06:00 AM');
                          setSchedulingMode('UNIFORM');
                          setSlotTimePreference('2.0 Hours');
                          setShortBreakDuration('15 mins');
                          setLunchStartTime('01:00 PM');
                          setLunchDuration('45 mins');
                          setDinnerStartTime('08:30 PM');
                          setDinnerDuration('45 mins');
                        }}
                        className="bg-slate-900/80 border border-slate-700/80 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                      >
                        <span>🌅 Early Bird (06:00 AM)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStartTimePreference('09:00 AM');
                          setSchedulingMode('UNIFORM');
                          setSlotTimePreference('2.5 Hours');
                          setShortBreakDuration('20 mins');
                          setLunchStartTime('01:30 PM');
                          setLunchDuration('60 mins');
                          setDinnerStartTime('09:00 PM');
                          setDinnerDuration('60 mins');
                        }}
                        className="bg-slate-900/80 border border-slate-700/80 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all shrink-0 flex items-center gap-1.5"
                      >
                        <span>🦉 Night Owl (09:00 AM)</span>
                      </button>

                      {customTimetablePresets.map((preset) => (
                        <div
                          key={preset.id}
                          onClick={() => handleLoadPreset(preset)}
                          className="bg-slate-900/80 border border-slate-700/80 hover:border-cyan-400 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all shrink-0 flex items-center gap-2 group"
                        >
                          <span className="font-bold text-cyan-300">📌 {preset.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTimetablePreset(preset.id);
                            }}
                            className="text-slate-500 hover:text-red-400 text-xs px-1 rounded transition-colors"
                            title="Delete Preset"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3-Way Scheduling Mode Switcher */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-extrabold text-indigo-300 uppercase tracking-wider block">
                      Scheduling Mode
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSchedulingMode('UNIFORM')}
                        className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                          schedulingMode === 'UNIFORM'
                            ? 'bg-cyan-950/60 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-black'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        ⚡ Uniform
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulingMode('VARIABLE')}
                        className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                          schedulingMode === 'VARIABLE'
                            ? 'bg-cyan-950/60 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-black'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        🌅 Variable
                      </button>

                      <button
                        type="button"
                        onClick={() => setSchedulingMode('MANUAL')}
                        className={`py-2 text-[10px] font-bold font-mono rounded-lg transition-all text-center ${
                          schedulingMode === 'MANUAL'
                            ? 'bg-cyan-950/60 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)] font-black'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        🛠️ Manual
                      </button>
                    </div>
                  </div>

                  {/* 1st Study Slot Start Time & Last Slot End Time */}
                  {schedulingMode !== 'MANUAL' && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-indigo-300 uppercase block">1st Slot Start Time</span>
                        <input
                          type="text"
                          value={startTimePreference}
                          onChange={(e) => setStartTimePreference(e.target.value)}
                          placeholder="e.g. 09:00 AM"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex gap-1">
                          {['AM', 'PM'].map(p => {
                            const isActive = startTimePreference.toUpperCase().includes(p);
                            return (
                              <button
                                key={`start-period-${p}`}
                                type="button"
                                onClick={() => {
                                  const base = startTimePreference.replace(/\s*(AM|PM)/i, '').trim() || '09:00';
                                  setStartTimePreference(`${base} ${p}`);
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
                        <span className="text-[10px] font-extrabold text-indigo-300 uppercase block">Last Slot End Time</span>
                        <input
                          type="text"
                          value={endTimePreference}
                          onChange={(e) => setEndTimePreference(e.target.value)}
                          placeholder="e.g. 11:00 PM"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <div className="flex gap-1">
                          {['AM', 'PM'].map(p => {
                            const isActive = endTimePreference.toUpperCase().includes(p);
                            return (
                              <button
                                key={`end-period-${p}`}
                                type="button"
                                onClick={() => {
                                  const base = endTimePreference.replace(/\s*(AM|PM)/i, '').trim() || '11:00';
                                  setEndTimePreference(`${base} ${p}`);
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

                  {/* UNIFORM SLOT SIZING */}
                  {schedulingMode === 'UNIFORM' && (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <span className="text-[10px] font-extrabold text-indigo-300 uppercase block">Uniform Study Slot Duration</span>
                      <input
                        type="text"
                        value={slotTimePreference}
                        onChange={(e) => setSlotTimePreference(e.target.value)}
                        placeholder="e.g. 2.0 Hours"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}

                  {/* VARIABLE DAY-PARTING SLOT SIZING */}
                  {schedulingMode === 'VARIABLE' && (
                    <div className="space-y-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800 animate-in fade-in duration-200">
                      <div className="text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                        🌅 Variable Day-Parting Block Durations
                      </div>

                      {/* Morning Block */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-300">🌅 Morning Block (06:00 AM - 01:00 PM)</span>
                        <input
                          type="text"
                          value={variableDurations.morning}
                          onChange={(e) => setVariableDurations(prev => ({ ...prev, morning: e.target.value }))}
                          placeholder="e.g. 2.0 Hours"
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Afternoon Block */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-300">☀️ Afternoon Block (02:00 PM - 07:00 PM)</span>
                        <input
                          type="text"
                          value={variableDurations.afternoon}
                          onChange={(e) => setVariableDurations(prev => ({ ...prev, afternoon: e.target.value }))}
                          placeholder="e.g. 2.0 Hours"
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Evening Block */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-300">🌙 Evening Block (08:00 PM - 12:00 AM)</span>
                        <input
                          type="text"
                          value={variableDurations.evening}
                          onChange={(e) => setVariableDurations(prev => ({ ...prev, evening: e.target.value }))}
                          placeholder="e.g. 1.5 Hours"
                          className="w-full bg-slate-900 border border-slate-750 rounded-xl px-3 py-1.5 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* 100% MANUAL FEEDING TABLE */}
                  {schedulingMode === 'MANUAL' && (
                    <div className="space-y-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 animate-in fade-in duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-2 gap-2">
                        <span className="text-[11px] font-bold text-amber-300">🛠️ Manual Timetable Slot Builder</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAddManualSlot('study')}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            ➕ Study Slot
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddManualSlot('break')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                          >
                            ➕ Break
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
                        {manualSlots.map((slot, index) => (
                          <div key={slot.id || index} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                              <span className="text-[10px] font-mono font-bold text-slate-500 w-4">#{index + 1}</span>
                              <input
                                type="text"
                                value={slot.time}
                                onChange={(e) => handleUpdateManualSlot(slot.id, { time: e.target.value })}
                                placeholder="06:00 AM - 08:30 AM"
                                className="w-36 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-mono"
                              />
                              <select
                                value={slot.category}
                                onChange={(e) => handleUpdateManualSlot(slot.id, { category: e.target.value as any })}
                                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-slate-200 font-bold"
                              >
                                <option value="study">Study</option>
                                <option value="break">Break</option>
                                <option value="revision">Revision</option>
                                <option value="mock">Mock Test</option>
                              </select>
                              <select
                                value={slot.subject}
                                onChange={(e) => handleUpdateManualSlot(slot.id, { subject: e.target.value })}
                                className="flex-1 min-w-[120px] bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-slate-100 font-bold"
                              >
                                {slot.category === 'break' ? (
                                  <option value="Break">Break / Refreshment</option>
                                ) : (
                                  subjects.map(s => (
                                    <option key={`man-${s.id}`} value={`${s.code}: ${s.name}`}>{s.code}: {s.name}</option>
                                  ))
                                )}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleDeleteManualSlot(slot.id)}
                                className="p-1 rounded bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                title="Remove Slot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={slot.activity}
                              onChange={(e) => handleUpdateManualSlot(slot.id, { activity: e.target.value })}
                              placeholder="Chapter / Topic / Activity details..."
                              className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-2 py-1 text-[11px] text-indigo-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Short Break Duration */}
                  {schedulingMode !== 'MANUAL' && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-extrabold text-indigo-300 uppercase">Short Break Duration</span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['10 mins', '15 mins', '20 mins', '30 mins'].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setShortBreakDuration(val)}
                            className={`py-1.5 text-[10px] font-mono rounded-lg transition-all ${
                              shortBreakDuration === val
                                ? 'bg-cyan-950/40 border border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                : 'bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {val.replace(' mins', 'm')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual Lunch & Dinner Inputs (Requirement 3) */}
                  {schedulingMode !== 'MANUAL' && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                      {/* Lunch Group */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-indigo-300 uppercase block">🥪 Lunch Allocation</span>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <span className="text-[9px] text-slate-400 font-mono block">Start Time</span>
                            <input
                              type="text"
                              value={lunchStartTime}
                              onChange={(e) => setLunchStartTime(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                              placeholder="e.g. 01:00 PM"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <span className="text-[9px] text-slate-400 font-mono block">Duration</span>
                            <input
                              type="text"
                              value={lunchDuration}
                              onChange={(e) => setLunchDuration(e.target.value)}
                              placeholder="e.g. 45 mins"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Dinner Group */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-extrabold text-indigo-300 uppercase block">🍛 Dinner Allocation</span>
                        <div className="flex gap-2">
                          <div className="flex-1 space-y-1">
                            <span className="text-[9px] text-slate-400 font-mono block">Start Time</span>
                            <input
                              type="text"
                              value={dinnerStartTime}
                              onChange={(e) => setDinnerStartTime(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                              placeholder="e.g. 08:30 PM"
                            />
                          </div>
                          <div className="flex-1 space-y-1">
                            <span className="text-[9px] text-slate-400 font-mono block">Duration</span>
                            <input
                              type="text"
                              value={dinnerDuration}
                              onChange={(e) => setDinnerDuration(e.target.value)}
                              placeholder="e.g. 45 mins"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Subject Selection Grid */}
                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner grow-0">
                  <label className="block text-xs font-extrabold text-indigo-300 uppercase tracking-wider">
                    Select Twin Study Subjects:
                  </label>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-300/80">Primary Subject:</span>
                      <select
                        value={primarySubject}
                        onChange={(e) => setPrimarySubject(e.target.value)}
                        className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                      >
                        {subjects.map((s) => (
                          <option key={`p-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-300/80">Secondary Subject:</span>
                      <select
                        value={secondarySubject}
                        onChange={(e) => setSecondarySubject(e.target.value)}
                        className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-indigo-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                      >
                        <option value="N/A">🚫 N/A (Solo Focus Mode - No Secondary Subject)</option>
                        {subjects.map((s) => (
                          <option key={`s-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subject Time Split Ratio Control (Primary vs Secondary) */}
                {secondarySubject !== 'N/A' ? (
                  <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
                    <label className="text-xs font-extrabold text-indigo-300 uppercase tracking-wider block">
                      Subject Time Split (Manual Feed):
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wide truncate block">
                          {pSubObj?.code || 'Primary'} (hrs)
                        </label>
                        <input 
                          type="number" 
                          min="0.5" 
                          max={availableHours} 
                          step="0.5" 
                          value={Number(allocatedPrimaryHours.toFixed(1))}
                          onChange={(e) => {
                            const newPrimary = Math.min(Math.max(0.5, Number(e.target.value)), availableHours);
                            setSplitRatio(Math.round((newPrimary / availableHours) * 100));
                          }}
                          className="w-full bg-slate-900 border border-indigo-500/30 rounded-lg p-2.5 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className="text-[10px] font-bold text-amber-300 uppercase tracking-wide truncate block">
                          {sSubObj?.code || 'Secondary'} (hrs)
                        </label>
                        <input 
                          type="number" 
                          min="0" 
                          max={availableHours - 0.5} 
                          step="0.5" 
                          value={Number(allocatedSecondaryHours.toFixed(1))}
                          onChange={(e) => {
                            const newSecondary = Math.min(Math.max(0, Number(e.target.value)), availableHours - 0.5);
                            const newPrimary = availableHours - newSecondary;
                            setSplitRatio(Math.round((newPrimary / availableHours) * 100));
                          }}
                          className="w-full bg-slate-900 border border-amber-500/30 rounded-lg p-2.5 text-xs text-white font-bold focus:border-amber-500 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-2xl text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <span>🎯 Solo Focus Mode: 100% allocated to Primary Subject ({availableHours.toFixed(1)} hrs)</span>
                  </div>
                )}



              </div>

              {/* Right Column: Dynamic Chapter Workspace (col-span-7) */}
              <div className="lg:col-span-7 space-y-4 flex flex-col min-h-[400px]">
                
                {/* Section Title */}
                <div className="text-xs font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500/10 pb-2 flex items-center justify-between">
                  <span>2. Interactive Chapters Selection</span>
                  <span className="text-[10px] text-slate-400 font-mono normal-case">Select focus chapters for AI customization</span>
                </div>

                {/* Tab Toggles for Primary vs Secondary Subject */}
                <div className="flex border-b border-slate-800 shrink-0">
                  <button
                    onClick={() => setActiveModalChapterTab('primary')}
                    className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
                      activeModalChapterTab === 'primary'
                        ? 'border-indigo-500 text-indigo-300 font-black bg-indigo-950/20'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>📘 Primary Chapters</span>
                    {pSubObj && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-900/60 text-indigo-200 border border-indigo-500/30">
                        {selectedPrimaryChapterIds.length}
                      </span>
                    )}
                  </button>
                  {secondarySubject !== 'N/A' && (
                    <button
                      onClick={() => setActiveModalChapterTab('secondary')}
                      className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
                        activeModalChapterTab === 'secondary'
                          ? 'border-amber-500 text-amber-300 font-black bg-amber-950/10'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>📙 Secondary Chapters</span>
                      {sSubObj && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30">
                          {selectedSecondaryChapterIds.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {/* Active Tab Panel */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-950/40 rounded-2xl border border-slate-800 p-4 space-y-3.5 shadow-inner">
                  
                  {activeModalChapterTab === 'primary' ? (
                    <>
                      {/* Real-Time Safety Budget Safeguard Panel */}
                      <div className="shrink-0">
                        {totalEstimatedPrimaryHours > allocatedPrimaryHours ? (
                          <div className="bg-amber-950/50 border border-amber-500/40 text-amber-300 rounded-xl p-3 text-xs flex flex-col gap-1 shadow-sm">
                            <div className="flex items-center gap-1.5 font-extrabold text-[11px] uppercase tracking-wide">
                              <span>⚠️ Budget Warning (Over-allocation)</span>
                            </div>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed font-semibold">
                              Selected chapters require ~{totalEstimatedPrimaryHours.toFixed(1)}h, exceeding your allocated {allocatedPrimaryHours.toFixed(1)}h budget. 
                              The AI will automatically prioritize key topics and summarize the rest.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-emerald-950/55 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-xs flex flex-col gap-1 shadow-sm">
                            <div className="flex items-center gap-1.5 font-extrabold text-[11px] uppercase tracking-wide">
                              <span>✅ Optimal Budget Coverage</span>
                            </div>
                            <p className="text-[11px] text-emerald-400/80 leading-relaxed font-semibold">
                              Selected chapters require ~{totalEstimatedPrimaryHours.toFixed(1)}h, which perfectly fits within your {allocatedPrimaryHours.toFixed(1)}h budget.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Search & Quick Controls: Primary */}
                      <div className="space-y-2 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search chapters in Primary Subject..."
                            value={primarySearch}
                            onChange={(e) => setPrimarySearch(e.target.value)}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                          {/* Filter Pills */}
                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="text-slate-400 mr-1">Filter:</span>
                            {(['all', 'pending', 'catA'] as const).map(f => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setPrimaryFilter(f)}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                  primaryFilter === f
                                    ? 'bg-indigo-600 text-white font-black'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Category A'}
                              </button>
                            ))}
                          </div>

                          {/* Selection Helpers */}
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => pSubObj && setSelectedPrimaryChapterIds(pSubObj.topics.map(t => t.id))}
                              className="text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-700">•</span>
                            <button
                              type="button"
                              onClick={() => pSubObj && setSelectedPrimaryChapterIds(pSubObj.topics.filter(t => !t.completed).map(t => t.id))}
                              className="text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                            >
                              Select Pending
                            </button>
                            <span className="text-slate-700">•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedPrimaryChapterIds([])}
                              className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chapters Scrolling Area (Primary) */}
                      <div className="flex-1 overflow-y-auto max-h-64 sm:max-h-80 pr-1 space-y-1.5 scrollbar-thin">
                        {primaryTopicsToDisplay.length === 0 ? (
                          <div className="text-center py-10 text-xs text-slate-500">
                            No chapters found matching search filters. 🔍
                          </div>
                        ) : (
                          primaryTopicsToDisplay.map((topic) => {
                            const isSelected = selectedPrimaryChapterIds.includes(topic.id);
                            return (
                              <div
                                key={topic.id}
                                onClick={() => togglePrimaryTopic(topic.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-950/40 border-indigo-500/50 text-indigo-100 font-semibold shadow-md shadow-indigo-500/5'
                                    : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/50'
                                } hover:scale-[1.01]`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden pr-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                    isSelected ? 'bg-indigo-500 border-indigo-400 text-slate-950 font-bold' : 'border-slate-600'
                                  }`}>
                                    {isSelected && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="truncate text-slate-200 text-[11px] sm:text-xs">{topic.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {topic.category && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 font-black border border-indigo-500/20">
                                      {topic.category}
                                    </span>
                                  )}
                                  {topic.completed ? (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/20 shrink-0">
                                      Done ✅
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 font-bold border border-amber-500/20 shrink-0">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Real-Time Safety Budget Safeguard Panel */}
                      <div className="shrink-0">
                        {totalEstimatedSecondaryHours > allocatedSecondaryHours ? (
                          <div className="bg-amber-950/50 border border-amber-500/40 text-amber-300 rounded-xl p-3 text-xs flex flex-col gap-1 shadow-sm">
                            <div className="flex items-center gap-1.5 font-extrabold text-[11px] uppercase tracking-wide">
                              <span>⚠️ Budget Warning (Over-allocation)</span>
                            </div>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed font-semibold">
                              Selected chapters require ~{totalEstimatedSecondaryHours.toFixed(1)}h, exceeding your allocated {allocatedSecondaryHours.toFixed(1)}h budget.
                              The AI will automatically prioritize key topics and summarize the rest.
                            </p>
                          </div>
                        ) : (
                          <div className="bg-emerald-950/55 border border-emerald-500/30 text-emerald-400 rounded-xl p-3 text-xs flex flex-col gap-1 shadow-sm">
                            <div className="flex items-center gap-1.5 font-extrabold text-[11px] uppercase tracking-wide">
                              <span>✅ Optimal Budget Coverage</span>
                            </div>
                            <p className="text-[11px] text-emerald-400/80 leading-relaxed font-semibold">
                              Selected chapters require ~{totalEstimatedSecondaryHours.toFixed(1)}h, which perfectly fits within your {allocatedSecondaryHours.toFixed(1)}h budget.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Search & Quick Controls: Secondary */}
                      <div className="space-y-2 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search chapters in Secondary Subject..."
                            value={secondarySearch}
                            onChange={(e) => setSecondarySearch(e.target.value)}
                            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
                          {/* Filter Pills */}
                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className="text-slate-400 mr-1">Filter:</span>
                            {(['all', 'pending', 'catA'] as const).map(f => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setSecondaryFilter(f)}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                  secondaryFilter === f
                                    ? 'bg-amber-600 text-slate-950 font-black'
                                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                {f === 'all' ? 'All' : f === 'pending' ? 'Pending' : 'Category A'}
                              </button>
                            ))}
                          </div>

                          {/* Selection Helpers */}
                          <div className="flex items-center gap-2 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => sSubObj && setSelectedSecondaryChapterIds(sSubObj.topics.map(t => t.id))}
                              className="text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                            >
                              Select All
                            </button>
                            <span className="text-slate-700">•</span>
                            <button
                              type="button"
                              onClick={() => sSubObj && setSelectedSecondaryChapterIds(sSubObj.topics.filter(t => !t.completed).map(t => t.id))}
                              className="text-amber-300 hover:text-amber-200 hover:underline cursor-pointer"
                            >
                              Select Pending
                            </button>
                            <span className="text-slate-700">•</span>
                            <button
                              type="button"
                              onClick={() => setSelectedSecondaryChapterIds([])}
                              className="text-slate-400 hover:text-slate-300 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Chapters Scrolling Area (Secondary) */}
                      <div className="flex-1 overflow-y-auto max-h-64 sm:max-h-80 pr-1 space-y-1.5 scrollbar-thin">
                        {secondaryTopicsToDisplay.length === 0 ? (
                          <div className="text-center py-10 text-xs text-slate-500">
                            No chapters found matching search filters. 🔍
                          </div>
                        ) : (
                          secondaryTopicsToDisplay.map((topic) => {
                            const isSelected = selectedSecondaryChapterIds.includes(topic.id);
                            return (
                              <div
                                key={topic.id}
                                onClick={() => toggleSecondaryTopic(topic.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-amber-950/20 border-amber-500/50 text-amber-100 font-semibold shadow-md shadow-amber-500/5'
                                    : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-900/50'
                                } hover:scale-[1.01]`}
                              >
                                <div className="flex items-center gap-3 overflow-hidden pr-2">
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                    isSelected ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold' : 'border-slate-600'
                                  }`}>
                                    {isSelected && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="truncate text-slate-200 text-[11px] sm:text-xs">{topic.title}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {topic.category && (
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 font-black border border-amber-500/20">
                                      {topic.category}
                                    </span>
                                  )}
                                  {topic.completed ? (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-500/20 shrink-0">
                                      Done ✅
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 font-bold border border-amber-500/20 shrink-0">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                </div>

              </div>
              </div>
            </main>

            {/* Live Slot-Count & Sleep Reality Preview Badge */}
            <div className="px-6 sm:px-8 pt-2 pb-0 flex flex-col gap-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  id="toggle-projection-btn"
                  onClick={() => setShowProjection(!showProjection)}
                  className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider rounded-xl transition-all border flex items-center gap-2 cursor-pointer shadow-md ${
                    showProjection
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  {showProjection ? '📊 Hide Real-Time Projection' : '📊 Show Real-Time Projection'}
                </button>
              </div>

              {showProjection && (
                <div className="bg-[#0A121E]/90 border border-cyan-500/40 p-4 rounded-xl flex flex-col gap-2 shadow-[0_0_20px_rgba(6,182,212,0.15)] animate-in fade-in duration-300">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        📊 Real-Time Schedule Projection
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                        Mode: {schedulingMode}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-300">
                      <span>Slots: <strong className="text-amber-300">{previewMath.totalSlotsNeeded}</strong> ({previewMath.totalBreaksNeeded} breaks)</span>
                      <span>•</span>
                      <span>Span: <strong className="text-indigo-300">{previewMath.spanHours}h {previewMath.spanMins}m</strong></span>
                      <span>•</span>
                      <span>Ends At: <strong className="text-emerald-300">{previewMath.projectedEndTimeStr}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-semibold">Remaining Sleep & Free Window:</span>
                      <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${
                        previewMath.isHighBurnoutRisk
                          ? 'bg-red-950/80 border-red-500/80 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse'
                          : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      }`}>
                        🌙 {previewMath.remainingSleepAndFreeHours} Hours
                      </span>
                    </div>

                    {previewMath.isHighBurnoutRisk && (
                      <div className="text-[11px] text-red-300 font-bold bg-red-950/50 border border-red-500/40 px-3 py-1 rounded-lg flex items-center gap-1.5">
                        ⚠️ Crimson Alert: High Burnout Risk! Sleep window is below 6.0 hours.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Layer 3: Sticky Action Footer */}
            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-4 sticky bottom-0 z-20 bg-[#0B1528] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
              {/* Custom instructions text box */}
              <div className="w-full sm:flex-1 relative">
                <textarea
                  placeholder="✍️ Any specific instructions or goals for the AI? (e.g. Focus deeply on tricky MCQs, take shorter breaks, assign 1 hour to revision only, etc.)"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950/80 border border-slate-700 hover:border-slate-600 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors shadow-inner resize-none min-h-[50px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700 min-h-[44px] flex items-center justify-center"
                >
                  Cancel
                </button>

                {/* Action Button */}
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isGenerating}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-95 text-white font-extrabold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 transition-all shrink-0 active:scale-[0.98] min-h-[44px]"
                >
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>{isGenerating ? 'Generating Strategy...' : `Generate AI Schedule`}</span>
                </button>
              </div>
            </footer>

          </div>
        </div>,
        document.body
      )}

      {/* Save Custom Timetable Preset Modal */}
      {showSavePresetModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B1528] border border-cyan-500/50 p-6 rounded-2xl w-full max-w-md shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider">
                📌 Save Timetable Preset
              </h3>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">Preset Name:</label>
              <input
                type="text"
                placeholder="e.g., Heavy Morning 10h Sprint, Audit Revision Day"
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetNameInput.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-lg cursor-pointer min-h-[44px]"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Beautiful Custom Slide-over Manual Override Drawer */}
      {showManualDrawer && createPortal(
        <div className="fixed inset-0 z-[9999] flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setShowManualDrawer(false)} />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-[#0B1528] border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300 z-10 text-slate-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400 animate-spin-slow" />
                <h3 className="text-base font-extrabold uppercase tracking-widest text-cyan-300 font-mono">
                  Manual Timetable Override
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualDrawer(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-400 text-slate-400 hover:text-red-300 transition-all font-mono text-xs cursor-pointer flex items-center justify-center gap-1"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form: Add Slot */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4 shadow-inner">
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Add New Custom Study Slot</span>
                </h4>
                
                <form onSubmit={handleAddCustomSlot} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Start Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 09:00 AM"
                        value={newSlotForm.startTime}
                        onChange={(e) => setNewSlotForm({ ...newSlotForm, startTime: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Duration
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min="0"
                            max="16"
                            value={Math.floor(newSlotForm.duration)}
                            onChange={(e) => {
                              const hrs = parseInt(e.target.value) || 0;
                              const mins = Math.round((newSlotForm.duration % 1) * 60);
                              setNewSlotForm({ ...newSlotForm, duration: hrs + mins / 60 });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                            required
                          />
                          <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-mono">hrs</span>
                        </div>
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={Math.round((newSlotForm.duration % 1) * 60)}
                            onChange={(e) => {
                              const hrs = Math.floor(newSlotForm.duration);
                              const mins = parseInt(e.target.value) || 0;
                              setNewSlotForm({ ...newSlotForm, duration: hrs + mins / 60 });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 font-mono text-xs"
                            required
                          />
                          <span className="absolute right-3 top-2 text-[10px] text-slate-500 font-mono">min</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Subject / Activity Name
                    </label>
                    <select
                      value={newSlotForm.subject}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, subject: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                    >
                      <option value="Break">Break / Leisure 🍳</option>
                      <option value="General Revision">General Revision 📚</option>
                      <option value="Mock Exam Practice">Mock Exam Practice 📝</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>
                          {s.code}: {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                      Activity / Topic Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Chapter 3 Revision, Mock practice"
                      value={newSlotForm.activity}
                      onChange={(e) => setNewSlotForm({ ...newSlotForm, activity: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={newSlotForm.category}
                        onChange={(e) => setNewSlotForm({ ...newSlotForm, category: e.target.value as any })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                      >
                        <option value="study">Study</option>
                        <option value="revision">Revision</option>
                        <option value="mock">Mock Exam</option>
                        <option value="break">Break</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                        Status
                      </label>
                      <select
                        value={newSlotForm.status}
                        onChange={(e) => setNewSlotForm({ ...newSlotForm, status: e.target.value as SlotStatus })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="FAILED">Failed</option>
                        <option value="PARTIALLY_COMPLETED">Partially Completed</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4 text-slate-950" />
                    <span>Add Custom Slot to Today's Plan</span>
                  </button>
                </form>
              </div>

              {/* Existing Slots List */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Current Slots for {selectedDateStr} ({slots.length} total)</span>
                </h4>

                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {slots.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-8 bg-slate-950/40 rounded-xl border border-slate-900 shadow-inner">
                      No slots generated for this date yet. Use the form above to add custom ones!
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-4 rounded-xl bg-[#09111C]/80 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-cyan-300 font-bold bg-cyan-950/40 border border-cyan-800/40 px-1.5 py-0.5 rounded text-[10px]">
                              {slot.time}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              slot.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40' :
                              slot.status === 'IN_PROGRESS' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/40' :
                              'bg-slate-850 text-slate-400 border border-slate-700/40'
                            }`}>
                              {slot.status || 'PENDING'}
                            </span>
                          </div>
                          <div className="font-extrabold text-slate-200">
                            {slot.subject}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {slot.activity}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(slot)}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
                            title="Edit details"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-red-500 text-slate-300 hover:text-red-400 transition-all cursor-pointer"
                            title="Delete slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Weekly Timetable Planner Integration (Requirement 5) */}
      <WeeklyPlannerModal
        isOpen={isWeeklyModalOpen}
        onClose={() => setIsWeeklyModalOpen(false)}
        subjects={subjects}
        isStrictMode={isStrictMode}
      />
    </div>
  );
};
