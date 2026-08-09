import { useStore } from '../store';

export function runStoreDiagnostic() {
  const state = useStore.getState();
  console.groupCollapsed('🔍 CA Final Study Companion - Store Diagnostic Summary');
  
  const subjects = state.subjects || [];
  const validSubjectIds = new Set(subjects.map((s) => s.id));
  
  // Also 'general' is used for non-subject specific logs
  validSubjectIds.add('general');
  validSubjectIds.add('General');

  const studyLogs = state.studyLogs || [];
  const historyLogs = state.studyHistoryLogs || [];

  let orphanedStudyLogs: any[] = [];
  let orphanedHistoryLogs: any[] = [];
  let missingSubjectIdsHistory: any[] = [];

  console.log(`Checking ${studyLogs.length} StudyLogs (Daily Progress)...`);
  studyLogs.forEach((log) => {
    if (!validSubjectIds.has(log.subjectId)) {
      orphanedStudyLogs.push(log);
    }
  });

  console.log(`Checking ${historyLogs.length} StudyHistoryLogs (Detailed Sessions)...`);
  historyLogs.forEach((log) => {
    if (!log.subjectId) {
      missingSubjectIdsHistory.push(log);
    } else if (!validSubjectIds.has(log.subjectId)) {
      orphanedHistoryLogs.push(log);
    }
  });

  if (orphanedStudyLogs.length === 0 && orphanedHistoryLogs.length === 0 && missingSubjectIdsHistory.length === 0) {
    console.log('%c✅ All historical study logs are properly linked to valid subject IDs.', 'color: #10b981; font-weight: bold;');
    console.log('%c✅ No orphaned sessions exist.', 'color: #10b981; font-weight: bold;');
  } else {
    console.warn(`⚠️ Found missing or inconsistent references!`);
    
    if (missingSubjectIdsHistory.length > 0) {
      console.warn(`❌ ${missingSubjectIdsHistory.length} StudyHistoryLogs are entirely missing a 'subjectId' (legacy logs):`);
      console.table(missingSubjectIdsHistory.map(l => ({ id: l.id, date: l.dateStr, subjectName: l.subject, duration: l.durationHours })));
    }

    if (orphanedStudyLogs.length > 0) {
      console.warn(`❌ ${orphanedStudyLogs.length} StudyLogs point to a deleted/invalid subjectId:`);
      console.table(orphanedStudyLogs.map(l => ({ date: l.date, subjectId: l.subjectId, hours: l.hours })));
    }

    if (orphanedHistoryLogs.length > 0) {
      console.warn(`❌ ${orphanedHistoryLogs.length} StudyHistoryLogs point to a deleted/invalid subjectId:`);
      console.table(orphanedHistoryLogs.map(l => ({ id: l.id, date: l.dateStr, subjectId: l.subjectId, subjectName: l.subject, duration: l.durationHours })));
    }
  }

  // Cross-reference checks: Timetable subjects vs subject list
  // The timetable stores subjects as strings (usually subject Name), so we can just check if it matches a known subject name
  const validSubjectNames = new Set(subjects.map(s => s.name));
  const validSubjectCodesAndNames = new Set(subjects.map(s => `${s.code}: ${s.name}`));
  
  const currentTimetable = state.timetable || [];
  let unknownTimetableSubjects = 0;
  currentTimetable.forEach(slot => {
    if (slot.category === 'study' || slot.category === 'revision' || slot.category === 'mock') {
       if (!validSubjectNames.has(slot.subject) && !validSubjectCodesAndNames.has(slot.subject)) {
          unknownTimetableSubjects++;
       }
    }
  });

  if (unknownTimetableSubjects > 0) {
     console.warn(`⚠️ ${unknownTimetableSubjects} Timetable Slots reference a subject name that isn't in your current subjects list. (This might be fine if manually typed).`);
  }

  console.groupEnd();
}

export function repairOrphanedLogs() {
  const state = useStore.getState();
  const subjects = state.subjects || [];
  
  // Create a mapping of known subject names and codes to their IDs
  const subjectMap = new Map<string, string>();
  subjects.forEach(s => {
    subjectMap.set(s.name.toLowerCase().trim(), s.id);
    subjectMap.set(`${s.code}: ${s.name}`.toLowerCase().trim(), s.id);
    subjectMap.set(s.id.toLowerCase().trim(), s.id);
  });
  
  let repairedHistory = false;
  let repairedDaily = false;

  const newHistoryLogs = (state.studyHistoryLogs || []).map(log => {
    // If it has a valid subjectId, leave it alone
    if (log.subjectId && subjects.find(s => s.id === log.subjectId)) {
      return log;
    }
    // Try to guess from the subject name
    const guessId = subjectMap.get((log.subject || '').toLowerCase().trim());
    if (guessId) {
      repairedHistory = true;
      return { ...log, subjectId: guessId };
    }
    // Fallback to 'general'
    repairedHistory = true;
    return { ...log, subjectId: 'general' };
  });

  const newDailyLogs = (state.studyLogs || []).map(log => {
    if (log.subjectId && (log.subjectId === 'general' || log.subjectId === 'General' || subjects.find(s => s.id === log.subjectId))) {
      return log;
    }
    repairedDaily = true;
    return { ...log, subjectId: 'general' }; // Fallback to general for daily logs if we can't figure it out
  });

  if (repairedHistory || repairedDaily) {
    useStore.setState({ 
      studyHistoryLogs: newHistoryLogs,
      studyLogs: newDailyLogs
    });
    console.log('%c🔧 Diagnostic Repair: Successfully repaired orphaned/legacy logs.', 'color: #3b82f6; font-weight: bold;');
    
    // Trigger recalculation for all affected dates
    const affectedDates = new Set<string>();
    newHistoryLogs.forEach(l => affectedDates.add(l.dateStr));
    newDailyLogs.forEach(l => affectedDates.add(l.date));
    
    affectedDates.forEach(date => {
      state.recalculateAllMetrics(date);
    });
    console.log(`%c🔄 Recalculated metrics for ${affectedDates.size} dates.`, 'color: #3b82f6;');
  }
}
