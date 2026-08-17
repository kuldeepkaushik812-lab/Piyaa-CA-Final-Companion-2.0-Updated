import { getISTDate, createRealDateFromIST, formatDisplayDate, getISTYMD, addDaysToYMD, getISTTimeString } from "../lib/dateUtils";
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {  
  Calendar, Clock, CheckCircle2, Circle, Sparkles, RefreshCw, 
  Award, BookOpen, FileSpreadsheet, ChevronLeft, ChevronRight, 
  CalendarDays, Copy, Play, CheckSquare, Plus, Trash2, Edit3, Save, Layers,
  Search, Lock, Unlock, Ban, Settings, RotateCcw, Zap, GripVertical, ArrowUpDown } from 'lucide-react';
import { TimetableSlot, GeneratedTimetable, SlotStatus, TimetablePreset } from '../types';
import { WeeklyPlannerModal } from './WeeklyPlannerModal';
import { ExcelTimetableImportModal } from './ExcelTimetableImportModal';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr, enforceNonOverlappingSlots, sanitizeAndMergeConsecutiveBreaks } from '../utils/timeUtils';
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
    setCurrentSubject,
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

  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [importSuccessToast, setImportSuccessToast] = useState<string | null>(null);
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
    const updateTimeState = () => {
      const newNow = getISTDate();
      setNow(newNow);
      const newTodayStr = getISTYMD(newNow);
      if (todayStr !== newTodayStr && selectedDateStr === todayStr) {
        setSelectedDateStr(newTodayStr);
      }
    };

    updateTimeState();
    const timer = setInterval(updateTimeState, 5000); // 5s rapid real-time clock synchronization
    
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateTimeState();
      }
    };

    window.addEventListener('focus', updateTimeState);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateTimeState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [todayStr, selectedDateStr]);



  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTagEditId, setActiveTagEditId] = useState<string | null>(null);
  const [activeTagValue, setActiveTagValue] = useState<string>('');

  const handleSaveQuickTag = (slotId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = slots.map(s => s.id === slotId ? { ...s, quickTag: activeTagValue.trim() } : s);
    setScheduleForDate(selectedDateStr, updated);
    if (selectedDateStr === todayStr) onUpdateSchedule(updated);
    setActiveTagEditId(null);
  };
  
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  const handleDropSlot = (targetSlotId: string) => {
    if (isPastDate || !draggedSlotId || draggedSlotId === targetSlotId) {
      setDraggedSlotId(null);
      setDragOverSlotId(null);
      return;
    }

    const sourceIdx = slots.findIndex(s => s.id === draggedSlotId);
    const targetIdx = slots.findIndex(s => s.id === targetSlotId);
    if (sourceIdx === -1 || targetIdx === -1) {
      setDraggedSlotId(null);
      setDragOverSlotId(null);
      return;
    }

    const reordered = [...slots];
    const [movedSlot] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, movedSlot);

    const alignedSlots = enforceNonOverlappingSlots(reordered);
    saveSlots(alignedSlots);
    setShiftToast('✨ Schedule reordered & non-overlapping times synchronized!');
    setTimeout(() => setShiftToast(null), 3000);
    setDraggedSlotId(null);
    setDragOverSlotId(null);
  };

  const handleResortChronologically = () => {
    if (isPastDate || slots.length <= 1) return;

    const sorted = [...slots].sort((a, b) => {
      const aStartStr = a.time.split('-')[0]?.trim() || '06:00 AM';
      const bStartStr = b.time.split('-')[0]?.trim() || '06:00 AM';
      let aMins = parseTimeToMinutes(aStartStr);
      let bMins = parseTimeToMinutes(bStartStr);
      if (hasEveningSlots && aMins <= 5 * 60) aMins += 1440;
      if (hasEveningSlots && bMins <= 5 * 60) bMins += 1440;
      return aMins - bMins;
    });

    const aligned = enforceNonOverlappingSlots(sorted);
    saveSlots(aligned);
    setShiftToast('🗓️ Schedule re-sorted & aligned without overlaps!');
    setTimeout(() => setShiftToast(null), 3000);
  };

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
  const [primaryChaptersInput, setPrimaryChaptersInput] = useState<string>('');
  const [secondaryChaptersInput, setSecondaryChaptersInput] = useState<string>('');
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
  const [revisionMode, setRevisionMode] = useState<'R1' | 'R2' | 'R3'>('R1');

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

  const pSubObjFilteredTopics = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
       if (revisionMode === 'R1') return !t.rev1;
       if (revisionMode === 'R2') return !t.rev2;
       if (revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [pSubObj, revisionMode]);

  const sSubObjFilteredTopics = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
       if (revisionMode === 'R1') return !t.rev1;
       if (revisionMode === 'R2') return !t.rev2;
       if (revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [sSubObj, revisionMode]);

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
    const alignedSlots = enforceNonOverlappingSlots(newSlots);

    pushScheduleHistory(selectedDateStr);
    setScheduleForDate(selectedDateStr, alignedSlots);
    if (selectedDateStr === todayStr) {
      onUpdateSchedule(alignedSlots);
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
${primarySubject} Selected Chapters: (pSelChapters.length > 0 ? pSelChapters.join('; ') : 'All chapters').
${isSolo ? 'SECONDARY SUBJECT: None (Solo Focus Mode)' : `${secondarySubject} Selected Chapters: (sSelChapters.length > 0 ? sSelChapters.join('; ') : 'All chapters')`}.
Short Break Duration Preference: ${shortBreakDuration}
${lunchDuration === 'N/A' ? 'Lunch Break: DO NOT schedule any lunch break today (Omitted / Skip Break).' : `Lunch Break: Start EXACTLY at ${lunchStartTime} for ${lunchDuration}.`}
${dinnerDuration === 'N/A' ? 'Dinner Break: DO NOT schedule any dinner break today (Omitted / Skip Break).' : `Dinner Break: Start EXACTLY at ${dinnerStartTime} for ${dinnerDuration}.`}\n${customInstructions ? `Additional User Instructions: ${customInstructions}` : ''}
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

              <button
                type="button"
                onClick={handleResortChronologically}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-cyan-500/20 hover:border-cyan-500/60 border border-slate-700/60 text-cyan-300 font-mono text-sm transition-all cursor-pointer flex items-center gap-1.5 font-bold active:scale-95 shadow-sm"
                title="Automatically re-sort all slots for this day chronologically from morning to night"
              >
                <ArrowUpDown className="w-4 h-4 text-cyan-400" />
                <span>Re-sort Schedule</span>
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
            onClick={() => setIsExcelImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-700/90 hover:from-emerald-500 hover:to-teal-600 border border-emerald-500/50 text-white font-mono text-sm transition-all cursor-pointer flex items-center gap-2 font-bold shadow-lg shadow-emerald-600/15 active:scale-95"
            title="Import custom Excel (.xlsx / .csv) timetable for Day, Week, or Month"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>📥 Import Excel</span>
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
      <div className={`overflow-x-auto bg-[#0A121E]/60 rounded-xl border border-slate-700/80 shadow-lg ${isPastDate ? "pointer-events-none opacity-80 grayscale-[20%]" : ""}`}>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">
              {!isPastDate && <th className="px-2.5 py-3 font-semibold w-8 text-center" title="Drag & drop to reschedule">⠿</th>}
              <th className="px-4 py-3 font-semibold w-1/4">Time</th>
              <th className="px-4 py-3 font-semibold w-1/4">Subject</th>
              <th className="px-4 py-3 font-semibold w-1/3">Chapter</th>
              <th className="px-4 py-3 font-semibold w-auto">Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredSlots.map((slot) => {
              const isBreak = slot.category === "break" || slot.subject.toLowerCase() === "break" || slot.activity.toLowerCase().includes("break");
              const isCompleted = slot.status === "COMPLETED" || slot.completed;
              
              const isPast = isSlotPassed(selectedDateStr, slot.time);
              let isLive = false;
              
              if (selectedDateStr === effectiveNowDate) {
                const parts = slot.time.split('-').map(s => s.trim());
                if (parts.length === 2) {
                   let startMins = parseTimeToMinutes(parts[0]);
                   let endMins = parseTimeToMinutes(parts[1]);
                   if (endMins < startMins) endMins += 1440;
                   
                   let adjStart = startMins;
                   if (hasEveningSlots && adjStart <= 5 * 60) adjStart += 1440;
                   let adjEnd = endMins;
                   if (hasEveningSlots && adjEnd <= 5 * 60) adjEnd += 1440;
                   
                   if (effectiveCurrentMinutes >= adjStart && effectiveCurrentMinutes < adjEnd) {
                     isLive = true;
                   }
                }
              }

              const isMissed = isPast && !isCompleted && slot.status !== 'IN_PROGRESS' && (slot.studiedDurationHours || 0) === 0;

              let rowStyle = "hover:bg-slate-800/30 transition-all cursor-pointer ";
              
              const studiedHrs = slot.studiedDurationHours || 0;
              const totalHrs = parseSlotHours(slot.time) || 2;
              const progressPercent = Math.min(100, (studiedHrs / totalHrs) * 100);
              const isPomodoroActive = progressPercent > 0 && progressPercent < 100;
              
              if (isBreak) {
                rowStyle += "bg-amber-950/10 text-amber-200/80 border-l-[3px] border-amber-500/30 ";
              } else if (isCompleted || progressPercent >= 100) {
                rowStyle += "opacity-60 text-slate-400 border-l-[3px] border-emerald-500/50 bg-emerald-950/5 ";
              } else if (isPomodoroActive) {
                rowStyle += "border-l-[3px] border-cyan-400 bg-cyan-950/20 text-white shadow-[inset_4px_0_15px_rgba(34,211,238,0.15)] ";
              } else if (isLive) {
                rowStyle += "border-l-[3px] border-amber-400 bg-amber-950/20 text-white shadow-[inset_4px_0_15px_rgba(251,191,36,0.15)] ";
              } else if (slot.status === 'FAILED' || isMissed) {
                rowStyle += "border-l-[3px] border-rose-500/50 bg-rose-950/10 text-rose-300/80 ";
              } else {
                rowStyle += "border-l-[3px] border-slate-700 bg-transparent text-slate-100 ";
              }

              const isDragging = draggedSlotId === slot.id;
              const isDragTarget = dragOverSlotId === slot.id && draggedSlotId !== slot.id;

              if (isDragging) {
                rowStyle += "opacity-30 scale-[0.99] bg-slate-900 border-dashed border-2 border-cyan-500 ";
              } else if (isDragTarget) {
                rowStyle += "border-t-2 border-cyan-400 bg-cyan-950/50 shadow-md ";
              }

              if (isBreak) {
                return (
                  <tr 
                    key={slot.id} 
                    className={rowStyle}
                    draggable={!isPastDate}
                    onDragStart={(e) => {
                      if (isPastDate) return;
                      setDraggedSlotId(slot.id);
                      e.dataTransfer.setData('text/plain', slot.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (isPastDate) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverSlotId !== slot.id) setDragOverSlotId(slot.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverSlotId === slot.id) setDragOverSlotId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropSlot(slot.id);
                    }}
                    onDragEnd={() => {
                      setDraggedSlotId(null);
                      setDragOverSlotId(null);
                    }}
                  >
                    {!isPastDate && (
                      <td 
                        className="px-2.5 py-3 text-center text-slate-500 hover:text-cyan-300 cursor-grab active:cursor-grabbing select-none"
                        title="Drag to reorder slot"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="w-4 h-4 inline-block opacity-60 hover:opacity-100" />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{slot.time}</td>
                    <td className="px-4 py-3 font-medium" colSpan={2}>
                      <div className="flex items-center gap-2">
                        <span>☕ {slot.activity || slot.subject || "Rest Break"}</span>
                        {isLive && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.4)] flex items-center gap-1 shrink-0 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                            LIVE BREAK
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer ${slot.completed ? "bg-slate-800 text-slate-400" : "bg-amber-950/40 border border-amber-500/30 text-amber-300 hover:bg-amber-900/40"}`}>
                          {slot.completed ? "Undo" : "Done"}
                        </button>
                        {isLive && (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                            ● RUNNING
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr 
                  key={slot.id} 
                  className={rowStyle} 
                  onClick={() => handleStartEdit(slot)}
                  draggable={!isPastDate}
                  onDragStart={(e) => {
                    if (isPastDate) return;
                    setDraggedSlotId(slot.id);
                    e.dataTransfer.setData('text/plain', slot.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (isPastDate) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverSlotId !== slot.id) setDragOverSlotId(slot.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverSlotId === slot.id) setDragOverSlotId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropSlot(slot.id);
                  }}
                  onDragEnd={() => {
                    setDraggedSlotId(null);
                    setDragOverSlotId(null);
                  }}
                >
                  {!isPastDate && (
                    <td 
                      className="px-2.5 py-3 text-center text-slate-500 hover:text-cyan-300 cursor-grab active:cursor-grabbing select-none"
                      title="Drag to reorder slot"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="w-4 h-4 inline-block opacity-60 hover:opacity-100" />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                    {slot.time}
                  </td>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    {isCompleted && (
                       <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-in zoom-in spin-in-12 duration-500 shadow-sm shrink-0" />
                    )}
                    {isLive && !isCompleted && (
                       <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(251,191,36,0.5)] flex items-center gap-1 shrink-0 animate-pulse">
                         <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                         LIVE
                       </span>
                    )}
                    <span className={`${isCompleted ? 'line-through decoration-emerald-500/30 text-emerald-100/70' : ''}`}>
                       {slot.subject}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="truncate max-w-[200px]" title={slot.activity}>{slot.activity}</div>
                      
                      {/* Quick Tag Inline Editor */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {activeTagEditId === slot.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={activeTagValue}
                              onChange={e => setActiveTagValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveQuickTag(slot.id);
                                if (e.key === 'Escape') setActiveTagEditId(null);
                              }}
                              onBlur={() => handleSaveQuickTag(slot.id)}
                              placeholder="e.g. Concept Review"
                              className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none w-32"
                            />
                          </div>
                        ) : slot.quickTag ? (
                          <div 
                            className="inline-flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-900/60 transition-colors w-fit"
                            onClick={() => {
                              setActiveTagValue(slot.quickTag || '');
                              setActiveTagEditId(slot.id);
                            }}
                          >
                            <span className="text-[9px] font-bold tracking-wide uppercase">{slot.quickTag}</span>
                            <Edit3 className="w-2.5 h-2.5 opacity-50" />
                          </div>
                        ) : (
                          <button 
                            className="text-[9px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-wide flex items-center gap-1"
                            onClick={() => {
                              setActiveTagValue('');
                              setActiveTagEditId(slot.id);
                            }}
                          >
                            <Plus className="w-3 h-3" /> Add Tag
                          </button>
                        )}
                      </div>

                      {(slot.studiedDurationHours !== undefined && slot.studiedDurationHours > 0) && (
                        <div className="flex items-center gap-2 mt-0.5">
                           <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-700/50">
                              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000 ease-out relative" style={{ width: `${Math.min(100, ((slot.studiedDurationHours || 0) / (parseSlotHours(slot.time) || 2)) * 100)}%` }}>
                                {isCompleted && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                              </div>
                           </div>
                           <span className="text-[9px] font-mono font-bold text-amber-400">{slot.studiedDurationHours.toFixed(2)}h / {parseSlotHours(slot.time)}h</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }}
                        className={`px-3 py-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-wider transition-all cursor-pointer ${isCompleted ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"}`}
                      >
                        {isCompleted ? "Undo" : "Done"}
                      </button>
                      {!isPastDate && (
                        isLive ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimerTargetSlotId(slot.id);
                              setCurrentSubject(subjects.find(s => s.name.toLowerCase().includes(slot.subject.toLowerCase()) || s.code.toLowerCase().includes(slot.subject.toLowerCase()))?.id || "general");
                              setActiveTab("timer");
                            }}
                            className="px-3.5 py-1.5 rounded-lg border border-amber-400 text-[10px] uppercase font-black tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.6)] flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-pulse"
                            title="Jump directly to Live Pomodoro Timer for this running slot"
                          >
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0" />
                            <span>🔴 LIVE</span>
                          </button>
                        ) : !isCompleted ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTimerTargetSlotId(slot.id);
                              setCurrentSubject(subjects.find(s => s.name.toLowerCase().includes(slot.subject.toLowerCase()) || s.code.toLowerCase().includes(slot.subject.toLowerCase()))?.id || "general");
                              setActiveTab("timer");
                            }}
                            className="px-3 py-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-wider text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border-cyan-500/30 hover:bg-cyan-900/60 cursor-pointer transition-all active:scale-95"
                          >
                            Start
                          </button>
                        ) : null
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

            {/* Layer 2: Simplified Modal Body */}
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">
              <div className="bg-slate-950/40 p-5 sm:p-8 rounded-3xl border border-slate-800/80 space-y-8 shadow-2xl">
                <div className="space-y-6">
                  <div className="space-y-4">
                  <div className="text-sm font-black uppercase text-pink-400 tracking-widest border-b border-pink-500/10 pb-3 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-pink-400" />
                    <span>Revision Strategy</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <select
                        value={revisionMode}
                        onChange={e => setRevisionMode(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-pink-300 font-bold focus:border-pink-500 focus:outline-none shadow-inner"
                      >
                        <option value="R1">R1 Revision (Remaining for R1)</option>
                        <option value="R2">R2 Revision (Remaining for R2)</option>
                        <option value="R3">R3 Revision (Remaining for R3)</option>
                      </select>
                      <p className="mt-2 text-[10px] text-slate-500 font-medium">Chapters in the scope lists below are automatically filtered based on syllabus completion & this mode.</p>
                    </div>
                  </div>
                </div>

                <div className="text-sm font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500/10 pb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Time Setup</span>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Target Study Date
                      </label>
                      <input
                        type="date"
                        value={selectedDateStr}
                        onChange={(e) => setSelectedDateStr(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Day Start Time
                      </label>
                      <input
                        type="text"
                        value={startTimePreference}
                        onChange={(e) => setStartTimePreference(e.target.value)}
                        placeholder="e.g. 09:00 AM"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Targeted Hrs: {availableHours} Hrs
                      </label>
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
                        if (onUpdateTargetHours) onUpdateTargetHours(nextHrs);
                      }}
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">
                      <span>4h</span>
                      <span className="text-indigo-400/80">8h</span>
                      <span>16h</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">Time Split (Primary)</label>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          step={10}
                          value={splitRatio}
                          onChange={(e) => setSplitRatio(Number(e.target.value))}
                          className="w-full accent-teal-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Pri: {splitRatio}%</span>
                          <span>Sec: {100 - splitRatio}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex flex-col text-[10px] text-slate-300 font-mono bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden">
                          <div className="flex justify-between bg-slate-800 px-2 py-1 border-b border-slate-700 font-bold">
                            <span className="w-1/2">Time Split</span>
                            <span className="w-1/4 text-center">Hrs</span>
                            <span className="w-1/4 text-center">Min</span>
                          </div>
                          <div className="flex justify-between px-2 py-1 border-b border-slate-700">
                            <span className="w-1/2 text-indigo-300 truncate">Primary Sub</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.floor(availableHours * (splitRatio/100))}</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.round((availableHours * (splitRatio/100) % 1) * 60)}</span>
                          </div>
                          <div className="flex justify-between px-2 py-1">
                            <span className="w-1/2 text-teal-300 truncate">Secondary Sub</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.floor(availableHours * ((100-splitRatio)/100))}</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.round((availableHours * ((100-splitRatio)/100) % 1) * 60)}</span>
                          </div>
                         </div>
                      </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Lunch Time (Start)</label>
                             <input type="text" value={lunchStartTime} onChange={e => setLunchStartTime(e.target.value)} placeholder="e.g. 01:00 PM" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Lunch Duration (e.g. 45 mins)</label>
                             <input type="text" value={lunchDuration} onChange={e => setLunchDuration(e.target.value)} placeholder="e.g. 45 mins" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                        </div>
                        <div className="space-y-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Dinner Time (Start)</label>
                             <input type="text" value={dinnerStartTime} onChange={e => setDinnerStartTime(e.target.value)} placeholder="e.g. 08:30 PM" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Dinner Duration (e.g. 45 mins)</label>
                             <input type="text" value={dinnerDuration} onChange={e => setDinnerDuration(e.target.value)} placeholder="e.g. 45 mins" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="text-sm font-black uppercase text-amber-400/80 tracking-widest border-b border-amber-500/10 pb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400/80" />
                    <span>Subject Focus</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-amber-300/80 uppercase tracking-wider">
                        Primary Subject
                      </label>
                      <select
                        value={primarySubject}
                        onChange={(e) => setPrimarySubject(e.target.value)}
                        className="w-full text-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer shadow-inner"
                      >
                        {subjects.map((s) => (
                          <option key={`p-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-extrabold text-amber-300/80 uppercase tracking-wider">
                        Secondary Subject
                      </label>
                      <select
                        value={secondarySubject}
                        onChange={(e) => setSecondarySubject(e.target.value)}
                        className="w-full text-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer shadow-inner"
                      >
                        <option value="N/A">🚫 N/A (Solo Focus Mode)</option>
                        {subjects.map((s) => (
                          <option key={`s-${s.id}`} value={s.name}>{s.code}: {s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Chapters Scope</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-400">Primary Chapters ({pSubObj?.name || primarySubject})</label>
                         <div className="flex items-center gap-2">
                           <button onClick={() => setSelectedPrimaryChapterIds(pSubObjFilteredTopics.map(t => t.id))} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300">Select All</button>
                           <button onClick={() => setSelectedPrimaryChapterIds([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                         </div>
                       </div>
                       <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                         {pSubObjFilteredTopics.length === 0 ? (
                           <div className="text-xs text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                         ) : (
                           pSubObjFilteredTopics.map(topic => (
                             <label key={topic.id} className="flex items-start gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                               <input
                                 type="checkbox"
                                 checked={selectedPrimaryChapterIds.includes(topic.id)}
                                 onChange={(e) => {
                                   if (e.target.checked) {
                                     setSelectedPrimaryChapterIds(prev => [...prev, topic.id]);
                                   } else {
                                     setSelectedPrimaryChapterIds(prev => prev.filter(id => id !== topic.id));
                                   }
                                 }}
                                 className="mt-0.5 accent-indigo-500 rounded bg-slate-800 border-slate-600 shrink-0"
                               />
                               <span className="text-[11px] text-slate-300 leading-tight group-hover:text-indigo-300">{topic.title}</span>
                             </label>
                           ))
                         )}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-400">Secondary Chapters {(secondarySubject === 'N/A') ? '(None)' : `(${sSubObj?.name || secondarySubject})`}</label>
                         {secondarySubject !== 'N/A' && (
                           <div className="flex items-center gap-2">
                             <button onClick={() => setSelectedSecondaryChapterIds(sSubObjFilteredTopics.map(t => t.id))} className="text-[9px] font-bold text-teal-400 hover:text-teal-300">Select All</button>
                             <button onClick={() => setSelectedSecondaryChapterIds([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                           </div>
                         )}
                       </div>
                       <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                         {secondarySubject === 'N/A' ? (
                           <div className="text-xs text-slate-500 text-center py-6">Solo Mode Active</div>
                         ) : sSubObjFilteredTopics.length === 0 ? (
                           <div className="text-xs text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                         ) : (
                           sSubObjFilteredTopics.map(topic => (
                             <label key={topic.id} className="flex items-start gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                               <input
                                 type="checkbox"
                                 checked={selectedSecondaryChapterIds.includes(topic.id)}
                                 onChange={(e) => {
                                   if (e.target.checked) {
                                     setSelectedSecondaryChapterIds(prev => [...prev, topic.id]);
                                   } else {
                                     setSelectedSecondaryChapterIds(prev => prev.filter(id => id !== topic.id));
                                   }
                                 }}
                                 className="mt-0.5 accent-teal-500 rounded bg-slate-800 border-slate-600 shrink-0"
                               />
                               <span className="text-[11px] text-slate-300 leading-tight group-hover:text-teal-300">{topic.title}</span>
                             </label>
                           ))
                         )}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  <label className="block text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Custom Instructions for AI (Optional)</span>
                  </label>
                  <textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="e.g. Focus deeply on tricky MCQs, shorter breaks..."
                    className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/60 min-h-[80px] shadow-inner resize-none transition-colors"
                  />
                </div>
              </main>
            {/* Layer 3: Sticky Action Footer */}
            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-20 bg-[#0B1528] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer border border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 text-white font-extrabold text-sm shadow-xl flex items-center gap-2.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>{isGenerating ? 'Generating...' : 'Generate AI Schedule'}</span>
              </button>
            </footer>
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

      {/* Toast Notification for Excel Import Success */}
      {importSuccessToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 font-bold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
          <span className="text-xs sm:text-sm">{importSuccessToast}</span>
        </div>
      )}

      {/* Weekly Timetable Planner Integration (Requirement 5) */}
      <WeeklyPlannerModal
        isOpen={isWeeklyModalOpen}
        onClose={() => setIsWeeklyModalOpen(false)}
        subjects={subjects}
        isStrictMode={isStrictMode}
      />

      {/* Custom Excel Timetable Importer (Day / Week / Month) */}
      <ExcelTimetableImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        initialDateStr={selectedDateStr}
        onSuccessToast={(msg) => {
          setImportSuccessToast(msg);
          setTimeout(() => setImportSuccessToast(null), 5000);
        }}
      />
    </div>
  );
};
