import React, { useState, useEffect, useMemo } from "react";
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { getISTDate } from "../lib/dateUtils.ts";
import { 
  BookOpen, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ChevronUp, 
  Award, 
  Layers, 
  RefreshCw, 
  Globe, 
  CheckCircle2, 
  Search, 
  X, 
  Star, 
  Sparkles, 
  TrendingUp, 
  Check,
  FileEdit,
  Settings
} from 'lucide-react';
import { CASubject } from '../types';
import { useStore } from '../store';
import { SyllabusManagerModal } from "./SyllabusManagerModal";

interface SubjectTrackerProps {
  subjects: CASubject[];
  initialSubjectId?: string;
  onToggleTopic: (subjectId: string, topicId: string) => void;
  onToggleTopicRevision: (subjectId: string, topicId: string, revNum: 1 | 2 | 3 | 4) => void;
  onUpdateRevision: (subjectId: string, delta: number) => void;
  onToggleRtpMtp: (subjectId: string) => void;
  onUpdateMtp?: (subjectId: string, mtpId: string, updates: Partial<{ completed: boolean; score: number }>) => void;
  onUpdatePyq?: (subjectId: string, pyqId: string, updates: Partial<{ completed: boolean; score: number }>) => void;
}

const ChapterRow = ({ 
  subjectId, 
  topic, 
  onToggleTopic, 
  onToggleTopicRevision 
}: { 
  key?: string | number,
  subjectId: string, 
  topic: any, 
  onToggleTopic: any, 
  onToggleTopicRevision: any 
}) => {
  const [isPulsing, setIsPulsing] = useState(false);

  // Trigger pulse effect when state changes
  const checkState = `${topic.completed}-${topic.rev1}-${topic.rev2}-${topic.rev3}-${topic.ldr}`;
  useEffect(() => {
    setIsPulsing(true);
    const t = setTimeout(() => setIsPulsing(false), 400);
    return () => clearTimeout(t);
  }, [checkState]);

  const category = topic.category || (topic.important ? 'Cat A' : 'Cat C');
  const catColor = category === 'Cat A' 
    ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
    : category === 'Cat B' 
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      : 'bg-slate-800/80 text-slate-300 border-slate-700';

  const handleAction = (action: () => void, revNum?: number) => {
    action();

    const newRev1 = revNum === 1 ? !topic.rev1 : topic.rev1;
    const newRev2 = revNum === 2 ? !topic.rev2 : topic.rev2;
    const newRev3 = revNum === 3 ? !topic.rev3 : topic.rev3;
    
    const wasAllComplete = topic.rev1 && topic.rev2 && topic.rev3;
    const isNowAllComplete = newRev1 && newRev2 && newRev3;

    if (!wasAllComplete && isNowAllComplete) {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const isAllComplete = topic.rev1 && topic.rev2 && topic.rev3;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      className={`flex items-center gap-2 text-xs p-2.5 sm:p-3 rounded-xl transition-all border ${
      isAllComplete 
        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-100' 
        : topic.rev1 
        ? 'bg-slate-900/80 border-cyan-500/20 hover:border-cyan-500/40' 
        : 'bg-slate-950/60 border-white/5 hover:border-white/10'
    } ${isPulsing ? 'scale-[1.01] border-cyan-400 shadow-[0_0_12px_rgba(45,212,191,0.25)]' : ''}`}>
      
      {/* Chapter Title & Category */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className={`font-semibold truncate ${isAllComplete ? 'line-through text-slate-400' : topic.rev1 ? 'text-slate-100' : 'text-slate-300'}`}>
          {topic.title}
        </span>
        <span className={`shrink-0 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md border ${catColor}`}>
          {category}
        </span>
      </div>
      
      {/* Interactive Checkbox Matrix */}
      <div className="flex gap-1 sm:gap-1.5 shrink-0 justify-end items-center w-[150px] sm:w-[180px]">
        
        {/* Rev 1 */}
        <button 
          onClick={() => handleAction(() => onToggleTopicRevision(subjectId, topic.id, 1), 1)} 
          className={`w-10 sm:w-12 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer flex flex-col ${
            topic.rev1 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(45,212,191,0.2)]' 
              : 'bg-slate-900 text-slate-500 border border-white/10 hover:border-white/20'
          }`}
          title="Revision 1 (R1)"
        >
          {topic.rev1 ? <Check className="w-4 h-4 text-cyan-300 stroke-[3]" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        {/* Rev 2 */}
        <button 
          onClick={() => handleAction(() => onToggleTopicRevision(subjectId, topic.id, 2), 2)} 
          className={`w-10 sm:w-12 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer flex flex-col ${
            topic.rev2 
              ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.2)]' 
              : 'bg-slate-900 text-slate-500 border border-white/10 hover:border-white/20'
          }`}
          title="Revision 2 (R2)"
        >
          {topic.rev2 ? <Check className="w-4 h-4 text-amber-300 stroke-[3]" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        {/* Rev 3 */}
        <button 
          onClick={() => handleAction(() => onToggleTopicRevision(subjectId, topic.id, 3), 3)} 
          className={`w-10 sm:w-12 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer flex flex-col ${
            topic.rev3 
              ? 'bg-teal-500/20 text-teal-300 border border-teal-400/50 shadow-[0_0_8px_rgba(45,212,191,0.2)]' 
              : 'bg-slate-900 text-slate-500 border border-white/10 hover:border-white/20'
          }`}
          title="Revision 3 (LDR Exam Revision)"
        >
          {topic.rev3 ? <Check className="w-4 h-4 text-teal-300 stroke-[3]" /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
        </button>

        {/* LDR Bookmark */}
        <button 
          onClick={() => handleAction(() => onToggleTopicRevision(subjectId, topic.id, 4), 4)} 
          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:bg-white/5" 
          title="Bookmark for Last Day Revision (LDR)"
        >
          <span className={`text-base transition-all ${topic.ldr ? 'scale-110 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)] opacity-100' : 'opacity-25 grayscale'}`}>⭐</span>
        </button>

      </div>
    </motion.div>
  );
};

export const SubjectTracker: React.FC<SubjectTrackerProps> = ({
  subjects,
  onToggleTopic,
  onToggleTopicRevision,
  onUpdateRevision,
  onToggleRtpMtp,
  onUpdateMtp,
  onUpdatePyq,
}) => {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(subjects[0]?.id || null);
  const [filterGroup, setFilterGroup] = useState<0 | 1 | 2>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const statusFilter = useStore((state) => state.statusFilter);
  const setStatusFilter = useStore((state) => state.setStatusFilter);
  const globalTargetDays = useStore((state) => state.globalTargetDays);
  const setGlobalTargetDays = useStore((state) => state.setGlobalTargetDays);
  
  const [syncingSubjectId, setSyncingSubjectId] = useState<string | null>(null);
  const [managingSyllabusId, setManagingSyllabusId] = useState<string | null>(null);
  const [showTargetDaysConfig, setShowTargetDaysConfig] = useState<boolean>(false);
  const [isPlanningDays, setIsPlanningDays] = useState(false);
  const [totalDaysForPlanning, setTotalDaysForPlanning] = useState<string>('100');

  const isFilterActive = searchQuery.trim() !== '' || statusFilter !== 'ALL' || filterGroup !== 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setFilterGroup(0);
  };

  // Overall Syllabus Summary Metrics
  const syllabusMetrics = useMemo(() => {
    let totalChapters = 0;
    let completed1st = 0;
    let completedRev1 = 0;
    let completedRev2 = 0;
    let completedRev3 = 0;
    let totalLdrStarred = 0;
    let totalMtps = 0;
    let completedMtps = 0;
    let totalPyqs = 0;
    let completedPyqs = 0;

    subjects.forEach((subj) => {
      subj.topics.forEach((t) => {
        totalChapters++;
        if (t.completed) completed1st++;
        if (t.rev1) completedRev1++;
        if (t.rev2) completedRev2++;
        if (t.rev3) completedRev3++;
        if (t.ldr) totalLdrStarred++;
      });

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
    });

    const pct1st = totalChapters > 0 ? Math.round((completed1st / totalChapters) * 100) : 0;
    const pctRev1 = totalChapters > 0 ? Math.round((completedRev1 / totalChapters) * 100) : 0;
    const pctRev2 = totalChapters > 0 ? Math.round((completedRev2 / totalChapters) * 100) : 0;
    const pctRev3 = totalChapters > 0 ? Math.round((completedRev3 / totalChapters) * 100) : 0;
    const pctMtps = totalMtps > 0 ? Math.round((completedMtps / totalMtps) * 100) : 0;
    const pctPyqs = totalPyqs > 0 ? Math.round((completedPyqs / totalPyqs) * 100) : 0;

    return {
      totalChapters,
      completed1st,
      completedRev1,
      completedRev2,
      completedRev3,
      totalLdrStarred,
      totalMtps,
      completedMtps,
      totalPyqs,
      completedPyqs,
      pct1st,
      pctRev1,
      pctRev2,
      pctRev3,
      pctMtps,
      pctPyqs,
    };
  }, [subjects]);

  const filteredSubjects = filterGroup === 0 ? subjects : subjects.filter((s) => s.group === filterGroup);

  const getIcaiResourceLinks = (code: string) => {
    return 'https://boslive.icai.org/index.php';
  };

  const handleSyncToTasks = async (subject: CASubject) => {
    setSyncingSubjectId(subject.id);
    try {
      const { getAccessToken } = await import('../lib/auth.ts');
      const token = await getAccessToken();
      if (!token) {
        alert('Please connect Google account first using the button in the top right!');
        setSyncingSubjectId(null);
        return;
      }
      
      const pendingTopics = subject.topics.filter(t => !t.completed);
      
      for (const topic of pendingTopics) {
        await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: `[CA Study - ${subject.code}] ${topic.title}`,
            notes: `R1: ${topic.rev1 ? 'Done' : 'Pending'} | R2: ${topic.rev2 ? 'Done' : 'Pending'} | R3: ${topic.rev3 ? 'Done' : 'Pending'} \n\nTarget for ICAI Exam`
          })
        });
      }
      alert(`Successfully synced ${pendingTopics.length} pending topics to Google Tasks for ${subject.name}!`);
    } catch (err) {
      console.error('Google Tasks sync failed:', err);
      alert('Failed to sync tasks. Please try again.');
    } finally {
      setSyncingSubjectId(null);
    }
  };

  const handleAIPlanDays = async () => {
    const days = parseInt(totalDaysForPlanning);
    if (isNaN(days) || days < 5) return alert('Please enter a valid number of days (at least 5).');
    
    setIsPlanningDays(true);
    try {
      const res = await fetch('/api/plan-revision-days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalDays: days })
      });
      const data = await res.json();
      if (res.ok && data.rev1) {
        setGlobalTargetDays({
          rev1: data.rev1,
          rev2: data.rev2,
          rev3: data.rev3,
          mtp: data.mtp,
          pyq: data.pyq
        });
      } else {
        alert('Failed to generate plan: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error connecting to AI: ' + err.message);
    } finally {
      setIsPlanningDays(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner: Syllabus Master Hub */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-cyan-950/40 p-5 md:p-6 shadow-xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center relative z-10">
          
          {/* Title & Hub Overview */}
          <div className="md:col-span-12 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>CA Final Syllabus Command Center</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">Syllabus & Chapter Tracker</h2>
              <p className="text-xs text-slate-300">
                Track 3 Revisions (R1-R3), LDR Bookmarks, MTP & PYQ papers.
              </p>
            </div>
            
            <button
              onClick={() => setShowTargetDaysConfig(!showTargetDaysConfig)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                showTargetDaysConfig 
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300' 
                  : 'bg-slate-900 border-white/10 text-slate-300 hover:text-white hover:border-cyan-500/30'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Configure Target Days</span>
            </button>
          </div>

          {showTargetDaysConfig && (
            <div className="md:col-span-12 bg-slate-950/80 border border-cyan-500/30 p-4 rounded-xl shadow-inner flex flex-col gap-4 animate-in slide-in-from-top-2">
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 pb-4 border-b border-white/10">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 
                    AI Revision Planner
                  </label>
                  <p className="text-[11px] text-slate-400 leading-tight">Enter total days remaining for exams. AI will optimally distribute them using the 45/25/15 rule of thumb.</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      value={totalDaysForPlanning}
                      onChange={(e) => setTotalDaysForPlanning(e.target.value)}
                      placeholder="Total Days"
                      className="w-24 bg-slate-900 border border-white/10 rounded-lg py-2 px-3 text-sm text-white font-bold focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500">DAYS</span>
                  </div>
                  <button
                    onClick={handleAIPlanDays}
                    disabled={isPlanningDays}
                    className="whitespace-nowrap px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 text-white font-bold text-xs shadow-lg disabled:opacity-50 flex items-center gap-2 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {isPlanningDays ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isPlanningDays ? 'Planning...' : 'Auto-Plan'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { key: 'rev1', label: 'Rev 1 Days' },
                  { key: 'rev2', label: 'Rev 2 Days' },
                  { key: 'rev3', label: 'Rev 3 Days' },
                  { key: 'mtp', label: 'MTP Days' },
                  { key: 'pyq', label: 'PYQ Days' }
                ].map(target => (
                  <div key={target.key} className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{target.label}</label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={globalTargetDays[target.key as keyof typeof globalTargetDays]}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setGlobalTargetDays({ ...globalTargetDays, [target.key]: val });
                      }}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg p-2 text-xs text-white font-bold focus:border-cyan-500 focus:outline-none transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats Progression Grid */}
          <div className="md:col-span-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-white/10">

            {/* Revision 1 Progress */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING_REV1' ? 'ALL' : 'PENDING_REV1')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                statusFilter === 'PENDING_REV1'
                  ? 'bg-amber-950/90 border-amber-400 ring-1 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'bg-white/[0.03] border-white/10 hover:border-amber-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">Rev 1 (R1)</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-amber-300">{syllabusMetrics.pctRev1}%</span>
                <span className="text-[9px] text-slate-400 font-medium">{syllabusMetrics.completedRev1}/{syllabusMetrics.totalChapters}</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5 mb-2">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-700" style={{ width: `${syllabusMetrics.pctRev1}%` }}></div>
              </div>
              <div className="mt-auto w-full flex items-center justify-between text-[9px] text-slate-400">
                <span>Target:</span>
                <span className="font-bold text-amber-300">{globalTargetDays?.rev1 || 15}d</span>
              </div>
            </button>

            {/* Revision 2 Progress */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING_REV2' ? 'ALL' : 'PENDING_REV2')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                statusFilter === 'PENDING_REV2'
                  ? 'bg-amber-950/90 border-amber-400 ring-1 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'bg-white/[0.03] border-white/10 hover:border-amber-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">Rev 2 (R2)</span>
                <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-amber-300">{syllabusMetrics.pctRev2}%</span>
                <span className="text-[9px] text-slate-400 font-medium">{syllabusMetrics.completedRev2}/{syllabusMetrics.totalChapters}</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5 mb-2">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-700" style={{ width: `${syllabusMetrics.pctRev2}%` }}></div>
              </div>
              <div className="mt-auto w-full flex items-center justify-between text-[9px] text-slate-400">
                <span>Target:</span>
                <span className="font-bold text-amber-300">{globalTargetDays?.rev2 || 30}d</span>
              </div>
            </button>

            {/* Revision 3 Progress */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING_REV3' ? 'ALL' : 'PENDING_REV3')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                statusFilter === 'PENDING_REV3'
                  ? 'bg-teal-950/90 border-teal-400 ring-1 ring-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                  : 'bg-white/[0.03] border-white/10 hover:border-teal-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">Rev 3 (LDR)</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-teal-300">{syllabusMetrics.pctRev3}%</span>
                <span className="text-[9px] text-slate-400 font-medium">{syllabusMetrics.completedRev3}/{syllabusMetrics.totalChapters}</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5 mb-2">
                <div className="bg-teal-400 h-full rounded-full transition-all duration-700" style={{ width: `${syllabusMetrics.pctRev3}%` }}></div>
              </div>
              <div className="mt-auto w-full flex items-center justify-between text-[9px] text-slate-400">
                <span>Target:</span>
                <span className="font-bold text-teal-300">{globalTargetDays?.rev3 || 45}d</span>
              </div>
            </button>

            {/* MTP Series */}
            <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col">
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">MTP Series</span>
                <Award className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-cyan-300">{syllabusMetrics.pctMtps}%</span>
                <span className="text-[9px] text-slate-400 font-medium">{syllabusMetrics.completedMtps}/{syllabusMetrics.totalMtps}</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5 mb-2">
                <div className="bg-cyan-400 h-full rounded-full transition-all duration-700" style={{ width: `${syllabusMetrics.pctMtps}%` }}></div>
              </div>
              <div className="mt-auto w-full flex items-center justify-between text-[9px] text-slate-400">
                <span>Target:</span>
                <span className="font-bold text-cyan-300">{globalTargetDays?.mtp || 10}d</span>
              </div>
            </div>

            {/* PYQ Papers */}
            <div className="p-2.5 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col">
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">PYQ Papers</span>
                <BookOpen className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-teal-300">{syllabusMetrics.pctPyqs}%</span>
                <span className="text-[9px] text-slate-400 font-medium">{syllabusMetrics.completedPyqs}/{syllabusMetrics.totalPyqs}</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5 mb-2">
                <div className="bg-teal-400 h-full rounded-full transition-all duration-700" style={{ width: `${syllabusMetrics.pctPyqs}%` }}></div>
              </div>
              <div className="mt-auto w-full flex items-center justify-between text-[9px] text-slate-400">
                <span>Target:</span>
                <span className="font-bold text-teal-300">{globalTargetDays?.pyq || 10}d</span>
              </div>
            </div>

            {/* Starred LDR */}
            <button
              onClick={() => setStatusFilter(statusFilter === 'LDR_STARRED' ? 'ALL' : 'LDR_STARRED')}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col ${
                statusFilter === 'LDR_STARRED'
                  ? 'bg-amber-950/90 border-amber-400 ring-1 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'bg-white/[0.03] border-white/10 hover:border-amber-500/40 hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-300 w-full">
                <span className="font-bold truncate">LDR Starred</span>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-lg font-black font-mono text-amber-300">{syllabusMetrics.totalLdrStarred}</span>
                <span className="text-[9px] text-slate-400 font-medium">Chapters</span>
              </div>
              <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-700" style={{ width: syllabusMetrics.totalChapters > 0 ? `${(syllabusMetrics.totalLdrStarred / syllabusMetrics.totalChapters) * 100}%` : '0%' }}></div>
              </div>
            </button>

          </div>

        </div>
      </div>

      {/* Search & Status Filters Bar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapters or topics (e.g., GST, Amalgamation, Ind AS 115, Standard)..."
              className="w-full bg-slate-950/80 border border-cyan-500/30 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Group Filter Selector */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => setFilterGroup(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterGroup === 0 ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              All Groups
            </button>
            <button
              onClick={() => setFilterGroup(1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterGroup === 1 ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Group 1
            </button>
            <button
              onClick={() => setFilterGroup(2)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filterGroup === 2 ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}
            >
              Group 2
            </button>
          </div>

        </div>

        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-lg border border-white/10">
              <span className="text-[10px] text-slate-400 uppercase font-bold px-1.5">Filter Status:</span>
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'ALL' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All Chapters
              </button>
              <button
                onClick={() => setStatusFilter('PENDING_REV1')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'PENDING_REV1' ? 'bg-amber-950 text-amber-300 border border-amber-500/50' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Pending Rev 1
              </button>
              <button
                onClick={() => setStatusFilter('PENDING_REV2')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'PENDING_REV2' ? 'bg-amber-950 text-amber-300 border border-amber-500/50' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Pending Rev 2
              </button>
              <button
                onClick={() => setStatusFilter('PENDING_REV3')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'PENDING_REV3' ? 'bg-teal-950 text-teal-300 border border-teal-500/50' : 'text-slate-400 hover:text-teal-300'
                }`}
              >
                Pending Rev 3
              </button>
              <button
                onClick={() => setStatusFilter('LDR_STARRED')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'LDR_STARRED' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50' : 'text-slate-400 hover:text-amber-300'
                }`}
              >
                Starred LDR ⭐
              </button>
              <button
                onClick={() => setStatusFilter('NA')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer flex flex-col ${
                  statusFilter === 'NA' ? 'bg-slate-700 text-slate-100 border border-slate-500' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                N/A Chapters 🚫
              </button>
            </div>
          </div>

          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-500/30 transition-all cursor-pointer"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}

        </div>
      </div>

      {/* Expandable Subject Accordions Stack */}
      <div className="flex flex-col gap-4">
        {filteredSubjects.map((subj) => {
          const rev1Count = subj.topics.filter((t) => t.rev1).length;
          const rev2Count = subj.topics.filter((t) => t.rev2).length;
          const rev3Count = subj.topics.filter((t) => t.rev3).length;
          const ldrCount = subj.topics.filter((t) => t.ldr).length;
          const totalCount = subj.topics.length || 1;
          const pct = Math.round((rev1Count / totalCount) * 100);
          
          // Compute matching topics based on search query & status filter
          const matchingTopics = subj.topics.filter((t) => {
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              if (!t.title.toLowerCase().includes(q)) return false;
            }
            if (statusFilter === 'PENDING_REV1' && t.rev1) return false;
            if (statusFilter === 'PENDING_REV2' && t.rev2) return false;
            if (statusFilter === 'PENDING_REV3' && t.rev3) return false;
            if (statusFilter === 'LDR_STARRED' && !t.ldr) return false;
            if (statusFilter === 'NA' && (t.rev1 || t.rev2 || t.rev3)) return false;
            return true;
          });

          const hasCustomFilter = searchQuery.trim() !== '' || statusFilter !== 'ALL';
          const isExpanded = hasCustomFilter ? matchingTopics.length > 0 : expandedSubject === subj.id;
          const icaiUrl = getIcaiResourceLinks(subj.code);

          return (
            <div 
              key={subj.id} 
              className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                isExpanded 
                  ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(45,212,191,0.15)] bg-slate-900/95' 
                  : 'border-white/10 hover:border-white/20 bg-slate-950/70'
              }`}
            >
              
              {/* Accordion Header */}
              <div 
                className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => setExpandedSubject(isExpanded ? null : subj.id)}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black tracking-widest uppercase bg-cyan-950/80 text-cyan-300 px-2.5 py-0.5 rounded-md border border-cyan-500/30 shadow-sm">
                      Group {subj.group}
                    </span>
                    <span className="text-[10px] font-black tracking-widest uppercase bg-teal-950/80 text-teal-300 px-2.5 py-0.5 rounded-md border border-teal-500/30 shadow-sm">
                      {subj.code}
                    </span>
                    {hasCustomFilter && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {matchingTopics.length} / {subj.topics.length} matching
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
                    {subj.name}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                    <span>{rev1Count}/{totalCount} Rev 1</span>
                    <span>•</span>
                    <span>{rev2Count}/{totalCount} Rev 2</span>
                    <span>•</span>
                    <span>{rev3Count}/{totalCount} Rev 3</span>
                    {ldrCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-amber-300 font-semibold">⭐ {ldrCount} LDR</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between w-full md:w-auto gap-4 sm:gap-6">
                  
                  {/* Progress Meters */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5">
                        <Award className={`w-4 h-4 ${pct === 100 ? 'text-amber-400' : 'text-cyan-400'}`} />
                        <span className="text-sm font-black text-white font-mono">{pct}%</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={icaiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-cyan-300 hover:text-white hover:border-cyan-500/50 transition-colors cursor-pointer shadow-sm"
                      title="Open ICAI Portal Material"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleSyncToTasks(subj)}
                      disabled={syncingSubjectId === subj.id}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-cyan-300 hover:text-white hover:border-cyan-500/50 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                      title="Sync Pending Tasks to Google Tasks"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncingSubjectId === subj.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setManagingSyllabusId(subj.id); }}
                      className="p-2 rounded-xl bg-slate-900 border border-white/10 text-amber-300 hover:text-white hover:border-amber-500/50 transition-colors cursor-pointer shadow-sm"
                      title="Update Syllabus Manually or via AI"
                    >
                      <FileEdit className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block"></div>
                    <button 
                      className="p-1 rounded-full hover:bg-white/10 transition-colors text-slate-300"
                      onClick={() => setExpandedSubject(isExpanded ? null : subj.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-cyan-400" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                </div>
              </div>

              {/* Content (Expanded) */}
              {isExpanded && (
                <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950/60 space-y-6">
                  
                  {/* Chapter Table */}
                  <div className="space-y-3">
                    {/* Table Headers */}
                    <div className="flex text-[9px] sm:text-[10px] text-slate-400 font-bold px-2 sm:px-3 pb-2 border-b border-white/10 uppercase tracking-wider">
                      <span className="flex-1">Chapter / Topic Title</span>
                      <div className="flex gap-1 sm:gap-1.5 w-[150px] sm:w-[180px] justify-end shrink-0">
                        <span className="w-10 sm:w-12 text-center" title="Rev 1 (R1 - First Revision)">Rev 1</span>
                        <span className="w-10 sm:w-12 text-center" title="Rev 2 (R2 - Second Revision)">Rev 2</span>
                        <span className="w-10 sm:w-12 text-center" title="Rev 3 (LDR - Exam Revision)">Rev 3</span>
                        <span className="w-7 text-center" title="Bookmark for LDR">⭐</span>
                      </div>
                    </div>
                    
                    {/* Rows */}
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {matchingTopics.length > 0 ? (
                          matchingTopics.map((t) => (
                            <ChapterRow
                              key={t.id}
                              subjectId={subj.id}
                              topic={t}
                              onToggleTopic={onToggleTopic}
                              onToggleTopicRevision={onToggleTopicRevision}
                            />
                          ))
                        ) : (
                          <motion.div 
                            key="empty-state"
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            className="p-4 rounded-xl bg-slate-900/50 border border-white/5 text-center text-xs text-slate-400 font-medium"
                          >
                            No chapters match the selected filter query in {subj.code}.
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* MTP and PYQ Progression Section */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t border-white/10">
                    
                    {/* MTP Tracker */}
                    {subj.mtpProgress && subj.mtpProgress.length > 0 && (
                      <div className="bg-slate-900/60 rounded-xl p-4 border border-white/10 space-y-3">
                        <h4 className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wide">
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                          MTP (Model Test Papers) Series
                        </h4>
                        <div className="space-y-2">
                          {subj.mtpProgress.map((mtp) => (
                            <div key={mtp.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/5 hover:border-cyan-500/30 transition-colors">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onUpdateMtp && onUpdateMtp(subj.id, mtp.id, { completed: !mtp.completed })}
                                  className="cursor-pointer active:scale-90 transition-transform"
                                >
                                  {mtp.completed ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                                </button>
                                <span className={mtp.completed ? 'text-slate-400 line-through' : 'text-slate-200 font-medium'}>{mtp.title}</span>
                              </div>
                              {mtp.completed && (
                                <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-cyan-500/20">
                                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Score:</span>
                                  <input
                                    type="number"
                                    value={mtp.score || ''}
                                    onChange={(e) => onUpdateMtp && onUpdateMtp(subj.id, mtp.id, { score: parseInt(e.target.value) || 0 })}
                                    className="w-12 bg-slate-950 border border-cyan-500/40 rounded px-1.5 py-0.5 text-xs text-center text-cyan-200 outline-none focus:border-cyan-400 font-bold"
                                    placeholder="0"
                                  />
                                  <span className="text-[10px] font-bold text-slate-400">/ {mtp.totalScore}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PYQ Tracker */}
                    {subj.pyqProgress && subj.pyqProgress.length > 0 && (
                      <div className="bg-slate-900/60 rounded-xl p-4 border border-white/10 space-y-3">
                        <h4 className="text-xs font-extrabold text-teal-300 flex items-center gap-1.5 uppercase tracking-wide">
                          <span>📜</span> PYQ (Past Year Question Papers)
                        </h4>
                        <div className="space-y-2">
                          {subj.pyqProgress.map((pyq) => (
                            <div key={pyq.id} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-950/80 border border-white/5 hover:border-teal-500/30 transition-colors">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onUpdatePyq && onUpdatePyq(subj.id, pyq.id, { completed: !pyq.completed })}
                                  className="cursor-pointer active:scale-90 transition-transform"
                                >
                                  {pyq.completed ? <CheckSquare className="w-4 h-4 text-teal-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                                </button>
                                <span className={pyq.completed ? 'text-slate-400 line-through' : 'text-slate-200 font-medium'}>{pyq.title}</span>
                              </div>
                              {pyq.completed && (
                                <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-teal-500/20">
                                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Score:</span>
                                  <input
                                    type="number"
                                    value={pyq.score || ''}
                                    onChange={(e) => onUpdatePyq && onUpdatePyq(subj.id, pyq.id, { score: parseInt(e.target.value) || 0 })}
                                    className="w-12 bg-slate-950 border border-teal-500/40 rounded px-1.5 py-0.5 text-xs text-center text-teal-200 outline-none focus:border-teal-400 font-bold"
                                    placeholder="0"
                                  />
                                  <span className="text-[10px] font-bold text-slate-400">/ {pyq.totalScore}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {managingSyllabusId && (
        <SyllabusManagerModal 
          subjectId={managingSyllabusId} 
          onClose={() => setManagingSyllabusId(null)} 
        />
      )}
    </div>
  );
};
