sed -i '898,922c\
          // We no longer manually update studyLogs here to avoid double-counting.\
          // Instead, we just append to studyHistoryLogs, then trigger a full recalculation below.\
          return {\
            studyHistoryLogs: [newLog, ...(state.studyHistoryLogs || [])]\
          };\
        });\
        get().recalculateAllMetrics(entry.dateStr || getISTYMD());\
      },' src/store.ts
sed -i '932,952c\
          return {\
            studyHistoryLogs: remainingLogs\
          };\
        });\
        get().recalculateAllMetrics(targetDate);\
      },' src/store.ts
