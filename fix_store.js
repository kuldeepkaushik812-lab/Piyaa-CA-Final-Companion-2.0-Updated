import fs from 'fs';

let code = fs.readFileSync('src/store.ts', 'utf-8');

code = code.replace(/logStudyActivity: \(entry\) => \{[\s\S]*?deleteStudyHistoryLog:/m, 
`logStudyActivity: (entry) => {
        set((state) => {
          const id = \`history-\${Date.now()}-\${Math.random().toString(36).substring(2, 9)}\`;
          const timestamp = Date.now();
          const newLog = {
            ...entry,
            id,
            timestamp,
            status: 'COMPLETED'
          };
          
          return {
            studyHistoryLogs: [newLog, ...(state.studyHistoryLogs || [])]
          };
        });
        get().recalculateAllMetrics(entry.dateStr || getISTYMD());
      },
      deleteStudyHistoryLog:`);

code = code.replace(/deleteStudyHistoryLog: \(id\) => \{[\s\S]*?updateStudyHistoryLogNotes:/m, 
`deleteStudyHistoryLog: (id) => {
        const state = get();
        const targetLog = (state.studyHistoryLogs || []).find((l) => l.id === id);
        if (!targetLog) return;
        const targetDate = targetLog.dateStr;

        set((state) => {
          const remainingLogs = (state.studyHistoryLogs || []).filter((l) => l.id !== id);
          return {
            studyHistoryLogs: remainingLogs
          };
        });
        get().recalculateAllMetrics(targetDate);
      },
      updateStudyHistoryLogNotes:`);

fs.writeFileSync('src/store.ts', code);
