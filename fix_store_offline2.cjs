const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

const target = `      cloudSyncStatus: 'synced',
      setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),`;

const replacement = `      cloudSyncStatus: 'synced',
      setCloudSyncStatus: (status) => set({ cloudSyncStatus: status }),
      isForceOfflineMode: false,
      setForceOfflineMode: (force) => set({ isForceOfflineMode: force }),`;

code = code.replace(target, replacement);

fs.writeFileSync('src/store.ts', code);
