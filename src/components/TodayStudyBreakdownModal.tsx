import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Clock, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Zap, 
  BookOpen, 
  Calendar,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { useStore } from '../store';
import { getISTYMD, getISTTimeString } from '../lib/dateUtils';
import { parseSlotHours, parseTimeToMinutes, formatMinutesToTimeStr } from '../utils/timeUtils';

interface TodayStudyBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchNextSlot?: () => void;
}

export const TodayStudyBreakdownModal: React.FC<TodayStudyBreakdownModalProps> = ({
  isOpen,
  onClose,
  onLaunchNextSlot
}) => {
  const selectedDateStr = useStore((state) => state.selectedDateStr);
  const getScheduleForDate = useStore((state) => state.getScheduleForDate);
  const getDailyTarget = useStore((state) => state.getDailyTarget);
  const studyHistoryLogs = useStore((state) => state.studyHistoryLogs);
  const studyLogs = useStore((state) => state.studyLogs);
  const subjects = useStore((state) => state.subjects);
  const setActiveTab = useStore((state) => state.setActiveTab);
  const setTimerTargetSlotId = useStore((state) => state.setTimerTargetSlotId);

  const todayStr = getISTYMD();
  const dateStr = selectedDateStr || todayStr;
  const targetStudyHours = getDailyTarget(dateStr) || 12;

  // Handle ESC key press & Scroll Lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Retrieve today's schedule slots
  const todaySlots = useMemo(() => {
    return getScheduleForDate(dateStr) || [];
  }, [getScheduleForDate, dateStr]);

  // Today's logs from studyHistoryLogs
  const todayHistoryLogs = useMemo(() => {
    return (studyHistoryLogs || []).filter((log) => log.dateStr === dateStr);
  }, [studyHistoryLogs, dateStr]);

  // Compute total studied hours today
  const studyHoursToday = useMemo(() => {
    // Sum from studyHistoryLogs
    const logTotal = todayHistoryLogs.reduce((acc, log) => acc + (log.durationHours || 0), 0);
    if (logTotal > 0) return logTotal;

    // Fallback to slot completed durations
    return todaySlots.reduce((acc, slot) => {
      if (slot.category !== 'study') return acc;
      if (slot.studiedDurationHours && slot.studiedDurationHours > 0) {
        return acc + slot.studiedDurationHours;
      }
      if (slot.completed) {
        return acc + (slot.totalDurationHours || parseSlotHours(slot.time) || 1.5);
      }
      return acc;
    }, 0);
  }, [todayHistoryLogs, todaySlots]);

  // Compute Lapsed / Lost Hours today (slots up to current hour that were not completed / studied)
  const lapsedHoursToday = useMemo(() => {
    const istNowStr = getISTTimeString();
    const currentMins = parseTimeToMinutes(istNowStr);

    return todaySlots.reduce((acc, slot) => {
      if (slot.category !== 'study' || slot.status === 'NA') return acc;
      
      const parts = slot.time ? slot.time.split('-') : [];
      if (parts.length < 2) return acc;
      const endMins = parseTimeToMinutes(parts[1]);

      const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
      const studied = slot.studiedDurationHours || (slot.completed ? total : 0);

      // If slot end time has passed today, or status is FAILED / PARTIALLY_COMPLETED
      if (dateStr < todayStr || (dateStr === todayStr && currentMins > endMins)) {
        const unstudied = Math.max(0, total - studied);
        return acc + unstudied;
      }
      return acc;
    }, 0);
  }, [todaySlots, dateStr, todayStr]);

  const remainingTarget = Math.max(0, targetStudyHours - studyHoursToday);

  // Subject-wise time split today
  const subjectSplit = useMemo(() => {
    const map: Record<string, { subjectName: string; hours: number; count: number }> = {};

    // First collect from history logs
    todayHistoryLogs.forEach((log) => {
      const name = log.subject || 'General Study';
      if (!map[name]) map[name] = { subjectName: name, hours: 0, count: 0 };
      map[name].hours += log.durationHours || 0;
      map[name].count += 1;
    });

    // If no history logs, collect from study slots
    if (Object.keys(map).length === 0) {
      todaySlots.forEach((slot) => {
        if (slot.category === 'study' && slot.subject) {
          const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
          const studied = slot.studiedDurationHours || (slot.completed ? total : 0);
          if (studied > 0) {
            if (!map[slot.subject]) map[slot.subject] = { subjectName: slot.subject, hours: 0, count: 0 };
            map[slot.subject].hours += studied;
            map[slot.subject].count += 1;
          }
        }
      });
    }

    const items = Object.values(map);
    const totalHours = items.reduce((sum, item) => sum + item.hours, 0) || 1;

    return items.map((item) => ({
      ...item,
      percentage: Math.round((item.hours / totalHours) * 100)
    })).sort((a, b) => b.hours - a.hours);
  }, [todayHistoryLogs, todaySlots]);

  // Construct 1-by-1 Hr Chronological Time-Block Matrix (06:00 AM to 11:00 PM standard + dynamic expansion)
  const hourlyMatrix = useMemo(() => {
    const istNowStr = getISTTimeString();
    const currentMins = parseTimeToMinutes(istNowStr);

    // Determine min start hour and max end hour from slots
    let startHour = 6;
    let endHour = 23;

    todaySlots.forEach((slot) => {
      if (slot.time && slot.time.includes('-')) {
        const parts = slot.time.split('-');
        const sMins = parseTimeToMinutes(parts[0]);
        const eMins = parseTimeToMinutes(parts[1]);
        const sH = Math.floor(sMins / 60);
        const eH = Math.ceil(eMins / 60);
        if (sH < startHour) startHour = Math.max(0, sH);
        if (eH > endHour) endHour = Math.min(24, eH);
      }
    });

    const blocks = [];

    for (let h = startHour; h < endHour; h++) {
      const blockStartMins = h * 60;
      const blockEndMins = (h + 1) * 60;
      const timeWindow = `${formatMinutesToTimeStr(blockStartMins)} - ${formatMinutesToTimeStr(blockEndMins)}`;

      // Find overlapping slots
      const matchingSlots = todaySlots.filter((slot) => {
        if (!slot.time || !slot.time.includes('-')) return false;
        const parts = slot.time.split('-');
        const sMins = parseTimeToMinutes(parts[0]);
        const eMins = parseTimeToMinutes(parts[1]);
        return Math.max(sMins, blockStartMins) < Math.min(eMins, blockEndMins);
      });

      // Find matching history logs for this hour
      const matchingLogs = todayHistoryLogs.filter((log) => {
        const logDate = new Date(log.timestamp);
        const logMins = logDate.getHours() * 60 + logDate.getMinutes();
        return logMins >= blockStartMins && logMins < blockEndMins;
      });

      let studiedHours = 0;
      let subject = '';
      let topic = '';
      let sourceType: 'POMODORO' | 'EXAM_SIMULATOR' | 'TIME_TABLE' | 'MANUAL' | 'SYLLABUS' = 'TIME_TABLE';
      let isBreak = false;

      if (matchingLogs.length > 0) {
        studiedHours = matchingLogs.reduce((acc, l) => acc + l.durationHours, 0);
        subject = matchingLogs[0].subject;
        topic = matchingLogs[0].chapterTitle || matchingLogs[0].notes || 'Study Session';
        sourceType = matchingLogs[0].sourceType;
      } else if (matchingSlots.length > 0) {
        const primarySlot = matchingSlots[0];
        isBreak = primarySlot.category === 'break';
        subject = primarySlot.subject || (isBreak ? 'Scheduled Rest / Break' : 'CA Final Study Slot');
        topic = primarySlot.activity || 'Chapter Practice & Revision';

        if (isBreak) {
          studiedHours = 0;
        } else {
          const totalSlotDuration = primarySlot.totalDurationHours || parseSlotHours(primarySlot.time) || 1.5;
          const slotStudied = primarySlot.studiedDurationHours || (primarySlot.completed ? totalSlotDuration : 0);
          
          if (primarySlot.completed) {
            studiedHours = 1.0;
          } else if (slotStudied > 0) {
            studiedHours = Math.min(1.0, Number((slotStudied / totalSlotDuration).toFixed(1)));
          } else {
            studiedHours = 0;
          }
        }
      }

      // Determine status badge & styling
      let status: 'COMPLETED' | 'PARTIAL' | 'GAP' | 'PENDING' | 'BREAK' = 'PENDING';

      if (isBreak) {
        status = 'BREAK';
      } else if (studiedHours >= 0.85) {
        status = 'COMPLETED';
      } else if (studiedHours > 0) {
        status = 'PARTIAL';
      } else {
        if (dateStr < todayStr || (dateStr === todayStr && blockEndMins <= currentMins)) {
          status = 'GAP';
        } else {
          status = 'PENDING';
        }
      }

      blocks.push({
        hour: h,
        timeWindow,
        studiedHours,
        subject,
        topic,
        sourceType,
        status,
        slotId: matchingSlots[0]?.id
      });
    }

    return blocks;
  }, [todaySlots, todayHistoryLogs, dateStr, todayStr]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-emerald-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full h-full flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Layer 1: Sticky Glassmorphic Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 shadow-inner">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                  Today's Granular Hour-by-Hour Microscope
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {dateStr}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Precision accounting-grade ledger of every 1-hour time window today
              </p>
            </div>
          </div>

          {/* Center Dynamic Context Pill */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span>Target: {targetStudyHours.toFixed(1)}h | Today: {studyHoursToday.toFixed(1)}h Logged</span>
          </div>

          {/* Right Close Button */}
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
            title="Close Modal (Esc)"
          >
            <X className="w-4 h-4" />
            <span>✕ Close (ESC)</span>
          </button>
        </header>

        {/* Layer 2: Responsive Centered Content Wrapper */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto space-y-6">
          
          {/* Specification 3.1: Daily Efficiency Hero Summary (3 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            {/* Studied Hours Card */}
            <div className="bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-emerald-400">
                <CheckCircle2 className="w-16 h-16" />
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3 text-emerald-400" />
                Studied Hours
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-200 tracking-tight">
                  {studyHoursToday.toFixed(1)}h
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  / {targetStudyHours.toFixed(1)}h
                </span>
              </div>
              <p className="text-[11px] font-semibold text-emerald-300/80 mt-1">
                {Math.round((studyHoursToday / (targetStudyHours || 1)) * 100)}% of daily goal completed
              </p>
            </div>

            {/* Lapsed / Lost Hours Card */}
            <div className="bg-gradient-to-br from-rose-950/80 to-slate-900 border border-rose-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-rose-400">
                <AlertCircle className="w-16 h-16" />
              </div>
              <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Lapsed / Lost Hours
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-mono font-black text-rose-200 tracking-tight">
                  {lapsedHoursToday.toFixed(1)}h
                </span>
              </div>
              <p className="text-[11px] font-semibold text-rose-300/80 mt-1">
                {lapsedHoursToday > 0 ? "Unstudied gaps in past slots" : "Zero lapsed hours today! Perfect flow 🔥"}
              </p>
            </div>

            {/* Remaining Target Card */}
            <div className="bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-500/40 rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-amber-400">
                <TrendingUp className="w-16 h-16" />
              </div>
              <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                Remaining Daily Target
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-mono font-black text-amber-200 tracking-tight">
                  {remainingTarget.toFixed(1)}h
                </span>
              </div>
              <p className="text-[11px] font-semibold text-amber-300/80 mt-1">
                {remainingTarget === 0 ? "🎯 Daily Target Met!" : "Required hours remaining for today"}
              </p>
            </div>
          </div>

          {/* Specification 3.2: Subject-Wise Time Split (Today) */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Subject-Wise Distribution Today</span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-400">
                Total: {studyHoursToday.toFixed(1)} hrs
              </span>
            </div>

            {subjectSplit.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No study hours logged for specific CA subjects today yet.
              </p>
            ) : (
              <>
                {/* Horizontal Segmented Progress Bar */}
                <div className="h-3.5 w-full bg-slate-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-800">
                  {subjectSplit.map((sub, idx) => {
                    const colors = [
                      'bg-emerald-500',
                      'bg-sky-500',
                      'bg-indigo-500',
                      'bg-amber-500',
                      'bg-purple-500',
                      'bg-teal-500'
                    ];
                    return (
                      <div
                        key={sub.subjectName}
                        style={{ width: `${Math.max(5, sub.percentage)}%` }}
                        className={`h-full ${colors[idx % colors.length]} transition-all first:rounded-l-full last:rounded-r-full`}
                        title={`${sub.subjectName}: ${sub.hours.toFixed(1)}h (${sub.percentage}%)`}
                      />
                    );
                  })}
                </div>

                {/* Subject Legend Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {subjectSplit.map((sub, idx) => {
                    const bgColors = [
                      'bg-emerald-950/80 border-emerald-500/40 text-emerald-200',
                      'bg-sky-950/80 border-sky-500/40 text-sky-200',
                      'bg-indigo-950/80 border-indigo-500/40 text-indigo-200',
                      'bg-amber-950/80 border-amber-500/40 text-amber-200',
                      'bg-purple-950/80 border-purple-500/40 text-purple-200',
                      'bg-teal-950/80 border-teal-500/40 text-teal-200'
                    ];
                    return (
                      <div
                        key={sub.subjectName}
                        className={`px-2.5 py-1 rounded-xl text-xs border font-medium flex items-center gap-2 ${bgColors[idx % bgColors.length]}`}
                      >
                        <span className="font-extrabold">{sub.subjectName}:</span>
                        <span className="font-mono font-bold text-white">{sub.hours.toFixed(1)}h</span>
                        <span className="text-[10px] opacity-75 font-mono">({sub.percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Specification 2 & 3.3: Hour-by-Hour Chronological Time-Block Ledger */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Hour-by-Hour (1-1 Hr) Chronological Time-Block Ledger</span>
              </h4>
              <span className="text-[11px] text-slate-400 font-semibold">
                {hourlyMatrix.length} Hourly Intervals
              </span>
            </div>

            <div className="space-y-2">
              {hourlyMatrix.map((block) => {
                let badgeClass = '';
                let badgeText = '';
                let badgeIcon = null;

                if (block.status === 'COMPLETED') {
                  badgeClass = 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
                  badgeText = '1.0h Completed';
                  badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
                } else if (block.status === 'PARTIAL') {
                  badgeClass = 'bg-amber-950/90 border-amber-500/60 text-amber-300';
                  badgeText = `Partial (${block.studiedHours.toFixed(1)}h)`;
                  badgeIcon = <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
                } else if (block.status === 'GAP') {
                  badgeClass = 'bg-rose-950/80 border-rose-500/50 text-rose-300 opacity-90';
                  badgeText = '🔴 0.0h | Unrecorded / Lapsed Gap';
                  badgeIcon = <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
                } else if (block.status === 'BREAK') {
                  badgeClass = 'bg-slate-900 border-slate-700 text-slate-400';
                  badgeText = '☕ Scheduled Rest / Break';
                } else {
                  badgeClass = 'bg-slate-950 border-slate-800 text-slate-400';
                  badgeText = '⏳ Scheduled (Pending)';
                }

                let sourceTag = null;
                if (block.status === 'COMPLETED' || block.status === 'PARTIAL') {
                  if (block.sourceType === 'POMODORO') sourceTag = '⚡ POMODORO';
                  else if (block.sourceType === 'EXAM_SIMULATOR') sourceTag = '📋 EXAM SIMULATOR';
                  else if (block.sourceType === 'MANUAL') sourceTag = '✎ MANUAL LOG';
                  else sourceTag = '⏰ TIME TABLE SLOT';
                }

                return (
                  <div 
                    key={block.hour}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      block.status === 'GAP' 
                        ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/50' 
                        : block.status === 'COMPLETED'
                        ? 'bg-slate-950/90 border-emerald-500/30 hover:border-emerald-500/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Left: Time Window & Status */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="font-mono font-bold text-xs text-slate-200 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 w-36 text-center">
                        {block.timeWindow}
                      </div>

                      <div className={`px-2.5 py-1 rounded-xl text-xs font-mono font-extrabold border flex items-center gap-1.5 ${badgeClass}`}>
                        {badgeIcon}
                        <span>{badgeText}</span>
                      </div>
                    </div>

                    {/* Center: Subject & Specific Topic */}
                    <div className="flex-1 min-w-0">
                      {block.status === 'GAP' ? (
                        <p className="text-xs font-semibold text-rose-300 italic flex items-center gap-1">
                          <span>[ Unrecorded / Lapsed Time Gap ]</span>
                          <span className="text-[10px] text-rose-400/80 font-normal">
                            No study log recorded during this hour
                          </span>
                        </p>
                      ) : (
                        <div className="space-y-0.5 truncate">
                          <h5 className="text-xs font-extrabold text-slate-100 truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                            <span className="truncate">{block.subject || 'CA Final Study'}</span>
                          </h5>
                          <p className="text-[11px] font-medium text-slate-400 truncate">
                            {block.topic}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Source Tag */}
                    {sourceTag && (
                      <div className="shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-950/90 border border-indigo-400/50 text-indigo-300 font-mono text-[10px] font-black tracking-wider uppercase">
                          {sourceTag}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </main>

        {/* Layer 3: Sticky Action Footer */}
        <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-between gap-4 sticky bottom-0 z-20 bg-[#0A121E]/90">
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">ICAI Audit Ledger • Real-time Session Accounting</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700"
            >
              Close
            </button>

            <button
              onClick={() => {
                onClose();
                if (onLaunchNextSlot) {
                  onLaunchNextSlot();
                } else {
                  setActiveTab('timetable');
                }
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current text-emerald-200" />
              <span>⚡ Launch Next Study Slot</span>
            </button>
          </div>
        </footer>

      </div>
    </div>,
    document.body
  );
};
