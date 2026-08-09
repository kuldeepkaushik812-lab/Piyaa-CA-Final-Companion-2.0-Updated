import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { getISTYMD } from '../lib/dateUtils';
import { BookOpen, ArrowUpDown, Clock } from 'lucide-react';

export const SubjectHoursTable: React.FC = () => {
  const { subjects, studyLogs, selectedDateStr } = useStore();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const todayStr = selectedDateStr || getISTYMD();

  const aggregatedData = useMemo(() => {
    // 1. Build a map of our subjects
    const data = subjects.map((subj) => {
      const todayHours = studyLogs
        .filter((log) => log.date === todayStr && log.subjectId === subj.id)
        .reduce((sum, log) => sum + log.hours, 0);

      const cumulativeHours = studyLogs
        .filter((log) => log.subjectId === subj.id)
        .reduce((sum, log) => sum + log.hours, 0);

      return {
        id: subj.id,
        code: subj.code,
        name: subj.name,
        todayHours,
        cumulativeHours,
        revisionCount: subj.revisionCount || 0,
        isGeneral: false,
      };
    });

    // 2. Add General logs
    const generalTodayHours = studyLogs
      .filter((log) => log.date === todayStr && (log.subjectId === 'general' || !subjects.some(s => s.id === log.subjectId)))
      .reduce((sum, log) => sum + log.hours, 0);

    const generalCumulativeHours = studyLogs
      .filter((log) => log.subjectId === 'general' || !subjects.some(s => s.id === log.subjectId))
      .reduce((sum, log) => sum + log.hours, 0);

    if (generalCumulativeHours > 0 || generalTodayHours > 0) {
      data.push({
        id: 'general',
        code: 'GENERAL',
        name: 'General / Quick Entry',
        todayHours: generalTodayHours,
        cumulativeHours: generalCumulativeHours,
        revisionCount: 0,
        isGeneral: true,
      });
    }

    // Sort by cumulative hours
    return data.sort((a, b) => {
      if (sortOrder === 'desc') {
        return b.cumulativeHours - a.cumulativeHours;
      } else {
        return a.cumulativeHours - b.cumulativeHours;
      }
    });
  }, [subjects, studyLogs, todayStr, sortOrder]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div id="subject-hours-table" className="glass-panel p-5 rounded-3xl border border-cyan-500/20 shadow-xl space-y-4 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Subject-Wise Study Statistics</span>
        </h3>
        <button
          onClick={toggleSort}
          className="px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 hover:text-white border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Sort by Cumulative ({sortOrder === 'desc' ? 'Desc' : 'Asc'})</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-cyan-500/20">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-cyan-950/40 border-b border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject Name</th>
              <th className="px-4 py-3 text-right">Today Hours</th>
              <th className="px-4 py-3 text-right">Cumulative Hours</th>
              <th className="px-4 py-3 text-center">Revisions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cyan-500/10 text-xs">
            {aggregatedData.map((row) => (
              <tr
                key={row.id}
                className={`transition-colors hover:bg-cyan-950/20 ${
                  row.isGeneral ? 'bg-slate-900/40 italic' : ''
                }`}
              >
                <td className="px-4 py-3.5 font-bold text-slate-100">{row.code}</td>
                <td className="px-4 py-3.5 text-slate-200 font-medium">{row.name}</td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-mono tracking-tight text-slate-100 font-semibold bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-md">
                    {row.todayHours.toFixed(1)}h
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="font-mono tracking-tight text-slate-100 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    {row.cumulativeHours.toFixed(1)}h
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold font-mono">
                    {row.revisionCount}
                  </span>
                </td>
              </tr>
            ))}
            {aggregatedData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">
                  No study hours logged yet. Start logging on your study schedule to see stats here!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
