const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

const storeExtract = `  const subjects = useStore((state) => state.subjects);`;
const newStoreExtract = `  const isForceOfflineMode = useStore((state) => state.isForceOfflineMode);
  const setForceOfflineMode = useStore((state) => state.setForceOfflineMode);
  const subjects = useStore((state) => state.subjects);`;

code = code.replace(storeExtract, newStoreExtract);

const offlineToggleStr = `                    <div className="px-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cloud & Data</p>

                      <button
                        onClick={() => {
                          const newMode = !isForceOfflineMode;
                          setForceOfflineMode(newMode);
                          if (newMode) {
                            useStore.getState().setCloudSyncStatus('offline_queued');
                          } else {
                            if (navigator.onLine) {
                              useStore.getState().setCloudSyncStatus('idle');
                              onSaveToCloud();
                            }
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl glass-card glass-card-hover border border-slate-500/30 text-xs font-bold cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          {isForceOfflineMode ? <CloudOff className="w-3.5 h-3.5 text-amber-400" /> : <Cloud className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                          <span>{isForceOfflineMode ? 'Offline Mode Active' : 'Go Offline Mode'}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Toggle</span>
                      </button>`;

code = code.replace(`                    <div className="px-2 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Cloud & Data</p>`, offlineToggleStr);

// To avoid duplicate 'import { WifiOff } from "lucide-react";' let's use CloudOff / Cloud which are already imported.

fs.writeFileSync('src/components/Header.tsx', code);
