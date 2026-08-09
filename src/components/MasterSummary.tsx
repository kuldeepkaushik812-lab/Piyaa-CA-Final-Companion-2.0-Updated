import React, { useState, useMemo } from 'react';
import { CASubject } from '../types';
import { useStore } from '../store';
import { getISTYMD } from '../lib/dateUtils';
import { ReadinessDashboardHub } from './ReadinessDashboardHub';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell
} from 'recharts';
import { 
  Target, 
  BookOpen, 
  Repeat, 
  Trophy, 
  FileText, 
  ScrollText, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  LayoutGrid,
  Table,
  Layers,
  TrendingUp,
  BarChart2
} from 'lucide-react';

interface MasterSummaryProps {
  isStrictMode?: boolean;
  subjects: CASubject[];
}

interface SubjectInteractiveChartProps {
  subject: CASubject;
  studyLogs: any[];
  studyHistoryLogs: any[];
  timeframe: 'daily' | 'weekly' | 'monthly';
  isGroup1?: boolean;
}

export const SubjectInteractiveChart: React.FC<SubjectInteractiveChartProps> = ({
  subject,
  studyLogs,
  studyHistoryLogs,
  timeframe,
  isGroup1 = true
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const points = useMemo(() => {
    const res: { label: string; value: number; fullLabel: string }[] = [];
    const now = new Date();

    if (timeframe === 'daily') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const ymd = getISTYMD(d);
        const dayLabel = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
        const fullLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let sum = 0;
        (studyLogs || []).forEach(log => {
          if (
            (log.subjectId === subject.id || log.subjectId === subject.code || log.subjectId === subject.name) &&
            log.date === ymd
          ) {
            sum += log.hours || 0;
          }
        });
        (studyHistoryLogs || []).forEach(h => {
          const hYmd = h.dateStr || (h.timestamp ? getISTYMD(new Date(h.timestamp)) : '');
          if (
            (h.subjectId === subject.id || (h.subject && (h.subject.includes(subject.name) || h.subject.includes(subject.code)))) &&
            hYmd === ymd
          ) {
            sum += h.durationHours || 0;
          }
        });
        res.push({ label: dayLabel, value: Math.round(sum * 10) / 10, fullLabel });
      }
    } else if (timeframe === 'weekly') {
      for (let i = 5; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(now.getDate() - (i * 7 + 6));
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date();
        weekEnd.setDate(now.getDate() - (i * 7));
        weekEnd.setHours(23, 59, 59, 999);

        const label = i === 0 ? 'This Wk' : `W-${i}`;
        const fullLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

        let sum = 0;
        (studyLogs || []).forEach(log => {
          if (log.subjectId === subject.id || log.subjectId === subject.code || log.subjectId === subject.name) {
            if (log.date) {
              const logTime = new Date(log.date).getTime();
              if (logTime >= weekStart.getTime() && logTime <= weekEnd.getTime()) {
                sum += log.hours || 0;
              }
            }
          }
        });
        (studyHistoryLogs || []).forEach(h => {
          if (h.subjectId === subject.id || (h.subject && (h.subject.includes(subject.name) || h.subject.includes(subject.code)))) {
            const hMs = h.timestamp || (h.dateStr ? new Date(h.dateStr).getTime() : 0);
            if (hMs >= weekStart.getTime() && hMs <= weekEnd.getTime()) {
              sum += h.durationHours || 0;
            }
          }
        });
        res.push({ label, value: Math.round(sum * 10) / 10, fullLabel });
      }
    } else {
      // monthly
      for (let i = 5; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
        const label = mDate.toLocaleDateString('en-US', { month: 'short' });
        const fullLabel = mDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        let sum = 0;
        (studyLogs || []).forEach(log => {
          if (log.subjectId === subject.id || log.subjectId === subject.code || log.subjectId === subject.name) {
            if (log.date && log.date.startsWith(monthKey)) {
              sum += log.hours || 0;
            }
          }
        });
        (studyHistoryLogs || []).forEach(h => {
          if (h.subjectId === subject.id || (h.subject && (h.subject.includes(subject.name) || h.subject.includes(subject.code)))) {
            const hYmd = h.dateStr || (h.timestamp ? getISTYMD(new Date(h.timestamp)) : '');
            if (hYmd && hYmd.startsWith(monthKey)) {
              sum += h.durationHours || 0;
            }
          }
        });
        res.push({ label, value: Math.round(sum * 10) / 10, fullLabel });
      }
    }
    return res;
  }, [subject.id, subject.code, subject.name, timeframe, studyLogs, studyHistoryLogs]);

  const totalInPeriod = Math.round(points.reduce((acc, p) => acc + p.value, 0) * 10) / 10;
  const maxInPeriod = Math.max(...points.map(p => p.value), 0);

  const primaryColor = isGroup1 ? '#818cf8' : '#22d3ee';
  const secondaryColor = isGroup1 ? '#c084fc' : '#38bdf8';
  const gradId = `areaGrad-${subject.id}-${timeframe}`;

  // Custom tooltip component for Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950/95 border border-slate-700/80 px-2.5 py-1.5 rounded-lg shadow-xl backdrop-blur-md text-[11px] font-sans pointer-events-none z-50">
          <div className="font-bold text-slate-200">{data.fullLabel || data.label}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
            <span className="font-mono font-extrabold text-white">{data.value} hours</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-1.5 w-full">
      {/* Top statistics summary bar */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="capitalize text-slate-300 font-semibold">
            {timeframe === 'daily' ? '7-Day Activity' : timeframe === 'weekly' ? '6-Week Activity' : '6-Month Activity'}
          </span>
          <button
            onClick={() => setChartType(prev => prev === 'area' ? 'bar' : 'area')}
            className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors cursor-pointer"
            title="Switch Chart Style"
          >
            {chartType === 'area' ? '🌊 Wave' : '📊 Bars'}
          </button>
        </div>
        <div className="flex items-center gap-2 font-mono">
          {maxInPeriod > 0 && (
            <span className="text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded font-bold">
              Peak: {maxInPeriod}h
            </span>
          )}
          <span className="font-bold text-slate-200">
            {totalInPeriod > 0 ? `${totalInPeriod}h total` : '0h'}
          </span>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="relative w-full h-16 bg-slate-950/90 rounded-xl border border-slate-800/80 p-1 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart data={points} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={primaryColor}
                strokeWidth={2.5}
                fillOpacity={1}
                fill={`url(#${gradId})`}
                activeDot={{
                  r: 5,
                  fill: '#ffffff',
                  stroke: primaryColor,
                  strokeWidth: 2
                }}
              />
            </AreaChart>
          ) : (
            <BarChart data={points} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <XAxis dataKey="label" hide />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {points.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.value === maxInPeriod && maxInPeriod > 0 ? secondaryColor : primaryColor}
                    fillOpacity={entry.value > 0 ? 0.85 : 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Bottom axis tick labels */}
      <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 px-1">
        <span>{points[0]?.label}</span>
        <span>{points[Math.floor(points.length / 2)]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
};

export const MasterSummary: React.FC<MasterSummaryProps> = ({ subjects, isStrictMode }) => {
  const store = useStore();
  const { studyLogs, studyHistoryLogs, addStudyLog, logStudyActivity } = store;

  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [loggingSubjectId, setLoggingSubjectId] = useState<string | null>(null);
  const [customLogHours, setCustomLogHours] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Trend micro-chart timeframe state
  const [globalSparklineTimeframe, setGlobalSparklineTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [cardTimeframes, setCardTimeframes] = useState<Record<string, 'daily' | 'weekly' | 'monthly'>>({});

  // Requirement 2: Calculate total hours invested for each subject
  const getSubjectInvestedHours = (subject: CASubject) => {
    let total = 0;
    (studyLogs || []).forEach(log => {
      if (log.subjectId === subject.id || log.subjectId === subject.code || log.subjectId === subject.name) {
        total += (log.hours || 0);
      }
    });
    (studyHistoryLogs || []).forEach(h => {
      if (h.subjectId === subject.id || (h.subject && (h.subject.includes(subject.name) || h.subject.includes(subject.code)))) {
        total += (h.durationHours || 0);
      }
    });
    return Math.round(total * 10) / 10;
  };

  // Requirement 3: Memory Decay / Freshness Indicator
  const getSubjectFreshness = (subject: CASubject) => {
    const todayYmd = getISTYMD();
    const todayTime = new Date(todayYmd).getTime();
    let latestTimestamp = 0;

    // Check topic completion/revision dates
    (subject.topics || []).forEach(topic => {
      const datesToCheck = [
        topic.lastCompletedDate,
        topic.completedAt,
        topic.rev1At,
        topic.rev2At,
        topic.rev3At,
        topic.ldrAt,
        ...(topic.completedDates || [])
      ];
      datesToCheck.forEach(dStr => {
        if (dStr) {
          const time = new Date(dStr).getTime();
          if (!isNaN(time) && time > latestTimestamp) {
            latestTimestamp = time;
          }
        }
      });
    });

    // Check studyLogs
    (studyLogs || []).forEach(log => {
      if (log.hours > 0 && (log.subjectId === subject.id || log.subjectId === subject.code || log.subjectId === subject.name)) {
        if (log.date) {
          const time = new Date(log.date).getTime();
          if (!isNaN(time) && time > latestTimestamp) {
            latestTimestamp = time;
          }
        }
      }
    });

    // Check studyHistoryLogs
    (studyHistoryLogs || []).forEach(h => {
      if (h.subjectId === subject.id || (h.subject && (h.subject.includes(subject.name) || h.subject.includes(subject.code)))) {
        const time = h.timestamp || (h.dateStr ? new Date(h.dateStr).getTime() : 0);
        if (!isNaN(time) && time > latestTimestamp) {
          latestTimestamp = time;
        }
      }
    });

    if (!latestTimestamp) {
      return {
        status: 'fading',
        label: '⚠️ Fading (Never touched)',
        badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
      };
    }

    const diffDays = Math.max(0, Math.floor((todayTime - latestTimestamp) / (1000 * 60 * 60 * 24)));
    
    if (diffDays <= 3) {
      const daysText = diffDays === 0 ? 'Today' : `${diffDays}d ago`;
      return {
        status: 'active',
        label: `⚡ Active (${daysText})`,
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
      };
    } else if (diffDays <= 10) {
      return {
        status: 'moderate',
        label: `🟡 Moderate (${diffDays}d ago)`,
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      };
    } else {
      return {
        status: 'fading',
        label: `⚠️ Fading (${diffDays}d untouched)`,
        badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30'
      };
    }
  };

  // Quick Action Handler to log hours directly
  const handleQuickLogHours = (subjectId: string, hours: number) => {
    addStudyLog(subjectId, hours);
    const subj = subjects.find(s => s.id === subjectId);
    logStudyActivity({
      dateStr: getISTYMD(),
      subject: subj?.name || 'General Study',
      subjectId: subjectId,
      durationHours: hours,
      sourceType: 'MANUAL',
      chapterTitle: 'Quick Log via Master Summary'
    });
    setLoggingSubjectId(null);
  };

  // Handle toggling chapter revisions directly in drill-down
  const handleToggleTopicRev = (subjectId: string, topicId: string, revKey: 'rev1' | 'rev2' | 'rev3' | 'completed') => {
    const todayStr = getISTYMD();
    store.setSubjects(prevSubjects => 
      prevSubjects.map(s => {
        if (s.id !== subjectId) return s;
        const updatedTopics = (s.topics || []).map(t => {
          if (t.id !== topicId) return t;
          const newVal = !t[revKey];
          const atKey = `${revKey}At` as keyof typeof t;
          return {
            ...t,
            [revKey]: newVal,
            [atKey]: newVal ? todayStr : undefined,
            ...(revKey === 'rev1' && newVal ? { completed: true, completedAt: todayStr } : {})
          };
        });
        return { ...s, topics: updatedTopics };
      })
    );
  };

  // Group subjects by Group 1 and Group 2
  const group1Subjects = subjects.filter(s => s.group === 1 || String(s.group) === '1');
  const group2Subjects = subjects.filter(s => s.group === 2 || String(s.group) === '2');

  const renderSubjectCard = (subject: CASubject) => {
    const isGroup1 = subject.group === 1 || String(subject.group) === '1';
    const topics = subject.topics || [];
    const total = topics.length || 1;
    const firstReading = topics.filter(t => t.completed).length;
    const rev1 = topics.filter(t => t.rev1).length;
    const rev2 = topics.filter(t => t.rev2).length;
    const rev3 = topics.filter(t => t.rev3).length;
    const mtps = subject.mtpProgress || [];
    const mtpTotal = mtps.length || 1;
    const mtpDone = mtps.filter(m => m.completed).length;
    const pyqs = subject.pyqProgress || [];
    const pyqTotal = pyqs.length || 1;
    const pyqDone = pyqs.filter(p => p.completed).length;

    const percentRev1 = Math.round((rev1 / total) * 100);
    const percentRev2 = Math.round((rev2 / total) * 100);
    const percentRev3 = Math.round((rev3 / total) * 100);

    const investedHours = getSubjectInvestedHours(subject);
    const freshness = getSubjectFreshness(subject);
    const isExpanded = expandedSubjectId === subject.id;

    // Circular ring percentage: overall Rev 1 percentage
    const ringPercent = percentRev1;
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (ringPercent / 100) * circumference;

    // Group-based Theme Accent Styling
    const theme = isGroup1 ? {
      cardHover: 'hover:border-indigo-500/40 hover:shadow-[0_8px_30px_rgba(99,102,241,0.12)]',
      codeBadge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      titleHover: 'group-hover:text-indigo-300',
      roiText: 'text-indigo-300',
      gradientId: `g1Grad-${subject.id}`,
      gradStart: '#818cf8',
      gradEnd: '#a855f7',
      ringPercentColor: 'text-indigo-200'
    } : {
      cardHover: 'hover:border-cyan-500/40 hover:shadow-[0_8px_30px_rgba(6,182,212,0.12)]',
      codeBadge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      titleHover: 'group-hover:text-cyan-300',
      roiText: 'text-cyan-300',
      gradientId: `g2Grad-${subject.id}`,
      gradStart: '#22d3ee',
      gradEnd: '#06b6d4',
      ringPercentColor: 'text-cyan-200'
    };

    return (
      <div 
        key={subject.id}
        className={`glass-card p-4 rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-xl shadow-lg transition-all duration-300 space-y-3.5 group ${theme.cardHover}`}
      >
        {/* Card Header: Subject Code/Name, Freshness, and Circular Ring */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold border ${theme.codeBadge}`}>
                {subject.code || `GRP ${subject.group}`}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${freshness.badgeClass}`}>
                {freshness.label}
              </span>
            </div>
            <h3 className={`text-base font-extrabold text-white transition-colors leading-tight ${theme.titleHover}`}>
              {subject.name}
            </h3>
          </div>

          {/* Circular Progress Ring */}
          <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle
                cx="28"
                cy="28"
                r={radius}
                stroke="currentColor"
                strokeWidth="4"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="28"
                cy="28"
                r={radius}
                stroke={`url(#${theme.gradientId})`}
                strokeWidth="4"
                className="transition-all duration-1000 ease-out"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
              <defs>
                <linearGradient id={theme.gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={theme.gradStart} />
                  <stop offset="100%" stopColor={theme.gradEnd} />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className={`text-xs font-black font-mono ${theme.ringPercentColor}`}>{ringPercent}%</span>
              <span className="text-[8px] text-slate-400 font-bold">Rev1</span>
            </div>
          </div>
        </div>

        {/* Key Metrics Grid inside Card */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          {/* Hours Invested */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hours ROI</span>
            <span className={`font-mono text-sm font-black ${theme.roiText}`}>{investedHours} hrs</span>
          </div>

          {/* Chapters Done */}
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">First Read</span>
            <span className="font-mono text-sm font-bold text-slate-200">{firstReading}/{total} <span className="text-[10px] text-slate-400">({Math.round((firstReading/total)*100)}%)</span></span>
          </div>
        </div>

        {/* Preparation Trend Micro-Sparkline */}
        <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className={`w-3 h-3 ${isGroup1 ? 'text-indigo-400' : 'text-cyan-400'}`} /> Study Trend
            </span>
            {/* Daily / Weekly / Monthly quick toggle buttons */}
            <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800/80">
              {(['daily', 'weekly', 'monthly'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setCardTimeframes(prev => ({ ...prev, [subject.id]: tf }))}
                  className={`px-1.5 py-0.5 text-[9px] font-extrabold rounded transition-all cursor-pointer ${
                    (cardTimeframes[subject.id] || globalSparklineTimeframe) === tf
                      ? isGroup1 ? 'bg-indigo-600/80 text-white shadow-sm' : 'bg-cyan-600/80 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf === 'daily' ? 'Daily' : tf === 'weekly' ? 'Wkly' : 'Mthly'}
                </button>
              ))}
            </div>
          </div>

          <SubjectInteractiveChart
            subject={subject}
            studyLogs={studyLogs}
            studyHistoryLogs={studyHistoryLogs}
            timeframe={cardTimeframes[subject.id] || globalSparklineTimeframe}
            isGroup1={isGroup1}
          />
        </div>

        {/* Revision Bars with Soft Distinct Colors */}
        <div className="space-y-2 pt-1">
          {/* Rev 1 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 text-[11px] font-bold flex items-center gap-1">
                <Repeat className="w-3 h-3 text-indigo-400" /> Rev 1
              </span>
              <span className="font-mono text-[11px] font-bold text-indigo-300">{rev1}/{total} ({percentRev1}%)</span>
            </div>
            <div className="w-full bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full transition-all duration-500 rounded-full" style={{ width: `${percentRev1}%` }} />
            </div>
          </div>

          {/* Rev 2 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
                <Repeat className="w-3 h-3 text-sky-400" /> Rev 2
              </span>
              <span className="font-mono text-[11px] font-bold text-sky-300">{rev2}/{total} ({percentRev2}%)</span>
            </div>
            <div className="w-full bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-cyan-500 h-full transition-all duration-500 rounded-full" style={{ width: `${percentRev2}%` }} />
            </div>
          </div>

          {/* Rev 3 */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" /> Rev 3
              </span>
              <span className="font-mono text-[11px] font-bold text-amber-300">{rev3}/{total} ({percentRev3}%)</span>
            </div>
            <div className="w-full bg-slate-800/90 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-500 rounded-full" style={{ width: `${percentRev3}%` }} />
            </div>
          </div>
        </div>

        {/* MTP & PYQ Pills */}
        <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-300">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">MTP: <strong className="font-mono text-white">{mtpDone}/{mtpTotal}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <ScrollText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">PYQ: <strong className="font-mono text-white">{pyqDone}/{pyqTotal}</strong></span>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
          <button
            onClick={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
            className="flex items-center gap-1 text-xs font-bold text-slate-300 hover:text-white py-1 px-2 rounded-lg hover:bg-slate-800/80 transition-all cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
            <span>{isExpanded ? 'Hide Chapters' : 'Chapter Drill-down'}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                store.setCurrentSubject(subject.id);
                store.setActiveTab('timer');
              }}
              className="p-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 transition-all cursor-pointer"
              title="Start Pomodoro Timer"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLoggingSubjectId(loggingSubjectId === subject.id ? null : subject.id)}
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer"
              title="Quick Log Hours"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Log Hours Drawer */}
        {loggingSubjectId === subject.id && (
          <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-3 space-y-2 animate-fadeIn">
            <div className="text-xs text-amber-200 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Log study hours for <span className="font-bold text-white">{subject.name}</span>:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[0.5, 1.0, 1.5, 2.0, 3.0].map((hrs) => (
                <button
                  key={hrs}
                  onClick={() => handleQuickLogHours(subject.id, hrs)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 font-mono font-bold text-xs transition-all cursor-pointer"
                >
                  +{hrs}h
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chapter Drill-down Sub-table in Card Mode */}
        {isExpanded && (
          <div className="pt-2 space-y-2 border-t border-slate-700/80 animate-fadeIn">
            <div className="text-xs font-extrabold text-indigo-300 flex items-center justify-between">
              <span>{subject.name} Chapters</span>
              <span className="font-mono text-slate-400">{topics.length} items</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 max-h-64 overflow-y-auto">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 z-10">
                  <tr>
                    <th className="p-2 font-semibold text-slate-400">Chapter Title</th>
                    <th className="p-2 font-semibold text-slate-400 text-center">First Read</th>
                    <th className="p-2 font-semibold text-slate-400 text-center">R1</th>
                    <th className="p-2 font-semibold text-slate-400 text-center">R2</th>
                    <th className="p-2 font-semibold text-slate-400 text-center">R3</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {topics.map((topic) => (
                    <tr key={topic.id} className="hover:bg-white/[0.03]">
                      <td className="p-2 font-medium text-slate-200">
                        {topic.title}
                        {topic.important && <span className="ml-1 text-rose-400 font-bold">★ LDR</span>}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleToggleTopicRev(subject.id, topic.id, 'completed')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                            topic.completed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {topic.completed ? '✓' : '-'}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleToggleTopicRev(subject.id, topic.id, 'rev1')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                            topic.rev1 ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {topic.rev1 ? '✓' : '-'}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleToggleTopicRev(subject.id, topic.id, 'rev2')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                            topic.rev2 ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {topic.rev2 ? '✓' : '-'}
                        </button>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleToggleTopicRev(subject.id, topic.id, 'rev3')}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                            topic.rev3 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {topic.rev3 ? '✓' : '-'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ReadinessDashboardHub subjects={subjects} isStrictMode={isStrictMode} />
      
      {/* Header & View Mode Toggle Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 via-slate-800 to-cyan-500/20 rounded-xl border border-indigo-500/30 shadow-inner">
            <Target className="w-6 h-6 text-indigo-300" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-50 tracking-tight">Master Progress Summary</h2>
            <p className="text-slate-400 text-sm">Bird's eye view of your CA Final preparation & ROI tracking</p>
          </div>
        </div>

        {/* Controls: Global Sparkline Timeframe & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Sparkline Timeframe Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-indigo-400" /> Trend:
            </span>
            {(['daily', 'weekly', 'monthly'] as const).map(tf => (
              <button
                key={tf}
                onClick={() => setGlobalSparklineTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                  globalSparklineTimeframe === tf
                    ? 'bg-indigo-600/80 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf === 'daily' ? 'Daily' : tf === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* View Switcher Controls */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 shadow-inner">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-md scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Visual Cards</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-slate-800 text-indigo-300 border border-indigo-500/40 shadow-md scale-105'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Dense Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mode 1: Visual Cards View */}
      {viewMode === 'cards' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Group 1 Subjects */}
          {group1Subjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="text-base font-black text-white tracking-wide">
                  Group 1 Subjects <span className="text-xs font-bold text-indigo-400 font-mono">({group1Subjects.length} Papers)</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group1Subjects.map(renderSubjectCard)}
              </div>
            </div>
          )}

          {/* Group 2 Subjects */}
          {group2Subjects.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-slate-800/80">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-base font-extrabold text-white tracking-wide">
                  Group 2 Subjects <span className="text-xs font-bold text-cyan-400 font-mono">({group2Subjects.length} Papers)</span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group2Subjects.map(renderSubjectCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Dense Table View */}
      {viewMode === 'table' && (
        <div className="glass-card overflow-x-auto animate-fadeIn">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider">Subject & Freshness</th>
              <th className="p-4 text-xs font-semibold text-cyan-300 uppercase tracking-wider text-center">Hours Invested</th>
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">Rev 1</th>
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">Rev 2</th>
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">Rev 3</th>
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">MTP</th>
              <th className="p-4 text-xs font-semibold text-slate-300 uppercase tracking-wider text-center">PYQ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {subjects.map((subject) => {
              const topics = subject.topics || [];
              const total = topics.length || 1;
              const firstReading = topics.filter(t => t.completed).length;
              const rev1 = topics.filter(t => t.rev1).length;
              const rev2 = topics.filter(t => t.rev2).length;
              const rev3 = topics.filter(t => t.rev3).length;
              const mtps = subject.mtpProgress || [];
              const mtpTotal = mtps.length || 1;
              const mtpDone = mtps.filter(m => m.completed).length;
              const pyqs = subject.pyqProgress || [];
              const pyqTotal = pyqs.length || 1;
              const pyqDone = pyqs.filter(p => p.completed).length;

              const percentRev1 = Math.round((rev1 / total) * 100);
              const percentRev2 = Math.round((rev2 / total) * 100);
              const percentRev3 = Math.round((rev3 / total) * 100);
              
              const percentMtp = mtps.length > 0 ? Math.round((mtpDone / mtpTotal) * 100) : 0;
              const percentPyq = pyqs.length > 0 ? Math.round((pyqDone / pyqTotal) * 100) : 0;

              const investedHours = getSubjectInvestedHours(subject);
              const freshness = getSubjectFreshness(subject);
              const isExpanded = expandedSubjectId === subject.id;

              const renderCell = (label: string, done: number, tot: number, percent: number, isAccent: boolean, Icon: any) => {
                const isZero = done === 0;
                return (
                  <div className="flex flex-col items-center justify-center gap-1.5 p-2 transition-all duration-300 hover:scale-[1.01]">
                    <div className={`flex items-center gap-1.5 text-xs font-mono tracking-tight ${isZero ? 'text-slate-500 bg-white/[0.03] px-2 py-0.5 rounded-full font-medium' : 'text-slate-100'}`}>
                      {!isZero && <Icon className={`w-3 h-3 ${isAccent ? 'text-[#2dd4bf]' : 'text-slate-300'}`} />}
                      <span>{done}/{tot}</span>
                    </div>
                    {!isZero && (
                      <>
                        <div className="w-16 bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                          <div 
                            className={`h-full transition-all duration-1000 ${isAccent ? 'bg-[#2dd4bf] shadow-[0_0_12px_rgba(45,212,191,0.35)]' : 'bg-slate-300'}`} 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className={`text-[10px] font-mono tracking-tight font-bold ${isAccent ? 'text-[#2dd4bf]' : 'text-slate-300'}`}>{percent}%</div>
                      </>
                    )}
                    {isZero && <span className="text-[10px] text-slate-500 font-medium mt-1">Ready to start</span>}
                  </div>
                );
              };

              return (
                <React.Fragment key={subject.id}>
                  {/* Subject Summary Row */}
                  <tr 
                    onClick={() => setExpandedSubjectId(isExpanded ? null : subject.id)}
                    className="hover:bg-white/[0.04] cursor-pointer transition-colors group select-none"
                  >
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 group-hover:border-cyan-500/40 group-hover:bg-cyan-500/10 transition-all">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-cyan-300" />
                          )}
                        </div>

                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Group {subject.group}</span>
                            {/* Requirement 3: Freshness Timestamp Badge */}
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold border ${freshness.badgeClass}`}>
                              {freshness.label}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                            {subject.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Requirement 2: Dedicated HOURS INVESTED Column */}
                    <td className="p-3 align-middle text-center">
                      <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-cyan-950/30 border border-cyan-500/20">
                        <span className="font-mono text-sm font-black text-slate-100">{investedHours} hrs</span>
                        <span className="text-[9px] text-cyan-400 font-medium">ROI Logged</span>
                      </div>
                    </td>

                    <td className="p-2 align-middle">
                      {renderCell('Rev 1', rev1, total, percentRev1, true, Repeat)}
                    </td>
                    <td className="p-2 align-middle">
                      {renderCell('Rev 2', rev2, total, percentRev2, false, Repeat)}
                    </td>
                    <td className="p-2 align-middle">
                      {renderCell('Rev 3', rev3, total, percentRev3, false, Trophy)}
                    </td>
                    <td className="p-2 align-middle">
                      {renderCell('MTP', mtpDone, mtpTotal, percentMtp, false, FileText)}
                    </td>
                    <td className="p-2 align-middle">
                      {renderCell('PYQ', pyqDone, pyqTotal, percentPyq, false, ScrollText)}
                    </td>
                  </tr>

                  {/* Requirement 4: Interactive Drill-down Sub-table & Quick Actions */}
                  {isExpanded && (
                    <tr className="bg-slate-900/90 border-t border-b border-cyan-500/30 backdrop-blur-md animate-fadeIn">
                      <td colSpan={7} className="p-4 sm:p-6 space-y-4">
                        
                        {/* Sub-table Header & Quick Action CTAs */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-white/10 shadow-lg">
                          <div className="flex items-center gap-2.5">
                            <BookOpen className="w-4 h-4 text-cyan-400" />
                            <h4 className="text-sm font-bold text-white">{subject.name} — Chapter Drill-down</h4>
                            <span className="text-xs text-slate-400 font-mono">({topics.length} Chapters)</span>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-2">
                            {/* Start Pomodoro Quick Action CTA */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                store.setCurrentSubject(subject.id);
                                store.setActiveTab('timer');
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 fill-slate-950" />
                              <span>⚡ Start Pomodoro</span>
                            </button>

                            {/* Log Hours Quick Action CTA */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLoggingSubjectId(loggingSubjectId === subject.id ? null : subject.id);
                              }}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer"
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              <span>➕ Log Hours</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick Log Hours Drawer */}
                        {loggingSubjectId === subject.id && (
                          <div className="bg-slate-950/95 border border-amber-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                            <div className="text-xs text-amber-200 font-semibold flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span>Log study hours for <span className="font-bold text-white">{subject.name}</span>:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {[0.5, 1.0, 1.5, 2.0, 3.0].map((hrs) => (
                                <button
                                  key={hrs}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickLogHours(subject.id, hrs);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-200 font-mono font-bold text-xs transition-all cursor-pointer"
                                >
                                  +{hrs}h
                                </button>
                              ))}
                              <input
                                type="number"
                                step="0.5"
                                min="0.5"
                                placeholder="Hrs"
                                value={customLogHours}
                                onChange={(e) => setCustomLogHours(e.target.value)}
                                className="w-16 bg-slate-900 border border-amber-500/40 rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none"
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const h = parseFloat(customLogHours);
                                  if (h > 0) {
                                    handleQuickLogHours(subject.id, h);
                                    setCustomLogHours('');
                                  }
                                }}
                                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Chapter Drill-down Sub-table */}
                        <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/70 max-h-80 overflow-y-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-900 border-b border-white/10 z-10">
                              <tr>
                                <th className="p-3 font-semibold text-slate-400">Chapter / Ind AS / Topic Title</th>
                                <th className="p-3 font-semibold text-slate-400 text-center">Category</th>
                                <th className="p-3 font-semibold text-slate-400 text-center">First Read</th>
                                <th className="p-3 font-semibold text-slate-400 text-center">Revision 1 (R1)</th>
                                <th className="p-3 font-semibold text-slate-400 text-center">Revision 2 (R2)</th>
                                <th className="p-3 font-semibold text-slate-400 text-center">Revision 3 (R3)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {topics.map((topic) => (
                                <tr key={topic.id} className="hover:bg-white/[0.03] transition-colors">
                                  <td className="p-3 font-medium text-slate-200">
                                    <div className="flex items-center gap-2">
                                      <span>{topic.title}</span>
                                      {topic.important && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                                          ★ LDR
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      topic.category === 'A' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' :
                                      topic.category === 'B' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                      'bg-slate-700/50 text-slate-300 border border-slate-600/40'
                                    }`}>
                                      Cat {topic.category || 'A'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleTopicRev(subject.id, topic.id, 'completed');
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                        topic.completed 
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {topic.completed ? '✓ Done' : 'Pending'}
                                    </button>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleTopicRev(subject.id, topic.id, 'rev1');
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                        topic.rev1 
                                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40' 
                                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {topic.rev1 ? '✓ R1' : 'Mark R1'}
                                    </button>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleTopicRev(subject.id, topic.id, 'rev2');
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                        topic.rev2 
                                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {topic.rev2 ? '✓ R2' : 'Mark R2'}
                                    </button>
                                  </td>
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggleTopicRev(subject.id, topic.id, 'rev3');
                                      }}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                        topic.rev3 
                                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' 
                                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {topic.rev3 ? '✓ R3' : 'Mark R3'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};
