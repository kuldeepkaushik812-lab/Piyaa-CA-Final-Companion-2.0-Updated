import React, { useState, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, AreaChart, Area, ComposedChart
} from 'recharts';
import { CASubject, TimetableSlot, CATopic } from '../types';
import { 
  Sparkles, Bot, TrendingUp, Award, AlertTriangle, Calendar, Zap, 
  CheckCircle2, Target, Activity, Filter, Layers, Clock, ArrowUpRight, 
  BarChart3, Sliders, Download, HelpCircle, RefreshCw, BookOpen, Flame, 
  ShieldAlert, PieChart as PieIcon, Gauge, Brain, Check, ChevronRight, Search, 
  Eye, FileSpreadsheet, Hourglass
} from 'lucide-react';
import { useStore } from '../store';
import { getISTYMD, addDaysToYMD } from '../lib/dateUtils';

interface ProgressAnalyticsHubProps {
  subjects: CASubject[];
  timetable: TimetableSlot[];
  isStrictMode?: boolean;
}

export const ProgressAnalyticsHub: React.FC<ProgressAnalyticsHubProps> = ({ 
  subjects, 
  timetable, 
  isStrictMode = false 
}) => {
  const store = useStore();
  const studyLogs = store.studyLogs;
  const setSubjects = store.setSubjects;

  // Active Sub-Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'forecast' | 'velocity'>('overview');

  // Active Group Filter
  const [groupFilter, setGroupFilter] = useState<'all' | 'group1' | 'group2'>('all');

  // Velocity Chart Timeframe
  const [velocityTimeframe, setVelocityTimeframe] = useState<7 | 14 | 30>(7);

  // Search query for weak chapters table
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [chapterFilter, setChapterFilter] = useState<'all' | 'important' | 'rev1_pending' | 'rev2_pending'>('all');
  const [matrixSubjectFilter, setMatrixSubjectFilter] = useState<string>('all');

  // Interactive AI Scenario Simulator State
  const [targetDailyHours, setTargetDailyHours] = useState<number>(store.targetStudyHours || 8);

  // Sync with global store target study hours
  React.useEffect(() => {
    if (store.targetStudyHours) {
      setTargetDailyHours(store.targetStudyHours);
    }
  }, [store.targetStudyHours]);

  const handleTargetDailyHoursChange = (val: number) => {
    setTargetDailyHours(val);
    store.setTargetStudyHours(val);
    const today = getISTYMD();
    store.setDailyTarget(today, val);
  };

  const [targetPaceChapters, setTargetPaceChapters] = useState<number>(3);
  const [retentionRate, setRetentionRate] = useState<number>(80);
  const [mtpFrequency, setMtpFrequency] = useState<number>(2);
  const [distractionHours, setDistractionHours] = useState<number>(1.5);

  // Custom AI Query State
  const [aiCustomQuestion, setAiCustomQuestion] = useState<string>('');
  const [aiCustomAnswer, setAiCustomAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Filtered Subjects based on Group
  const filteredSubjects = useMemo(() => {
    if (groupFilter === 'group1') return subjects.filter(s => s.group === 1);
    if (groupFilter === 'group2') return subjects.filter(s => s.group === 2);
    return subjects;
  }, [subjects, groupFilter]);

  // --- STATS COMPUTATIONS ---
  const totalChapters = useMemo(() => {
    return filteredSubjects.reduce((sum, s) => sum + (s.topics?.length || 0), 0);
  }, [filteredSubjects]);

  const rev1Count = useMemo(() => {
    return filteredSubjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev1)?.length || 0), 0);
  }, [filteredSubjects]);

  const rev2Count = useMemo(() => {
    return filteredSubjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev2)?.length || 0), 0);
  }, [filteredSubjects]);

  const rev3Count = useMemo(() => {
    return filteredSubjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev3)?.length || 0), 0);
  }, [filteredSubjects]);

  const overallPercentage = totalChapters > 0 ? Math.round((rev1Count / totalChapters) * 100) : 0;
  const pendingRev1 = Math.max(0, totalChapters - rev1Count);

  // MTP & PYQ Aggregates
  const totalMtpPapers = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => acc + (s.mtpProgress?.length || 0), 0);
  }, [filteredSubjects]);

  const completedMtpPapers = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => acc + (s.mtpProgress?.filter(m => m.completed)?.length || 0), 0);
  }, [filteredSubjects]);

  const totalPyqPapers = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => acc + (s.pyqProgress?.length || 0), 0);
  }, [filteredSubjects]);

  const completedPyqPapers = useMemo(() => {
    return filteredSubjects.reduce((acc, s) => acc + (s.pyqProgress?.filter(m => m.completed)?.length || 0), 0);
  }, [filteredSubjects]);

  // Overall Exam Preparedness Score (0 to 100)
  const readinessScore = useMemo(() => {
    if (totalChapters === 0) return 0;
    const rev1Weight = (rev1Count / totalChapters) * 45;
    const rev2Weight = (rev2Count / totalChapters) * 25;
    const mtpWeight = totalMtpPapers > 0 ? (completedMtpPapers / totalMtpPapers) * 15 : 0;
    const pyqWeight = totalPyqPapers > 0 ? (completedPyqPapers / totalPyqPapers) * 15 : 0;
    return Math.min(100, Math.round(rev1Weight + rev2Weight + mtpWeight + pyqWeight));
  }, [totalChapters, rev1Count, rev2Count, totalMtpPapers, completedMtpPapers, totalPyqPapers, completedPyqPapers]);

  // Number of Subjects in Exemption Zone (Projected Score >= 60)
  const subjectScores = useMemo(() => {
    return filteredSubjects.map(s => {
      const topics = s.topics || [];
      const total = topics.length || 1;
      const r1 = topics.filter(t => t.rev1).length;
      const r2 = topics.filter(t => t.rev2).length;
      const r3 = topics.filter(t => t.rev3).length;

      // Base score calculation from completion and test marks
      let base = (r1 / total) * 35 + (r2 / total) * 25 + (r3 / total) * 10;
      
      // Add MTP actual score contribution
      const mtps = s.mtpProgress || [];
      const scoredMtps = mtps.filter(m => m.completed && m.score !== undefined);
      if (scoredMtps.length > 0) {
        const avgMtp = scoredMtps.reduce((a, b) => a + (b.score || 0), 0) / scoredMtps.length;
        base = base * 0.6 + avgMtp * 0.4;
      } else {
        base += 15; // default buffer
      }

      const score = Math.min(95, Math.round(base));
      return {
        subject: s,
        score,
        status: score >= 60 ? 'EXEMPTION' : score >= 40 ? 'PASS' : 'RISK'
      };
    });
  }, [filteredSubjects]);

  const exemptionCount = subjectScores.filter(s => s.status === 'EXEMPTION').length;

  // Weakest subject
  const weakestSubjectObj = useMemo(() => {
    if (subjectScores.length === 0) return null;
    return [...subjectScores].sort((a, b) => a.score - b.score)[0];
  }, [subjectScores]);

  // --- CHART DATA GENERATION ---

  // 1. Overall Donut
  const completionData = useMemo(() => [
    { name: 'Pending R1', value: pendingRev1, color: '#334155' },
    { name: 'Rev 1 (R1)', value: Math.max(0, rev1Count - rev2Count), color: '#34d399' },
    { name: 'Rev 2 (R2)', value: Math.max(0, rev2Count - rev3Count), color: '#fbbf24' },
    { name: 'Rev 3 (LDR)', value: rev3Count, color: '#2dd4bf' }
  ].filter(item => item.value > 0 || item.name === 'Pending R1'), [pendingRev1, rev1Count, rev2Count, rev3Count]);

  // 2. Radar Data
  const radarData = useMemo(() => {
    return filteredSubjects.map(s => {
      const total = s.topics?.length || 1;
      const rev1Done = s.topics?.filter(t => t.rev1)?.length || 0;
      const rev2Done = s.topics?.filter(t => t.rev2)?.length || 0;
      const scoreObj = subjectScores.find(sc => sc.subject.id === s.id);
      return {
        subject: s.code,
        strength: Math.round((rev1Done / total) * 100),
        rev2Strength: Math.round((rev2Done / total) * 100),
        projectedScore: scoreObj?.score || 0,
        exemption: 60,
        fullMark: 100
      };
    });
  }, [filteredSubjects, subjectScores]);

  // 3. MTP Trend Line Data
  const mtpTrendData = useMemo(() => {
    const mtpTitles = filteredSubjects[0]?.mtpProgress?.map(m => m.title) || ["MTP 1", "MTP 2", "RTP 2026"];
    return mtpTitles.map((title, index) => {
      const dataPoint: any = { name: title.split(' - ')[0] || title };
      filteredSubjects.forEach(subj => {
        const mtp = subj.mtpProgress?.[index];
        if (mtp?.completed && mtp.score) {
          dataPoint[subj.code] = mtp.score;
        } else if (mtp?.completed) {
          dataPoint[subj.code] = 62; 
        } else {
          dataPoint[subj.code] = 0;
        }
      });
      return dataPoint;
    });
  }, [filteredSubjects]);

  // 4. Daily / Weekly Velocity Data
  const velocityData = useMemo(() => {
    const days = [];
    const todayStr = getISTYMD();
    for (let i = velocityTimeframe - 1; i >= 0; i--) {
      const dateStr = addDaysToYMD(todayStr, -i);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      
      const logsForDay = studyLogs.filter(l => l.date === dateStr);
      const totalHours = logsForDay.reduce((sum, l) => sum + l.hours, 0);
      const chaptersDone = Math.max(logsForDay.length, Math.floor(totalHours));
      
      days.push({
        date: dateStr,
        day: dayName,
        chapters: chaptersDone,
        hours: Number(totalHours.toFixed(1)),
        target: targetPaceChapters
      });
    }
    return days;
  }, [studyLogs, velocityTimeframe, targetPaceChapters]);

  // 5. Subject Specific Progress Breakdown Bar Data
  const subjectProgressData = useMemo(() => {
    return filteredSubjects.map(s => {
      const totalTopics = s.topics?.length || 1;
      const rev1Completed = Math.round(((s.topics?.filter(t => t.rev1)?.length || 0) / totalTopics) * 100);
      
      const mtpCompleted = s.mtpProgress?.filter(m => m.completed)?.length || 0;
      const totalMtp = s.mtpProgress?.length || 1;
      
      const pyqCompleted = s.pyqProgress?.filter(m => m.completed)?.length || 0;
      const totalPyq = s.pyqProgress?.length || 1;

      return {
        subject: s.code,
        name: s.name,
        'Rev 1 %': rev1Completed,
        'MTP %': Math.round((mtpCompleted / totalMtp) * 100),
        'PYQ %': Math.round((pyqCompleted / totalPyq) * 100)
      };
    });
  }, [filteredSubjects]);

  // 6. Subject Hours Investment Distribution Pie Data
  const subjectHoursData = useMemo(() => {
    return filteredSubjects.map((s, idx) => {
      const logs = studyLogs.filter(l => l.subjectId === s.id);
      const totalHours = logs.reduce((acc, l) => acc + l.hours, 0);
      const colors = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#e879f9', '#2dd4bf', '#f43f5e'];
      return {
        name: s.code,
        fullName: s.name,
        value: Number(totalHours.toFixed(1)) || 2, // fallback for visual
        color: colors[idx % colors.length]
      };
    });
  }, [filteredSubjects, studyLogs]);

  // --- UNCOMPLETED / WEAK CHAPTERS LIST ---
  const pendingChaptersList = useMemo(() => {
    const list: { subject: CASubject; topic: CATopic }[] = [];
    filteredSubjects.forEach(s => {
      if (matrixSubjectFilter !== 'all' && s.id !== matrixSubjectFilter) return;
      s.topics?.forEach(t => {
        let matches = false;
        if (chapterFilter === 'all' && (!t.rev1 || !t.rev2)) matches = true;
        if (chapterFilter === 'important' && t.important && !t.rev1) matches = true;
        if (chapterFilter === 'rev1_pending' && !t.rev1) matches = true;
        if (chapterFilter === 'rev2_pending' && t.rev1 && !t.rev2) matches = true;

        if (matches) {
          if (!chapterSearch || t.title.toLowerCase().includes(chapterSearch.toLowerCase()) || s.code.toLowerCase().includes(chapterSearch.toLowerCase())) {
            list.push({ subject: s, topic: t });
          }
        }
      });
    });
    return list.slice(0, 15); // Show top 15
  }, [filteredSubjects, chapterFilter, chapterSearch, matrixSubjectFilter]);

  // Quick Action: Toggle Topic Revision directly from Analytics Hub
  const handleToggleTopicRevFromHub = (subjectId: string, topicId: string, revKey: 'rev1' | 'rev2' | 'rev3') => {
    setSubjects(prev => prev.map(s => {
      if (s.id !== subjectId) return s;
      return {
        ...s,
        topics: s.topics?.map(t => {
          if (t.id !== topicId) return t;
          const updatedVal = !t[revKey];
          return {
            ...t,
            [revKey]: updatedVal,
            completed: revKey === 'rev1' ? updatedVal : t.completed
          };
        })
      };
    }));
  };

  // --- WHAT-IF SIMULATOR CALCULATIONS ---
  const scenarioForecast = useMemo(() => {
    const chaptersRemaining = Math.max(1, pendingRev1);
    
    // Adjust pace by distraction and retention
    const effectiveHours = Math.max(1, targetDailyHours - distractionHours);
    const effectivePace = Math.max(0.5, targetPaceChapters * (effectiveHours / targetDailyHours) * (retentionRate / 100));
    const daysNeededAtPace = Math.ceil(chaptersRemaining / effectivePace);
    
    const today = new Date();
    const completionDate = new Date(today);
    completionDate.setDate(today.getDate() + daysNeededAtPace);

    const examDate = new Date(2026, 10, 1); // Nov 1, 2026
    const daysToExam = Math.max(1, Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 3600 * 24)));

    const isBufferComfortable = daysNeededAtPace <= daysToExam - 10;
    
    // Retention rate, MTPs and effective hours affect marks
    const baseScore = readinessScore * 5.2;
    const addedScore = (effectiveHours * 10) + (mtpFrequency * 20) * (retentionRate / 100);
    const projectedAggregateMarks = Math.min(800, Math.round(baseScore + addedScore));

    return {
      chaptersRemaining,
      daysNeededAtPace,
      completionDateStr: completionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      daysToExam,
      isBufferComfortable,
      projectedAggregateMarks,
      isPass: projectedAggregateMarks >= (groupFilter === 'all' ? 400 : 200),
      exemptionChances: Math.min(99, Math.round((readinessScore * 0.5) + (mtpFrequency * 6) + (retentionRate * 0.2)))
    };
  }, [pendingRev1, targetPaceChapters, targetDailyHours, readinessScore, groupFilter, retentionRate, mtpFrequency, distractionHours]);

  // Dynamic AI Insight Text
  const dynamicInsight = useMemo(() => {
    if (overallPercentage === 0) {
      return "Welcome to your AI Analytical Hub! Log your first chapter revision or study session to view live score projections, radar strength matrices, and exam exemption forecasts!";
    }
    if (weakestSubjectObj && weakestSubjectObj.score < 45) {
      return `Target Alert: ${weakestSubjectObj.subject.code} is currently at a projected score of ${weakestSubjectObj.score}/100. Boosting revision in 3 key chapters can push it straight into the Exemption Zone (60+)!`;
    }
    if (readinessScore >= 70) {
      return `Outstanding velocity! Your overall readiness score is ${readinessScore}%. ${exemptionCount} out of ${filteredSubjects.length} subjects are projected in the Exemption Zone (60+). Keep maintaining your momentum!`;
    }
    return `Solid progress across CA Final! Your average daily velocity is ${velocityData.reduce((a, b) => a + b.chapters, 0) / velocityData.length} chapters/day. Focus on completing pending MTP mock test papers for maximum retention.`;
  }, [overallPercentage, weakestSubjectObj, readinessScore, exemptionCount, filteredSubjects, velocityData]);

  // Handle Custom Quick AI Query
  const handleRunAiQuery = (prompt: string) => {
    setAiCustomQuestion(prompt);
    setIsAiLoading(true);
    setTimeout(() => {
      if (prompt.includes('weakest')) {
        setAiCustomAnswer(`Based on your live syllabus tracking, ${weakestSubjectObj?.subject.name || 'Audit'} is your primary bottleneck. Strategy: 1) Allocate 2.5 hrs daily for 4 days. 2) Complete top 5 high-weightage chapters. 3) Practice at least 2 MTP questions per chapter.`);
      } else if (prompt.includes('exemption')) {
        setAiCustomAnswer(`To guarantee 60+ exemption across FR & Audit: Finish 100% Rev 1 by end of this month, attempt MTP Series 1 in timed 3-hour exam mode, and highlight statutory ICAI section/IND AS references in working notes!`);
      } else if (prompt.includes('aggregate')) {
        setAiCustomAnswer(`At your current study velocity (${targetPaceChapters} chapters/day @ ${targetDailyHours} hrs/day), your projected aggregate score is ${scenarioForecast.projectedAggregateMarks} marks. You are on track to comfortably pass both groups!`);
      } else {
        setAiCustomAnswer(`Prioritize high-weightage chapters first thing in the morning when focus is highest. Take 10-min bio breaks every 90 minutes to prevent burnout.`);
      }
      setIsAiLoading(false);
    }, 600);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-500">
      
      {/* HEADER BAR & CONTROLS */}
      <div className="bg-slate-900 border border-teal-500/30 p-5 rounded-3xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950/60">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-teal-500/20 rounded-2xl border border-teal-500/40 text-teal-300">
            <Gauge className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/40">
                DYNAMIC ANALYTICAL HUB
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                CA Final Performance Analytics & AI Forecast
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time syllabus velocity, exam score projections, exemption probabilities & AI scenario planning
            </p>
          </div>
        </div>

        {/* Group Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 self-stretch md:self-auto justify-center">
          {[
            { id: 'all', label: `All Subjects (${subjects.length})` },
            { id: 'group1', label: 'Group 1 (FR, AFM, Audit)' },
            { id: 'group2', label: 'Group 2 (DT, IDT, IBS)' }
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                groupFilter === g.id
                  ? 'bg-teal-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* TOP DYNAMIC KPI METRICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Preparedness Index */}
        <div className="bg-slate-900/90 border border-teal-500/30 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden group hover:border-teal-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Exam Readiness</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border ${
              readinessScore >= 70 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : readinessScore >= 40 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}>
              {readinessScore >= 70 ? 'EXEMPTION READY' : readinessScore >= 40 ? 'ON TRACK' : 'NEEDS BOOST'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-white font-mono">{readinessScore}%</span>
            <span className="text-xs text-teal-400 font-bold flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> Live Index
            </span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${readinessScore}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">Weighted score across Rev 1, Rev 2, MTPs & PYQs</p>
        </div>

        {/* KPI 2: Syllabus Completion */}
        <div className="bg-slate-900/90 border border-purple-500/30 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden group hover:border-purple-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Syllabus Progress</span>
            <span className="text-xs font-mono text-purple-300 font-bold">{totalChapters} Ch. Total</span>
          </div>
          <div className="space-y-2 mt-2">
             {/* R1 */}
             <div className="space-y-1">
               <div className="flex justify-between text-[11px] font-bold text-teal-300"><span className="uppercase">Rev 1 (R1)</span><span>{overallPercentage}% ({rev1Count})</span></div>
               <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-teal-400 h-full rounded-full" style={{ width: `${overallPercentage}%` }} /></div>
             </div>
             {/* R2 */}
             <div className="space-y-1">
               <div className="flex justify-between text-[11px] font-bold text-amber-300"><span className="uppercase">Rev 2 (R2)</span><span>{totalChapters > 0 ? Math.round((rev2Count / totalChapters) * 100) : 0}% ({rev2Count})</span></div>
               <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-amber-400 h-full rounded-full" style={{ width: `${totalChapters > 0 ? Math.round((rev2Count / totalChapters) * 100) : 0}%` }} /></div>
             </div>
             {/* R3 */}
             <div className="space-y-1">
               <div className="flex justify-between text-[11px] font-bold text-purple-300"><span className="uppercase">Rev 3 (LDR)</span><span>{totalChapters > 0 ? Math.round((rev3Count / totalChapters) * 100) : 0}% ({rev3Count})</span></div>
               <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden"><div className="bg-purple-400 h-full rounded-full" style={{ width: `${totalChapters > 0 ? Math.round((rev3Count / totalChapters) * 100) : 0}%` }} /></div>
             </div>
          </div>
        </div>

        {/* KPI 3: Exemption Target Meter */}
        <div className="bg-slate-900/90 border border-amber-500/30 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden group hover:border-amber-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">60+ Exemption Zone</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-300 font-mono">{exemptionCount} <span className="text-sm font-normal text-slate-400">/ {filteredSubjects.length} Sub.</span></span>
            <span className="text-xs text-amber-400 font-bold">Target 60+</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full transition-all duration-1000"
              style={{ width: `${(exemptionCount / (filteredSubjects.length || 1)) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">Subjects projected to score 60+ marks in exam</p>
        </div>

        {/* KPI 4: Weakest Link Alert */}
        <div className="bg-slate-900/90 border border-red-500/30 p-5 rounded-2xl shadow-xl space-y-3 relative overflow-hidden group hover:border-red-400/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Priority Focus Area</span>
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-black text-red-300 font-mono truncate max-w-[160px]">
              {weakestSubjectObj?.subject.code || 'None'}
            </span>
            <span className="text-xs text-red-400 font-bold font-mono">{weakestSubjectObj?.score || 0}/100</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-red-500 to-rose-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${weakestSubjectObj?.score || 0}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {weakestSubjectObj?.subject.name || 'All subjects balanced'}
          </p>
        </div>

      </div>

      {/* PIYAA LIVE AI INSIGHT & INTERACTIVE STRATEGY BAR */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-teal-950/80 border border-purple-500/40 p-5 rounded-3xl shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 to-teal-400 p-0.5 shrink-0 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-purple-300">
                <Bot className="w-6 h-6 animate-bounce" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-purple-300 uppercase bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                  PIYAA REAL-TIME AI DIAGNOSTIC
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <p className="text-xs sm:text-sm text-purple-100 font-medium italic mt-1 leading-relaxed">
                "{dynamicInsight}"
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Quick AI Strategy Prompts */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 font-bold uppercase mr-1">Quick Strategy:</span>
          {[
            "🚨 Analyze my weakest subject & action plan",
            "🎯 How to get FR & Audit exemption 60+?",
            "🏆 Predict aggregate total score",
            "⚡ High weightage chapters remaining"
          ].map((promptText, idx) => (
            <button
              key={idx}
              onClick={() => handleRunAiQuery(promptText)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/40 text-xs text-purple-200 font-medium transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{promptText}</span>
            </button>
          ))}
        </div>

        {/* Custom AI Answer Panel */}
        {aiCustomAnswer && (
          <div className="bg-slate-950/90 border border-purple-500/40 p-4 rounded-2xl space-y-2 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-400" /> Piyaa AI Analysis for: "{aiCustomQuestion}"
              </span>
              <button 
                onClick={() => setAiCustomAnswer(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {aiCustomAnswer}
            </p>
          </div>
        )}
      </div>

      {/* VIEW NAVIGATION SUB-TABS */}
      <div className="bg-slate-900/80 p-2 rounded-2xl border border-white/10 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-teal-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Executive Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'matrix'
                ? 'bg-teal-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Subject & Chapter Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('forecast')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'forecast'
                ? 'bg-teal-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4 text-amber-300" />
            <span>AI Scenario Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('velocity')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'velocity'
                ? 'bg-teal-500 text-slate-950 shadow-lg font-black'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4 text-purple-300" />
            <span>Velocity & Time Metrics</span>
          </button>
        </div>

        <div className="text-xs font-mono text-slate-400 hidden lg:block">
          CA Final Exam Target: <strong className="text-amber-300">Nov 2026</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: EXECUTIVE OVERVIEW (CHARTS GRID) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          
          {/* Chart 1: Overall Syllabus Donut */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-teal-400" /> Overall Syllabus Progression
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Total {totalChapters} Chapters</span>
            </div>

            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionData}
                    innerRadius={68}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {completionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-16px]">
                <span className="text-3xl font-black text-teal-300 font-mono drop-shadow">{overallPercentage}%</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">REV 1 DONE</span>
              </div>
            </div>
          </div>

          {/* Chart 2: Subject Strength Radar Chart */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <Target className="w-4 h-4 text-teal-400" /> Subject Strength Radar Matrix
              </h3>
              <span className="text-[10px] text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                60% Exemption Line
              </span>
            </div>

            <div className="h-64 relative">
              {overallPercentage === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 italic text-center px-8">
                  Log your first chapter revision to populate the radar chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="68%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    
                    <Radar
                      name="60% Exemption"
                      dataKey="exemption"
                      stroke="#fbbf24"
                      strokeDasharray="4 4"
                      fill="transparent"
                      strokeWidth={1.5}
                    />
                    
                    <Radar
                      name="Rev 1 %"
                      dataKey="strength"
                      stroke="#2dd4bf"
                      fill="#14b8a6"
                      fillOpacity={0.4}
                    />

                    <Radar
                      name="Projected Marks"
                      dataKey="projectedScore"
                      stroke="#c084fc"
                      fill="#a855f7"
                      fillOpacity={0.2}
                    />

                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 3: MTP & Test Score Trend Matrix */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-teal-400" /> MTP Mock Test Score & Trend Lines
              </h3>
              <span className="text-[10px] text-teal-300 font-mono">
                {completedMtpPapers} of {totalMtpPapers} MTPs Completed
              </span>
            </div>

            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mtpTrendData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                  
                  <ReferenceLine y={60} stroke="#fbbf24" strokeDasharray="5 5" label={{ position: 'top', value: 'Exemption Target 60+', fill: '#fbbf24', fontSize: 10, fontWeight: 'bold' }} />
                  <ReferenceLine y={40} stroke="#f87171" strokeDasharray="3 3" label={{ position: 'bottom', value: 'Passing 40', fill: '#f87171', fontSize: 10 }} />

                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {filteredSubjects.map((subj, idx) => {
                    const colors = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#e879f9', '#2dd4bf', '#f43f5e'];
                    return (
                      <Line 
                        key={subj.id} 
                        type="monotone" 
                        dataKey={subj.code} 
                        stroke={colors[idx % colors.length]} 
                        strokeWidth={2.5} 
                        dot={{ r: 4 }} 
                        activeDot={{ r: 7 }} 
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SUBJECT & CHAPTER MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Component Bar Chart */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-teal-400" /> Syllabus Component Breakdown (Rev 1, MTP, PYQ)
              </h3>
              <span className="text-[10px] text-teal-300 font-mono">
                Compare completion percentages per subject
              </span>
            </div>

            <div className="h-72 relative">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="subject" stroke="#64748b" tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 'bold' }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                  <RechartsTooltip 
                    cursor={{ fill: '#1e293b' }}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Rev 1 %" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="MTP %" fill="#fbbf24" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="PYQ %" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive Pending & Weak Chapters Table */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-mono font-bold text-amber-300 uppercase flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" /> Uncompleted & Priority Chapter Action Hub
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Toggle revisions directly from this analytical table</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[120px] sm:w-40">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Search chapter..."
                    className="w-full bg-slate-950 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Subject Filter */}
                <select
                  value={matrixSubjectFilter}
                  onChange={(e) => setMatrixSubjectFilter(e.target.value)}
                  className="bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer min-w-[100px]"
                >
                  <option value="all">All Subjects</option>
                  {filteredSubjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code}</option>
                  ))}
                </select>

                {/* Filter */}
                <select
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value as any)}
                  className="bg-slate-950 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer min-w-[110px]"
                >
                  <option value="all">All Pending</option>
                  <option value="important">⭐ High Weightage</option>
                  <option value="rev1_pending">Rev 1 Pending</option>
                  <option value="rev2_pending">Rev 2 Pending</option>
                </select>
              </div>
            </div>

            {/* Chapters Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono text-slate-400 uppercase">
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-3">Chapter Title</th>
                    <th className="py-2 px-3">Weightage</th>
                    <th className="py-2 px-3 text-center">Rev 1</th>
                    <th className="py-2 px-3 text-center">Rev 2</th>
                    <th className="py-2 px-3 text-center">Rev 3 (LDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {pendingChaptersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                        🎉 All chapters matching filter are complete! Great job!
                      </td>
                    </tr>
                  ) : (
                    pendingChaptersList.map(({ subject, topic }) => (
                      <tr key={topic.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-3 font-bold text-teal-300 font-mono">
                          {subject.code}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-200 flex items-center gap-2">
                          <span>{topic.title}</span>
                          {topic.important && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold">
                              ⭐ HIGH
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {topic.important ? '12 - 16 Marks' : '6 - 8 Marks'}
                        </td>

                        {/* Rev 1 Toggle */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleTopicRevFromHub(subject.id, topic.id, 'rev1')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              topic.rev1
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {topic.rev1 ? '✓ R1 Done' : 'Mark R1'}
                          </button>
                        </td>

                        {/* Rev 2 Toggle */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleTopicRevFromHub(subject.id, topic.id, 'rev2')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              topic.rev2
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {topic.rev2 ? '✓ R2 Done' : 'Mark R2'}
                          </button>
                        </td>

                        {/* Rev 3 Toggle */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleTopicRevFromHub(subject.id, topic.id, 'rev3')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              topic.rev3
                                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {topic.rev3 ? '✓ LDR' : 'Mark LDR'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: AI SCENARIO SIMULATOR & WHAT-IF PREDICTOR */}
      {/* ========================================================================= */}
      {activeTab === 'forecast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
          
          {/* Left 5 Cols: Controls & Sliders */}
          <div className="lg:col-span-5 bg-slate-900/90 p-5 rounded-3xl border border-teal-500/30 shadow-xl space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <Sliders className="w-4 h-4 text-teal-400" /> Interactive AI What-If Scenario Builder
              </h3>
              <p className="text-xs text-slate-400 mt-1">Adjust target study hours & revision speed to forecast exam outcomes</p>
            </div>

            {/* Slider 1: Target Daily Hours */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-200">
                  Target Daily Study Hours:
                </label>
                <span className="text-sm font-mono font-black text-teal-300 bg-teal-500/20 px-2.5 py-0.5 rounded border border-teal-500/30">
                  {targetDailyHours} Hours / Day
                </span>
              </div>
              <input
                type="range"
                min="4"
                max="16"
                step="0.5"
                value={targetDailyHours}
                onChange={(e) => handleTargetDailyHoursChange(parseFloat(e.target.value) || 8)}
                className="w-full accent-teal-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>4 Hours (Light)</span>
                <span>8 Hours (Optimal)</span>
                <span>16 Hours (Strict Daily Limit)</span>
              </div>
            </div>

            {/* Slider 2: Target Pace (Chapters / Day) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-200">
                  Target Revision Speed:
                </label>
                <span className="text-sm font-mono font-black text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded border border-amber-500/30">
                  {targetPaceChapters} Chapters / Day
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={targetPaceChapters}
                onChange={(e) => setTargetPaceChapters(parseInt(e.target.value) || 3)}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 Ch/Day (Steady)</span>
                <span>3 Ch/Day (Ideal)</span>
                <span>8 Ch/Day (Sprint)</span>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-2 text-xs">
              <div className="font-bold text-slate-300 flex items-center gap-1.5">
                <Brain className="w-4 h-4 text-purple-400" /> AI Forecast Formula Parameters:
              </div>
              <ul className="text-[11px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Syllabus completion timeline based on {pendingRev1} unrevised chapters.</li>
                <li>CA Final Exam Date: <strong>Nov 1, 2026</strong>.</li>
                <li>Exemption probability factor derived from historical MTP retention models.</li>
              </ul>
            </div>
          </div>

          {/* Right 7 Cols: Scenario Forecast Results Cards */}
          <div className="lg:col-span-7 bg-slate-900/90 p-5 rounded-3xl border border-teal-500/30 shadow-xl space-y-5 flex flex-col justify-between">
            <div className="border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-amber-300 uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> Projected Exam Outcome & Timeline
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Box 1: Projected Finish Date */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">100% Syllabus Finish Date</span>
                <div className="text-xl font-black text-teal-300 font-mono">
                  {scenarioForecast.completionDateStr}
                </div>
                <div className="text-[11px] text-slate-400">
                  {scenarioForecast.daysNeededAtPace} Days required @ {targetPaceChapters} Ch/day
                </div>
              </div>

              {/* Box 2: Projected Aggregate Score */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Projected Aggregate Score</span>
                <div className="text-xl font-black text-amber-300 font-mono">
                  {scenarioForecast.projectedAggregateMarks} <span className="text-xs font-normal text-slate-400">/ {groupFilter === 'all' ? 800 : 400}</span>
                </div>
                <div className="text-[11px] text-emerald-400 font-bold">
                  {scenarioForecast.isPass ? '✓ Projected PASS with Both Groups' : '⚠️ Additional Revision Needed'}
                </div>
              </div>

              {/* Box 3: Exemption Odds */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Exemption Probability</span>
                <div className="text-xl font-black text-purple-300 font-mono">
                  {scenarioForecast.exemptionChances}%
                </div>
                <div className="text-[11px] text-slate-400">
                  High chance of scoring 60+ in primary subjects
                </div>
              </div>

              {/* Box 4: Buffer Days Before Exam */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Buffer Days Before Exam</span>
                <div className="text-xl font-black text-cyan-300 font-mono">
                  {Math.max(0, scenarioForecast.daysToExam - scenarioForecast.daysNeededAtPace)} Days
                </div>
                <div className="text-[11px] text-slate-400">
                  Ideal for final mock tests & ICAI MTP papers
                </div>
              </div>

            </div>

            {/* Verdict Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              scenarioForecast.isBufferComfortable
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/60 border-amber-500/40 text-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block">
                    {scenarioForecast.isBufferComfortable 
                      ? 'Comfortable Revision Pace Detected!' 
                      : 'Tight Timeline — Consider Increasing Velocity'}
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Maintaining {targetDailyHours} hours/day gives you a solid cushion before Nov 2026 exams.
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: VELOCITY & TIME INVESTMENT METRICS */}
      {/* ========================================================================= */}
      {activeTab === 'velocity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
          
          {/* Velocity Bar/Area Chart */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-400" /> Daily Revision Velocity Trend
              </h3>

              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-white/10">
                {[7, 14, 30].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setVelocityTimeframe(tf as any)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold cursor-pointer ${
                      velocityTimeframe === tf ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {tf}D
                  </button>
                ))}
              </div>
            </div>

            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <ReferenceLine y={targetPaceChapters} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: 'Target', fill: '#fbbf24', fontSize: 10 }} />
                  <Bar dataKey="chapters" fill="#2dd4bf" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Line type="monotone" dataKey="hours" stroke="#c084fc" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject Time Distribution Pie Chart */}
          <div className="bg-slate-900/90 p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-teal-300 uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" /> Study Time Investment per Subject (Hours)
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">Distribution</span>
            </div>

            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={subjectHoursData}
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {subjectHoursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
