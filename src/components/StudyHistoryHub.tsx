import React, { useState, useMemo } from 'react';
import { useStore } from '../store';
import { 
  Clock, Calendar, Filter, Trash2, Plus, Search, FileText, 
  Sparkles, TrendingUp, RotateCcw, CheckCircle2, ChevronRight, ChevronDown,
  BookOpen, Layers, Award, AlertCircle, Download, Edit3, MessageSquare,
  ShieldCheck, ArrowUpRight, BarChart2
} from 'lucide-react';
import { getISTYMD, formatDisplayDate } from '../lib/dateUtils';
import { parseSlotHours } from '../utils/timeUtils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { StudyHistoryLog } from '../types';
import * as XLSX from 'xlsx';

export const StudyHistoryHub: React.FC = () => {
  const { 
    subjects, 
    studyHistoryLogs, 
    logStudyActivity, 
    deleteStudyHistoryLog,
    updateStudyHistoryLogNotes,
    clearStudyHistoryLogs,
    getScheduleForDate,
    setScheduleForDate
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'DURATION_DESC' | 'DURATION_ASC' | 'SUBJECT_ASC' | 'SUBJECT_DESC'>('NEWEST');
  const [viewMode, setViewMode] = useState<'ITEMIZED' | 'DAILY_GROUPED'>('ITEMIZED');

  // Manual Quick Log form state
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0]?.id || 'general');
  const [manualHours, setManualHours] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSource, setManualSource] = useState<'POMODORO' | 'TIME_TABLE' | 'EXAM_SIMULATOR' | 'MANUAL' | 'SYLLABUS'>('TIME_TABLE');
  const [selectedTimetableSlotId, setSelectedTimetableSlotId] = useState<string>('');

  const todaySchedule = useMemo(() => {
    return getScheduleForDate(getISTYMD()).filter(s => s.category !== 'break' && !s.completed);
  }, [getScheduleForDate, studyHistoryLogs]);

  const handleTimetableSlotChange = (slotId: string) => {
    setSelectedTimetableSlotId(slotId);
    const slot = todaySchedule.find(s => s.id === slotId);
    if (slot) {
      const matchSubj = subjects.find(sub => sub.name.toLowerCase().includes(slot.subject.toLowerCase()) || sub.code.toLowerCase().includes(slot.subject.toLowerCase()));
      if (matchSubj) setSelectedSubjectId(matchSubj.id);
      setManualHours(parseSlotHours(slot.time).toString());
      setManualTitle(slot.activity);
    }
  };

  // Editing notes state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingNotesText, setEditingNotesText] = useState('');

  // Expanded dates state for daily grouped view
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  // Filter & search logs
  const filteredLogs = useMemo(() => {
    let logs = [...(studyHistoryLogs || [])];

    const todayStr = getISTYMD();
    // Date Range Presets
    if (dateRangePreset === 'TODAY') {
      logs = logs.filter(l => l.dateStr === todayStr);
    } else if (dateRangePreset === 'YESTERDAY') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      logs = logs.filter(l => l.dateStr === yStr);
    } else if (dateRangePreset === 'WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const limitStr = sevenDaysAgo.toISOString().split('T')[0];
      logs = logs.filter(l => l.dateStr >= limitStr);
    } else if (dateRangePreset === 'MONTH') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const limitStr = thirtyDaysAgo.toISOString().split('T')[0];
      logs = logs.filter(l => l.dateStr >= limitStr);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(l => 
        l.subject.toLowerCase().includes(q) || 
        l.chapterTitle?.toLowerCase().includes(q) ||
        l.sourceType.toLowerCase().includes(q) ||
        l.notes?.toLowerCase().includes(q)
      );
    }

    if (sourceFilter !== 'ALL') {
      logs = logs.filter(l => l.sourceType === sourceFilter);
    }

    if (subjectFilter !== 'ALL') {
      logs = logs.filter(l => l.subjectId === subjectFilter);
    }

    // Sorting
    if (sortBy === 'NEWEST') {
      logs.sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === 'OLDEST') {
      logs.sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === 'DURATION_DESC') {
      logs.sort((a, b) => b.durationHours - a.durationHours);
    } else if (sortBy === 'DURATION_ASC') {
      logs.sort((a, b) => a.durationHours - b.durationHours);
    } else if (sortBy === 'SUBJECT_ASC') {
      logs.sort((a, b) => a.subject.localeCompare(b.subject));
    } else if (sortBy === 'SUBJECT_DESC') {
      logs.sort((a, b) => b.subject.localeCompare(a.subject));
    }

    return logs;
  }, [studyHistoryLogs, searchQuery, sourceFilter, subjectFilter, dateRangePreset, sortBy]);

  // Grouped by Date for Daily Breakdown View
  const groupedByDate = useMemo(() => {
    const map: Record<string, { totalHours: number; logs: StudyHistoryLog[] }> = {};
    filteredLogs.forEach(log => {
      if (!map[log.dateStr]) {
        map[log.dateStr] = { totalHours: 0, logs: [] };
      }
      map[log.dateStr].totalHours += log.durationHours;
      map[log.dateStr].logs.push(log);
    });

    return Object.entries(map)
      .map(([dateStr, data]) => ({
        dateStr,
        totalHours: Number(data.totalHours.toFixed(2)),
        logs: data.logs
      }))
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [filteredLogs]);

  // Aggregate stats
  const stats = useMemo(() => {
    const logs = studyHistoryLogs || [];
    const totalHours = logs.reduce((sum, l) => sum + l.durationHours, 0);
    const totalSessions = logs.length;
    
    // Group by source
    const sourceBreakdown = logs.reduce((acc, l) => {
      acc[l.sourceType] = (acc[l.sourceType] || 0) + l.durationHours;
      return acc;
    }, {} as Record<string, number>);

    // Group by subject
    const subjectBreakdown = logs.reduce((acc, l) => {
      acc[l.subject] = (acc[l.subject] || 0) + l.durationHours;
      return acc;
    }, {} as Record<string, number>);

    // Find top subject & method
    let topSubject = 'N/A';
    let topSubjectHrs = 0;
    Object.entries(subjectBreakdown).forEach(([subj, hrs]) => {
      if (hrs > topSubjectHrs) {
        topSubjectHrs = hrs;
        topSubject = subj.split(':')[0] || subj;
      }
    });

    let topMethod = 'N/A';
    let topMethodHrs = 0;
    Object.entries(sourceBreakdown).forEach(([m, hrs]) => {
      if (hrs > topMethodHrs) {
        topMethodHrs = hrs;
        topMethod = m.replace('_', ' ');
      }
    });

    return {
      totalHours: Number(totalHours.toFixed(2)),
      totalSessions,
      sourceBreakdown,
      subjectBreakdown,
      topSubject,
      topMethod
    };
  }, [studyHistoryLogs]);

  // Data for Charts
  const sourceChartData = useMemo(() => {
    return Object.entries(stats.sourceBreakdown).map(([key, value]) => ({
      name: key.replace('_', ' '),
      hours: Number((value as number).toFixed(1))
    }));
  }, [stats.sourceBreakdown]);

  const subjectChartData = useMemo(() => {
    return Object.entries(stats.subjectBreakdown)
      .map(([key, value]) => ({
        name: key.split(':')[0] || key,
        hours: Number((value as number).toFixed(1))
      }))
      .slice(0, 5); // top 5 subjects
  }, [stats.subjectBreakdown]);

  const PIE_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa'];

  // Calculate Heatmap Data (Last 84 Days / 12 Weeks)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const map: { dateStr: string; hours: number }[] = [];
    
    // Create an array of the last 84 days
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      // Calculate hours for this day
      const dayLogs = studyHistoryLogs?.filter(l => l.dateStr === dateStr) || [];
      const totalHours = dayLogs.reduce((sum, log) => sum + log.durationHours, 0);
      
      map.push({ dateStr, hours: totalHours });
    }
    return map;
  }, [studyHistoryLogs]);

  const getHeatmapColor = (hours: number) => {
    if (hours === 0) return 'bg-slate-800/50';
    if (hours < 2) return 'bg-sky-900/60';
    if (hours < 4) return 'bg-sky-700/80';
    if (hours < 6) return 'bg-sky-500';
    return 'bg-sky-400';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(manualHours);
    if (isNaN(hrs) || hrs <= 0) {
      alert("Please enter a valid positive duration in hours!");
      return;
    }

    const matchSubj = subjects.find(s => s.id === selectedSubjectId);
    const subjectName = matchSubj ? `${matchSubj.code}: ${matchSubj.name}` : 'General Study';

    logStudyActivity({
      dateStr: getISTYMD(),
      subject: subjectName,
      subjectId: selectedSubjectId,
      durationHours: hrs,
      sourceType: manualSource,
      chapterTitle: manualTitle.trim() || 'Custom Logged Session',
      notes: manualNotes.trim() || undefined
    });

    // Reset form
    setManualHours('');
    setManualTitle('');
    setManualNotes('');
    setShowManualForm(false);
  };

  // Excel Audit Ledger Exporter
  const exportToExcel = () => {
    if (!studyHistoryLogs || studyHistoryLogs.length === 0) {
      alert("No study history records available to export!");
      return;
    }

    const data = filteredLogs.map(log => ({
      "Date": log.dateStr,
      "Subject Code & Name": log.subject,
      "Activity Description": log.chapterTitle || 'Standard Session',
      "Source Method": log.sourceType,
      "Duration (Hours)": Number(log.durationHours.toFixed(2)),
      "Status": log.status,
      "Notes/Remarks": log.notes || '',
      "IST Timestamp": new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Study Audit Ledger");
    XLSX.writeFile(workbook, `ICAI_Study_Audit_Ledger_${getISTYMD()}.xlsx`);
  };

  const handleClearHistory = () => {
    if (window.confirm("🚨 WARNING: Are you sure you want to permanently clear your Study Audit Ledger? This will reset all historical trail records.")) {
      clearStudyHistoryLogs();
    }
  };

  const saveEditedNotes = (id: string) => {
    updateStudyHistoryLogNotes(id, editingNotesText.trim());
    setEditingLogId(null);
    setEditingNotesText('');
  };

  const toggleExpandDate = (dStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dStr]: !prev[dStr] }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-12 animate-fadeIn" id="study-history-hub">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
              🕒 Study History & Audit Ledger
            </h1>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Ledger</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time automated trail logging, session compliance, and ICAI prep audit history.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
            title="Download Excel Audit Report"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export Excel</span>
          </button>

          <button 
            onClick={() => setShowManualForm(!showManualForm)}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Quick Log</span>
          </button>

          <button 
            onClick={handleClearHistory}
            className="flex items-center gap-2 border border-rose-950 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40 px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Reset Ledger</span>
          </button>
        </div>
      </div>

      {/* Manual Quick Log Form overlay */}
      {showManualForm && (
        <form onSubmit={handleManualSubmit} className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-2xl animate-slideDown max-w-lg mx-auto space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-400" />
              <span>Log Manual Activity</span>
            </h3>
            
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Subject</label>
              <select 
                value={selectedSubjectId} 
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.code}: {s.name}</option>
                ))}
                <option value="general">General / Other Study</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration (Hours)</label>
              <input 
                type="number" 
                step="0.1" 
                min="0.1"
                required
                placeholder="e.g. 2.5" 
                value={manualHours} 
                onChange={(e) => setManualHours(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
              <div className="flex gap-1 mt-1.5">
                {[0.5, 1.0, 2.0, 3.0].map(hrs => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => setManualHours(hrs.toString())}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                  >
                    +{hrs}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Method / Source</label>
              <select 
                value={manualSource} 
                onChange={(e) => setManualSource(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              >
                <option value="TIME_TABLE">Timetable Slot</option>
                <option value="POMODORO">Pomodoro Focus</option>
                <option value="MANUAL">Manual Entry</option>
                <option value="EXAM_SIMULATOR">Mock Exam</option>
                <option value="SYLLABUS">Syllabus Milestone</option>
              </select>
            </div>
            
            {manualSource === 'TIME_TABLE' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">Link to Today's Timetable Slot</label>
                <select 
                  value={selectedTimetableSlotId} 
                  onChange={(e) => handleTimetableSlotChange(e.target.value)}
                  className="w-full bg-sky-950/40 border border-sky-500/50 rounded-xl px-3 py-2 text-sm text-sky-200 focus:outline-none focus:border-sky-400"
                >
                  <option value="">-- Select Pending Slot --</option>
                  {todaySchedule.map(s => (
                    <option key={s.id} value={s.id}>[{s.time}] {s.subject} - {s.activity}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Activity / Chapter Title</label>
              <input 
                type="text" 
                placeholder="e.g. Ind AS 115 Revenue contract sums" 
                value={manualTitle} 
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes / Remarks (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Completed all study material practical questions 1-15" 
                value={manualNotes} 
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full bg-sky-500 hover:bg-sky-400 text-slate-950 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg cursor-pointer"
          >
            Confirm & Save to Ledger
          </button>
        </form>
      )}

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Audited Hours</p>
            <p className="text-2xl font-black text-slate-100 mt-0.5">{stats.totalHours} hrs</p>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Trail Entries</p>
            <p className="text-2xl font-black text-slate-100 mt-0.5">{stats.totalSessions}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Top Invested Subject</p>
            <p className="text-lg font-black text-slate-100 mt-0.5 truncate max-w-[150px]">{stats.topSubject}</p>
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Primary Method</p>
            <p className="text-lg font-black text-slate-100 mt-0.5 capitalize">{stats.topMethod}</p>
          </div>
        </div>
      </div>

      {/* Audit Consistency Heatmap */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
        <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          <span>Study Consistency (Last 12 Weeks)</span>
        </h3>
        
        <div className="flex justify-start overflow-x-auto pb-2">
          <div className="grid grid-rows-7 grid-flow-col gap-1.5 auto-cols-max">
            {heatmapData.map((day, i) => (
              <div 
                key={day.dateStr}
                title={`${formatDisplayDate(day.dateStr)}: ${day.hours.toFixed(1)} hrs`}
                className={`w-3.5 h-3.5 rounded-sm transition-all cursor-pointer hover:ring-2 hover:ring-slate-300 ${getHeatmapColor(day.hours)}`}
              />
            ))}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 mt-3 font-medium">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-slate-800/50" />
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-900/60" />
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-700/80" />
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-500" />
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-400" />
          </div>
          <span>More</span>
        </div>
      </div>

      {/* Charts Grid */}
      {studyHistoryLogs && studyHistoryLogs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Method distribution chart */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Study Hours by Method Type</span>
            </h3>
            <div className="h-60">
              {sourceChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      labelClassName="text-slate-400 font-bold text-xs"
                      itemStyle={{ color: '#38bdf8', fontSize: '12px' }}
                    />
                    <Bar dataKey="hours" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                      {sourceChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data logged yet</div>
              )}
            </div>
          </div>

          {/* Subject distribution chart */}
          <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-xl">
            <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Subject Investment (Top 5)</span>
            </h3>
            <div className="h-60">
              {subjectChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={subjectChartData} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={80} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#10b981', fontSize: '12px' }}
                    />
                    <Bar dataKey="hours" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">No data logged yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Ledger Table Card */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 shadow-2xl">
        {/* Controls header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6 mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <span>Audit Ledger Entries ({filteredLogs.length})</span>
            </h2>

            {/* View Mode Toggle */}
            <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
              <button
                onClick={() => setViewMode('ITEMIZED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === 'ITEMIZED' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Itemized List
              </button>
              <button
                onClick={() => setViewMode('DAILY_GROUPED')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  viewMode === 'DAILY_GROUPED' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Daily Grouped
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by topic, subject, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border border-slate-800/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 w-44 sm:w-64"
              />
            </div>

            {/* Date Preset Filter */}
            <select 
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="YESTERDAY">Yesterday</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>

            {/* Source Filter */}
            <select 
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Methods</option>
              <option value="POMODORO">Pomodoro</option>
              <option value="TIME_TABLE">Timetable</option>
              <option value="EXAM_SIMULATOR">Mock Exam</option>
              <option value="SYLLABUS">Syllabus</option>
              <option value="MANUAL">Manual</option>
            </select>

            {/* Subject Filter */}
            <select 
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500 max-w-[120px]"
            >
              <option value="ALL">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
              <option value="general">General</option>
            </select>

            {/* Sort Order */}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-sky-500"
            >
              <option value="NEWEST">Date (Newest)</option>
              <option value="OLDEST">Date (Oldest)</option>
              <option value="DURATION_DESC">Duration (Highest)</option>
              <option value="DURATION_ASC">Duration (Lowest)</option>
              <option value="SUBJECT_ASC">Subject (A-Z)</option>
              <option value="SUBJECT_DESC">Subject (Z-A)</option>
            </select>
          </div>
        </div>

        {/* ITEMIZED VIEW */}
        {viewMode === 'ITEMIZED' && (
          <div className="overflow-x-auto">
            {filteredLogs.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Activity Description</th>
                    <th className="py-3 px-4 text-center">Source Method</th>
                    <th className="py-3 px-4 text-right">Duration</th>
                    <th className="py-3 px-4">Notes / Remarks</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300 text-sm">
                  {filteredLogs.map((log) => {
                    let badgeColors = 'bg-slate-800 text-slate-300 border-slate-700';
                    if (log.sourceType === 'POMODORO') badgeColors = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                    else if (log.sourceType === 'TIME_TABLE') badgeColors = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                    else if (log.sourceType === 'EXAM_SIMULATOR') badgeColors = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
                    else if (log.sourceType === 'SYLLABUS') badgeColors = 'bg-violet-500/10 text-violet-400 border-violet-500/20';
                    else if (log.sourceType === 'MANUAL') badgeColors = 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                    const isEditingThis = editingLogId === log.id;

                    return (
                      <tr key={log.id} className="hover:bg-slate-800/20 transition-all group">
                        <td className="py-3.5 px-4 font-mono text-xs whitespace-nowrap text-slate-400">
                          <div>{formatDisplayDate(log.dateStr)}</div>
                          <div className="text-[10px] text-slate-600">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {log.subject.split(': ')[0] || log.subject}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col max-w-xs">
                            <span className="text-slate-100 font-medium">{log.chapterTitle || 'Standard Session'}</span>
                            {log.chapterId && <span className="text-slate-500 text-xs mt-0.5">Ref: {log.chapterId}</span>}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColors}`}>
                            {log.sourceType === 'TIME_TABLE' ? 'TIMETABLE SLOT' : log.sourceType === 'MANUAL' ? 'MANUAL ENTRY' : log.sourceType.replace('_', ' ')}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 whitespace-nowrap">
                          {log.durationHours.toFixed(2)} hrs
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="text"
                                autoFocus
                                value={editingNotesText}
                                onChange={(e) => setEditingNotesText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEditedNotes(log.id)}
                                placeholder="Add remark..."
                                className="bg-slate-950 border border-sky-500 text-xs text-slate-100 px-2 py-1 rounded w-full focus:outline-none"
                              />
                              <button 
                                onClick={() => saveEditedNotes(log.id)}
                                className="bg-sky-500 text-slate-950 text-xs font-bold px-2 py-1 rounded"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div 
                              onClick={() => {
                                setEditingLogId(log.id);
                                setEditingNotesText(log.notes || '');
                              }}
                              className="group/note cursor-pointer flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-all"
                              title="Click to edit remarks"
                            >
                              <MessageSquare className="w-3 h-3 text-slate-500 shrink-0 group-hover/note:text-sky-400" />
                              <span className="truncate italic">
                                {log.notes ? log.notes : <span className="text-slate-600 not-italic">+ Add note</span>}
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button 
                            onClick={() => deleteStudyHistoryLog(log.id)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                            title="Delete entry from audit trails"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-10 h-10 text-slate-600" />
                <p className="text-md font-semibold text-slate-400">No matching audit logs found</p>
                <p className="text-xs text-slate-600 max-w-sm">Complete study slots, Pomodoros, syllabus chapters, or mock exams to auto-generate verified audit logs.</p>
              </div>
            )}
          </div>
        )}

        {/* DAILY GROUPED VIEW */}
        {viewMode === 'DAILY_GROUPED' && (
          <div className="space-y-4">
            {groupedByDate.length > 0 ? (
              groupedByDate.map((group) => {
                const isExpanded = expandedDates[group.dateStr] ?? true;

                return (
                  <div key={group.dateStr} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    <div 
                      onClick={() => toggleExpandDate(group.dateStr)}
                      className="p-4 bg-slate-900/80 hover:bg-slate-800/80 transition-all cursor-pointer flex items-center justify-between border-b border-slate-800/50"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-sky-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )}
                        <span className="font-bold text-slate-100 text-sm">{formatDisplayDate(group.dateStr)}</span>
                        <span className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-full border border-slate-700">
                          {group.logs.length} sessions
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-xs font-medium">Daily Investment:</span>
                        <span className="font-mono font-extrabold text-sky-400 text-base">{group.totalHours} hrs</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 divide-y divide-slate-800/50 bg-slate-950/20">
                        {group.logs.map((log) => (
                          <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-slate-200">{log.subject.split(':')[0]}</span>
                              <span className="text-slate-300">{log.chapterTitle || 'Standard Session'}</span>
                              {log.notes && <span className="text-slate-500 italic">({log.notes})</span>}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">
                                {log.sourceType}
                              </span>
                              <span className="font-mono font-bold text-slate-100">{log.durationHours.toFixed(1)}h</span>
                              <button 
                                onClick={() => deleteStudyHistoryLog(log.id)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-500">No logs for selected filters.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
