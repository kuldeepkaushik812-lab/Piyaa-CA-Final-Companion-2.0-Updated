import React, { useMemo } from 'react';
import { useStore } from '../store';
import { Zap, TrendingUp, TrendingDown, Target, Clock } from 'lucide-react';
import { getISTDate, getISTYMD, addDaysToYMD } from '../lib/dateUtils';

export const PaceForecastBanner: React.FC<{ isStrictMode?: boolean }> = ({ isStrictMode }) => {
  const store = useStore();
  const subjects = store.subjects;
  const studyLogs = store.studyLogs;

  const {
    totalChapters,
    completedChapters,
    totalLoggedHours,
    avgHoursPerDay7d,
    daysUntilExam,
    estimatedDaysRemaining,
    onTrack,
    targetHoursPerDayNeeded
  } = useMemo(() => {
    const examDateStr = localStorage.getItem("ca_exam_date") || "2024-05-01";
    const [year, month, day] = examDateStr.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day).getTime();
    const now = getISTDate();
    const todayStr = getISTYMD(now);
    const nowTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    let diff = Math.ceil((targetDate - nowTime) / (1000 * 60 * 60 * 24));
    if (diff < 0) diff = 0;

    let totalChap = 0;
    let completedChap = 0;
    subjects.forEach(s => {
      totalChap += s.topics.length;
      completedChap += s.topics.filter(t => t.completed).length; // First read
    });

    const totalHours = studyLogs.reduce((acc, log) => acc + log.hours, 0);
    
    // Last 7 days avg hours
    const sevenDaysAgo = addDaysToYMD(todayStr, -7);
    const logs7d = studyLogs.filter(log => log.date >= sevenDaysAgo && log.date <= todayStr);
    const hours7d = logs7d.reduce((acc, log) => acc + log.hours, 0);
    const avgHrs7d = hours7d / 7;

    // Chapters per hour (Velocity)
    const chapPerHour = totalHours > 0 ? (completedChap / totalHours) : 0;
    
    // Remaining chapters
    const remainingChap = totalChap - completedChap;

    // Estimated hours needed
    // Default to 4 hours per chapter if no data yet
    const estimatedHoursNeeded = remainingChap / (chapPerHour > 0 ? chapPerHour : 0.25);

    // Estimated days remaining based on current 7d pace
    // If pace is 0, assume they need to do it at targetStudyHours per day
    const effectivePace = avgHrs7d > 0 ? avgHrs7d : (store.targetStudyHours || 8);
    const estDays = Math.ceil(estimatedHoursNeeded / effectivePace);

    const targetHoursNeeded = diff > 0 ? (estimatedHoursNeeded / diff) : 0;

    const cleanNumber = (num: number, fallback = 0) => {
      if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
        return fallback;
      }
      return num;
    };

    return {
      totalChapters: cleanNumber(totalChap),
      completedChapters: cleanNumber(completedChap),
      totalLoggedHours: cleanNumber(totalHours),
      avgHoursPerDay7d: cleanNumber(avgHrs7d),
      daysUntilExam: cleanNumber(diff),
      estimatedDaysRemaining: cleanNumber(estDays),
      onTrack: estDays <= diff,
      targetHoursPerDayNeeded: cleanNumber(targetHoursNeeded)
    };
  }, [subjects, studyLogs, store.targetStudyHours]);

  if (totalChapters === 0 || completedChapters === totalChapters) return null;

  const accentColor = isStrictMode ? "text-red-400" : "text-indigo-400";
  const bgAccent = isStrictMode 
    ? "bg-red-950/40 border-red-500/30 shadow-[0_4px_30px_rgba(239,68,68,0.15)]" 
    : "bg-indigo-950/40 border-indigo-500/30 shadow-[0_4px_30px_rgba(16,185,129,0.15)]";
  
  const iconBg = isStrictMode ? "bg-red-500/20" : "bg-indigo-500/20";
  const textTitle = isStrictMode ? "text-red-100" : "text-indigo-100";
  const onTrackColor = isStrictMode ? "text-orange-400" : "text-cyan-400";

  return (
    <div className={`glass-card w-full mb-6 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${bgAccent} transition-all duration-300`}>
      <div className="flex items-start md:items-center gap-3 w-full">
        <div className={`${iconBg} p-2.5 rounded-xl shrink-0`}>
          <Zap className={`w-6 h-6 ${accentColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm md:text-base font-bold ${textTitle} flex items-center gap-2`}>
            Smart Study Pace Forecast
            {onTrack ? (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                On Track
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-500/30">
                Needs Boost
              </span>
            )}
          </h3>
          
          <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-xs md:text-sm text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span>Current Pace: <strong className="font-mono tracking-tight font-semibold text-white">{avgHoursPerDay7d.toFixed(1)}</strong> hrs/day (7d avg)</span>
            </div>
            <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-600"></div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Proj. Rev 1 Finish: <strong className={`font-mono tracking-tight font-semibold ${onTrack ? 'text-indigo-400' : 'text-amber-400'}`}>{estimatedDaysRemaining}</strong> days</span>
            </div>
          </div>
          
          {!onTrack && daysUntilExam > 0 && (
            <p className="mt-2 text-[11px] sm:text-xs text-amber-200/90 flex items-center gap-1.5 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
              <Target className="w-3.5 h-3.5 shrink-0" />
              <span>Target Pace: <strong className="font-mono tracking-tight font-semibold text-amber-400">+{Math.max(0, targetHoursPerDayNeeded - avgHoursPerDay7d).toFixed(1)}</strong> hrs/day needed to comfortably finish before exams.</span>
            </p>
          )}
          {onTrack && daysUntilExam > 0 && (
            <p className="mt-2 text-[11px] sm:text-xs text-indigo-200/90 flex items-center gap-1.5 bg-indigo-950/30 p-2 rounded-lg border border-indigo-500/20">
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Excellent! You'll finish <strong className="font-mono tracking-tight font-semibold text-indigo-400">{daysUntilExam - estimatedDaysRemaining}</strong> days before the exam at this rate.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
