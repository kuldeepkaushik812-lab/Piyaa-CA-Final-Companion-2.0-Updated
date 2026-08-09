import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../store';
import { CASubject } from '../types';
import { 
  Zap, 
  Target, 
  Clock, 
  Flame, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  ShieldAlert,
  BookOpen,
  X
} from 'lucide-react';
import { getISTDate, getISTYMD, addDaysToYMD } from '../lib/dateUtils';

interface ReadinessDashboardHubProps {
  subjects: CASubject[];
  isStrictMode?: boolean;
}

const LiveDateTimeButton = () => {
  const [timeStr, setTimeStr] = useState('');
  const [dateStr, setDateStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      const localTime = d.getTime();
      const localOffset = d.getTimezoneOffset() * 60000;
      const utc = localTime + localOffset;
      const offset = 5.5; // IST
      const bombay = utc + (3600000 * offset);
      const nd = new Date(bombay);
      
      const tStr = nd.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dStr = nd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); // e.g., 10 Aug, 2026
      setTimeStr(tStr);
      setDateStr(dStr);
    };
    updateTime();
    const iv = setInterval(updateTime, 1000);
    return () => clearInterval(iv);
  }, []);
  
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 z-10 relative">
      <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 transition-all text-xs font-bold text-slate-200 shadow-sm cursor-default">
        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        {dateStr}
      </button>
      <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 transition-all font-mono text-xs font-black text-emerald-300 tracking-wide shadow-sm cursor-default">
        <Clock className="w-3.5 h-3.5 text-emerald-400" />
        {timeStr}
      </button>
    </div>
  );
};

