import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  BookOpen, 
  CheckCircle2, 
  BarChart3, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Clock, 
  Filter, 
  Zap,
  Target,
  ChevronRight,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../store';
import { CASubject } from '../types';

interface OverallSyllabusAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSyllabusTable?: () => void;
}

export const OverallSyllabusAuditModal: React.FC<OverallSyllabusAuditModalProps> = ({
  isOpen,
  onClose,
  onOpenSyllabusTable
}) => {
  const subjects = useStore((state) => state.subjects);
  const studyHistoryLogs = useStore((state) => state.studyHistoryLogs);
  const studyLogs = useStore((state) => state.studyLogs);
  const setActiveTab = useStore((state) => state.setActiveTab);

  // ABC Filter: ALL, A (High-Yield), B, C
  const [abcCategoryFilter, setAbcCategoryFilter] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');

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

  // Total cumulative hours invested per subject ID or Name across all logs
  const hoursInvestedBySubject = useMemo(() => {
    const map: Record<string, number> = {};

    // From studyHistoryLogs
    (studyHistoryLogs || []).forEach((log) => {
      const subKey = log.subjectId || log.subject || 'unknown';
      if (!map[subKey]) map[subKey] = 0;
      map[subKey] += log.durationHours || 0;

      // Also map by paper code or name if subjectId doesn't directly match
      subjects.forEach((s) => {
        if (s.id === log.subjectId || log.subject.includes(s.name) || log.subject.includes(s.code)) {
          map[s.id] = (map[s.id] || 0) + (log.durationHours || 0);
        }
      });
    });

    // From studyLogs
    (studyLogs || []).forEach((log) => {
      if (log.subjectId) {
        map[log.subjectId] = (map[log.subjectId] || 0) + (log.hours || 0);
      }
    });

    return map;
  }, [studyHistoryLogs, studyLogs, subjects]);

  // Filtered Subject Data based on ABC Weightage Category Filter
  const subjectAuditData = useMemo(() => {
    return subjects.map((sub) => {
      const topics = sub.topics || [];
      
      const filteredTopics = topics.filter((t) => {
        if (abcCategoryFilter === 'ALL') return true;
        const cat = (t.category || 'A').toUpperCase();
        return cat === abcCategoryFilter;
      });

      const totalCh = abcCategoryFilter === 'ALL' ? (sub.totalChapters || topics.length || 1) : filteredTopics.length;
      const completedCh = filteredTopics.filter((t) => t.completed).length;
      const percent = totalCh > 0 ? Math.round((completedCh / totalCh) * 100) : 0;

      const r1Count = filteredTopics.filter((t) => t.rev1).length;
      const r2Count = filteredTopics.filter((t) => t.rev2).length;
      const r3Count = filteredTopics.filter((t) => t.rev3).length;

      const totalHoursInvested = hoursInvestedBySubject[sub.id] || hoursInvestedBySubject[sub.name] || 0;

      return {
        ...sub,
        effectiveTotalCh: totalCh,
        effectiveCompletedCh: completedCh,
        effectivePercent: percent,
        r1Count,
        r2Count,
        r3Count,
        totalHoursInvested: Number(totalHoursInvested.toFixed(1))
      };
    });
  }, [subjects, abcCategoryFilter, hoursInvestedBySubject]);

  // Group 1 vs Group 2 Split Stats
  const groupStats = useMemo(() => {
    const g1Subjects = subjectAuditData.filter((s) => s.group === 1);
    const g2Subjects = subjectAuditData.filter((s) => s.group === 2);

    const g1Total = g1Subjects.reduce((sum, s) => sum + s.effectiveTotalCh, 0);
    const g1Completed = g1Subjects.reduce((sum, s) => sum + s.effectiveCompletedCh, 0);
    const g1Percent = g1Total > 0 ? Math.round((g1Completed / g1Total) * 100) : 0;
    const g1Hours = g1Subjects.reduce((sum, s) => sum + s.totalHoursInvested, 0);

    const g2Total = g2Subjects.reduce((sum, s) => sum + s.effectiveTotalCh, 0);
    const g2Completed = g2Subjects.reduce((sum, s) => sum + s.effectiveCompletedCh, 0);
    const g2Percent = g2Total > 0 ? Math.round((g2Completed / g2Total) * 100) : 0;
    const g2Hours = g2Subjects.reduce((sum, s) => sum + s.totalHoursInvested, 0);

    const totalChapters = g1Total + g2Total;
    const totalCompleted = g1Completed + g2Completed;
    const overallPercent = totalChapters > 0 ? Math.round((totalCompleted / totalChapters) * 100) : 0;

    return {
      g1Total,
      g1Completed,
      g1Percent,
      g1Hours: Number(g1Hours.toFixed(1)),
      g2Total,
      g2Completed,
      g2Percent,
      g2Hours: Number(g2Hours.toFixed(1)),
      totalChapters,
      totalCompleted,
      overallPercent
    };
  }, [subjectAuditData]);

  // Specification 4.4: AI Velocity & Completion Date Forecast
  const aiForecast = useMemo(() => {
    // Check chapters completed in the last 7 days
    const now = new Date();
    const sevenDaysAgoTime = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    let chaptersCompletedLast7Days = 0;

    subjects.forEach((s) => {
      (s.topics || []).forEach((t) => {
        if (t.completed && t.completedAt) {
          const cTime = new Date(t.completedAt).getTime();
          if (cTime >= sevenDaysAgoTime) {
            chaptersCompletedLast7Days += 1;
          }
        }
      });
    });

    // Fallback if no recent completion timestamps: estimate based on recent history logs
    if (chaptersCompletedLast7Days === 0) {
      const recentLogs = (studyHistoryLogs || []).filter(
        (l) => l.timestamp && l.timestamp >= sevenDaysAgoTime
      );
      const totalHours7Days = recentLogs.reduce((sum, l) => sum + l.durationHours, 0);
      // Estimate 1 chapter per 3.5 hours studied
      chaptersCompletedLast7Days = Math.max(1, Math.round(totalHours7Days / 3.5));
    }

    const velocityPerDay = Math.max(0.2, Number((chaptersCompletedLast7Days / 7).toFixed(1)));
    const remainingChapters = Math.max(0, groupStats.totalChapters - groupStats.totalCompleted);

    const daysNeeded = Math.ceil(remainingChapters / velocityPerDay);
    const forecastDate = new Date();
    forecastDate.setDate(forecastDate.getDate() + daysNeeded);

    const formattedDate = forecastDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    return {
      chaptersCompletedLast7Days,
      velocityPerDay,
      remainingChapters,
      daysNeeded,
      formattedDate
    };
  }, [subjects, studyHistoryLogs, groupStats]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-y-auto flex flex-col justify-between bg-[#0A121E]/85 backdrop-blur-3xl border-0 text-slate-100 shadow-2xl selection:bg-sky-500/30 bg-gradient-to-br from-slate-950/90 via-[#0A121E]/85 to-slate-900/90 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full h-full flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Layer 1: Sticky Glassmorphic Header */}
        <header className="h-16 px-6 sm:px-8 border-b border-slate-800/60 backdrop-blur-md flex items-center justify-between shrink-0 sticky top-0 z-20 bg-[#0A121E]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-950/80 border border-sky-500/40 text-sky-300 shadow-inner">
              <BarChart3 className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-100 tracking-tight">
                  Overall CA Final Syllabus & ROI Ledger Audit
                </h3>
                <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {groupStats.totalCompleted} / {groupStats.totalChapters} Ch ({groupStats.overallPercent}%)
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Comprehensive Group-wise breakdown, cumulative revision audit, and cumulative hours invested
              </p>
            </div>
          </div>

          {/* Center Dynamic Context Pill */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-sky-500/30 text-sky-300 font-mono text-xs font-bold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-spin" />
            <span>Forecast Completion: {aiForecast.formattedDate}</span>
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

          {/* Specification 4.1: Group 1 vs Group 2 Split Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
            {/* Group 1 Card */}
            <div className="bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/40 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 font-black text-xs uppercase tracking-wider">
                    Group 1
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    FR, AFM, Audit
                  </span>
                </div>
                <span className="font-mono font-black text-indigo-300 text-sm">
                  {groupStats.g1Percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-indigo-500/30">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-700"
                  style={{ width: `${groupStats.g1Percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Completed: <strong className="text-indigo-200">{groupStats.g1Completed}</strong> / {groupStats.g1Total} ch
                </span>
                <span className="text-emerald-400 font-bold">
                  Time Invested: {groupStats.g1Hours} hrs
                </span>
              </div>
            </div>

            {/* Group 2 Card */}
            <div className="bg-gradient-to-br from-amber-950/70 via-slate-900 to-slate-950 border border-amber-500/40 rounded-2xl p-4 shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-xs uppercase tracking-wider">
                    Group 2
                  </span>
                  <span className="text-xs font-semibold text-slate-300">
                    DT, IDT, IBS
                  </span>
                </div>
                <span className="font-mono font-black text-amber-300 text-sm">
                  {groupStats.g2Percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-amber-500/30">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${groupStats.g2Percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Completed: <strong className="text-amber-200">{groupStats.g2Completed}</strong> / {groupStats.g2Total} ch
                </span>
                <span className="text-emerald-400 font-bold">
                  Time Invested: {groupStats.g2Hours} hrs
                </span>
              </div>
            </div>
          </div>

          {/* Specification 4.3: ABC Weightage High-Yield Filter Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Filter className="w-4 h-4 text-sky-400 shrink-0" />
              <span>ICAI Category High-Yield Filter:</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(['ALL', 'A', 'B', 'C'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAbcCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    abcCategoryFilter === cat
                      ? cat === 'A'
                        ? 'bg-rose-950 text-rose-200 border-2 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                        : 'bg-sky-950 text-sky-200 border-2 border-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? 'All Topics' : `Category ${cat} ${cat === 'A' ? '🔥 (High-Yield)' : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Specification 4.2: Subject-Wise Completion & Hours Invested Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-sky-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Accounting-Grade Subject Syllabus & ROI Ledger</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-400">
                6 CA Final Papers
              </span>
            </div>

            {/* Accounting Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/90 shadow-md">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">CA Final Paper</th>
                    <th className="py-3 px-3">Grp</th>
                    <th className="py-3 px-4">Completion Status</th>
                    <th className="py-3 px-4">Progress</th>
                    <th className="py-3 px-4">Revision Matrix</th>
                    <th className="py-3 px-4 text-right">Hours Invested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-mono">
                  {subjectAuditData.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-900/50 transition-colors">
                      {/* Paper Name */}
                      <td className="py-3 px-4 font-sans font-bold text-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
                          <div>
                            <span className="text-xs text-sky-300 font-mono block">{sub.code}</span>
                            <span className="text-xs text-slate-100 font-bold block">{sub.name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Group */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                          sub.group === 1 ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                        }`}>
                          G{sub.group}
                        </span>
                      </td>

                      {/* Completion Status */}
                      <td className="py-3 px-4 font-bold text-slate-200">
                        {sub.effectiveCompletedCh} / {sub.effectiveTotalCh} ch
                      </td>

                      {/* Progress % & Mini Bar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="bg-sky-400 h-full rounded-full"
                              style={{ width: `${sub.effectivePercent}%` }}
                            />
                          </div>
                          <span className="font-bold text-sky-300">{sub.effectivePercent}%</span>
                        </div>
                      </td>

                      {/* Revision Matrix */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold" title="Revision 1">
                            R1: {sub.r1Count}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-500/40 text-teal-300 font-bold" title="Revision 2">
                            R2: {sub.r2Count}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-500/40 text-sky-300 font-bold" title="Revision 3">
                            R3: {sub.r3Count}
                          </span>
                        </div>
                      </td>

                      {/* Total Cumulative Hours Invested */}
                      <td className="py-3 px-4 text-right font-black text-emerald-400 text-sm">
                        {sub.totalHoursInvested.toFixed(1)} hrs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Specification 4.4: AI Velocity & Date Forecast Badge */}
          <div className="bg-gradient-to-r from-sky-950/90 via-slate-900 to-indigo-950/90 border-2 border-sky-500/40 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-sky-500/20 border border-sky-400/40 text-sky-300 shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse text-amber-300" />
              </div>
              <div className="space-y-0.5">
                <h5 className="text-xs font-black uppercase text-sky-300 tracking-wider flex items-center gap-1.5">
                  <span>🚀 AI Velocity & Completion Forecast</span>
                </h5>
                <p className="text-xs text-slate-200 font-medium">
                  Based on 7-day average completion speed (<strong className="text-emerald-300 font-mono">~{aiForecast.velocityPerDay} ch/day</strong>)
                </p>
              </div>
            </div>

            <div className="bg-slate-950/90 px-4 py-2.5 rounded-2xl border border-sky-400/50 text-center shrink-0 shadow-inner">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Estimated Syllabus Completion</span>
              <span className="text-sm font-mono font-black text-emerald-300 block mt-0.5">{aiForecast.formattedDate}</span>
            </div>
          </div>

        </main>

        {/* Layer 3: Sticky Action Footer */}
        <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-between gap-4 sticky bottom-0 z-20 bg-[#0A121E]/90">
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">ICAI Strategic Audit • Complete Curriculum Analytics</span>
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
                if (onOpenSyllabusTable) {
                  onOpenSyllabusTable();
                } else {
                  setActiveTab('subjects');
                }
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white font-black text-xs cursor-pointer shadow-[0_0_20px_rgba(56,189,248,0.3)] flex items-center gap-2 uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
            >
              <BookOpen className="w-4 h-4 fill-current text-sky-200" />
              <span>📖 Open Full Syllabus Table</span>
            </button>
          </div>
        </footer>

      </div>
    </div>,
    document.body
  );
};
