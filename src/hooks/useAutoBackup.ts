import { useEffect } from 'react';
import { useStore } from '../store';

export function useAutoBackup() {
  const exportBackupJson = useStore(state => state.exportBackupJson);
  const studyHistoryLogsLength = useStore(state => state.studyHistoryLogs?.length || 0);

  useEffect(() => {
    try {
      const lastBackupDateStr = localStorage.getItem('ca_companion_last_backup_date');
      const lastBackupHistoryLenStr = localStorage.getItem('ca_companion_last_backup_history_len');

      const now = Date.now();
      let shouldBackup = false;

      const currentLen = studyHistoryLogsLength;

      if (!lastBackupDateStr) {
        // If it's the first time running, set the baseline but maybe don't immediately download if it's empty
        // to avoid annoying new users. If they have logs, we can backup.
        if (currentLen > 0) {
           shouldBackup = true;
        } else {
           // Just set the initial values so we don't trigger immediately
           localStorage.setItem('ca_companion_last_backup_date', new Date(now).toISOString());
           localStorage.setItem('ca_companion_last_backup_history_len', '0');
        }
      } else {
        const lastBackupTime = new Date(lastBackupDateStr).getTime();
        const daysSinceLastBackup = (now - lastBackupTime) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastBackup >= 7) {
          shouldBackup = true;
        } else if (lastBackupHistoryLenStr !== null) {
          const lastLen = parseInt(lastBackupHistoryLenStr, 10);
          if (Math.abs(currentLen - lastLen) >= 10) { // 10 logs is a solid chunk of "significant changes"
            shouldBackup = true;
          }
        }
      }

      if (shouldBackup) {
        exportBackupJson();
        localStorage.setItem('ca_companion_last_backup_date', new Date(now).toISOString());
        localStorage.setItem('ca_companion_last_backup_history_len', currentLen.toString());
      }
    } catch (e) {
      console.warn("Auto-backup check failed", e);
    }
  }, [studyHistoryLogsLength, exportBackupJson]);
}
