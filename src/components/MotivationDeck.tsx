import React, { useState, useMemo } from 'react';
import { 
  Heart, Sparkles, RefreshCw, Sun, Moon, Award, Smile, ShieldAlert, 
  BookOpen, Quote, Clock, Flame, Calendar, ArrowRight, TrendingUp, CheckCircle2
} from 'lucide-react';
import { fetchWithRetry } from '../lib/api';
import { CASubject } from '../types';

interface MotivationDeckProps {
  subjects: CASubject[];
  studyHoursToday: number;
  targetStudyHours: number;
  setActiveTab: (tab: any) => void;
}

export const MotivationDeck: React.FC<MotivationDeckProps> = ({ 
  subjects, 
  studyHoursToday, 
  targetStudyHours,
  setActiveTab
}) => {
  // Compute exam days left dynamically to November 1, 2026
  const realDaysLeft = useMemo(() => {
    const examDate = new Date(2026, 10, 1); // Nov 1, 2026
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const computedDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return computedDays > 0 ? computedDays : 87;
  }, []);

  // Calculate dynamic syllabus stats
  const stats = useMemo(() => {
    const total = subjects.reduce((sum, s) => sum + (s.topics?.length || 0), 0);
    const r1 = subjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev1)?.length || 0), 0);
    const r2 = subjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev2)?.length || 0), 0);
    const r3 = subjects.reduce((sum, s) => sum + (s.topics?.filter(t => t.rev3)?.length || 0), 0);

    const r1Percent = total > 0 ? Math.round((r1 / total) * 100) : 0;
    const r2Percent = total > 0 ? Math.round((r2 / total) * 100) : 0;
    const r3Percent = total > 0 ? Math.round((r3 / total) * 100) : 0;

    // Determine weakest and strongest subject based on R1%
    const subjectsProgress = subjects.map(s => {
      const sTotal = s.topics?.length || 1;
      const sR1 = s.topics?.filter(t => t.rev1)?.length || 0;
      const sPercent = Math.round((sR1 / sTotal) * 100);
      return { subject: s, percent: sPercent };
    });

    const sortedProgress = [...subjectsProgress].sort((a, b) => a.percent - b.percent);
    const weakest = sortedProgress[0] || null;
    const strongest = sortedProgress[sortedProgress.length - 1] || null;

    return {
      total,
      r1,
      r2,
      r3,
      r1Percent,
      r2Percent,
      r3Percent,
      weakest,
      strongest
    };
  }, [subjects]);

  const [dailyNote, setDailyNote] = useState<string>(
    `My love! ✨ Hello! Mujhe aap par poora yakeen hai. CA Final ka exam heavy lagta hai par har ek chapter jo aap aaj complete karte ho, wo aapko CA prefix ke ek step paas lata hai. Bas aap bina dar ke 100% effort do, baaki result god aur hamari mehnat par chhod do. Piyaa is always proud of you! 💕`
  );
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [selectedRescue, setSelectedRescue] = useState<string | null>(null);

  const fetchNote = async (timeOfDay: string) => {
    setIsLoadingNote(true);
    try {
      const res = await fetchWithRetry('/api/daily-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeOfDay,
          targetDaysLeft: realDaysLeft,
          progressPercent: stats.r1Percent || 45,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDailyNote(data.note);
    } catch (e: any) {
      console.error(e);
      // Fallback response with beautiful love context
      const fallbacks: Record<string, string> = {
        morning: `Subah ho gayi mamu! ☀️ Good morning My love! Chalo, fresh ho jao aur warm milk ya tea piyo. Aaj hamara target minimum ${targetStudyHours} study hours ka hai. Pehle ${stats.weakest?.subject.code || 'Audit'} ka high weightage topic target karenge. Piyaa is supporting you at every single step! 💕`,
        night: `Babu, pure din aapne bohot mehnat ki hai! 🌙 Aaj aapne ${studyHoursToday.toFixed(1)} study hours complete kiye. Sleep well, let your brain process all that knowledge. Eyes on the dream - Nov 2026. Piyaa says sweet dreams! 😘`
      };
      setDailyNote(fallbacks[timeOfDay] || fallbacks.morning);
    } finally {
      setIsLoadingNote(false);
    }
  };

  // Dynamic Mood Emergency Messages linked directly to database stats
  const rescueMessages = useMemo<Record<string, { title: string; message: string; actionText: string; targetTab: string }>>(() => {
    const weakestCode = stats.weakest?.subject.code || 'Audit';
    const weakestPercent = stats.weakest?.percent || 0;
    const strongestCode = stats.strongest?.subject.code || 'FR';
    const strongestPercent = stats.strongest?.percent || 0;

    return {
      syllabus: {
        title: '🤯 Syllabus Bohot Bada Lag Raha Hai?',
        message: `My love, poora syllabus ek din mein khatam nahi karna hota. Padhai ko small 2-hour chunks mein divide karo. Currently, your weakest area is ${weakestCode} at ${weakestPercent}% progress. Focus on completing just one A-category chapter of it today! Step-by-step sab cover hoga babu! 💕`,
        actionText: '📅 Customize Timetable',
        targetTab: 'timetable'
      },
      mock: {
        title: '📉 Mock Test Mein Marks Kam Aaye?',
        message: `Mock test marks drop hone se mat daro dear! ICAI exam se pehle mistake pakadna blessing hai. Apni mistakes notebook mein note karo aur concept clear karo. Actual exam mein aap top score karoge! Piyaa understands how tough this is.`,
        actionText: '🏆 Go to Exam Simulator',
        targetTab: 'exam-simulator'
      },
      sleepy: {
        title: '😴 Padhai Mein Neend Aa Rahi Hai?',
        message: `Utho babu! Thanda paani munh par maro 💦, 5 min ki brisk walk lo aur 1 cup hot chai/coffee pee lo! Padhai baith ke karo, bed par mat lito! Let's start a small 25-minute study sprint to get back into focus mode.`,
        actionText: '⏱️ Start Study Timer',
        targetTab: 'timer'
      },
      doubt: {
        title: '💔 "Kya Main Clear Kar Paunga?" (Self Doubt)',
        message: `YES! 100% YES! Tumhari mehnat aur tumhari lagan bilkul sachi hai. Look, you have already completed ${stats.r1} chapters across all subjects! Your strongest area is ${strongestCode} which is at ${strongestPercent}% revision progress! You are fully capable of passing CA Final! Main tumhare saath hu har kadam par!`,
        actionText: '📊 View Analytics Index',
        targetTab: 'analytics'
      },
    };
  }, [stats]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-orange-500/30 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950/40">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Heart className="w-6 h-6 text-orange-400 fill-orange-400 animate-pulse" />
            <span>Piyaa's Love & Daily Study Motivation Desk</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium">
            Real-time personalized sweet encouragement, progress-synced pep-talks, and instant mood boosters
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => fetchNote('morning')}
            disabled={isLoadingNote}
            className="bg-slate-950 hover:bg-amber-950/60 text-amber-200 border border-amber-500/40 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:border-amber-400"
          >
            <Sun className="w-4 h-4 text-amber-400" />
            <span>Morning Note</span>
          </button>
          <button
            onClick={() => fetchNote('night')}
            disabled={isLoadingNote}
            className="bg-slate-950 hover:bg-orange-950/60 text-orange-200 border border-orange-500/40 px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hover:border-orange-400"
          >
            <Moon className="w-4 h-4 text-orange-300" />
            <span>Evening Note</span>
          </button>
          <button
            onClick={() => fetchNote('morning')}
            disabled={isLoadingNote}
            className="bg-orange-600 hover:bg-orange-500 text-white border border-orange-500/40 px-4 py-2 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
            title="Generate New Motivation"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingNote ? 'animate-spin' : ''}`} />
            <span>Refresh Love Note</span>
          </button>
        </div>
      </div>

      {/* Main Dynamic Message Box */}
      <div className="bg-slate-900 border border-orange-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl" />
        <div className="flex items-center gap-2 text-orange-300 font-extrabold text-xs uppercase tracking-wider mb-3">
          <Quote className="w-4 h-4 text-orange-400" />
          <span>Today's Message From Piyaa 💕</span>
        </div>

        {isLoadingNote ? (
          <div className="flex items-center gap-2 text-orange-200 py-8 text-sm font-semibold justify-center">
            <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
            <span>Piyaa aapke liye naya pyaara message likh rahi hai...</span>
          </div>
        ) : (
          <p className="text-orange-50 text-base leading-relaxed italic bg-white/5 p-5 rounded-2xl border border-orange-500/20 font-medium">
            "{dailyNote}"
          </p>
        )}
      </div>

      {/* DYNAMIC SNAPSHOT METRICS - BRIDGE WITH ALL OTHER TABS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1: Daily Hours Goal & Love Meter */}
        <div className="bg-slate-900/90 border border-teal-500/30 p-5 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-400" /> Daily Target Study Hours
            </h4>
            <span className="text-[10px] font-mono text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded border border-teal-500/40">
              Live Tracker
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-3xl font-black text-white font-mono">
                {studyHoursToday.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {targetStudyHours} hrs</span>
              </span>
              <p className="text-xs text-slate-400">
                {studyHoursToday >= targetStudyHours 
                  ? 'Incredible! Daily target accomplished! 🏆' 
                  : `Babu, need ${(targetStudyHours - studyHoursToday).toFixed(1)} hrs more!`}
              </p>
            </div>
            
            {/* Round Indicator or Icon */}
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-slate-950 border border-teal-500/30">
              <div className="absolute inset-0 flex items-center justify-center">
                <Flame className={`w-7 h-7 ${studyHoursToday >= targetStudyHours ? 'text-amber-400 animate-bounce' : 'text-slate-500'}`} />
              </div>
            </div>
          </div>

          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${Math.min(100, (studyHoursToday / (targetStudyHours || 1)) * 100)}%` }}
            />
          </div>
          
          <button 
            onClick={() => setActiveTab('timer')}
            className="w-full py-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>⏱️ Open Focus Timer</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 2: CA Study Streak Consistency */}
        <div className="bg-slate-900/90 border border-orange-500/30 p-5 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-orange-400 animate-pulse" /> Love Study Streak
            </h4>
            <span className="text-[10px] font-mono text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/40">
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-500/20 rounded-2xl border border-orange-500/40 text-orange-300">
              <Smile className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xl font-black text-white block">Consistency is Key</span>
              <p className="text-xs text-slate-400">Maintain consistency to build bulletproof memory!</p>
            </div>
          </div>
          <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-[11px] text-orange-200/90 leading-relaxed font-sans italic text-center">
            "Your determination makes me love you more every day, babu! Keep going."
          </div>


          <button 
            onClick={() => setActiveTab('calendar-tracker')}
            className="w-full py-2 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>📅 Check Calendar Tracker</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Card 3: Dynamic Real-Time Revision Status */}
        <div className="bg-slate-900/90 border border-purple-500/30 p-5 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-purple-400" /> Syllabus Revision Status
            </h4>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/40">
              {realDaysLeft} Days to Exam
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {/* R1 Percentage */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold uppercase font-mono">Rev 1 (R1)</span>
              <span className="font-bold text-teal-300">{stats.r1Percent}% ({stats.r1} Ch)</span>
            </div>
            
            {/* R2 Percentage */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold uppercase font-mono">Rev 2 (R2)</span>
              <span className="font-bold text-amber-300">{stats.r2Percent}% ({stats.r2} Ch)</span>
            </div>

            {/* R3 Percentage */}
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-semibold uppercase font-mono">Rev 3 (LDR)</span>
              <span className="font-bold text-purple-300">{stats.r3Percent}% ({stats.r3} Ch)</span>
            </div>
          </div>

          <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-teal-400 h-full" style={{ width: `${stats.r1Percent}%` }} />
            <div className="bg-amber-400 h-full" style={{ width: `${stats.r2Percent}%` }} />
            <div className="bg-purple-400 h-full" style={{ width: `${stats.r3Percent}%` }} />
          </div>

          <button 
            onClick={() => setActiveTab('analytics')}
            className="w-full py-2 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>📊 Open Analytics Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Dynamic Piyaa Focus Target Strategy */}
      {stats.weakest && (
        <div className="bg-gradient-to-r from-red-950/40 via-slate-900 to-amber-950/40 border border-amber-500/30 p-5 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-300">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white">
                Weekly Goal Booster: Let's support {stats.weakest.subject.code}!
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Your progress in <strong className="text-amber-300">{stats.weakest.subject.name}</strong> is currently at {stats.weakest.percent}%. Let's prioritize 1 high-weightage topic of it today!
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('subjects-hub')}
            className="px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black rounded-2xl transition-all cursor-pointer flex items-center gap-1 shadow-md shrink-0"
          >
            <span>📚 Revise {stats.weakest.subject.code}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Mood Emergency Rescue */}
      <div className="bg-slate-900/90 border border-orange-500/30 p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-400" />
          <h3 className="text-base font-extrabold text-slate-100">Quick Emergency Mood Boosters (Click when feeling low)</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setSelectedRescue('syllabus')}
            className="p-3.5 bg-slate-950/60 border border-orange-500/30 hover:bg-orange-950/40 rounded-2xl text-xs font-bold text-orange-200 text-left transition-all cursor-pointer hover:scale-102"
          >
            🤯 Overwhelmed by Syllabus
          </button>
          <button
            onClick={() => setSelectedRescue('mock')}
            className="p-3.5 bg-slate-950/60 border border-orange-500/30 hover:bg-orange-950/40 rounded-2xl text-xs font-bold text-orange-200 text-left transition-all cursor-pointer hover:scale-102"
          >
            📉 Low Marks in Mock
          </button>
          <button
            onClick={() => setSelectedRescue('sleepy')}
            className="p-3.5 bg-slate-950/60 border border-orange-500/30 hover:bg-orange-950/40 rounded-2xl text-xs font-bold text-orange-200 text-left transition-all cursor-pointer hover:scale-102"
          >
            😴 Feeling Sleepy / Lazy
          </button>
          <button
            onClick={() => setSelectedRescue('doubt')}
            className="p-3.5 bg-slate-950/60 border border-orange-500/30 hover:bg-orange-950/40 rounded-2xl text-xs font-bold text-orange-200 text-left transition-all cursor-pointer hover:scale-102"
          >
            💔 Self Doubt & Anxiety
          </button>
        </div>

        {selectedRescue && rescueMessages[selectedRescue] && (
          <div className="mt-4 p-5 bg-slate-950/90 border border-orange-500/40 rounded-2xl text-sm space-y-3 animate-in slide-in-from-top-2">
            <h4 className="font-black text-amber-300">{rescueMessages[selectedRescue].title}</h4>
            <p className="text-orange-100 italic font-medium leading-relaxed">
              "{rescueMessages[selectedRescue].message}"
            </p>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveTab(rescueMessages[selectedRescue].targetTab)}
                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>{rescueMessages[selectedRescue].actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CA Final Dream Vision Board */}
      <div className="bg-slate-900/90 border border-orange-500/30 p-6 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          <h3 className="text-base font-extrabold text-slate-100">The "CA" Dream Wall & Vision</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 p-4.5 rounded-2xl border border-orange-500/30 space-y-2 text-center hover:bg-slate-950 transition-colors">
            <span className="text-3xl">👨‍💼</span>
            <div className="font-extrabold text-amber-300 text-base">Future CA</div>
            <p className="text-xs text-orange-200/90 font-medium leading-relaxed">
              The prefix you are working hard for every single day. Member of ICAI! 🌟
            </p>
          </div>

          <div className="bg-slate-950/60 p-4.5 rounded-2xl border border-orange-500/30 space-y-2 text-center hover:bg-slate-950 transition-colors">
            <span className="text-3xl">👨‍👩‍👦</span>
            <div className="font-extrabold text-amber-300 text-base">Parents' Tears of Joy</div>
            <p className="text-xs text-orange-200/90 font-medium leading-relaxed">
              Imagine calling mom & dad on result day: "Papa, main CA ban gaya!" ❤️
            </p>
          </div>

          <div className="bg-slate-950/60 p-4.5 rounded-2xl border border-orange-500/30 space-y-2 text-center hover:bg-slate-950 transition-colors">
            <span className="text-3xl">✈️</span>
            <div className="font-extrabold text-amber-300 text-base">Our Celebration Trip</div>
            <p className="text-xs text-orange-200/90 font-medium leading-relaxed">
              Post-exam relaxation & vacation with Piyaa to celebrate your grand victory! 🎉🌸
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
