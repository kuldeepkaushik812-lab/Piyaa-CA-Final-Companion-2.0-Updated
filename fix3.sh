sed -i '948,950c\
        };\
        set((state) => ({\
          customTimetablePresets: [...(state.customTimetablePresets || []), newPreset]\
        }));\
      },' src/store.ts
