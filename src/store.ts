import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CASubject, TimetableSlot, StudyHistoryLog, SlotStatus, BacklogDebtItem, TimetablePreset, ChatMessage, FocusSession } from './types';
import { DEFAULT_CA_SUBJECTS, INITIAL_TIMETABLE } from './data/caData';
import { getISTYMD, addDaysToYMD } from './lib/dateUtils';
import { parseSlotHours, parseTimeStr, formatMinutesToTimeStr, sanitizeAndMergeConsecutiveBreaks } from './utils/timeUtils';
import { idbStateStorage } from './lib/idbStorage';

export interface StudyLog {
  id: string;
  date: string;
  subjectId: string;
  hours: number;
}

interface GlobalState {
  subjects: CASubject[];
  setSubjects: (subjects: CASubject[] | ((prev: CASubject[]) => CASubject[])) => void;
  updateSubject: (id: string, updates: Partial<CASubject>) => void;

  timetable: TimetableSlot[];
  setTimetable: (timetable: TimetableSlot[] | ((prev: TimetableSlot[]) => TimetableSlot[])) => void;

  schedulesByDate: Record<string, TimetableSlot[]>;
  getScheduleForDate: (dateStr: string) => TimetableSlot[];
  addPomodoroProgressToSlot: (dateStr: string, slotId: string, hours: number) => void;
  setScheduleForDate: (dateStr: string, slots: TimetableSlot[]) => void;
  applyScheduleToFutureRange: (sourceSlots: TimetableSlot[], startDateStr: string, daysCount: number) => void;

  dailyNotes: Record<string, string>;
  setDailyNote: (dateStr: string, note: string) => void;

  dailyTargets: Record<string, number>;
  getDailyTarget: (dateStr: string) => number;
  setDailyTarget: (dateStr: string, target: number) => void;

  studyLogs: StudyLog[];
  addStudyLog: (subjectId: string | null, hours: number, dateStr?: string) => void;
  deleteStudyLog: (id: string) => void;
  updateStudyLogHoursDirectly: (id: string, hours: number) => void;
  getSubjectHoursToday: (subjectId: string) => number;
  getTotalHoursToday: () => number;
  getTotalHoursForDate: (dateStr: string) => number;
  
  focusSessions: FocusSession[];
  addFocusSession: (session: Omit<FocusSession, 'id' | 'timestamp'>) => void;
  
  targetStudyHours: number;
  setTargetStudyHours: (hours: number | ((prev: number) => number)) => void;
  
  globalTargetDays: { rev1: number; rev2: number; rev3: number; mtp: number; pyq: number };
  setGlobalTargetDays: (targets: { rev1: number; rev2: number; rev3: number; mtp: number; pyq: number }) => void;

  subjectStreaks: Record<string, number>;
  incrementSubjectStreak: (subjectId: string) => void;
  getSubjectStreak: (subjectId: string) => number;

