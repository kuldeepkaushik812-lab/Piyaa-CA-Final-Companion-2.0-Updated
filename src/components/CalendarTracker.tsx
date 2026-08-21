import { getISTDate, formatDisplayDate, getISTYMD, getISTTimeString } from "../lib/dateUtils";
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Award, ChevronLeft, ChevronRight, 
  CheckCircle2, Plus, Edit3, Save, X, BookOpen, AlertCircle, FileText, CheckSquare, Trash2, RotateCcw, Zap, FileSpreadsheet
} from 'lucide-react';
import { getAccessToken } from '../lib/auth';
import { syncEventToGoogleCalendar } from '../lib/calendar';
import { useStore } from '../store';
import { TimetableSlot } from '../types';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr, enforceNonOverlappingSlots } from '../utils/timeUtils';
import { SubjectHoursTable } from './SubjectHoursTable';
import { ExcelTimetableImportModal } from './ExcelTimetableImportModal';

interface CalendarTrackerProps {
  targetStudyHours?: number;
  isStrictMode?: boolean;
  studyHoursToday: number;
  completedCount: number;
  totalChapters: number;
}

export const CalendarTracker: React.FC<CalendarTrackerProps> = ({ 
  studyHoursToday,
  completedCount,
  totalChapters
}) => {
  const { 
    studyLogs, 
    subjects, 
    setSubjects,
    getScheduleForDate, 
    setScheduleForDate, 
    addStudyLog, 
    deleteStudyLog,
    updateStudyLogHoursDirectly,
    getTotalHoursForDate,
    dailyNotes,
    setDailyNote,
    dailyTargets,
    getDailyTarget,
    setDailyTarget,
    selectedDateStr,
    setSelectedDateStr,
    recalculateAllMetrics,
    logStudyActivity,
    deleteStudyHistoryLog,
    studyHistoryLogs
  } = useStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [examDate, setExamDate] = useState<string>('2026-11-01');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState(getISTDate());
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

  // Scroll lock & ESC key handler for CalendarTracker modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingSlotId) {
        setEditingSlotId(null);
      }
    };
    if (editingSlotId) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingSlotId]);

  // Default selected date is today in YYYY-MM-DD
  const todayStr = getISTYMD(currentDate);

  useEffect(() => {
    const updateTimeState = () => {
      const newNow = getISTDate();
      setCurrentDate(newNow);
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

  const [showSyncToast, setShowSyncToast] = useState(false);

  const handleMasterSync = () => {
    recalculateAllMetrics(selectedDateStr);
    setShowSyncToast(true);
    setTimeout(() => {
      setShowSyncToast(false);
    }, 4000);
  };

  // States for selected day detail edits
  const [editingNote, setEditingNote] = useState<string>('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [customLogHours, setCustomLogHours] = useState<string>('1');
  const [customLogMinutes, setCustomLogMinutes] = useState<string>('0');
  const [customLogSubject, setCustomLogSubject] = useState<string>('');
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [customTargetHours, setCustomTargetHours] = useState<number>(8);
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [importSuccessToast, setImportSuccessToast] = useState<string | null>(null);

  // States for slot editing
  const [editForm, setEditForm] = useState({ 
    subject: '', 
    activity: '', 
    startTime: '09:00 AM', 
    duration: 1.5,
    category: 'study' as 'study' | 'break' | 'revision' | 'mock' | 'na'
  });

  
  const isSlotPassed = (dateStr: string, timeStr: string) => {
    if (dateStr < todayStr) return true;
    if (dateStr > todayStr) return false;
    const parts = timeStr.split('-').map(s => s.trim());
    if (parts.length !== 2) return false;
    let endMinutes = parseTimeToMinutes(parts[1]);
    const startMinutes = parseTimeToMinutes(parts[0]);
    if (endMinutes < startMinutes) endMinutes += 1440;
    const istNow = getISTDate();
    const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();
    return currentMinutes > endMinutes;
  };

  const handleStartEdit = (slot: TimetableSlot, e: React.MouseEvent) => {
    e.stopPropagation();
    const hours = parseSlotHours(slot.time);
    const startStr = slot.time.split('-')[0].trim() || '09:00 AM';
    setEditingSlotId(slot.id);
    setEditForm({
      subject: slot.subject,
      activity: slot.activity,
      startTime: startStr,
      duration: hours,
      category: slot.category
    });
  };

  const saveEdit = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const oldSlot = selectedDateSchedule.find(s => s.id === slotId);
    if (!oldSlot) {
      setEditingSlotId(null);
      return;
    }

    const startMin = parseTimeToMinutes(editForm.startTime);
    const endMin = startMin + Math.round(editForm.duration * 60);
    const timeStr = `${formatMinutesToTimeStr(startMin)} - ${formatMinutesToTimeStr(endMin)}`;

    const newSlot: TimetableSlot = {
      ...oldSlot,
      subject: editForm.subject,
      activity: editForm.activity,
      time: timeStr,
      category: editForm.category
    };

    const getSubjectIdFromName = (name: string): string | null => {
      const matchSubj = subjects.find(sub => 
        sub.name.toLowerCase().includes(name.toLowerCase()) || 
        sub.code.toLowerCase().includes(name.toLowerCase())
      );
      return matchSubj ? matchSubj.id : null;
    };

    if (oldSlot.completed && oldSlot.category !== 'break') {
      const oldSubjId = getSubjectIdFromName(oldSlot.subject);
    }

    if (newSlot.completed && newSlot.category !== 'break') {
      const newSubjId = getSubjectIdFromName(newSlot.subject);
    }

    let updated = selectedDateSchedule.map(s => s.id === slotId ? newSlot : s);
    if (selectedDateStr >= todayStr) {
      updated = enforceNonOverlappingSlots(updated);
    }
    setScheduleForDate(selectedDateStr, updated);
    setEditingSlotId(null);
  };

  useEffect(() => {
    const calculateDays = () => {
      const [year, month, day] = examDate.split("-").map(Number); 
      const target = new Date(year, month - 1, day).getTime();
      const now = new Date(getISTDate().getFullYear(), getISTDate().getMonth(), getISTDate().getDate()).getTime();
      const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
      setDaysLeft(diff > 0 ? diff : 0);
    };
    calculateDays();
    const interval = setInterval(calculateDays, 60000);
    return () => clearInterval(interval);
  }, [examDate]);

  // Sync selected date note & target when selectedDateStr changes
  useEffect(() => {
    setEditingNote(dailyNotes[selectedDateStr] || '');
    setCustomTargetHours(getDailyTarget(selectedDateStr));
  }, [selectedDateStr, dailyNotes, dailyTargets, getDailyTarget]);

  const completionPercent = Math.round((completedCount / (totalChapters || 1)) * 100);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      recalculateAllMetrics(selectedDateStr);
      await new Promise(r => setTimeout(r, 600)); // Smooth UX delay
      setShowSyncToast(true);
      setTimeout(() => setShowSyncToast(false), 3000);
    } catch (err) {
      console.error('Error syncing:', err);
      alert('An unexpected error occurred while syncing.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute stats for selected Date
  const selectedDateLoggedHours = getTotalHoursForDate(selectedDateStr);
  const selectedDateTarget = getDailyTarget(selectedDateStr);
  const isTargetAchieved = selectedDateLoggedHours >= selectedDateTarget && selectedDateLoggedHours > 0;
  const isPartialStudy = selectedDateLoggedHours > 0 && selectedDateLoggedHours < selectedDateTarget;

  // Retrieve study logs for selected date
  const selectedDateLogs = studyLogs.filter(l => l.date === selectedDateStr);

  // Retrieve topics completed on this selected date
  const completedTopicsForSelectedDate: { subjectId: string; topicId: string; subjectName: string; subjectCode: string; topicTitle: string; action: string }[] = [];
  subjects.forEach(subject => {
    subject.topics.forEach(t => {
      const hasCompletedOnDate = (t.completedDates && t.completedDates.includes(selectedDateStr)) || 
                                 t.lastCompletedDate === selectedDateStr ||
                                 t.rev1At === selectedDateStr ||
                                 t.rev2At === selectedDateStr ||
                                 t.rev3At === selectedDateStr;

      if (hasCompletedOnDate) {
        // Collect all milestones that were completed on this specific day
        const actions: string[] = [];
        if (t.rev1At === selectedDateStr) actions.push('Revision 1 Completed');
        if (t.rev2At === selectedDateStr) actions.push('Revision 2 Completed');
        if (t.rev3At === selectedDateStr) actions.push('Revision 3 Completed');

        const actionText = actions.length > 0 ? actions.join(' & ') : 'Activity Logged';

        completedTopicsForSelectedDate.push({
          subjectId: subject.id,
          topicId: t.id,
          subjectName: subject.name,
          subjectCode: subject.code,
          topicTitle: t.title,
          action: actionText
        });
      }
    });
  });

  const handleResetTopic = (subjectId: string, topicId: string) => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      const updatedTopics = s.topics.map(t => {
        if (t.id !== topicId) return t;
        return {
          ...t,
          rev1: false,
          rev1At: undefined,
          rev2: false,
          rev2At: undefined,
          rev3: false,
          rev3At: undefined,
          ldr: false,
          ldrAt: undefined,
          completedDates: [],
          lastCompletedDate: undefined
        };
      });
      const completedChapters = updatedTopics.filter(t => t.completed).length;
      return {
        ...s,
        topics: updatedTopics,
        completedChapters
      };
    }));
  };

  // Schedule for selected Date
  const selectedDateSchedule = getScheduleForDate(selectedDateStr);

  const [isTogglingSlot, setIsTogglingSlot] = useState<Record<string, boolean>>({});
  const toggleSlotCompletion = async (slotId: string) => {
    if (isTogglingSlot[slotId]) return;
    setIsTogglingSlot((prev) => ({ ...prev, [slotId]: true }));
    try {
    const updatedSlots = selectedDateSchedule.map(s => {
      if (s.id === slotId) {
        const newStatus = !s.completed;
        if (s.category !== 'break') {
          const slotHrs = parseSlotHours(s.time);
          const matchSubj = subjects.find(sub => sub.name.toLowerCase().includes(s.subject.toLowerCase()) || sub.code.toLowerCase().includes(s.subject.toLowerCase()));
          const subjectId = matchSubj ? matchSubj.id : 'general';
          const subjName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : `General (${s.subject})`;

          if (s.completed) {
            // Unchecking completed slot -> remove from history
            const matchingLog = (studyHistoryLogs || []).find(
              log => log.sourceType === 'TIME_TABLE' && 
                     log.subjectId === subjectId && 
                     log.chapterTitle === s.activity &&
                     log.dateStr === selectedDateStr
            );
            if (matchingLog) {
              deleteStudyHistoryLog(matchingLog.id);
            } else {
            }
          } else {
            // Logging check in history
            logStudyActivity({
              dateStr: selectedDateStr,
              subject: subjName,
              subjectId,
              durationHours: slotHrs,
              sourceType: 'TIME_TABLE',
              chapterTitle: s.activity
            });
          }
        }
        return { ...s, completed: newStatus };
      }
      return s;
    });
    setScheduleForDate(selectedDateStr, updatedSlots);
    await new Promise(res => setTimeout(res, 100));
    } finally {
      setIsTogglingSlot((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  const handleSaveNote = () => {
    setIsSavingNote(true);
    setDailyNote(selectedDateStr, editingNote);
    setTimeout(() => {
      setIsSavingNote(false);
    }, 400);
  };

  const handleAddManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(customLogHours) || 0;
    const m = parseFloat(customLogMinutes) || 0;
    const totalHours = Number((h + (m / 60)).toFixed(2));
    if (totalHours <= 0) return;
    
    const matchSubj = subjects.find(sub => sub.id === customLogSubject);
    const subjName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : 'General Manual Study';
    
    logStudyActivity({
      dateStr: selectedDateStr,
      subject: subjName,
      subjectId: customLogSubject || 'general',
      durationHours: totalHours,
      sourceType: 'MANUAL',
      chapterTitle: 'Manual Study Log Entry'
    });
    
    setCustomLogHours('1');
    setCustomLogMinutes('0');
    setIsAddingLog(false);
  };

  const handleSaveTarget = (newTarget: number) => {
    setCustomTargetHours(newTarget);
    setDailyTarget(selectedDateStr, newTarget);
  };

  // Format nice display date
  const displayDateObj = new Date(selectedDateStr + 'T00:00:00');
  const weekdayStr = displayDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedSelectedDate = `${formatDisplayDate(selectedDateStr)} (${weekdayStr})`;

  // Subject-wise Cumulative Aggregates (Past days + Current day)
  const subjectAggregates = subjects.map(subj => {
    const logs = studyLogs.filter(l => l.subjectId === subj.id);
    const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);
    const sessionCount = logs.length;
    return {
      id: subj.id,
      code: subj.code,
      name: subj.name,
      totalHours,
      sessionCount
    };
  });

  const generalLogs = studyLogs.filter(l => l.subjectId === 'general' || !l.subjectId || !subjects.some(s => s.id === l.subjectId));
  const generalTotalHours = generalLogs.reduce((sum, l) => sum + l.hours, 0);
  const generalSessionCount = generalLogs.length;

  const totalCombinedHours = studyLogs.reduce((sum, l) => sum + l.hours, 0);

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {showSyncToast && (
        <div className="fixed bottom-20 right-8 z-50 bg-slate-900 border border-amber-500/50 text-amber-200 font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 transition-all duration-300 transform animate-fadeIn">
          <Zap className="w-5 h-5 text-amber-400 animate-bounce" />
          <span>⚡ All metrics & header badges synced successfully! ✨</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-2xl">
        <div>
          <h2 className="text-xl font-extrabold nature-gradient-text flex items-center gap-2">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <span>Calendar Performance & Record Tracker 📅</span>
          </h2>
          <p className="text-sm text-cyan-100/90 mt-1 font-medium">
            Click any day on the calendar to view past study records, target achievements, scheduled timetables, and notes!
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0 justify-end">
          <button
            onClick={() => setIsExcelImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
            title="Import custom Excel (.xlsx / .csv) timetable for Day, Week, or Month"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>📥 Import Excel Timetable</span>
          </button>

          <button
            onClick={handleMasterSync}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all duration-300 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>⚡ Sync & Refresh Day Record</span>
          </button>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Calendar className="w-4 h-4" />
            <span>{isSyncing ? 'Syncing to G-Cal...' : 'Sync Day Record to G-Cal'}</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ICAI Exam Countdown */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/40 rounded-xl">
            <Calendar className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold">ICAI Exam Target</div>
            <div className="font-extrabold text-amber-200 text-lg">{daysLeft} Days Left</div>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="bg-transparent text-[9px] text-cyan-400/80 border-none cursor-pointer focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Selected Date Metric */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/40 rounded-xl">
            <Clock className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold">Selected Day Hours</div>
            <div className="font-extrabold text-cyan-200 text-lg">{selectedDateLoggedHours.toFixed(1)} / {selectedDateTarget} hrs</div>
            <div className="text-[10px] font-bold text-cyan-400/80">{selectedDateStr === todayStr ? 'Today' : formatDisplayDate(selectedDateStr)}</div>
          </div>
        </div>

        {/* Selected Date Status */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/40 rounded-xl">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold">Day Target Status</div>
            <div className={`font-extrabold text-sm ${isTargetAchieved ? 'text-emerald-400' : isPartialStudy ? 'text-amber-300' : 'text-slate-400'}`}>
              {isTargetAchieved ? 'Target Achieved 🎉' : isPartialStudy ? 'Partial Study ⚠️' : 'No Study Recorded ❌'}
            </div>
          </div>
        </div>

        {/* Overall Syllabus Progress */}
        <div className="glass-panel p-4 rounded-2xl border border-cyan-500/30 flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/40 rounded-xl">
            <BookOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] text-cyan-300 uppercase tracking-wider font-bold">Syllabus Completion</div>
            <div className="font-extrabold text-amber-200 text-lg">{completionPercent}%</div>
            <div className="text-[10px] text-cyan-400/80 font-bold">{completedCount} of {totalChapters} chapters</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Calendar View, Right Selected Day Comprehensive Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Calendar Picker Panel */}
        <div className="lg:col-span-5 glass-panel rounded-3xl border border-cyan-500/30 p-6 shadow-2xl flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-cyan-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Calendar Grid</span>
            </h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                className="p-1.5 hover:bg-cyan-500/20 rounded-lg transition-colors text-cyan-300 cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-200 min-w-[110px] text-center">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button 
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                className="p-1.5 hover:bg-cyan-500/20 rounded-lg transition-colors text-cyan-300 cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
              <div key={day} className="text-center text-[10px] font-bold text-cyan-400/80 uppercase py-1">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 flex-1">
            {Array.from({ length: (new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() + 6) % 7 }).map((_, i) => (
              <div key={`blank-${i}`} className="p-2" />
            ))}
            {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
              const dayNum = i + 1;
              const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
              // Ensure zero padded YYYY-MM-DD
              const year = dateObj.getFullYear();
              const month = String(dateObj.getMonth() + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const cellDateStr = `${year}-${month}-${dayStr}`;

              const isToday = todayStr === cellDateStr;
              const isSelected = selectedDateStr === cellDateStr;
              
              // Real study hours logged for this date
              const realHours = getTotalHoursForDate(cellDateStr);
              const targetForCell = getDailyTarget(cellDateStr);
              const isCellTargetAchieved = realHours >= targetForCell && realHours > 0;
              const isCellPartial = realHours > 0 && realHours < targetForCell;

              let dotColor = "bg-transparent";
              if (isCellTargetAchieved) dotColor = "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)]";
              else if (isCellPartial) dotColor = "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]";

              return (
                <button
                  key={cellDateStr}
                  onClick={() => setSelectedDateStr(cellDateStr)}
                  className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-500/30 shadow-lg shadow-cyan-500/20 scale-105 z-10'
                      : isToday
                        ? 'border-amber-400/60 bg-amber-500/10' 
                        : realHours > 0
                          ? 'border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/40'
                          : 'border-transparent hover:border-cyan-500/20 hover:bg-cyan-950/20'
                  }`}
                >
                  <span className={`text-xs font-semibold ${isSelected ? 'text-white font-extrabold' : isToday ? 'text-amber-300 font-bold' : realHours > 0 ? 'text-cyan-200' : 'text-slate-400'}`}>
                    {dayNum}
                  </span>
                  
                  {realHours > 0 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      <span className="text-[9px] font-bold text-cyan-300">{realHours.toFixed(1)}h</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Jump Buttons */}
          <div className="mt-4 pt-3 border-t border-cyan-500/20 flex items-center justify-between gap-2">
            <button
              onClick={() => {
                const freshNow = getISTDate();
                setCurrentDate(freshNow);
                setSelectedDateStr(getISTYMD(freshNow));
              }}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/30 text-[11px] font-bold text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <span>Jump to Today</span>
            </button>

            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" /> Target Met
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Partial
              </span>
            </div>
          </div>
        </div>

        {/* Selected Date Comprehensive Record & Interlinked Details */}
        <div className="lg:col-span-7 glass-panel rounded-3xl border border-cyan-500/30 p-6 shadow-2xl flex flex-col space-y-6">
          
          {/* Selected Date Title & Quick Target Adjuster */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-cyan-500/20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Day Record</span>
                {selectedDateStr === todayStr && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold">
                    TODAY
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2 mt-0.5">
                <span>{formattedSelectedDate}</span>
              </h3>
            </div>

            {/* Target Hours Configurator */}
            <div className="flex items-center gap-2 bg-cyan-950/50 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
              <span className="text-xs text-cyan-300 font-medium">Daily Target:</span>
              <select
                value={selectedDateTarget}
                onChange={(e) => handleSaveTarget(Number(e.target.value))}
                className="bg-cyan-900/80 border border-cyan-500/40 rounded-md text-xs font-bold text-amber-300 px-2 py-1 focus:outline-none"
              >
                {[4, 6, 8, 10, 12, 14].map(h => (
                  <option key={h} value={h}>{h} Hours</option>
                ))}
              </select>
            </div>
          </div>

          {/* Performance Summary Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isTargetAchieved 
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
              : isPartialStudy 
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : 'bg-cyan-950/30 border-cyan-500/20 text-cyan-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                isTargetAchieved ? 'bg-emerald-500/20 text-emerald-300' : isPartialStudy ? 'bg-amber-500/20 text-amber-300' : 'bg-cyan-500/20 text-cyan-300'
              }`}>
                {isTargetAchieved ? <CheckCircle2 className="w-6 h-6" /> : isPartialStudy ? <Clock className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider">
                  {isTargetAchieved ? '🎉 Target Achieved' : isPartialStudy ? '⚠️ Partial Progress' : '📖 Scheduled Day'}
                </div>
                <div className="text-lg font-extrabold mt-0.5">
                  {selectedDateLoggedHours.toFixed(1)} hrs completed <span className="text-xs opacity-75 font-normal">(Target: {selectedDateTarget} hrs)</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsAddingLog(!isAddingLog)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-bold text-cyan-200 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingLog ? 'Cancel' : 'Log Hours for this Date'}</span>
            </button>
          </div>

          {/* Inline Add Hours Form for Selected Date */}
          {isAddingLog && (
            <form onSubmit={handleAddManualLog} className="p-4 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 space-y-3 animate-fadeIn">
              <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Add / Record Study Session for {selectedDateStr}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-cyan-200 uppercase">Subject</label>
                  <select
                    value={customLogSubject}
                    onChange={(e) => setCustomLogSubject(e.target.value)}
                    className="w-full mt-1 bg-cyan-900/80 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">General Study Session</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cyan-200 uppercase">Hours (Hrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    step="1"
                    placeholder="0"
                    value={customLogHours}
                    onChange={(e) => setCustomLogHours(e.target.value)}
                    className="w-full mt-1 bg-cyan-900/80 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-cyan-200 uppercase">Minutes (Min)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    placeholder="0"
                    value={customLogMinutes}
                    onChange={(e) => setCustomLogMinutes(e.target.value)}
                    className="w-full mt-1 bg-cyan-900/80 border border-cyan-500/40 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-cyan-300 px-1">
                <span>Calculated Duration:</span>
                <span className="font-bold">
                  {customLogHours || 0}h {customLogMinutes || 0}m ({((parseFloat(customLogHours) || 0) + (parseFloat(customLogMinutes) || 0) / 60).toFixed(2)} hrs)
                </span>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:from-cyan-400 cursor-pointer"
              >
                Save Hours to {selectedDateStr}
              </button>
            </form>
          )}

          {/* 3 Interlinked Cards: Completed Topics, Timetable Schedule, & Reflection Notes */}
          <div className="space-y-4">
            
            {/* 1. Topics Completed on this Date */}
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>Syllabus Topics Completed on this Date ({completedTopicsForSelectedDate.length})</span>
                </h4>
              </div>

              {completedTopicsForSelectedDate.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {completedTopicsForSelectedDate.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-900/30 border border-cyan-500/30 text-xs">
                      <div className="flex items-center gap-2 max-w-[60%]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="truncate">
                          <div className="font-bold text-slate-100 truncate" title={item.topicTitle}>{item.topicTitle}</div>
                          <div className="text-[10px] text-cyan-300/80 truncate">{item.subjectCode} - {item.subjectName}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          {item.action}
                        </span>
                        <button
                          onClick={() => handleResetTopic(item.subjectId, item.topicId)}
                          className="p-1 rounded-md bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/30 transition-all cursor-pointer"
                          title="Undo / Reset Status"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  No syllabus chapters were marked with revisions on {selectedDateStr}. Mark revisions in the Syllabus tab!
                </p>
              )}
            </div>

            {/* 2. Scheduled Timetable for this Date */}
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span>Timetable Schedule for {selectedDateStr}</span>
                </h4>
                <span className="text-[10px] text-cyan-400 font-medium">Click slot to toggle complete</span>
              </div>

              {selectedDateSchedule.length > 0 ? (
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {selectedDateSchedule.map((slot) => {
                    const isBreak = slot.category === 'break' || slot.subject.toLowerCase() === 'break' || slot.activity.toLowerCase().includes('break');
                    const isCompleted = slot.completed || slot.status === 'COMPLETED';
                    const isPartial = slot.status === 'PARTIALLY_COMPLETED';
                    const isFailed = (slot.status === 'FAILED' || slot.isFrozen) && !slot.isUnlocked;

                    if (isBreak) {
                      return (
                        <div
                          key={slot.id}
                          onClick={() => toggleSlotCompletion(slot.id)}
                          className="w-full text-left bg-amber-950/10 border border-amber-500/25 rounded-xl h-12 px-4 py-2 flex items-center justify-between text-amber-200/80 transition-all cursor-pointer hover:border-amber-500/40"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-4 h-4 rounded border border-amber-500/50 flex items-center justify-center shrink-0">
                              {slot.completed && <CheckCircle2 className="w-3 h-3 text-amber-400 stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-mono text-xs font-bold text-amber-300 mr-2">{slot.time}</span>
                              <span className={`text-xs font-bold ${slot.completed ? 'line-through text-slate-400' : 'text-amber-200/90'}`}>
                                ☕ {slot.activity || slot.subject || 'Rest Break'}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300">
                            BREAK
                          </span>
                        </div>
                      );
                    }

                    let cardClasses = 'bg-[#0A121E]/70 border border-slate-700/80 border-l-4 border-l-cyan-500/50 hover:border-cyan-500/50 shadow-md text-slate-100';
                    if (isCompleted) {
                      cardClasses = 'bg-[#0A121E]/80 border-2 border-emerald-500/75 border-l-4 border-l-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.18)] text-slate-100';
                    } else if (isPartial) {
                      cardClasses = 'bg-[#0A121E]/80 border-2 border-amber-500/75 border-l-4 border-l-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.18)] text-slate-100';
                    } else if (isFailed) {
                      cardClasses = 'bg-[#0A121E]/80 border-2 border-red-500/75 border-l-4 border-l-red-500 shadow-[0_0_18px_rgba(239,68,68,0.18)] opacity-90 text-slate-100';
                    }

                    return (
                      <div
                        key={slot.id}
                        onClick={() => toggleSlotCompletion(slot.id)}
                        className={`w-full text-left p-3 rounded-xl backdrop-blur-md flex items-center justify-between gap-3 transition-all cursor-pointer ${cardClasses}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isCompleted ? 'bg-emerald-500 border-emerald-400 text-slate-950' : 'border-cyan-500/50'
                          }`}>
                            {isCompleted && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div className={`text-xs font-bold truncate ${isCompleted ? 'line-through opacity-75' : ''}`}>
                              {slot.time}: {slot.activity}
                            </div>
                            <div className="text-[10px] text-cyan-300/80 truncate">{slot.subject}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {!isSlotPassed(selectedDateStr, slot.time) && (
                            <button
                              onClick={(e) => handleStartEdit(slot, e)}
                              className="p-1.5 rounded bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/30 text-slate-300 hover:text-white text-[10px] font-bold cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          )}
                          <span className="text-[10px] px-2 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-semibold">
                            {slot.category}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No custom schedule saved for this date yet.</p>
              )}
            </div>

            {/* Modal: Edit Timetable Slot Details (Unified Popover) */}
            {editingSlotId && (
              <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-cyan-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
                <div className="w-full h-full flex flex-col justify-between">
                  <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
                    <div className="flex items-center gap-3 text-cyan-300">
                      <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-inner">
                        <Clock className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black text-white">Edit Calendar Slot</h3>
                        <p className="text-xs text-cyan-300/80 hidden sm:block">Modify timetable slot details for selected date</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setEditingSlotId(null)} 
                      className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
                    >
                      <span>✕ Close (ESC)</span>
                    </button>
                  </header>

                  <main className="flex-1 w-full max-w-xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
                    {/* Smart Balance Alert inside modal */}
                    {(() => {
                      const hypoTotal = selectedDateSchedule.reduce((sum, s) => {
                        if (s.id === editingSlotId) {
                          return editForm.category !== 'break' ? sum + editForm.duration : sum;
                        }
                        return s.category !== 'break' ? sum + parseSlotHours(s.time) : sum;
                      }, 0);
                      const currentDailyTarget = getDailyTarget(selectedDateStr);
                      if (hypoTotal > currentDailyTarget) {
                        return (
                          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold text-xs animate-pulse flex items-center gap-2 shadow-lg">
                            <span>⚡ Planned: {hypoTotal.toFixed(1)}h / {currentDailyTarget.toFixed(1)}h Target (+{(hypoTotal - currentDailyTarget).toFixed(1)}h over target)</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="bg-slate-950/60 p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl">
                      <div>
                        <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block mb-1">Subject</label>
                        <select
                          value={editForm.subject}
                          onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                          className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                        >
                          {subjects.map(s => (
                            <option key={s.id} value={s.name}>{s.code} - {s.name}</option>
                          ))}
                          <option value="General Study">General Study</option>
                          <option value="Break / Relaxation">Break / Relaxation</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block mb-1">Activity / Slot Title</label>
                        <input
                          type="text"
                          value={editForm.activity}
                          onChange={(e) => setEditForm({ ...editForm, activity: e.target.value })}
                          className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                          placeholder="e.g. Solve Ind AS 115 questions"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block mb-1">Category</label>
                          <select
                            value={editForm.category}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                            className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                          >
                            <option value="study">Study</option>
                            <option value="revision">Revision</option>
                            <option value="mock">Mock Test</option>
                            <option value="break">Break</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider block mb-1">Start Time</label>
                          <input
                            type="text"
                            value={editForm.startTime}
                            onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                            className="w-full bg-slate-900 border border-cyan-500/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                            placeholder="e.g. 09:00 AM"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex justify-between mb-1">
                          <span>Duration</span>
                          <span className="text-amber-300 font-mono font-bold">{editForm.duration.toFixed(1)} hours</span>
                        </label>
                        <input
                          type="range"
                          min="0.5"
                          max="5.0"
                          step="0.5"
                          value={editForm.duration}
                          onChange={(e) => setEditForm({ ...editForm, duration: parseFloat(e.target.value) })}
                          className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                        />
                      </div>
                    </div>
                  </main>

                  <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-20 bg-[#0A121E]/90">
                    <button
                      onClick={() => setEditingSlotId(null)}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => saveEdit(editingSlotId, e)}
                      className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg cursor-pointer transition-all"
                    >
                      Save Changes
                    </button>
                  </footer>
                </div>
              </div>
            )}

            {/* 3. Reflection Notes & Journal for this Date */}
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-300" />
                  <span>Daily Study Notes & Reflection Journal</span>
                </h4>
                <button
                  onClick={handleSaveNote}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[11px] font-bold text-amber-300 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingNote ? 'Saved!' : 'Save Note'}</span>
                </button>
              </div>

              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                placeholder={`Write notes for ${selectedDateStr}: What did you accomplish? Any doubts faced or target adjustments?`}
                rows={3}
                className="w-full p-3 bg-cyan-900/40 border border-cyan-500/30 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            {/* 4. Active Study Logs for this Date */}
            <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>Logged Study Sessions ({selectedDateLogs.length})</span>
                </h4>
                {selectedDateLogs.length > 0 && (
                  <span className="text-[10px] font-mono font-bold text-amber-300">
                    Day Total: {selectedDateLogs.reduce((sum, l) => sum + l.hours, 0).toFixed(1)} hrs
                  </span>
                )}
              </div>

              {selectedDateLogs.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {selectedDateLogs.map((log) => {
                    const matchSubj = subjects.find(s => s.id === log.subjectId);
                    const subjName = matchSubj ? matchSubj.name : 'General / Quick Entry';
                    const subjCode = matchSubj ? matchSubj.code : 'General';
                    return (
                      <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-cyan-900/20 border border-cyan-500/10 text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-100">{subjName}</span>
                          <span className="text-[10px] text-cyan-400/80 font-mono">{subjCode}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <input 
                              type="number"
                              step="0.5"
                              min="0"
                              value={log.hours}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0) {
                                  updateStudyLogHoursDirectly(log.id, val);
                                }
                              }}
                              className="w-12 h-6 bg-slate-950/80 border border-cyan-500/30 rounded text-center text-xs text-white font-bold font-mono outline-none focus:border-cyan-400"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">hrs</span>
                          </div>
                          <button
                            onClick={() => deleteStudyLog(log.id)}
                            className="p-1 rounded bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-500/30 cursor-pointer transition-all"
                            title="Delete log session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No study sessions logged for {selectedDateStr} yet.</p>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Subject-wise Cumulative Aggregate Hours Table (Requirement 3 & 4) */}
      <SubjectHoursTable />

      {/* Toast Notification for Excel Import Success */}
      {importSuccessToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-950/95 border-2 border-emerald-400 text-emerald-100 font-bold px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
          <span className="text-xs sm:text-sm">{importSuccessToast}</span>
        </div>
      )}

      {/* Custom Excel Timetable Importer Modal */}
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