export const ReadinessDashboardHub: React.FC<ReadinessDashboardHubProps> = ({ subjects, isStrictMode }) => {
  const store = useStore();
  const { studyLogs, targetStudyHours } = store;

  type BreakdownFilter = 
    | { type: 'REV'; group: 1 | 2; revNum: 1 | 2 | 3 }
    | { type: 'MTP' }
    | { type: 'PYQ' }
    | null;

  const [selectedBreakdown, setSelectedBreakdown] = useState<BreakdownFilter>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedBreakdown) {
        setSelectedBreakdown(null);
      }
    };
    if (selectedBreakdown) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedBreakdown]);

  // 1. Calculate Exam Countdown
  const examCountdown = useMemo(() => {
    const examDateStr = localStorage.getItem('ca_exam_date') || '2026-11-01';
    const [year, month, day] = examDateStr.split('-').map(Number);
    const targetTime = new Date(year, month - 1, day).getTime();
    
    const todayYmd = getISTYMD();
    const [cy, cm, cd] = todayYmd.split('-').map(Number);
    const nowTime = new Date(cy, cm - 1, cd).getTime();

    const diffDays = Math.max(0, Math.ceil((targetTime - nowTime) / (1000 * 60 * 60 * 24)));
    return { examDateStr, diffDays };
  }, []);

  // 2. Idea 1: Exam Readiness Score (Weighted Index)
  const readinessIndex = useMemo(() => {
    if (!subjects || subjects.length === 0) {
      return { 
        totalReadiness: 0, group1: 0, group2: 0, details: [],
        g1TotalTopics: 0, g1Rev1Count: 0, g1Rev2Count: 0, g1Rev3Count: 0, g1Rev1Pct: 0, g1Rev2Pct: 0, g1Rev3Pct: 0,
        g2TotalTopics: 0, g2Rev1Count: 0, g2Rev2Count: 0, g2Rev3Count: 0, g2Rev1Pct: 0, g2Rev2Pct: 0, g2Rev3Pct: 0,
        totalMtps: 0, completedMtps: 0, mtpPct: 0,
        totalPyqs: 0, completedPyqs: 0, pyqPct: 0,
        mtpPyqAvgPct: 0
      };
    }

    let totalWeightSum = 0;
    let g1WeightSum = 0;
    let g2WeightSum = 0;
    let g1Count = 0;
    let g2Count = 0;

    let g1TotalTopics = 0;
    let g1Rev1Count = 0;
    let g1Rev2Count = 0;
    let g1Rev3Count = 0;

    let g2TotalTopics = 0;
    let g2Rev1Count = 0;
    let g2Rev2Count = 0;
    let g2Rev3Count = 0;

    let totalMtps = 0;
    let completedMtps = 0;
    let totalPyqs = 0;
    let completedPyqs = 0;

    const subjectDetails = subjects.map((subj) => {
      const topics = subj.topics || [];
      const tot = topics.length || 0;

      const rev1Done = topics.filter(t => t.rev1).length;
      const rev2Done = topics.filter(t => t.rev2).length;
      const rev3Done = topics.filter(t => t.rev3).length;

      const rev1Pct = tot > 0 ? (rev1Done / tot) * 100 : 0;
      const rev2Pct = tot > 0 ? (rev2Done / tot) * 100 : 0;
      const rev3Pct = tot > 0 ? (rev3Done / tot) * 100 : 0;

      if (subj.group === 1) {
        g1TotalTopics += tot;
        g1Rev1Count += rev1Done;
        g1Rev2Count += rev2Done;
        g1Rev3Count += rev3Done;
      } else {
        g2TotalTopics += tot;
        g2Rev1Count += rev1Done;
        g2Rev2Count += rev2Done;
        g2Rev3Count += rev3Done;
      }

      if (subj.mtpProgress) {
        subj.mtpProgress.forEach((m) => {
          totalMtps++;
          if (m.completed) completedMtps++;
        });
      }

      if (subj.pyqProgress) {
        subj.pyqProgress.forEach((p) => {
          totalPyqs++;
          if (p.completed) completedPyqs++;
        });
      }

      const mtp = subj.mtpProgress && subj.mtpProgress.length > 0 
        ? (subj.mtpProgress.filter(m => m.completed).length / subj.mtpProgress.length) * 100 
        : 0;

      const pyq = subj.pyqProgress && subj.pyqProgress.length > 0 
        ? (subj.pyqProgress.filter(p => p.completed).length / subj.pyqProgress.length) * 100 
        : 0;

      // Weights: Rev 1 (40%), Rev 2 (25%), Rev 3 (15%), MTP (10%), PYQ (10%)
      const score = Math.round(
        (rev1Pct * 0.40) +
        (rev2Pct * 0.25) +
        (rev3Pct * 0.15) +
        (mtp * 0.10) +
        (pyq * 0.10)
      );

      totalWeightSum += score;
      if (subj.group === 1) {
        g1WeightSum += score;
        g1Count++;
      } else {
        g2WeightSum += score;
        g2Count++;
      }

      return {
        id: subj.id,
        name: subj.name,
        group: subj.group,
        score,
        rev1: Math.round(rev1Pct),
        rev2: Math.round(rev2Pct)
      };
    });

    const totalReadiness = Math.round(totalWeightSum / (subjects.length || 1));
    const group1 = g1Count > 0 ? Math.round(g1WeightSum / g1Count) : 0;
    const group2 = g2Count > 0 ? Math.round(g2WeightSum / g2Count) : 0;

    const g1Rev1Pct = g1TotalTopics > 0 ? Math.round((g1Rev1Count / g1TotalTopics) * 100) : 0;
    const g1Rev2Pct = g1TotalTopics > 0 ? Math.round((g1Rev2Count / g1TotalTopics) * 100) : 0;
    const g1Rev3Pct = g1TotalTopics > 0 ? Math.round((g1Rev3Count / g1TotalTopics) * 100) : 0;

    const g2Rev1Pct = g2TotalTopics > 0 ? Math.round((g2Rev1Count / g2TotalTopics) * 100) : 0;
    const g2Rev2Pct = g2TotalTopics > 0 ? Math.round((g2Rev2Count / g2TotalTopics) * 100) : 0;
    const g2Rev3Pct = g2TotalTopics > 0 ? Math.round((g2Rev3Count / g2TotalTopics) * 100) : 0;

    const mtpPct = totalMtps > 0 ? Math.round((completedMtps / totalMtps) * 100) : 0;
    const pyqPct = totalPyqs > 0 ? Math.round((completedPyqs / totalPyqs) * 100) : 0;
    const mtpPyqAvgPct = (totalMtps + totalPyqs) > 0 ? Math.round(((completedMtps + completedPyqs) / (totalMtps + totalPyqs)) * 100) : 0;

    return { 
      totalReadiness, 
      group1, 
      group2, 
      details: subjectDetails,
      g1TotalTopics, g1Rev1Count, g1Rev2Count, g1Rev3Count, g1Rev1Pct, g1Rev2Pct, g1Rev3Pct,
      g2TotalTopics, g2Rev1Count, g2Rev2Count, g2Rev3Count, g2Rev1Pct, g2Rev2Pct, g2Rev3Pct,
      totalMtps, completedMtps, mtpPct,
      totalPyqs, completedPyqs, pyqPct,
      mtpPyqAvgPct
    };
  }, [subjects]);

  // 3. Idea 3: Weak Spots & Strongholds Radar
  const radarAnalysis = useMemo(() => {
    const sorted = [...readinessIndex.details].sort((a, b) => a.score - b.score);
    const weakSpots = sorted.filter(s => s.score < 50).slice(0, 2);
    const strongholds = sorted.filter(s => s.score >= 50).reverse().slice(0, 2);
    
    let recommendation = "";
    if (weakSpots.length > 0) {
      recommendation = `Focus on ${weakSpots[0].name} (Readiness: ${weakSpots[0].score}%) to boost Group ${weakSpots[0].group} score.`;
    } else if (readinessIndex.totalReadiness < 80) {
      recommendation = `Great balance! Step up Rev 2 & PYQ papers to cross 80% readiness.`;
    } else {
      recommendation = `Outstanding preparation! Maintain mock test practice daily.`;
    }

    return { weakSpots, strongholds, recommendation };
  }, [readinessIndex]);

  // 4. Idea 4: Weekly Consistency Matrix (Mon - Sun) & Momentum
  const consistencyStats = useMemo(() => {
    const todayYmd = getISTYMD();
    const [cy, cm, cd] = todayYmd.split('-').map(Number);
    const todayObj = new Date(cy, cm - 1, cd);
    const dayOfWeek = todayObj.getDay(); // 0 = Sun, 1 = Mon...
    const distToMon = (dayOfWeek + 6) % 7; // distance back to Monday
    const mondayYmd = addDaysToYMD(todayYmd, -distToMon);

    const weekDaysList = [];
    let total7dHours = 0;
    let daysMetTarget = 0;

    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysToYMD(mondayYmd, i);
      const dayLogs = studyLogs.filter(l => l.date === dateStr);
      const hours = dayLogs.reduce((sum, l) => sum + l.hours, 0);
      
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const formattedDate = `${d}/${m}`;

      const target = targetStudyHours || 8;
      const isMet = hours >= target;
      if (isMet) daysMetTarget++;
      total7dHours += hours;

      weekDaysList.push({
        dateStr,
        dayName,
        formattedDate,
        hours,
        target,
        isMet,
        isToday: dateStr === todayYmd,
        isFuture: dateStr > todayYmd
      });
    }

    // Calculate overall streak from studyLogs
    const logDatesSet = new Set(studyLogs.filter(l => l.hours > 0).map(l => l.date));
    let activeStreak = 0;
    let checkDate = todayYmd;
    if (!logDatesSet.has(checkDate)) {
      // Check if yesterday had logs
      checkDate = addDaysToYMD(todayYmd, -1);
    }
    while (logDatesSet.has(checkDate)) {
      activeStreak++;
      checkDate = addDaysToYMD(checkDate, -1);
    }

    const daysElapsed = distToMon + 1;
    const avg7d = Math.round((total7dHours / daysElapsed) * 10) / 10;
    const targetPace = targetStudyHours || 8;
    
    let paceStatus = "⚡ On Track";
    let paceColor = "text-[#2dd4bf] border-[#2dd4bf]/40 bg-[#2dd4bf]/10";
    if (avg7d >= targetPace * 1.1) {
      paceStatus = "🔥 High Momentum";
      paceColor = "text-amber-400 border-amber-400/40 bg-amber-400/10";
    } else if (avg7d < targetPace * 0.7) {
      paceStatus = "⚠️ Pace Boost Needed";
      paceColor = "text-rose-400 border-rose-400/40 bg-rose-400/10";
    }

    return {
      last7Days: weekDaysList,
      activeStreak,
      total7dHours,
      avg7d,
      daysMetTarget,
      paceStatus,
      paceColor
    };
  }, [studyLogs, targetStudyHours]);

  // 5. Dynamic Required Pace vs Current Pace Calculator
  const paceCalculator = useMemo(() => {
    const daysLeft = Math.max(1, examCountdown.diffDays);
    
    let pendingR1Chapters = 0;
    let pendingR2Chapters = 0;

    (subjects || []).forEach((subject) => {
      const topics = subject.topics || [];
      topics.forEach((t) => {
        if (!t.rev1) pendingR1Chapters++;
        if (!t.rev2) pendingR2Chapters++;
      });
    });

    // Standard estimate: R1 chapter = 3.0 hrs, R2 chapter = 1.5 hrs
    const totalR1Hours = pendingR1Chapters * 3.0;
    const totalR2Hours = pendingR2Chapters * 1.5;
    const remainingTotalTargetHours = totalR1Hours + totalR2Hours;

    const requiredDailyHours = Math.round((remainingTotalTargetHours / daysLeft) * 10) / 10;
    const currentPace = consistencyStats.avg7d;
    const diff = Math.round((currentPace - requiredDailyHours) * 10) / 10;
    const isDeficit = diff < 0;
    const deficitText = isDeficit 
      ? `-${Math.abs(diff).toFixed(1)}h deficit` 
      : `+${diff.toFixed(1)}h surplus`;

    return {
      pendingR1Chapters,
      pendingR2Chapters,
      remainingTotalTargetHours,
      requiredDailyHours,
      currentPace,
      diff,
      isDeficit,
      deficitText
    };
  }, [subjects, examCountdown.diffDays, consistencyStats.avg7d]);

  return (
    <div className="space-y-4">
      {/* Top Banner: Exam Readiness Index + Countdown + Daily Velocity */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-cyan-950/40 p-5 md:p-6 shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <LiveDateTimeButton />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-center relative z-10">
          
          {/* Readiness Dial Score */}
          <div className="xl:col-span-3 lg:col-span-4 md:col-span-12 flex items-center gap-4 xl:border-b-0 xl:border-r border-white/10 pb-4 xl:pb-0 xl:pr-5">
            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-teal-500/10 border border-cyan-400/40 shadow-[0_0_20px_rgba(45,212,191,0.25)] shrink-0">
              <div className="text-center">
                <span className="text-2xl font-black text-cyan-300 font-mono tracking-tight">{readinessIndex.totalReadiness}%</span>
                <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400">Ready</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Exam Readiness Index</span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">CA Final Preparation</h3>
              <p className="text-xs text-slate-300 mt-0.5">Weighted across 3 Revisions, MTPs & PYQs</p>
            </div>
          </div>

          {/* Group 1, Group 2 3-Revisions & MTP/PYQ Summary Cards */}
          <div className="xl:col-span-6 lg:col-span-8 md:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-2.5 xl:border-r border-white/10 xl:pr-5">
            
            {/* Group 1 Revisions Card */}
            <div className="bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>Group 1 Revisions</span>
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-cyan-300">{readinessIndex.g1Rev1Pct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">{readinessIndex.g1Rev1Count}/{readinessIndex.g1TotalTopics} R1</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-2">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-700" style={{ width: `${readinessIndex.g1Rev1Pct}%` }}></div>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5 text-[9px] font-mono text-center">
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 1, revNum: 1 })}
                  className="bg-white/[0.04] hover:bg-cyan-500/20 hover:border-cyan-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 1 Revision 1 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-cyan-200 font-sans">R1</span>
                  <span className="text-cyan-300 font-bold">{readinessIndex.g1Rev1Pct}%</span>
                </button>
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 1, revNum: 2 })}
                  className="bg-white/[0.04] hover:bg-amber-500/20 hover:border-amber-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 1 Revision 2 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-amber-200 font-sans">R2</span>
                  <span className="text-amber-300 font-bold">{readinessIndex.g1Rev2Pct}%</span>
                </button>
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 1, revNum: 3 })}
                  className="bg-white/[0.04] hover:bg-teal-500/20 hover:border-teal-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 1 Revision 3 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-teal-200 font-sans">R3</span>
                  <span className="text-teal-300 font-bold">{readinessIndex.g1Rev3Pct}%</span>
                </button>
              </div>
            </div>

            {/* Group 2 Revisions Card */}
            <div className="bg-white/[0.03] border border-white/10 hover:border-teal-500/30 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>Group 2 Revisions</span>
                <Layers className="w-3.5 h-3.5 text-teal-400" />
              </div>
              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-teal-300">{readinessIndex.g2Rev1Pct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">{readinessIndex.g2Rev1Count}/{readinessIndex.g2TotalTopics} R1</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-2">
                <div className="bg-teal-400 h-full rounded-full transition-all duration-700" style={{ width: `${readinessIndex.g2Rev1Pct}%` }}></div>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5 text-[9px] font-mono text-center">
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 2, revNum: 1 })}
                  className="bg-white/[0.04] hover:bg-cyan-500/20 hover:border-cyan-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 2 Revision 1 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-cyan-200 font-sans">R1</span>
                  <span className="text-cyan-300 font-bold">{readinessIndex.g2Rev1Pct}%</span>
                </button>
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 2, revNum: 2 })}
                  className="bg-white/[0.04] hover:bg-amber-500/20 hover:border-amber-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 2 Revision 2 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-amber-200 font-sans">R2</span>
                  <span className="text-amber-300 font-bold">{readinessIndex.g2Rev2Pct}%</span>
                </button>
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'REV', group: 2, revNum: 3 })}
                  className="bg-white/[0.04] hover:bg-teal-500/20 hover:border-teal-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for Group 2 Revision 3 breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-teal-200 font-sans">R3</span>
                  <span className="text-teal-300 font-bold">{readinessIndex.g2Rev3Pct}%</span>
                </button>
              </div>
            </div>

            {/* MTP & PYQ Summary Card */}
            <div className="bg-white/[0.03] border border-white/10 hover:border-amber-500/30 rounded-xl p-3 flex flex-col justify-between transition-all">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                <span>MTP & PYQ Papers</span>
                <Award className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="my-1.5 flex items-baseline justify-between">
                <span className="text-xl font-black font-mono text-amber-300">{readinessIndex.mtpPyqAvgPct}%</span>
                <span className="text-[10px] text-slate-400 font-medium">{readinessIndex.completedMtps + readinessIndex.completedPyqs}/{readinessIndex.totalMtps + readinessIndex.totalPyqs} Solved</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-2">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-700" style={{ width: `${readinessIndex.mtpPyqAvgPct}%` }}></div>
              </div>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-white/5 text-[9px] font-mono text-center">
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'MTP' })}
                  className="bg-white/[0.04] hover:bg-cyan-500/20 hover:border-cyan-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for MTP Series breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-cyan-200 font-sans">MTP Series</span>
                  <span className="text-cyan-300 font-bold">{readinessIndex.completedMtps}/{readinessIndex.totalMtps} ({readinessIndex.mtpPct}%)</span>
                </button>
                <button 
                  onClick={() => setSelectedBreakdown({ type: 'PYQ' })}
                  className="bg-white/[0.04] hover:bg-teal-500/20 hover:border-teal-400/50 p-1 rounded border border-white/5 transition-all cursor-pointer group/btn"
                  title="Click for PYQ Papers breakdown"
                >
                  <span className="block text-[8px] text-slate-400 group-hover/btn:text-teal-200 font-sans">PYQ Papers</span>
                  <span className="text-teal-300 font-bold">{readinessIndex.completedPyqs}/{readinessIndex.totalPyqs} ({readinessIndex.pyqPct}%)</span>
                </button>
              </div>
            </div>

          </div>

          {/* Exam Countdown & Pace Meter */}
          <div className="xl:col-span-3 lg:col-span-12 md:col-span-12 flex flex-col justify-center space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">Exam Target</span>
              </div>
              <span className="text-xs font-extrabold font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-500/40 px-2.5 py-1 rounded-lg shadow-sm">
                {examCountdown.diffDays} Days Left
              </span>
            </div>

            {/* Daily Pace Comparison Meter */}
            <div className="bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 rounded-xl p-2.5 space-y-2 transition-all">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold">Target Pace Calculator</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${consistencyStats.paceColor}`}>
                  {consistencyStats.paceStatus}
                </span>
              </div>

              {/* Mathematical Comparison Badge */}
              <div className={`text-center py-1.5 px-2.5 rounded-lg font-mono text-[10px] font-black border tracking-tight shadow-md transition-all ${
                paceCalculator.isDeficit 
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 shadow-rose-950/20' 
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-emerald-950/20'
              }`}>
                Req. Pace: {paceCalculator.requiredDailyHours} hrs/day | Current: {paceCalculator.currentPace} hrs/day ({paceCalculator.deficitText})
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Grid Row 2: Weak Spot Radar & 7-Day Consistency Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* Idea 3: Weak Spot & Focus Recommendation Radar */}
        <div className="md:col-span-5 glass-card p-4 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Focus & Revision Radar</h4>
                  <p className="text-[11px] text-slate-400">Subject readiness alerts</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {radarAnalysis.weakSpots.length > 0 ? (
                radarAnalysis.weakSpots.map((spot) => (
                  <div key={spot.id} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-semibold text-rose-200 block">{spot.name}</span>
                        <span className="text-[10px] text-slate-400">Group {spot.group} • Needs Read/Rev</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-500/30">
                      {spot.score}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>All subjects are progressing above 50% readiness threshold!</span>
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
            <p className="text-cyan-200 leading-snug text-[11px]">
              <span className="font-bold text-cyan-300">AI Strategy:</span> {radarAnalysis.recommendation}
            </p>
          </div>
        </div>

        {/* Idea 4: 7-Day Consistency Matrix & Streak Tracker */}
        <div className="md:col-span-7 glass-card p-4 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Weekly Consistency Matrix (Mon - Sun)</h4>
                <p className="text-[11px] text-slate-400">Daily study hours vs target ({targetStudyHours || 8}h)</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-300 text-xs font-bold font-mono">
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{consistencyStats.activeStreak} Day Streak</span>
            </div>
          </div>

          {/* 7 Day Blocks */}
          <div className="grid grid-cols-7 gap-1.5 py-1">
            {consistencyStats.last7Days.map((day) => (
              <div 
                key={day.dateStr} 
                className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center transition-all ${
                  day.isToday 
                    ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_12px_rgba(45,212,191,0.2)]' 
                    : day.isMet 
                    ? 'border-emerald-500/40 bg-emerald-500/10' 
                    : day.hours > 0 
                    ? 'border-white/10 bg-white/[0.04]' 
                    : 'border-white/5 bg-white/[0.01] opacity-60'
                }`}
              >
                <span className="text-[10px] font-semibold text-slate-400 block">{day.dayName}</span>
                <span className="text-[9px] text-slate-500 block mb-1">{day.formattedDate}</span>
                
                <div className={`font-mono font-bold text-xs ${day.isMet ? 'text-emerald-300' : day.hours > 0 ? 'text-cyan-300' : 'text-slate-500'}`}>
                  {day.hours}h
                </div>

                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full ${day.isMet ? 'bg-emerald-400' : 'bg-cyan-400'}`} 
                    style={{ width: `${Math.min(100, (day.hours / day.target) * 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
            <span>Weekly Total: <strong className="text-white font-mono">{consistencyStats.total7dHours} hrs</strong></span>
            <span>Targets Met: <strong className="text-emerald-400 font-mono">{consistencyStats.daysMetTarget} / 7 days</strong></span>
          </div>
        </div>

      </div>

      {/* Interactive Breakdown Modal */}
      {selectedBreakdown && (
        <div className="fixed inset-0 z-[9999] w-screen h-screen max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-cyan-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200">
          <div className="w-full h-full flex flex-col justify-between">
            
            {/* Modal Header */}
            <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-inner">
                  <Layers className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {selectedBreakdown.type === 'REV' && `Group ${selectedBreakdown.group} - Revision ${selectedBreakdown.revNum} (R${selectedBreakdown.revNum}) Detailed Breakdown`}
                    {selectedBreakdown.type === 'MTP' && `MTP Mock Test Papers Detailed Breakdown`}
                    {selectedBreakdown.type === 'PYQ' && `Past Year Question Papers (PYQ) Breakdown`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                    Subject-wise topic progress and completion matrix
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 transition-all font-mono text-sm cursor-pointer flex items-center gap-2 text-slate-300"
              >
                <span>✕ Close (ESC)</span>
              </button>
            </header>

            {/* Modal Body */}
            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 overflow-y-auto space-y-6">
              {selectedBreakdown.type === 'REV' && (() => {
                const groupSubjects = subjects.filter(s => s.group === selectedBreakdown.group);
                const revKey = selectedBreakdown.revNum === 1 ? 'rev1' : selectedBreakdown.revNum === 2 ? 'rev2' : 'rev3';

                return (
                  <div className="space-y-3">
                    {groupSubjects.map((subject) => {
                      const totalTopics = subject.topics?.length || 0;
                      const completedRevTopics = subject.topics?.filter(t => t[revKey]).length || 0;
                      const pct = totalTopics > 0 ? Math.round((completedRevTopics / totalTopics) * 100) : 0;

                      return (
                        <div 
                          key={subject.id} 
                          onClick={() => {
                            store.setCurrentSubject(subject.id);
                            store.setStatusFilter(selectedBreakdown.revNum === 1 ? 'PENDING_REV1' : selectedBreakdown.revNum === 2 ? 'PENDING_REV2' : 'PENDING_REV3');
                            store.setActiveTab('subjects');
                            setSelectedBreakdown(null);
                          }}
                          className="bg-white/[0.03] hover:bg-cyan-950/30 border border-white/10 hover:border-cyan-500/40 rounded-xl p-3.5 space-y-2.5 transition-all cursor-pointer group/subj"
                          title={`Click to view checklist for ${subject.name}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-cyan-300 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30">
                                {subject.code}
                              </span>
                              <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                                {subject.name}
                                <span className="text-[10px] text-cyan-400 font-normal opacity-0 group-hover/subj:opacity-100 transition-all ml-1.5 flex items-center gap-0.5">
                                  (Open Checklist 🚀)
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className="text-slate-300 font-bold">{completedRevTopics}/{totalTopics} Topics</span>
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                pct === 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                pct > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                'bg-slate-800 text-slate-400'
                              }`}>
                                {pct}% Done
                              </span>
                            </div>
                          </div>

                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                selectedBreakdown.revNum === 1 ? 'bg-cyan-400' : selectedBreakdown.revNum === 2 ? 'bg-amber-400' : 'bg-teal-400'
                              }`} 
                              style={{ width: `${pct}%` }} 
                            />
                          </div>

                          {/* Chapter List */}
                          <div className="pt-2 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                            {subject.topics?.map((topic) => {
                              const isDone = topic[revKey];
                              return (
                                <div 
                                  key={topic.id} 
                                  className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between text-[11px] ${
                                    isDone 
                                      ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200 font-medium' 
                                      : 'bg-slate-900/60 border-white/5 text-slate-400'
                                  }`}
                                >
                                  <span className="truncate pr-2">{topic.title}</span>
                                  {isDone ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {selectedBreakdown.type === 'MTP' && (
                <div className="space-y-3">
                  {subjects.map((subject) => {
                    const mtpList = subject.mtpProgress || [];
                    const completedCount = mtpList.filter(m => m.completed).length;
                    const totalCount = mtpList.length;
                    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <div 
                        key={subject.id} 
                        onClick={() => {
                          store.setCurrentSubject(subject.id);
                          store.setActiveTab('subjects-hub');
                          setSelectedBreakdown(null);
                        }}
                        className="bg-white/[0.03] hover:bg-amber-950/35 border border-white/10 hover:border-amber-500/40 rounded-xl p-3.5 space-y-2.5 transition-all cursor-pointer group/mtp"
                        title={`Click to view Subjects Hub for ${subject.name}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-amber-300 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/30">
                              {subject.code}
                            </span>
                            <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                              {subject.name}
                              <span className="text-[10px] text-amber-400 font-normal opacity-0 group-hover/mtp:opacity-100 transition-all ml-1.5 flex items-center gap-0.5">
                                (Open Subjects Hub 🚀)
                              </span>
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-amber-300">
                            {completedCount}/{totalCount} Papers Solved ({pct}%)
                          </span>
                        </div>

                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                          {mtpList.map((mtp) => (
                            <div 
                              key={mtp.id}
                              className={`p-2 rounded-lg border flex items-center justify-between text-[11px] ${
                                mtp.completed 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' 
                                  : 'bg-slate-900/60 border-white/5 text-slate-400'
                              }`}
                            >
                              <div>
                                <span className="font-bold">{mtp.title}</span>
                                {mtp.score !== undefined && mtp.score > 0 && (
                                  <span className="block text-[10px] text-amber-300 font-mono">Score: {mtp.score}/{mtp.totalScore || 100}</span>
                                )}
                              </div>
                              {mtp.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Pending</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedBreakdown.type === 'PYQ' && (
                <div className="space-y-3">
                  {subjects.map((subject) => {
                    const pyqList = subject.pyqProgress || [];
                    const completedCount = pyqList.filter(p => p.completed).length;
                    const totalCount = pyqList.length;
                    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

                    return (
                      <div 
                        key={subject.id} 
                        onClick={() => {
                          store.setCurrentSubject(subject.id);
                          store.setActiveTab('subjects-hub');
                          setSelectedBreakdown(null);
                        }}
                        className="bg-white/[0.03] hover:bg-teal-950/35 border border-white/10 hover:border-teal-500/40 rounded-xl p-3.5 space-y-2.5 transition-all cursor-pointer group/pyq"
                        title={`Click to view Subjects Hub for ${subject.name}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-teal-300 px-2 py-0.5 rounded bg-teal-950/60 border border-teal-500/30">
                              {subject.code}
                            </span>
                            <span className="font-semibold text-sm text-white flex items-center gap-1.5">
                              {subject.name}
                              <span className="text-[10px] text-teal-400 font-normal opacity-0 group-hover/pyq:opacity-100 transition-all ml-1.5 flex items-center gap-0.5">
                                (Open Subjects Hub 🚀)
                              </span>
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-teal-300">
                            {completedCount}/{totalCount} Papers Solved ({pct}%)
                          </span>
                        </div>

                        <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                          <div className="bg-teal-400 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                          {pyqList.map((pyq) => (
                            <div 
                              key={pyq.id}
                              className={`p-2 rounded-lg border flex items-center justify-between text-[11px] ${
                                pyq.completed 
                                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' 
                                  : 'bg-slate-900/60 border-white/5 text-slate-400'
                              }`}
                            >
                              <div>
                                <span className="font-bold">{pyq.title}</span>
                                {pyq.score !== undefined && pyq.score > 0 && (
                                  <span className="block text-[10px] text-teal-300 font-mono">Score: {pyq.score}/{pyq.totalScore || 100}</span>
                                )}
                              </div>
                              {pyq.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Pending</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </main>

            {/* Modal Footer */}
            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-20 bg-[#0A121E]/90">
              <span className="text-xs text-slate-400 text-center sm:text-left">
                Tip: Click any subject above or use the button on the right to navigate directly!
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {selectedBreakdown.type === 'REV' && (
                  <button
                    onClick={() => {
                      const filterVal = selectedBreakdown.revNum === 1 ? 'PENDING_REV1' : selectedBreakdown.revNum === 2 ? 'PENDING_REV2' : 'PENDING_REV3';
                      store.setStatusFilter(filterVal);
                      store.setActiveTab('subjects');
                      setSelectedBreakdown(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 border border-cyan-400/30"
                  >
                    <span>🎯 Filter Pending R{selectedBreakdown.revNum} in Tracker</span>
                  </button>
                )}
                {(selectedBreakdown.type === 'MTP' || selectedBreakdown.type === 'PYQ') && (
                  <button
                    onClick={() => {
                      store.setActiveTab('subjects-hub');
                      setSelectedBreakdown(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95 border border-amber-400/30"
                  >
                    <span>🎯 Open Subjects Hub & Analytics</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedBreakdown(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer border border-white/10"
                >
                  Close Breakdown
                </button>
              </div>
            </footer>

          </div>
        </div>
      )}
    </div>
  );
};
