const fs = require('fs');
let code = fs.readFileSync('src/components/WeeklyPlannerModal.tsx', 'utf8');

// 1. Add filtered topics memo logic
const memoRegex = /const allocatedSecondaryHours = useMemo\(\(\) => \{[\s\S]*?\}, \[activeConfig, sSubObj\]\);/;
const replacementMemo = `const allocatedSecondaryHours = useMemo(() => {
    if (!sSubObj) return 0;
    return activeConfig.availableHours - allocatedPrimaryHours;
  }, [activeConfig, sSubObj]);

  const pSubObjFilteredTopics = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
       if (activeConfig.revisionMode === 'R1') return !t.rev1;
       if (activeConfig.revisionMode === 'R2') return !t.rev2;
       if (activeConfig.revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [pSubObj, activeConfig.revisionMode]);

  const sSubObjFilteredTopics = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
       if (activeConfig.revisionMode === 'R1') return !t.rev1;
       if (activeConfig.revisionMode === 'R2') return !t.rev2;
       if (activeConfig.revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [sSubObj, activeConfig.revisionMode]);`;

code = code.replace(memoRegex, replacementMemo);

// 2. Replace the whole Subject Pairing & Chapters Selection block (Lines ~1080 - 1220)
const chaptersRegex = /\{\/\* Subjects Pairing \*\/\}[\s\S]*?\{\/\* Custom Notes \*\/\}/;

const newChaptersUI = `{/* Revision Strategy (Same as Daily Planner) */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <div className="text-[10px] font-black uppercase text-pink-400 tracking-widest border-b border-pink-500/10 pb-2 flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-pink-400" />
                <span>Revision Strategy</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <select
                    value={activeConfig.revisionMode}
                    onChange={e => updateActiveConfig({ revisionMode: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-xs text-pink-300 font-bold focus:border-pink-500 focus:outline-none shadow-inner"
                  >
                    <option value="R1">R1 Revision (Remaining for R1)</option>
                    <option value="R2">R2 Revision (Remaining for R2)</option>
                    <option value="R3">R3 Revision (Remaining for R3)</option>
                  </select>
                  <p className="mt-2 text-[9px] text-slate-500 font-medium">Chapters in the scope lists below are automatically filtered based on syllabus completion & this mode.</p>
                </div>
              </div>
            </div>

            {/* Subjects Pairing */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Select Study Subjects:
              </label>
              <div className="space-y-2">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-300">Primary Subject:</span>
                  <select
                    value={activeConfig.primarySubject}
                    onChange={(e) => updateActiveConfig({ primarySubject: e.target.value })}
                    className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                  >
                    {subjects.map((s) => (
                      <option key={\`p-\${s.id}\`} value={s.name}>{s.code}: {s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-300/80">Secondary Subject:</span>
                  <select
                    value={activeConfig.secondarySubject}
                    onChange={(e) => updateActiveConfig({ secondarySubject: e.target.value })}
                    className="w-full text-slate-100 text-xs font-bold rounded-xl px-3 py-2.5 focus:border-emerald-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer"
                  >
                    <option value="N/A">🚫 N/A (Solo Focus Mode)</option>
                    {subjects
                      .filter((s) => s.name !== activeConfig.primarySubject)
                      .map((s) => (
                        <option key={\`s-\${s.id}\`} value={s.name}>{s.code}: {s.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Split Ratio Slider */}
            {activeConfig.secondarySubject !== 'N/A' && (
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                    Split Ratio (Primary : Secondary)
                  </label>
                  <span className="text-xs font-black text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                    {activeConfig.splitRatio} : {100 - activeConfig.splitRatio}
                  </span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={5}
                  value={activeConfig.splitRatio}
                  onChange={(e) => updateActiveConfig({ splitRatio: Number(e.target.value) })}
                  className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="text-center font-bold text-xs text-emerald-300 bg-emerald-950/50 py-1.5 px-3 rounded-xl border border-emerald-500/10">
                  ⚡ {pSubObj?.code || 'Primary'}: {allocatedPrimaryHours.toFixed(1)} hrs | {sSubObj?.code || 'Secondary'}: {allocatedSecondaryHours.toFixed(1)} hrs
                </div>
              </div>
            )}

            {/* Chapter selectors (Exact match to Daily AI) */}
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3 shadow-inner">
              <label className="block text-xs font-extrabold text-emerald-300 uppercase tracking-wider">
                Chapters Scope
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Subject chapters list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-300">Primary Chapters ({pSubObj?.name || activeConfig.primarySubject})</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateActiveConfig({ selectedPrimaryChapterIds: pSubObjFilteredTopics.map(t => t.id) })} className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300">Select All</button>
                      <button onClick={() => updateActiveConfig({ selectedPrimaryChapterIds: [] })} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                    </div>
                  </div>
                  <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                    {pSubObjFilteredTopics.length === 0 ? (
                      <div className="text-[10px] text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                    ) : (
                      pSubObjFilteredTopics.map(topic => {
                        const isSelected = activeConfig.selectedPrimaryChapterIds.includes(topic.id);
                        return (
                          <label key={topic.id} className="flex items-start gap-1.5 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updated = isSelected 
                                  ? activeConfig.selectedPrimaryChapterIds.filter(id => id !== topic.id)
                                  : [...activeConfig.selectedPrimaryChapterIds, topic.id];
                                updateActiveConfig({ selectedPrimaryChapterIds: updated });
                              }}
                              className="mt-0.5 accent-emerald-500 rounded bg-slate-800 border-slate-600 shrink-0"
                            />
                            <span className="text-[11px] text-slate-300 leading-tight group-hover:text-emerald-300">{topic.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Secondary Subject chapters list */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-300">Secondary Chapters {(activeConfig.secondarySubject === 'N/A') ? '(None)' : \`(\${sSubObj?.name || activeConfig.secondarySubject})\`}</span>
                    {activeConfig.secondarySubject !== 'N/A' && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateActiveConfig({ selectedSecondaryChapterIds: sSubObjFilteredTopics.map(t => t.id) })} className="text-[9px] font-bold text-teal-400 hover:text-teal-300">Select All</button>
                        <button onClick={() => updateActiveConfig({ selectedSecondaryChapterIds: [] })} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                      </div>
                    )}
                  </div>
                  <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                    {activeConfig.secondarySubject === 'N/A' ? (
                      <div className="text-[10px] text-slate-500 text-center py-6">Solo Mode Active</div>
                    ) : sSubObjFilteredTopics.length === 0 ? (
                      <div className="text-[10px] text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                    ) : (
                      sSubObjFilteredTopics.map(topic => {
                        const isSelected = activeConfig.selectedSecondaryChapterIds.includes(topic.id);
                        return (
                          <label key={topic.id} className="flex items-start gap-1.5 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const updated = isSelected 
                                  ? activeConfig.selectedSecondaryChapterIds.filter(id => id !== topic.id)
                                  : [...activeConfig.selectedSecondaryChapterIds, topic.id];
                                updateActiveConfig({ selectedSecondaryChapterIds: updated });
                              }}
                              className="mt-0.5 accent-teal-500 rounded bg-slate-800 border-slate-600 shrink-0"
                            />
                            <span className="text-[11px] text-slate-300 leading-tight group-hover:text-teal-300">{topic.title}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Notes */}`;

code = code.replace(chaptersRegex, newChaptersUI);

fs.writeFileSync('src/components/WeeklyPlannerModal.tsx', code);
console.log('Chapters section in WeeklyPlannerModal updated.');
