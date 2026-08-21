import fs from 'fs';
let code = fs.readFileSync('src/store.ts', 'utf-8');

const targetStr = `
        set((state) => {
          const remainingLogs = (state.studyHistoryLogs || []).filter((l) => l.id !== id);
`;

const replacement = `
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
`;

if (code.includes('const remainingLogs = (state.studyHistoryLogs || []).filter((l) => l.id !== id);') && !code.includes('Revert slot progress if this log was linked')) {
  code = code.replace(targetStr, replacement);
  
  // also inject newSchedules and newTimetable into the return object
  code = code.replace(
    `            studyHistoryLogs: remainingLogs,
            studyLogs: newStudyLogs
          };`,
    `            studyHistoryLogs: remainingLogs,
            studyLogs: newStudyLogs,
            ...(newSchedules ? { schedulesByDate: newSchedules } : {}),
            ...(newTimetable ? { timetable: newTimetable } : {})
          };`
  );
  
  fs.writeFileSync('src/store.ts', code);
  console.log('Patched deleteStudyHistoryLog');
} else {
  console.log('Already patched or string not found');
}
