sed -i '/addStudyLog(oldSubjId, -parseSlotHours(oldSlot.time), selectedDateStr);/d' src/components/CalendarTracker.tsx
sed -i '/addStudyLog(newSubjId, parseSlotHours(newSlot.time), selectedDateStr);/d' src/components/CalendarTracker.tsx
sed -i '/addStudyLog(subjectId, -slotHrs, selectedDateStr);/d' src/components/CalendarTracker.tsx
sed -i '/addStudyLog(subjectId, -hours);/d' src/App.tsx
