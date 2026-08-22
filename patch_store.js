import fs from 'fs';
let code = fs.readFileSync('src/store.ts', 'utf-8');

const target1 = `          // 4. Aggregate hours from studyHistoryLogs for this date
          const historyLogsForDate = (state.studyHistoryLogs || []).filter(l => l.dateStr === dateStr);
          const historyHoursBySubject: Record<string, number> = {};
          historyLogsForDate.forEach(log => {
            if (log.subjectId && log.durationHours > 0) {
              historyHoursBySubject[log.subjectId] = (historyHoursBySubject[log.subjectId] || 0) + log.durationHours;
            }
          });

          // 5. Build verified studyLogs for this date
          const logsForOtherDates = state.studyLogs.filter((log) => log.date !== dateStr);
          
          const allSubjectIds = new Set([
            ...Object.keys(slotHoursBySubject),
            ...Object.keys(historyHoursBySubject)
          ]);

          const finalLogsForThisDate: typeof state.studyLogs = [];

          allSubjectIds.forEach((subjId) => {
            const slotHrs = slotHoursBySubject[subjId] || 0;
            const histHrs = historyHoursBySubject[subjId] || 0;
            const verifiedHrs = Math.max(slotHrs, histHrs);`;

const replacement1 = `          // 4. Aggregate hours from studyHistoryLogs for this date
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
            const verifiedHrs = slotHrs + unlinkedHrs;`;

if (code.includes('const histHrs = historyHoursBySubject[subjId] || 0;')) {
  code = code.replace(target1, replacement1);
  fs.writeFileSync('src/store.ts', code);
  console.log('Patched store.ts');
} else {
  console.log('Already patched or target not found');
}
