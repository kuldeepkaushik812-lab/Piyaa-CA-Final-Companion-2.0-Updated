const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

const stateDef = `  const [showSyncToast, setShowSyncToast] = useState(false);
  const [offlineToast, setOfflineToast] = useState(false);`;

code = code.replace(`  const [showSyncToast, setShowSyncToast] = useState(false);`, stateDef);

const effectDef = `  useEffect(() => {
    const handleSyncSuccess = () => {
      setShowSyncToast(true);
      setTimeout(() => setShowSyncToast(false), 3000);
    };
    const handleOffline = () => {
      setOfflineToast(true);
      setTimeout(() => setOfflineToast(false), 4000);
    };
    window.addEventListener('offline-sync-success', handleSyncSuccess);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('offline-sync-success', handleSyncSuccess);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);`;

code = code.replace(/  useEffect\(\(\) => \{\n    const handleSyncSuccess = \(\) => \{\n      setShowSyncToast\(true\);\n      setTimeout\(\(\) => setShowSyncToast\(false\), 3000\);\n    \};\n    window\.addEventListener\('offline-sync-success', handleSyncSuccess\);\n    return \(\) => window\.removeEventListener\('offline-sync-success', handleSyncSuccess\);\n  \}, \[\]\);/g, effectDef);


const toastRender = `      {showSyncToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 glass-card bg-sky-950/90 border-sky-500/50 px-4 py-2 rounded-xl text-sky-200 text-sm font-bold flex items-center gap-2 shadow-2xl shadow-sky-500/20 animate-fadeIn pointer-events-none">
          <CloudCheck className="w-5 h-5 text-[#2dd4bf]" />
          ✅ Offline Queue Synced!
        </div>
      )}
      {offlineToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] glass-card bg-rose-950/95 border-rose-500/50 px-4 py-2 rounded-xl text-rose-200 text-sm font-bold flex items-center gap-2 shadow-2xl shadow-rose-500/20 animate-in slide-in-from-bottom-5 fade-in pointer-events-none">
          <CloudOff className="w-5 h-5 text-rose-400 animate-pulse" />
          Network Offline. You can continue studying! Changes will be queued.
        </div>
      )}`;

code = code.replace(/      \{showSyncToast && \(\n        <div className="fixed bottom-20 left-1\/2 -translate-x-1\/2 z-50 glass-card bg-sky-950\/90 border-sky-500\/50 px-4 py-2 rounded-xl text-sky-200 text-sm font-bold flex items-center gap-2 shadow-2xl shadow-sky-500\/20 animate-fadeIn pointer-events-none">\n          <CloudCheck className="w-5 h-5 text-\[#2dd4bf\]" \/>\n          ✅ Offline Queue Synced!\n        <\/div>\n      \)\}/g, toastRender);

fs.writeFileSync('src/components/Header.tsx', code);
