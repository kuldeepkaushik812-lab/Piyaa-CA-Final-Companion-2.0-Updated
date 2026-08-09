import React, { useState, useEffect } from "react";
import { CASubject } from "../types";
import {
  Flame,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Target,
  Link,
  Clock,
} from "lucide-react";

interface SubjectKPIHubProps {
  subjects: CASubject[];
  studyHoursToday: number;
  targetStudyHours: number;
  onUpdateStudyHours: (delta: number) => void;
  onUpdateTargetHours: (delta: number) => void;
  onNavigateToSyllabus?: (subjectId: string) => void;
}

export const SubjectKPIHub: React.FC<SubjectKPIHubProps> = ({
  subjects,
  studyHoursToday,
  targetStudyHours,
  onUpdateStudyHours,
  onUpdateTargetHours,
  onNavigateToSyllabus,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || "",
  );

  // Local state for editable subject specific streaks
  const [subjectStreaks, setSubjectStreaks] = useState<Record<string, number>>(
    () => {
      const saved = localStorage.getItem("ca_companion_subject_streaks");
      return saved ? JSON.parse(saved) : {};
    },
  );

  // Local state for combined subjects mapping
  const [combinedSubjects, setCombinedSubjects] = useState<
    Record<string, string>
  >(() => {
    const saved = localStorage.getItem("ca_companion_combined_subjects");
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem(
      "ca_companion_subject_streaks",
      JSON.stringify(subjectStreaks),
    );
  }, [subjectStreaks]);

  useEffect(() => {
    localStorage.setItem(
      "ca_companion_combined_subjects",
      JSON.stringify(combinedSubjects),
    );
  }, [combinedSubjects]);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const handleStreakChange = (id: string, delta: number) => {
    setSubjectStreaks((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const handleCombineToggle = (targetId: string) => {
    if (!selectedSubject) return;
    setCombinedSubjects((prev) => {
      const newMap = { ...prev };
      if (newMap[selectedSubject.id] === targetId) {
        delete newMap[selectedSubject.id];
      } else {
        newMap[selectedSubject.id] = targetId;
      }
      return newMap;
    });
  };

  // Generate current week starting from Monday
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(d);
  }

  const currentDayOfMonth = today.getDate();
  const monthName = today.toLocaleString("default", { month: "long" });
  const totalDaysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
  ).getDate();

  if (!selectedSubject) return null;

  const currentStreak = subjectStreaks[selectedSubject.id] || 0;
  const combinedWithId = combinedSubjects[selectedSubject.id];
  const combinedWithSubject = subjects.find((s) => s.id === combinedWithId);

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)]">
      {/* Scrollable Subject List */}
      <div className="w-full md:w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 scrollbar-none">
        <h2 className="text-xl font-extrabold text-amber-300 mb-2 flex items-center gap-2">
          <BookOpen className="w-6 h-6" /> Subjects
        </h2>
        {subjects.map((subject) => (
          <button
            key={subject.id}
            onClick={() => setSelectedSubjectId(subject.id)}
            className={`text-left p-4 rounded-2xl border transition-all ${
              selectedSubjectId === subject.id
                ? "bg-emerald-950/40 border-emerald-400/50 shadow-lg shadow-emerald-900/20"
                : "glass-card border-emerald-500/20 hover:border-emerald-400/40 hover:bg-emerald-900/20"
            }`}
          >
            <div className="text-xs font-bold text-emerald-300 mb-1">
              Group {subject.group}
            </div>
            <div
              className={`font-bold ${selectedSubjectId === subject.id ? "text-white" : "text-slate-200"}`}
            >
              {subject.name}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Subject KPIs */}
      <div className="w-full md:w-2/3 glass-panel rounded-3xl border border-emerald-500/30 p-6 md:p-8 flex flex-col overflow-y-auto scrollbar-none">
        <div className="mb-8 border-b border-emerald-500/20 pb-6">
          <div className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-wider mb-3 bg-gradient-to-r from-amber-300 to-emerald-500 text-slate-900">
            {selectedSubject.code}
          </div>
          <h2 className="text-3xl font-black text-white">
            {selectedSubject.name}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Editable Streak */}
          <div className="glass-card p-6 rounded-2xl border border-orange-500/30 flex flex-col items-center text-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Flame className="w-8 h-8 text-orange-400 mb-3 animate-pulse" />
            <div className="text-xs font-bold text-orange-200 uppercase tracking-wider mb-2">
              Subject Study Streak
            </div>

            <div className="flex items-center gap-4 mt-2 z-10">
              <button
                onClick={() => handleStreakChange(selectedSubject.id, -1)}
                className="w-10 h-10 rounded-full bg-slate-900 border border-orange-500/40 flex items-center justify-center text-orange-400 hover:bg-orange-950/50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-4xl font-black text-white w-16 text-center">
                {currentStreak}
              </div>
              <button
                onClick={() => handleStreakChange(selectedSubject.id, 1)}
                className="w-10 h-10 rounded-full bg-slate-900 border border-orange-500/40 flex items-center justify-center text-orange-400 hover:bg-orange-950/50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-3">Days in a row</div>
          </div>

          {/* Weekly Calendar Linked to Progress */}
          <div className="glass-card p-6 rounded-2xl border border-emerald-500/30 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-4 text-emerald-300">
              <Calendar className="w-5 h-5" />
              <div className="text-sm font-bold uppercase tracking-wider">
                Weekly G-Cal Progress
              </div>
            </div>
            <div className="flex justify-between items-center gap-1">
              {weekDays.map((date, i) => {
                const isToday =
                  date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();
                const isPastOrToday = date.getTime() <= today.getTime();

                // Mock link to G-Cal: active if streak covers this past day
                const dayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 for Mon, 6 for Sun
                const isActive = isPastOrToday && currentStreak > dayIndex - i;

                return (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {date
                        .toLocaleDateString("en-US", { weekday: "short" })
                        .charAt(0)}
                    </div>
                    <div
                      className={`w-8 h-10 rounded-lg flex items-center justify-center transition-all ${
                        isActive
                          ? "bg-emerald-500/20 border border-emerald-500/50 shadow-inner"
                          : "bg-slate-900/50 border border-slate-700/50"
                      } ${isToday ? "ring-2 ring-amber-400/50" : ""}`}
                    >
                      {isActive ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-[10px] text-emerald-400/70 mt-4 text-center flex items-center justify-center gap-1">
              <Link className="w-3 h-3" /> Synced with G-Cal Tracker
            </div>
          </div>
        </div>

        {/* Daily Study Tracker (Synced with G-Cal) */}
        <div className="glass-card p-6 rounded-2xl border border-teal-500/30 flex flex-col mb-8">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-teal-500/20">
            <div className="flex items-center gap-2 text-teal-300">
              <Clock className="w-5 h-5" />
              <div className="text-sm font-bold uppercase tracking-wider">
                Today's Study Target
              </div>
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-amber-300 text-xs font-black flex items-center gap-1.5 shadow-md">
              <Calendar className="w-3.5 h-3.5 text-amber-300" />
              <span>
                {currentDayOfMonth}/{totalDaysInMonth} days of {monthName}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              {/* Actual Study Hours */}
              <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <span className="text-xs font-bold text-slate-300">
                  Studied Today
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onUpdateStudyHours(-0.5)}
                    className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-black text-white w-12 text-center">
                    {studyHoursToday.toFixed(1)}h
                  </span>
                  <button
                    onClick={() => onUpdateStudyHours(0.5)}
                    className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-teal-400 hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Target Study Hours */}
              <div className="flex items-center justify-between bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                <span className="text-xs font-bold text-slate-300">
                  Daily Target
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onUpdateTargetHours(-1)}
                    className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-black text-amber-300 w-12 text-center">
                    {targetStudyHours}h
                  </span>
                  <button
                    onClick={() => onUpdateTargetHours(1)}
                    className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 hover:bg-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Completion Percentage */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#0f172a"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke="#14b8a6"
                    strokeWidth="8"
                    strokeDasharray="251.2"
                    strokeDashoffset={
                      251.2 -
                      (251.2 *
                        Math.min(
                          100,
                          (studyHoursToday / targetStudyHours) * 100,
                        )) /
                        100
                    }
                    className="transition-all duration-1000 ease-out"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-teal-300">
                    {Math.min(
                      100,
                      Math.round((studyHoursToday / targetStudyHours) * 100),
                    )}
                    %
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Complete
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-teal-400/70 mt-2 text-center flex items-center justify-center gap-1">
                <Link className="w-3 h-3" /> Auto-syncs with G-Cal Tracker
              </div>
            </div>
          </div>
        </div>

        {/* Subject Combiner */}
        <div className="glass-card p-6 rounded-2xl border border-indigo-500/30 flex flex-col">
          <div className="flex items-center gap-2 mb-4 text-indigo-300">
            <Target className="w-5 h-5" />
            <div className="text-sm font-bold uppercase tracking-wider">
              Combine Subject
            </div>
          </div>
          <p className="text-xs text-slate-300 mb-4">
            Select another subject to pair with {selectedSubject.code} for
            inter-linked study sessions.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {subjects
              .filter((s) => s.id !== selectedSubject.id)
              .map((s) => {
                const isCombined = combinedWithId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleCombineToggle(s.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-between ${
                      isCombined
                        ? "bg-indigo-500/20 border-indigo-400/60 text-white shadow-lg shadow-indigo-900/20"
                        : "bg-slate-900/50 border-slate-700/50 text-slate-400 hover:border-indigo-500/40 hover:text-indigo-200"
                    }`}
                  >
                    <span className="truncate mr-2">{s.code}</span>
                    {isCombined ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 opacity-50 shrink-0" />
                    )}
                  </button>
                );
              })}
          </div>

          {combinedWithSubject && (
            <div className="mt-4 p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 flex items-center gap-3">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg">
                <Link className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-xs text-indigo-100">
                Currently combining{" "}
                <span className="font-bold text-white">
                  {selectedSubject.code}
                </span>{" "}
                with{" "}
                <span className="font-bold text-white">
                  {combinedWithSubject.code}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
