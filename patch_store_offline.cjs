const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

const target1 = `  cloudSyncStatus: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued';
  setCloudSyncStatus: (status: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued') => void;`;

const rep1 = `  cloudSyncStatus: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued';
  setCloudSyncStatus: (status: 'idle' | 'saving' | 'synced' | 'error' | 'offline_queued') => void;
  isForceOfflineMode: boolean;
  setForceOfflineMode: (force: boolean) => void;`;

code = code.replace(target1, rep1);

const target2 = `  cloudSyncStatus: 'idle',
  setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),`;

const rep2 = `  cloudSyncStatus: 'idle',
  setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),
  isForceOfflineMode: false,
  setForceOfflineMode: (force) => set({ isForceOfflineMode: force }),`;

code = code.replace(target2, rep2);

fs.writeFileSync('src/store.ts', code);