  cloudSyncStatus: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued';
  setCloudSyncStatus: (status: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued') => void;
  isForceOfflineMode: boolean;
  setForceOfflineMode: (force: boolean) => void;

  statusFilter: 'ALL' | 'PENDING_REV1' | 'PENDING_REV2' | 'PENDING_REV3' | 'LDR_STARRED' | 'NA';
  setStatusFilter: (filter: 'ALL' | 'PENDING_REV1' | 'PENDING_REV2' | 'PENDING_REV3' | 'LDR_STARRED' | 'NA') => void;

  activeTab: 'master-summary' | 'subjects-hub' | 'chat' | 'timetable' | 'timer' | 'subjects' | 'analytics' | 'radar' | 'motivation' | 'evaluator' | 'flashcards' | 'calendar-tracker' | 'study-buddy' | 'exam-simulator' | 'study-history';
  setActiveTab: (tab: 'master-summary' | 'subjects-hub' | 'chat' | 'timetable' | 'timer' | 'subjects' | 'analytics' | 'radar' | 'motivation' | 'evaluator' | 'flashcards' | 'calendar-tracker' | 'study-buddy' | 'exam-simulator' | 'study-history') => void;

  selectedGroupFilter: 1 | 2 | 'BOTH';
  setSelectedGroupFilter: (group: 1 | 2 | 'BOTH') => void;

  currentSubject: string;
  setCurrentSubject: (subjectId: string) => void;
  timerTargetSlotId: string | null;
  setTimerTargetSlotId: (id: string | null) => void;

  selectedDateStr: string;
  setSelectedDateStr: (date: string) => void;
  clearStudyLogsForDate: (dateStr: string) => void;
  recalculateAllMetrics: (dateStr: string) => void;

  // Real-World Resilience & Time-Recording Upgrades
  dailyShiftMinutes: Record<string, number>;
  isIdleGuardEnabled: boolean;
  setIsIdleGuardEnabled: (enabled: boolean) => void;
  scheduleHistoryByDate: Record<string, { slots: TimetableSlot[]; dailyShiftMinutes: number }[]>;
  pushScheduleHistory: (dateStr: string) => void;
  undoLastScheduleAction: (dateStr: string) => boolean;
  canUndoScheduleAction: (dateStr: string) => boolean;
  shiftScheduleCascading: (dateStr: string, slotId: string, shiftMins: 15 | 30) => { success: boolean; message: string };
  splitSlotAndMorphSubject: (dateStr: string, slotId: string, newSubjectName: string, newTopicName?: string) => void;
  quickAddMicroLog: (dateStr: string, slotId: string, incrementHours: number) => void;
  getTotalBacklogDebtHours: () => number;
  getBacklogDebtDetails: () => BacklogDebtItem[];
  settleAllBacklogDebt: () => void;

  studyHistoryLogs: StudyHistoryLog[];
  logStudyActivity: (entry: Omit<StudyHistoryLog, 'id' | 'timestamp' | 'status'>) => void;
  deleteStudyHistoryLog: (id: string) => void;
  updateStudyHistoryLogNotes: (id: string, notes: string) => void;
  clearStudyHistoryLogs: () => void;

  customTimetablePresets: TimetablePreset[];
  addTimetablePreset: (preset: Omit<TimetablePreset, 'id'>) => void;
  deleteTimetablePreset: (id: string) => void;

  chatMessages: ChatMessage[];
  setChatMessages: (messages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  addChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;

  userInstructions: string;
  setUserInstructions: (instructions: string) => void;

  hydrateFromCloud: (data: any) => void;
  resetState: () => void;

  exportBackupJson: () => void;
  importBackupJson: (jsonData: string) => boolean;

  isTodaySyncedWithWeekly: boolean;
  setIsTodaySyncedWithWeekly: (synced: boolean) => void;
}


export const useStore = create<GlobalState>()(
  persist(
    (set, get) => ({
      subjects: DEFAULT_CA_SUBJECTS,
      setSubjects: (subjectsOrFn) => {
        set((state) => ({
          subjects: typeof subjectsOrFn === 'function' ? subjectsOrFn(state.subjects) : subjectsOrFn
        }));
      },
      updateSubject: (id, updates) => {
        set((state) => ({
          subjects: state.subjects.map((s) => s.id === id ? { ...s, ...updates } : s)
        }));
      },

      isTodaySyncedWithWeekly: true,
      setIsTodaySyncedWithWeekly: (synced) => {
        set((state) => {
          const today = getISTYMD();
          if (synced) {
            const weeklyPlanForToday = state.schedulesByDate[today] || INITIAL_TIMETABLE;
            return {
              isTodaySyncedWithWeekly: true,
              timetable: weeklyPlanForToday
            };
          } else {
            return {
              isTodaySyncedWithWeekly: false
            };
          }
        });
      },

      timetable: INITIAL_TIMETABLE,
      setTimetable: (timetableOrFn) => {
        set((state) => {
          const rawNext = typeof timetableOrFn === 'function' ? timetableOrFn(state.timetable) : timetableOrFn;
          const nextTimetable = sanitizeAndMergeConsecutiveBreaks(rawNext || []);
          const today = getISTYMD();
          const shouldSync = state.isTodaySyncedWithWeekly !== false;
          return {
            timetable: nextTimetable,
            ...(shouldSync ? { schedulesByDate: { ...(state.schedulesByDate || {}), [today]: nextTimetable } } : {})
          };
        });
        get().recalculateAllMetrics(getISTYMD());
      },

      schedulesByDate: {},
      getScheduleForDate: (dateStr) => {
        const state = get();
        if (state.schedulesByDate && state.schedulesByDate[dateStr]) {
          return state.schedulesByDate[dateStr];
        }
        return state.timetable || INITIAL_TIMETABLE;
      },
      addPomodoroProgressToSlot: (dateStr, slotId, hours) => {
        set((state) => {
          const today = getISTYMD();
          const slots = state.schedulesByDate[dateStr] || state.timetable;
          const newSlots = slots.map(slot => {
            if (slot.id === slotId) {
              const totalSlotHours = parseSlotHours(slot.time) || 2;
              const currentStudied = (slot.studiedDurationHours || ((slot.progress || 0) * totalSlotHours / 100)) + hours;
              const addedProgress = (hours / totalSlotHours) * 100;
              const newProgress = Math.min(100, (slot.progress || 0) + addedProgress);
              
              let newStatus = slot.status;
              let isCompleted = slot.completed;
              if (currentStudied >= totalSlotHours) {
                newStatus = 'COMPLETED';
                isCompleted = true;
              } else if (currentStudied > 0) {
                newStatus = 'IN_PROGRESS';
              }
              
              return { 
                ...slot, 
                progress: newProgress, 
                completed: isCompleted,
                studiedDurationHours: currentStudied,
                totalDurationHours: totalSlotHours,
                status: newStatus as any
              };
            }
            return slot;
          });
          const newSchedules = { ...(state.schedulesByDate || {}), [dateStr]: newSlots };
          const shouldSync = state.isTodaySyncedWithWeekly !== false;
          return {
            schedulesByDate: newSchedules,
            ...(dateStr === today && shouldSync ? { timetable: newSlots } : {})
          };
        });
        get().recalculateAllMetrics(dateStr);
      },
      setScheduleForDate: (dateStr, rawSlots) => {
        set((state) => {
          const slots = sanitizeAndMergeConsecutiveBreaks(rawSlots || []);
          const today = getISTYMD();
          const newSchedules = { ...(state.schedulesByDate || {}), [dateStr]: slots };
          const shouldSync = state.isTodaySyncedWithWeekly !== false;
          return {
            schedulesByDate: newSchedules,
            ...(dateStr === today && shouldSync ? { timetable: slots } : {})
          };
        });
        get().recalculateAllMetrics(dateStr);
      },
      applyScheduleToFutureRange: (sourceSlots, startDateStr, daysCount) => {
        set((state) => {
          const newSchedules = { ...(state.schedulesByDate || {}) };
          let currDate = startDateStr;
          for (let i = 0; i < daysCount; i++) {
            const dateKey = currDate;
            newSchedules[dateKey] = sourceSlots.map((s, idx) => ({ ...s, id: `slot-${dateKey}-${idx}` }));
            currDate = addDaysToYMD(currDate, 1);
          }
          const today = getISTYMD();
          return {
            schedulesByDate: newSchedules,
            ...(newSchedules[today] ? { timetable: newSchedules[today] } : {})
          };
        });
      },

      dailyNotes: {},
      setDailyNote: (dateStr, note) => {
        set((state) => ({
          dailyNotes: { ...(state.dailyNotes || {}), [dateStr]: note }
        }));
      },

      dailyTargets: {},
      getDailyTarget: (dateStr) => {
        const state = get();
        // Priority 1: User explicitly configured/saved target for this date
        if (state.dailyTargets && typeof state.dailyTargets[dateStr] === 'number') {
          return state.dailyTargets[dateStr];
        }

        // Priority 2: Calculate planned from active schedule slots if available
        const slots = state.schedulesByDate && state.schedulesByDate[dateStr] 
          ? state.schedulesByDate[dateStr] 
          : (dateStr === getISTYMD() ? state.timetable : []);
          
        let planned = 0;
        if (Array.isArray(slots) && slots.length > 0) {
          slots.forEach(s => {
            if (s.category !== 'break' && s.category !== 'na' && s.status !== 'NA') {
              if (s.totalDurationHours) {
                planned += s.totalDurationHours;
              } else if (s.time && s.time.includes('-')) {
                const parts = s.time.split('-');
                const parseMins = (t: string) => {
                  const match = t.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
                  if (!match) return 0;
                  let h = parseInt(match[1], 10);
                  let m = parseInt(match[2], 10);
                  let p = match[3] ? match[3].toUpperCase() : 'AM';
                  if (p === 'PM' && h < 12) h += 12;
                  if (p === 'AM' && h === 12) h = 0;
                  return h * 60 + m;
                };
                let start = parseMins(parts[0]);
                let end = parseMins(parts[1]);
                if (end < start) end += 1440;
                planned += (end - start) / 60;
              } else {
                planned += 1.5;
              }
            }
          });
        }

        return planned > 0 ? Number(planned.toFixed(2)) : (state.targetStudyHours || 8);
      },
      setDailyTarget: (dateStr, target) => {
        set((state) => {
          const today = getISTYMD();
          return {
            dailyTargets: { ...(state.dailyTargets || {}), [dateStr]: target },
            ...(dateStr === today ? { targetStudyHours: target } : {})
          };
        });
      },

      focusSessions: [],
      addFocusSession: (session) => {
        set((state) => ({
          focusSessions: [{ ...session, id: Date.now().toString(), timestamp: Date.now() }, ...(state.focusSessions || [])]
        }));
      },

      studyLogs: [],
      addStudyLog: (subjectId, hours, customDateStr) => {
        set((state) => {
          const targetDate = customDateStr || getISTYMD();
          const targetId = subjectId || 'general';
          const existingLogIndex = state.studyLogs.findIndex(
            (log) => log.date === targetDate && log.subjectId === targetId
          );
          let newLogs = state.studyLogs.map(l => ({ ...l }));
          if (existingLogIndex >= 0) {
            newLogs[existingLogIndex].hours += hours;
            if (newLogs[existingLogIndex].hours < 0) newLogs[existingLogIndex].hours = 0;
          } else if (hours > 0) {
            newLogs.push({
              id: Date.now().toString(),
              date: targetDate,
              subjectId: targetId,
              hours
            });
          }
          return { studyLogs: newLogs };
        });
      },
      deleteStudyLog: (id) => {
        set((state) => ({
          studyLogs: state.studyLogs.filter((log) => log.id !== id)
        }));
      },
      updateStudyLogHoursDirectly: (id, hours) => {
        set((state) => ({
          studyLogs: state.studyLogs.map((log) => 
            log.id === id ? { ...log, hours: Math.max(0, hours) } : log
          )
        }));
      },

      getSubjectHoursToday: (subjectId) => {
        const state = get();
        const today = getISTYMD();
        const log = state.studyLogs.find((l) => l.date === today && l.subjectId === subjectId);
        return log ? log.hours : 0;
      },

      getTotalHoursToday: () => {
        const state = get();
        const today = getISTYMD();
        return state.getTotalHoursForDate(today);
      },

      getTotalHoursForDate: (dateStr) => {
        const state = get();
        // Since recalculateAllMetrics intelligently merges slot hours and history logs 
        // into studyLogs (using Math.max per subject to avoid double-counting), 
        // we should simply sum the hours from studyLogs for the given date.
        const logs = state.studyLogs.filter(l => l.date === dateStr);
        const total = logs.reduce((acc, log) => acc + log.hours, 0);
        return Number(total.toFixed(2));
      },

      targetStudyHours: 8,
      setTargetStudyHours: (hoursOrFn) => {
        set((state) => {
          const next = typeof hoursOrFn === 'function' ? hoursOrFn(state.targetStudyHours) : hoursOrFn;
          const today = getISTYMD();
          return {
            targetStudyHours: next,
            dailyTargets: { ...(state.dailyTargets || {}), [today]: next }
          };
        });
      },

      globalTargetDays: { rev1: 15, rev2: 30, rev3: 45, mtp: 10, pyq: 10 },
      setGlobalTargetDays: (targets) => set({ globalTargetDays: targets }),

      subjectStreaks: {},
      incrementSubjectStreak: (subjectId) => {
        set((state) => {
          const current = state.subjectStreaks[subjectId] || 0;
          return { subjectStreaks: { ...state.subjectStreaks, [subjectId]: current + 1 } };
        });
      },

      getSubjectStreak: (subjectId) => {
        const state = get();
        return state.subjectStreaks[subjectId] || 0;
      },

      cloudSyncStatus: 'synced',
      setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),
      isForceOfflineMode: false,
      setForceOfflineMode: (force) => set({ isForceOfflineMode: force }),

      statusFilter: 'ALL',
      setStatusFilter: (filter) => set({ statusFilter: filter }),

      activeTab: 'master-summary',
      setActiveTab: (tab) => set({ activeTab: tab }),

      selectedGroupFilter: 'BOTH',
      setSelectedGroupFilter: (group) => set({ selectedGroupFilter: group }),


      currentSubject: 'fr',
      setCurrentSubject: (subjectId) => set({ currentSubject: subjectId }),
      timerTargetSlotId: null,
      setTimerTargetSlotId: (id) => set({ timerTargetSlotId: id }),

      selectedDateStr: getISTYMD(),
      setSelectedDateStr: (date) => set({ selectedDateStr: date }),
      clearStudyLogsForDate: (dateStr) => {
        set((state) => ({
          studyLogs: state.studyLogs.filter((log) => log.date !== dateStr)
        }));
      },
      recalculateAllMetrics: (dateStr) => {
        set((state) => {
          // 1. Recalculate completed chapters (topics) for all subjects
          const updatedSubjects = state.subjects.map((sub) => {
            const completedCount = sub.topics.filter((t) => t.completed || t.rev1 || t.rev2 || t.rev3).length;
            return {
              ...sub,
              completedChapters: completedCount,
            };
          });

          // 2. Get the schedule/timetable slots for this date
          const slots = state.schedulesByDate && state.schedulesByDate[dateStr] 
            ? state.schedulesByDate[dateStr] 
            : state.timetable || [];
          
          // 3. Aggregate completed hours by subjectId from slots
          const slotHoursBySubject: Record<string, number> = {};
          
          slots.forEach((slot) => {
            if (slot.category !== 'break' && slot.category !== 'na' && slot.status !== 'NA') {
              const totalSlotHours = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
              const studied = slot.studiedDurationHours || ((slot.progress || 0) * totalSlotHours / 100) || 0;
              
              let counted = 0;
              if (slot.status === 'COMPLETED' || slot.completed) {
                // If they explicitly tracked some time, use it. Otherwise fallback to the full slot hours
                counted = studied > 0 ? studied : totalSlotHours;
              } else if (slot.status === 'PARTIALLY_COMPLETED' || slot.status === 'IN_PROGRESS') {
                counted = studied;
              } else if (slot.status === 'FAILED') {
                counted = 0;
              }
              
              if (counted > 0) {
                const matchSubj = state.subjects.find((sub) => 
                  sub.name.toLowerCase().includes(slot.subject.toLowerCase()) || 
                  sub.code.toLowerCase().includes(slot.subject.toLowerCase())
                );
                const subjectId = matchSubj ? matchSubj.id : 'general';
                
                slotHoursBySubject[subjectId] = (slotHoursBySubject[subjectId] || 0) + counted;
              }
            }
          });

          // 4. Aggregate hours from studyHistoryLogs for this date
          const historyLogsForDate = (state.studyHistoryLogs || []).filter(l => l.dateStr === dateStr);
          
          const unlinkedHistoryHoursBySubject: Record<string, number> = {};
          
          historyLogsForDate.forEach(log => {
            if (log.subjectId && log.durationHours > 0) {
              const isLinkedToSlot = log.sourceType === 'TIME_TABLE' || (log.chapterId && log.chapterId.startsWith('slot-'));
              if (!isLinkedToSlot) {
                unlinkedHistoryHoursBySubject[log.subjectId] = (unlinkedHistoryHoursBySubject[log.subjectId] || 0) + log.durationHours;
              }
            }
          });

          // 5. Build verified studyLogs for this date
          const logsForOtherDates = state.studyLogs.filter((log) => log.date !== dateStr);
          
          const allSubjectIds = new Set([
            ...Object.keys(slotHoursBySubject),
            ...Object.keys(unlinkedHistoryHoursBySubject)
          ]);

          const finalLogsForThisDate: typeof state.studyLogs = [];

          allSubjectIds.forEach((subjId) => {
            const slotHrs = slotHoursBySubject[subjId] || 0;
            const unlinkedHrs = unlinkedHistoryHoursBySubject[subjId] || 0;
            const verifiedHrs = slotHrs + unlinkedHrs;
            if (verifiedHrs > 0) {
              finalLogsForThisDate.push({
                id: `log-${dateStr}-${subjId}`,
                date: dateStr,
                subjectId: subjId,
                hours: Number(verifiedHrs.toFixed(2))
              });
            }
          });

          return {
            subjects: updatedSubjects,
            studyLogs: [...logsForOtherDates, ...finalLogsForThisDate]
          };
        });
      },

      dailyShiftMinutes: {},
      isIdleGuardEnabled: false,
      setIsIdleGuardEnabled: (enabled) => set({ isIdleGuardEnabled: enabled }),
      scheduleHistoryByDate: {},

      pushScheduleHistory: (dateStr) => {
        const state = get();
        const currentSlots = state.schedulesByDate[dateStr] || state.timetable || [];
        const currentShift = (state.dailyShiftMinutes || {})[dateStr] || 0;
        const currentHist = state.scheduleHistoryByDate?.[dateStr] || [];

        const newHist = [
          ...currentHist,
          { slots: JSON.parse(JSON.stringify(currentSlots)), dailyShiftMinutes: currentShift }
        ].slice(-15);

        set({
          scheduleHistoryByDate: {
            ...(state.scheduleHistoryByDate || {}),
            [dateStr]: newHist
          }
        });
      },

      canUndoScheduleAction: (dateStr) => {
        const state = get();
        return ((state.scheduleHistoryByDate || {})[dateStr] || []).length > 0;
      },

      undoLastScheduleAction: (dateStr) => {
        const state = get();
        const currentHist = (state.scheduleHistoryByDate || {})[dateStr] || [];
        if (currentHist.length === 0) return false;

        const lastState = currentHist[currentHist.length - 1];
        const newHist = currentHist.slice(0, -1);
        const today = getISTYMD();

        set({
          schedulesByDate: { ...(state.schedulesByDate || {}), [dateStr]: lastState.slots },
          dailyShiftMinutes: { ...(state.dailyShiftMinutes || {}), [dateStr]: lastState.dailyShiftMinutes },
          scheduleHistoryByDate: { ...(state.scheduleHistoryByDate || {}), [dateStr]: newHist },
          ...(dateStr === today ? { timetable: lastState.slots } : {})
        });

        get().recalculateAllMetrics(dateStr);
        return true;
      },

      shiftScheduleCascading: (dateStr, slotId, shiftMins) => {
        const state = get();
        const currentShiftMins = (state.dailyShiftMinutes || {})[dateStr] || 0;
        if (currentShiftMins + shiftMins > 45) {
          return {
            success: false,
            message: `Maximum daily emergency shift limit reached (45 mins max per day). Used today: ${currentShiftMins}m.`
          };
        }

        const slots = state.schedulesByDate[dateStr] || state.timetable || [];
        const targetIdx = slots.findIndex(s => s.id === slotId);
        if (targetIdx === -1) {
          return { success: false, message: 'Slot not found.' };
        }

        // Save snapshot for Undo
        get().pushScheduleHistory(dateStr);

        const newSlots = slots.map((slot, idx) => {
          if (idx < targetIdx) {
            return slot;
          }
          const parsed = parseTimeStr(slot.time);
          if (!parsed) return slot;

          if (idx === targetIdx) {
            const newStart = parsed.start;
            const newEnd = parsed.end + shiftMins;
            const newTimeStr = `${formatMinutesToTimeStr(newStart)} - ${formatMinutesToTimeStr(newEnd)}`;
            const newTotalHours = (newEnd - newStart) / 60;
            return {
              ...slot,
              time: newTimeStr,
              totalDurationHours: Number(newTotalHours.toFixed(2))
            };
          } else {
            const newStart = parsed.start + shiftMins;
            const newEnd = parsed.end + shiftMins;
            const newTimeStr = `${formatMinutesToTimeStr(newStart)} - ${formatMinutesToTimeStr(newEnd)}`;
            return {
              ...slot,
              time: newTimeStr
            };
          }
        });

        const updatedDailyShift = {
          ...(state.dailyShiftMinutes || {}),
          [dateStr]: currentShiftMins + shiftMins
        };

        const today = getISTYMD();
        set({
          schedulesByDate: { ...(state.schedulesByDate || {}), [dateStr]: newSlots },
          dailyShiftMinutes: updatedDailyShift,
          ...(dateStr === today ? { timetable: newSlots } : {})
        });

        get().recalculateAllMetrics(dateStr);

        return {
          success: true,
          message: `Shifted current slot & downstream schedule by +${shiftMins} mins. Total shift today: ${currentShiftMins + shiftMins}m / 45m limit.`
        };
      },

      splitSlotAndMorphSubject: (dateStr, slotId, newSubjectName, newTopicName) => {
        const state = get();
        const slots = state.schedulesByDate[dateStr] || state.timetable || [];
        const targetIdx = slots.findIndex(s => s.id === slotId);
        if (targetIdx === -1) return;

        const currentSlot = slots[targetIdx];
        const parsed = parseTimeStr(currentSlot.time);
        const totalHrs = currentSlot.totalDurationHours || (parsed ? (parsed.end - parsed.start) / 60 : parseSlotHours(currentSlot.time));
        const studiedHrs = currentSlot.studiedDurationHours || ((currentSlot.progress || 0) * totalHrs / 100) || 0;

        if (studiedHrs <= 0 || studiedHrs >= totalHrs) return;

        // Save snapshot for Undo
        get().pushScheduleHistory(dateStr);

        const remainingHrs = Math.max(0.25, totalHrs - studiedHrs);
        const startMins = parsed ? parsed.start : 540;
        const splitMins = startMins + Math.round(studiedHrs * 60);
        const endMins = parsed ? parsed.end : splitMins + Math.round(remainingHrs * 60);

        const cappedSlot: TimetableSlot = {
          ...currentSlot,
          time: `${formatMinutesToTimeStr(startMins)} - ${formatMinutesToTimeStr(splitMins)}`,
          totalDurationHours: Number(studiedHrs.toFixed(2)),
          studiedDurationHours: Number(studiedHrs.toFixed(2)),
          progress: 100,
          completed: true,
          status: 'COMPLETED' as const
        };

        const displayTopic = newTopicName && newTopicName.trim() ? newTopicName.trim() : `Switched Focus: ${newSubjectName}`;

        const newSlotId = `slot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const newSlot: TimetableSlot = {
          id: newSlotId,
          time: `${formatMinutesToTimeStr(splitMins)} - ${formatMinutesToTimeStr(endMins)}`,
          subject: newSubjectName,
          activity: displayTopic,
          category: 'study',
          completed: false,
          progress: 0,
          status: 'PENDING',
          totalDurationHours: Number(remainingHrs.toFixed(2)),
          studiedDurationHours: 0
        };

        const newSlots = [
          ...slots.slice(0, targetIdx),
          cappedSlot,
          newSlot,
          ...slots.slice(targetIdx + 1)
        ];

        const today = getISTYMD();
        set({
          schedulesByDate: { ...(state.schedulesByDate || {}), [dateStr]: newSlots },
          ...(dateStr === today ? { timetable: newSlots } : {})
        });

        const matchSubj = state.subjects.find(sub => 
          sub.name.toLowerCase().includes(currentSlot.subject.toLowerCase()) || 
          sub.code.toLowerCase().includes(currentSlot.subject.toLowerCase())
        );
        get().recalculateAllMetrics(dateStr);
      },

      quickAddMicroLog: (dateStr, slotId, incrementHours) => {
        const state = get();
        const slots = state.schedulesByDate[dateStr] || state.timetable || [];
        const targetIdx = slots.findIndex(s => s.id === slotId);
        if (targetIdx === -1) return;

        // Save snapshot for Undo
        get().pushScheduleHistory(dateStr);

        const slot = slots[targetIdx];
        const totalHrs = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
        const currentStudied = slot.studiedDurationHours || ((slot.progress || 0) * totalHrs / 100) || 0;
        const newStudied = Number((currentStudied + incrementHours).toFixed(2));
        const newProgress = Math.min(100, Number(((newStudied / totalHrs) * 100).toFixed(1)));

        let newStatus: SlotStatus = 'IN_PROGRESS';
        let isCompleted = false;
        if (newStudied >= totalHrs) {
          newStatus = 'COMPLETED';
          isCompleted = true;
        } else if (newStudied >= totalHrs * 0.5) {
          newStatus = 'PARTIALLY_COMPLETED';
        }

        const updatedSlot: TimetableSlot = {
          ...slot,
          studiedDurationHours: newStudied,
          totalDurationHours: totalHrs,
          progress: newProgress,
          completed: isCompleted,
          status: newStatus
        };

        const newSlots = [...slots];
        newSlots[targetIdx] = updatedSlot;

        const today = getISTYMD();
        set({
          schedulesByDate: { ...(state.schedulesByDate || {}), [dateStr]: newSlots },
          ...(dateStr === today ? { timetable: newSlots } : {})
        });

        const matchSubj = state.subjects.find(sub => 
          sub.name.toLowerCase().includes(slot.subject.toLowerCase()) || 
          sub.code.toLowerCase().includes(slot.subject.toLowerCase())
        );
        get().logStudyActivity({
          dateStr,
          subject: slot.subject,
          subjectId: matchSubj ? matchSubj.id : 'general',
          chapterTitle: slot.activity,
          durationHours: incrementHours,
          sourceType: 'TIME_TABLE'
        });

        get().recalculateAllMetrics(dateStr);
      },

      getTotalBacklogDebtHours: () => {
        const state = get();
        let totalLapsed = 0;
        const allSchedules = state.schedulesByDate || {};
        const datesToCheck = new Set([...Object.keys(allSchedules), getISTYMD()]);

        datesToCheck.forEach(dateStr => {
          const slots = allSchedules[dateStr] || (dateStr === getISTYMD() ? state.timetable : []);
          slots.forEach(slot => {
            if (slot.category !== 'break' && slot.category !== 'na' && slot.status !== 'NA' && !slot.isBacklogSettled) {
              const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
              const studied = slot.studiedDurationHours || ((slot.progress || 0) * total / 100) || (slot.completed ? total : 0);
              
              if (slot.status === 'FAILED' || slot.status === 'PARTIALLY_COMPLETED') {
                totalLapsed += Math.max(0, total - studied);
              } else if (!slot.completed && slot.status === 'PENDING') {
                const today = getISTYMD();
                if (dateStr < today) {
                  totalLapsed += Math.max(0, total - studied);
                }
              }
            }
          });
        });

        return Number(totalLapsed.toFixed(1));
      },

      getBacklogDebtDetails: () => {
        const state = get();
        const items: BacklogDebtItem[] = [];
        const allSchedules = state.schedulesByDate || {};
        const datesToCheck = new Set([...Object.keys(allSchedules), getISTYMD()]);

        datesToCheck.forEach(dateStr => {
          const slots = allSchedules[dateStr] || (dateStr === getISTYMD() ? state.timetable : []);
          slots.forEach(slot => {
            if (slot.category !== 'break' && slot.category !== 'na' && slot.status !== 'NA' && !slot.isBacklogSettled) {
              const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
              const studied = slot.studiedDurationHours || ((slot.progress || 0) * total / 100) || (slot.completed ? total : 0);
              
              let debt = 0;
              let isDebt = false;
              if (slot.status === 'FAILED' || slot.status === 'PARTIALLY_COMPLETED') {
                debt = Math.max(0, total - studied);
                if (debt > 0) isDebt = true;
              } else if (!slot.completed && slot.status === 'PENDING') {
                const today = getISTYMD();
                if (dateStr < today) {
                  debt = Math.max(0, total - studied);
                  if (debt > 0) isDebt = true;
                }
              }

              if (isDebt && debt > 0) {
                items.push({
                  id: slot.id,
                  dateStr,
                  time: slot.time,
                  subject: slot.subject,
                  activity: slot.activity,
                  category: slot.category,
                  totalDurationHours: Number(total.toFixed(2)),
                  studiedDurationHours: Number(studied.toFixed(2)),
                  debtHours: Number(debt.toFixed(2)),
                  status: slot.status || 'PENDING'
                });
              }
            }
          });
        });

        return items.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
      },

      settleAllBacklogDebt: () => {
        set((state) => {
          const allSchedules = { ...(state.schedulesByDate || {}) };
          const today = getISTYMD();
          const datesToCheck = new Set([...Object.keys(allSchedules), today]);

          datesToCheck.forEach(dateStr => {
            const slots = allSchedules[dateStr] || (dateStr === today ? state.timetable : []);
            const updatedSlots = slots.map(slot => {
              if (slot.category !== 'break' && slot.category !== 'na' && slot.status !== 'NA' && !slot.isBacklogSettled) {
                const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
                const studied = slot.studiedDurationHours || ((slot.progress || 0) * total / 100) || (slot.completed ? total : 0);
                
                let isLapsed = false;
                if (slot.status === 'FAILED' || slot.status === 'PARTIALLY_COMPLETED') {
                  isLapsed = true;
                } else if (!slot.completed && slot.status === 'PENDING') {
                  if (dateStr < today) {
                    isLapsed = true;
                  }
                }
                
                if (isLapsed) {
                  return {
                    ...slot,
                    isBacklogSettled: true
                  };
                }
              }
              return slot;
            });
            allSchedules[dateStr] = updatedSlots;
          });

          const todaySchedule = allSchedules[today] || state.timetable;
          const updatedTodaySchedule = todaySchedule.map(slot => {
            if (slot.category !== 'break' && slot.category !== 'na' && slot.status !== 'NA' && !slot.isBacklogSettled) {
              const total = slot.totalDurationHours || parseSlotHours(slot.time) || 1.5;
              const studied = slot.studiedDurationHours || ((slot.progress || 0) * total / 100) || (slot.completed ? total : 0);
              
              if (slot.status === 'FAILED' || slot.status === 'PARTIALLY_COMPLETED') {
                return { ...slot, isBacklogSettled: true };
              }
            }
            return slot;
          });

          return {
            schedulesByDate: allSchedules,
            timetable: updatedTodaySchedule
          };
        });
      },

      studyHistoryLogs: [],
      logStudyActivity: (entry) => {
        set((state) => {
          const id = `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          const timestamp = Date.now();
          const newLog = {
            ...entry,
            id,
            timestamp,
            status: 'COMPLETED' as const
          };
          
          return {
            studyHistoryLogs: [newLog, ...(state.studyHistoryLogs || [])]
          };
        });
        get().recalculateAllMetrics(entry.dateStr || getISTYMD());
      },
      deleteStudyHistoryLog: (id) => {
        const state = get();
        const targetLog = (state.studyHistoryLogs || []).find((l) => l.id === id);
        if (!targetLog) return;
        const targetDate = targetLog.dateStr;

        set((state) => {
          const remainingLogs = (state.studyHistoryLogs || []).filter((l) => l.id !== id);
          
          // Revert slot progress if this log was linked to a timetable slot
          let newSchedules = state.schedulesByDate;
          let newTimetable = state.timetable;
          if (targetLog.chapterId && targetLog.chapterId.startsWith('slot-')) {
            const slotId = targetLog.chapterId.replace('slot-', '');
            const slots = state.schedulesByDate[targetDate] || (targetDate === getISTYMD() ? state.timetable : []);
            
            const updatedSlots = slots.map(slot => {
              if (slot.id === slotId) {
                const newStudied = Math.max(0, (slot.studiedDurationHours || 0) - targetLog.durationHours);
                const totalHrs = slot.totalDurationHours || parseSlotHours(slot.time) || 2;
                const newProgress = Math.min(100, (newStudied / totalHrs) * 100);
                
                let newStatus = slot.status;
                let isCompleted = slot.completed;
                if (newStudied < totalHrs) {
                  isCompleted = false;
                  newStatus = newStudied > 0 ? 'IN_PROGRESS' : 'PENDING';
                }
                
                return {
                  ...slot,
                  studiedDurationHours: newStudied,
                  progress: newProgress,
                  completed: isCompleted,
                  status: newStatus as any
                };
              }
              return slot;
            });
            
            newSchedules = { ...state.schedulesByDate, [targetDate]: updatedSlots };
            if (targetDate === getISTYMD()) {
              newTimetable = updatedSlots;
            }
          }
          
          let newStudyLogs = state.studyLogs.map(l => ({ ...l }));
          if (targetLog.durationHours > 0) {
            const targetSubjectId = targetLog.subjectId;
            const existingLogIndex = newStudyLogs.findIndex(
              (log) => log.date === targetDate && log.subjectId === targetSubjectId
            );
            if (existingLogIndex >= 0) {
              newStudyLogs[existingLogIndex].hours = Number((newStudyLogs[existingLogIndex].hours - targetLog.durationHours).toFixed(2));
              if (newStudyLogs[existingLogIndex].hours <= 0) {
                newStudyLogs = newStudyLogs.filter((_, idx) => idx !== existingLogIndex);
              }
            }
          }
          
          return {
            studyHistoryLogs: remainingLogs,
            studyLogs: newStudyLogs,
            ...(newSchedules ? { schedulesByDate: newSchedules } : {}),
            ...(newTimetable ? { timetable: newTimetable } : {})
          };
        });
        get().recalculateAllMetrics(targetDate);
      },
      updateStudyHistoryLogNotes: (id, notes) => {
        set((state) => ({
          studyHistoryLogs: (state.studyHistoryLogs || []).map(l => l.id === id ? { ...l, notes } : l)
        }));
      },
      clearStudyHistoryLogs: () => {
        set({ studyHistoryLogs: [] });
      },
      customTimetablePresets: [],
      addTimetablePreset: (presetData) => {
        const newPreset: TimetablePreset = {
          ...presetData,
          id: `preset-${Date.now()}`
        };
        set((state) => ({
          customTimetablePresets: [...(state.customTimetablePresets || []), newPreset]
        }));
      },
      deleteTimetablePreset: (id) => {
        set((state) => ({
          customTimetablePresets: (state.customTimetablePresets || []).filter((p) => p.id !== id)
        }));
      },

      chatMessages: [],
      setChatMessages: (messagesOrFn) => {
        set((state) => ({
          chatMessages: typeof messagesOrFn === 'function' ? messagesOrFn(state.chatMessages || []) : messagesOrFn
        }));
      },
      addChatMessage: (msg) => {
        set((state) => ({
          chatMessages: [...(state.chatMessages || []), msg]
        }));
      },
      clearChatHistory: () => {
        set({ chatMessages: [] });
      },

      userInstructions: '',
      setUserInstructions: (instructions) => {
        set({ userInstructions: instructions });
      },

      hydrateFromCloud: (data) => {
        if (!data) return;
        
        let hydratedSubjects = Array.isArray(data.subjects) ? data.subjects : useStore.getState().subjects;
        hydratedSubjects = hydratedSubjects.map((sub: CASubject) => {
          const completedCount = sub.topics?.filter((t) => t.completed || t.rev1 || t.rev2 || t.rev3).length || 0;
          return { ...sub, completedChapters: completedCount };
        });

        set((state) => ({
          subjects: hydratedSubjects,
          timetable: Array.isArray(data.timetable) ? data.timetable : state.timetable,
          schedulesByDate: data.schedulesByDate && typeof data.schedulesByDate === 'object' ? data.schedulesByDate : state.schedulesByDate || {},
          dailyNotes: data.dailyNotes && typeof data.dailyNotes === 'object' ? data.dailyNotes : state.dailyNotes || {},
          dailyTargets: data.dailyTargets && typeof data.dailyTargets === 'object' ? data.dailyTargets : state.dailyTargets || {},
          dailyShiftMinutes: data.dailyShiftMinutes && typeof data.dailyShiftMinutes === 'object' ? data.dailyShiftMinutes : state.dailyShiftMinutes || {},
          isIdleGuardEnabled: typeof data.isIdleGuardEnabled === 'boolean' ? data.isIdleGuardEnabled : state.isIdleGuardEnabled ?? false,
          studyLogs: Array.isArray(data.studyLogs) ? data.studyLogs : state.studyLogs,
          focusSessions: Array.isArray(data.focusSessions) ? data.focusSessions : state.focusSessions || [],
          targetStudyHours: typeof data.targetStudyHours === 'number' ? data.targetStudyHours : state.targetStudyHours,
          subjectStreaks: data.subjectStreaks && typeof data.subjectStreaks === 'object' ? data.subjectStreaks : state.subjectStreaks,
          selectedDateStr: typeof data.selectedDateStr === 'string' ? data.selectedDateStr : state.selectedDateStr || getISTYMD(),
          studyHistoryLogs: Array.isArray(data.studyHistoryLogs) ? data.studyHistoryLogs : state.studyHistoryLogs || [],
          customTimetablePresets: Array.isArray(data.customTimetablePresets) ? data.customTimetablePresets : state.customTimetablePresets || [],
          chatMessages: Array.isArray(data.chatMessages) ? data.chatMessages : state.chatMessages || [],
          userInstructions: typeof data.userInstructions === 'string' ? data.userInstructions : state.userInstructions || '',
          cloudSyncStatus: 'synced'
        }));
        get().recalculateAllMetrics(getISTYMD());
      },

      resetState: () => {
        set({
          subjects: DEFAULT_CA_SUBJECTS,
          timetable: INITIAL_TIMETABLE,
          schedulesByDate: {},
          dailyNotes: {},
          dailyTargets: {},
          dailyShiftMinutes: {},
          isIdleGuardEnabled: false,
          studyLogs: [],
          targetStudyHours: 8,
          subjectStreaks: {},
          statusFilter: 'ALL',
          activeTab: 'master-summary',
          selectedGroupFilter: 'BOTH',
      currentSubject: 'fr',
          selectedDateStr: getISTYMD(),
          studyHistoryLogs: [],
          customTimetablePresets: [],
          chatMessages: [],
          userInstructions: '',
          cloudSyncStatus: 'idle'
        });
      },

      exportBackupJson: () => {
        const state = get();
        const backupData = {
          subjects: state.subjects,
          timetable: state.timetable,
          schedulesByDate: state.schedulesByDate,
          dailyNotes: state.dailyNotes,
          dailyTargets: state.dailyTargets,
          studyLogs: state.studyLogs,
          targetStudyHours: state.targetStudyHours,
          subjectStreaks: state.subjectStreaks,
          studyHistoryLogs: state.studyHistoryLogs || [],
          customTimetablePresets: state.customTimetablePresets || [],
          chatMessages: state.chatMessages || [],
          userInstructions: state.userInstructions || '',
          isTodaySyncedWithWeekly: state.isTodaySyncedWithWeekly,
          version: '2.0',
          exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ca-final-backup-${getISTYMD()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },

      importBackupJson: (jsonData: string) => {
        try {
          // Layer 6: Prototype Pollution & JSON Payload Protection
          const parsed = JSON.parse(jsonData, (key, value) => {
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
              return undefined;
            }
            return value;
          });
          
          if (parsed && typeof parsed === 'object') {
            set((state) => ({
              subjects: parsed.subjects || state.subjects,
              timetable: parsed.timetable || state.timetable,
              schedulesByDate: parsed.schedulesByDate || state.schedulesByDate || {},
              dailyNotes: parsed.dailyNotes || state.dailyNotes || {},
              dailyTargets: parsed.dailyTargets || state.dailyTargets || {},
              studyLogs: parsed.studyLogs || state.studyLogs,
              targetStudyHours: parsed.targetStudyHours ?? state.targetStudyHours,
              subjectStreaks: parsed.subjectStreaks || state.subjectStreaks,
              studyHistoryLogs: parsed.studyHistoryLogs || state.studyHistoryLogs || [],
              customTimetablePresets: parsed.customTimetablePresets || state.customTimetablePresets || [],
              chatMessages: parsed.chatMessages || state.chatMessages || [],
              userInstructions: parsed.userInstructions || state.userInstructions || '',
              isTodaySyncedWithWeekly: parsed.isTodaySyncedWithWeekly ?? state.isTodaySyncedWithWeekly
            }));
            return true;
          }
        } catch (e) {
          console.warn('⚠️ [Storage Import Warning] Failed to parse backup JSON. Data format was invalid.', e);
        }
        return false;
      }
    }),
    {
      name: (typeof window !== 'undefined' && localStorage.getItem('ca_active_attempt') && localStorage.getItem('ca_active_attempt') !== 'nov-2026') 
        ? `ca-final-companion-storage-${localStorage.getItem('ca_active_attempt')?.replace(/\s+/g, '-').toLowerCase()}`
        : 'ca-final-companion-storage',
      version: 2,
      storage: createJSONStorage(() => idbStateStorage),
      migrate: (persistedState: any, version: number) => {
        console.log(`[IndexedDB Storage Migration] Migrating state from version ${version} to 2.`);
        if (version < 2) {
          return {
            ...persistedState,
            activeTab: persistedState?.activeTab || 'master-summary',
            currentSubject: persistedState?.currentSubject || 'fr',
            cloudSyncStatus: 'idle',
            statusFilter: persistedState?.statusFilter || 'ALL',
            globalTargetDays: persistedState?.globalTargetDays || { rev1: 15, rev2: 30, rev3: 45, mtp: 10, pyq: 10 }
          };
        }
        return {
          ...persistedState,
          globalTargetDays: persistedState?.globalTargetDays || { rev1: 15, rev2: 30, rev3: 45, mtp: 10, pyq: 10 }
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('⚠️ [IndexedDB Storage Hydration Error] Saved state was corrupted or outdated.', error);
        } else {
          console.log('✅ [IndexedDB Storage Hydration] State successfully restored from IndexedDB (`ca-final-companion-storage`).');
        }
      }
    }
  )
);

export const useStudyStore = useStore;
