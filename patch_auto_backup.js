import fs from 'fs';
let code = fs.readFileSync('src/hooks/useAutoBackup.ts', 'utf-8');

code = code.replace(
  'const studyHistoryLogs = useStore(state => state.studyHistoryLogs);',
  'const studyHistoryLogsLength = useStore(state => state.studyHistoryLogs?.length || 0);'
);

code = code.replace(
  'const currentLen = studyHistoryLogs?.length || 0;',
  'const currentLen = studyHistoryLogsLength;'
);

code = code.replace(
  '[studyHistoryLogs?.length, exportBackupJson]',
  '[studyHistoryLogsLength, exportBackupJson]'
);

fs.writeFileSync('src/hooks/useAutoBackup.ts', code);
console.log('Patched useAutoBackup');
