const fs = require('fs');
let code = fs.readFileSync('src/lib/db.ts', 'utf8');

const target1 = `  if (!navigator.onLine) {
    console.warn('Network offline. Queuing changes locally in IndexedDB/localStorage.');
    store.setCloudSyncStatus('offline_queued');
    return false;
  }`;

const rep1 = `  if (!navigator.onLine || store.isForceOfflineMode) {
    console.warn('Network offline or Force Offline mode active. Queuing changes locally.');
    store.setCloudSyncStatus('offline_queued');
    return false;
  }`;

code = code.replace(target1, rep1);

const target2 = `  window.addEventListener('online', () => {
    const store = useStore.getState();
    if (store.cloudSyncStatus === 'offline_queued' || store.cloudSyncStatus === 'error') {`;

const rep2 = `  window.addEventListener('online', () => {
    const store = useStore.getState();
    if (store.isForceOfflineMode) return;
    if (store.cloudSyncStatus === 'offline_queued' || store.cloudSyncStatus === 'error') {`;

code = code.replace(target2, rep2);

fs.writeFileSync('src/lib/db.ts', code);
