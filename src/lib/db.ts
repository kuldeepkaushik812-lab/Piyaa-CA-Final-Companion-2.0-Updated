import { getFirestore, doc, setDoc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { app, auth } from './auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { useStore } from '../store';
import { getISTYMD } from './dateUtils';
import { DEFAULT_CA_SUBJECTS, INITIAL_TIMETABLE } from '../data/caData';

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let activeUnsubscribe: Unsubscribe | null = null;
let saveDebounceTimeout: any = null;
let isHydratingFromRemote = false;
let prevSerializedData = '';

export function cleanUndefined<T>(obj: T): T {
  if (obj === undefined) {
    return null as unknown as T;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as unknown as T;
  }
  const cleaned: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      cleaned[key] = cleanUndefined(val);
    }
  }
  return cleaned;
}

export const getActiveAttemptId = () => {
  return (typeof window !== 'undefined' ? localStorage.getItem('ca_active_attempt') : 'nov-2026') || 'nov-2026';
};

export const getUserDocRef = (userId: string) => {
  const attempt = getActiveAttemptId().replace(/-/g, '_').toLowerCase();
  return doc(db, 'users', userId, `ca_final_state_${attempt}`, 'master_data');
};

export const saveProgressToCloud = async (stateData?: any) => {
  const store = useStore.getState();
  
  if (!navigator.onLine || store.isForceOfflineMode) {
    console.warn('Network offline or Force Offline mode active. Queuing changes locally.');
    store.setCloudSyncStatus('offline_queued');
    return false;
  }

  if (!auth.currentUser) {
    console.warn('Save to cloud skipped: User is not logged in.');
    return false;
  }

  const userId = auth.currentUser.uid;
  const docRef = getUserDocRef(userId);
  
  const payload = stateData || {
    subjects: store.subjects,
    timetable: store.timetable,
    schedulesByDate: store.schedulesByDate,
    dailyNotes: store.dailyNotes,
    dailyTargets: store.dailyTargets,
    studyLogs: store.studyLogs,
    targetStudyHours: store.targetStudyHours,
    subjectStreaks: store.subjectStreaks,
    studyHistoryLogs: store.studyHistoryLogs || [],
    customTimetablePresets: store.customTimetablePresets || [],
    chatMessages: store.chatMessages || [],
    userInstructions: store.userInstructions || '',
    hours: store.getTotalHoursToday(),
    targetHours: store.targetStudyHours,
    lastUpdated: new Date().toISOString()
  };

  try {
    store.setCloudSyncStatus('saving');
    const cleanedPayload = cleanUndefined(payload);
    await setDoc(docRef, cleanedPayload, { merge: true });
    
    // Save public stats for Study Buddy Accountability Room
    try {
      const publicStatsRef = doc(db, 'public_stats', userId);
      const totalFirstRead = store.subjects.reduce((sum, subj) => sum + subj.topics.length, 0);
      const completedFirstRead = store.subjects.reduce((sum, subj) => sum + subj.topics.filter(t => t.completed).length, 0);
      const completedRev1 = store.subjects.reduce((sum, subj) => sum + subj.topics.filter(t => t.rev1).length, 0);
      const firstReadPercent = totalFirstRead > 0 ? Math.round((completedFirstRead / totalFirstRead) * 100) : 0;
      const rev1Percent = totalFirstRead > 0 ? Math.round((completedRev1 / totalFirstRead) * 100) : 0;
      const today = getISTYMD();
      const todayLogs = store.studyLogs.filter(log => log.date.startsWith(today));
      const hoursLoggedToday = todayLogs.reduce((acc, log) => acc + (log.hours), 0);
      const streakDays = Math.max(0, ...Object.values(store.subjectStreaks).map(s => s));
      
      const customLocalName = typeof window !== 'undefined' ? localStorage.getItem('ca_companion_display_name') : null;
      const currentDisplayName = customLocalName || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Aspirant';

      await setDoc(publicStatsRef, cleanUndefined({
        displayName: currentDisplayName,
        hoursLoggedToday,
        firstReadPercent,
        rev1Percent,
        streakDays,
        lastUpdated: new Date().toISOString()
      }), { merge: true });
    } catch (publicStatsErr) {
      console.warn("Failed to update public stats:", publicStatsErr);
    }
    
    store.setCloudSyncStatus('synced');
  } catch (error) {
    store.setCloudSyncStatus('error');
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/ca_final_state/master_data`);
  }
};

export const debouncedSaveToCloud = () => {
  if (!auth.currentUser || isHydratingFromRemote) return;

  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
  }

  useStore.getState().setCloudSyncStatus('saving');

  saveDebounceTimeout = setTimeout(() => {
    saveProgressToCloud().catch((err) => console.error('Auto cloud save error:', err));
  }, 1500);
};

export const setupRealtimeCloudSync = (userId: string) => {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  const docRef = getUserDocRef(userId);

  activeUnsubscribe = onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      isHydratingFromRemote = true;
      try {
        useStore.getState().hydrateFromCloud(data);
        const state = useStore.getState();
        prevSerializedData = JSON.stringify({
          subjects: state.subjects,
          timetable: state.timetable,
          schedulesByDate: state.schedulesByDate,
          dailyNotes: state.dailyNotes,
          dailyTargets: state.dailyTargets,
          studyLogs: state.studyLogs,
          targetStudyHours: state.targetStudyHours,
          subjectStreaks: state.subjectStreaks,
          studyHistoryLogs: state.studyHistoryLogs || [],
          customTimetablePresets: state.customTimetablePresets || [],
          chatMessages: state.chatMessages || [],
          userInstructions: state.userInstructions || '',
        });
      } finally {
        setTimeout(() => {
          isHydratingFromRemote = false;
        }, 100);
      }
    } else {
      // First-time user initialization
      console.log('✨ First time login detected! Initializing user cloud document with default syllabus schema...');
      const defaultPayload = {
        subjects: DEFAULT_CA_SUBJECTS,
        timetable: INITIAL_TIMETABLE,
        schedulesByDate: {},
        dailyNotes: {},
        dailyTargets: {},
        studyLogs: [],
        targetStudyHours: 8,
        subjectStreaks: {},
        hours: 0,
        targetHours: 8,
        lastUpdated: new Date().toISOString()
      };

      try {
        isHydratingFromRemote = true;
        const cleanedDefault = cleanUndefined(defaultPayload);
        await setDoc(docRef, cleanedDefault);
        useStore.getState().hydrateFromCloud(cleanedDefault);
        const state = useStore.getState();
        prevSerializedData = JSON.stringify({
          subjects: state.subjects,
          timetable: state.timetable,
          schedulesByDate: state.schedulesByDate,
          dailyNotes: state.dailyNotes,
          dailyTargets: state.dailyTargets,
          studyLogs: state.studyLogs,
          targetStudyHours: state.targetStudyHours,
          subjectStreaks: state.subjectStreaks,
          studyHistoryLogs: state.studyHistoryLogs || [],
        });
      } catch (err) {
        console.error('Error initializing user document:', err);
      } finally {
        setTimeout(() => {
          isHydratingFromRemote = false;
        }, 100);
      }
    }
  }, (error) => {
    console.error('Firestore Realtime Listener Error:', error);
    useStore.getState().setCloudSyncStatus('error');
  });

  return activeUnsubscribe;
};

export const stopRealtimeCloudSyncAndWipe = () => {
  if (activeUnsubscribe) {
    activeUnsubscribe();
    activeUnsubscribe = null;
  }

  if (saveDebounceTimeout) {
    clearTimeout(saveDebounceTimeout);
    saveDebounceTimeout = null;
  }

  prevSerializedData = '';

  // Clear local storage cache
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('ca-final-companion-storage')) {
        localStorage.removeItem(key);
      }
    }
    localStorage.removeItem('ca_companion_hours');
    localStorage.removeItem('ca_companion_target_hours');
    localStorage.removeItem('ca_companion_subjects');
    localStorage.removeItem('ca_companion_timetable');
  } catch (e) {
    console.warn('Failed to clear local storage cache on logout:', e);
  }

  // Wipe React/Zustand state to clean slate
  useStore.getState().resetState();
};

// Automatic subscription to Zustand store updates for debounced cloud auto-save
// Only triggers when the actual user data changes, avoiding infinite recursion from status updates
useStore.subscribe((state) => {
  if (!auth.currentUser || isHydratingFromRemote) return;

  const currentData = JSON.stringify({
    subjects: state.subjects,
    timetable: state.timetable,
    schedulesByDate: state.schedulesByDate,
    dailyNotes: state.dailyNotes,
    dailyTargets: state.dailyTargets,
    studyLogs: state.studyLogs,
    targetStudyHours: state.targetStudyHours,
    subjectStreaks: state.subjectStreaks,
    studyHistoryLogs: state.studyHistoryLogs || [],
    customTimetablePresets: state.customTimetablePresets || [],
    chatMessages: state.chatMessages || [],
    userInstructions: state.userInstructions || '',
  });

  if (!prevSerializedData) {
    prevSerializedData = currentData;
    return;
  }

  if (currentData !== prevSerializedData) {
    prevSerializedData = currentData;
    debouncedSaveToCloud();
  }
});


if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    useStore.getState().setCloudSyncStatus('offline_queued');
  });

  window.addEventListener('online', () => {
    const store = useStore.getState();
    if (store.isForceOfflineMode) return;
    if (store.cloudSyncStatus === 'offline_queued' || store.cloudSyncStatus === 'error') {
      console.log('Network restored. Flushing offline queue...');
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        saveProgressToCloud().then(() => {
          if (useStore.getState().cloudSyncStatus === 'synced') {
            // Optional: trigger a success toast via custom event or just console
            console.log('✅ Offline Queue Synced!');
            window.dispatchEvent(new CustomEvent('offline-sync-success'));
          }
        });
      }, 1000);
    }
  });
}
