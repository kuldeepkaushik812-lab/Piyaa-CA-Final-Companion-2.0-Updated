sed -i '928,938c\
          return {\
            studyHistoryLogs: remainingLogs,\
            studyLogs: newStudyLogs\
          };\
        });\
        get().recalculateAllMetrics(targetDate);\
      },\
      updateStudyHistoryLogNotes: (id, notes) => {\
        set((state) => ({\
          studyHistoryLogs: (state.studyHistoryLogs || []).map(l => l.id === id ? { ...l, notes } : l)\
        }));\
      },\
      clearStudyHistoryLogs: () => {\
        set({ studyHistoryLogs: [] });\
      },\
      customTimetablePresets: [],\
      addTimetablePreset: (presetData) => {\
        const newPreset: TimetablePreset = {\
          ...presetData,\
          id: `preset-${Date.now()}`\
        };' src/store.ts
