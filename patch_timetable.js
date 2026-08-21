const fs = require('fs');
const content = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf-8');

const targetSection = `                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Targeted Hrs: {availableHours} Hrs
                      </label>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={16}
                      step={1}
                      value={availableHours}
                      onChange={(e) => {
                        const nextHrs = Number(e.target.value);
                        setAvailableHours(nextHrs);
                        setDailyTarget(selectedDateStr, nextHrs);
                        if (onUpdateTargetHours) onUpdateTargetHours(nextHrs);
                      }}
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">
                      <span>4h</span>
                      <span className="text-indigo-400/80">8h</span>
                      <span>16h</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">Time Split (Primary)</label>
                        <input
                          type="range"
                          min={20}
                          max={100}
                          step={10}
                          value={splitRatio}
                          onChange={(e) => setSplitRatio(Number(e.target.value))}
                          className="w-full accent-teal-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>Pri: {splitRatio}%</span>
                          <span>Sec: {100 - splitRatio}%</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                         <div className="flex flex-col text-[10px] text-slate-300 font-mono bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden">
                          <div className="flex justify-between bg-slate-800 px-2 py-1 border-b border-slate-700 font-bold">
                            <span className="w-1/2">Time Split</span>
                            <span className="w-1/4 text-center">Hrs</span>
                            <span className="w-1/4 text-center">Min</span>
                          </div>
                          <div className="flex justify-between px-2 py-1 border-b border-slate-700">
                            <span className="w-1/2 text-indigo-300 truncate">Primary Sub</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.floor(availableHours * (splitRatio/100))}</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.round((availableHours * (splitRatio/100) % 1) * 60)}</span>
                          </div>
                          <div className="flex justify-between px-2 py-1">
                            <span className="w-1/2 text-teal-300 truncate">Secondary Sub</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.floor(availableHours * ((100-splitRatio)/100))}</span>
                            <span className="w-1/4 text-center text-slate-400">{Math.round((availableHours * ((100-splitRatio)/100) % 1) * 60)}</span>
                          </div>
                         </div>
                      </div>
                      </div>
                    </div>`;

const newSection = `                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Manual Target Hours Feed (Hrs & Min)
                      </label>
                      <div className="text-[10px] text-indigo-400 font-mono font-bold bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-500/30">
                        Total: {availableHours.toFixed(2)}h
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider truncate block w-full">
                          Pri: {primarySubject === 'N/A' ? '(None)' : primarySubject.split(' ')[0]}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="24"
                              value={Math.floor(availableHours * (splitRatio/100)).toString()}
                              onChange={(e) => {
                                const h = parseFloat(e.target.value) || 0;
                                const currentM = Math.round((availableHours * (splitRatio/100) % 1) * 60);
                                const priTotal = h + (currentM / 60);
                                const secTotal = availableHours * ((100-splitRatio)/100);
                                const total = priTotal + secTotal;
                                setAvailableHours(total);
                                setDailyTarget(selectedDateStr, total);
                                if (onUpdateTargetHours) onUpdateTargetHours(total);
                                setSplitRatio(total > 0 ? (priTotal / total) * 100 : 100);
                              }}
                              placeholder="0"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-indigo-300 font-bold focus:border-indigo-500 focus:outline-none shadow-inner"
                            />
                            <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-bold pointer-events-none">Hrs</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="59"
                              step="5"
                              value={Math.round((availableHours * (splitRatio/100) % 1) * 60).toString()}
                              onChange={(e) => {
                                const h = Math.floor(availableHours * (splitRatio/100));
                                const m = parseFloat(e.target.value) || 0;
                                const priTotal = h + (m / 60);
                                const secTotal = availableHours * ((100-splitRatio)/100);
                                const total = priTotal + secTotal;
                                setAvailableHours(total);
                                setDailyTarget(selectedDateStr, total);
                                if (onUpdateTargetHours) onUpdateTargetHours(total);
                                setSplitRatio(total > 0 ? (priTotal / total) * 100 : 100);
                              }}
                              placeholder="0"
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-indigo-300 font-bold focus:border-indigo-500 focus:outline-none shadow-inner"
                            />
                            <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-bold pointer-events-none">Min</span>
                          </div>
                        </div>
                      </div>

                      {secondarySubject !== 'N/A' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-extrabold text-teal-300/80 uppercase tracking-wider truncate block w-full">
                            Sec: {secondarySubject.split(' ')[0]}
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="24"
                                value={Math.floor(availableHours * ((100-splitRatio)/100)).toString()}
                                onChange={(e) => {
                                  const h = parseFloat(e.target.value) || 0;
                                  const currentM = Math.round((availableHours * ((100-splitRatio)/100) % 1) * 60);
                                  const secTotal = h + (currentM / 60);
                                  const priTotal = availableHours * (splitRatio/100);
                                  const total = priTotal + secTotal;
                                  setAvailableHours(total);
                                  setDailyTarget(selectedDateStr, total);
                                  if (onUpdateTargetHours) onUpdateTargetHours(total);
                                  setSplitRatio(total > 0 ? (priTotal / total) * 100 : 100);
                                }}
                                placeholder="0"
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-teal-300 font-bold focus:border-teal-500 focus:outline-none shadow-inner"
                              />
                              <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-bold pointer-events-none">Hrs</span>
                            </div>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="59"
                                step="5"
                                value={Math.round((availableHours * ((100-splitRatio)/100) % 1) * 60).toString()}
                                onChange={(e) => {
                                  const h = Math.floor(availableHours * ((100-splitRatio)/100));
                                  const m = parseFloat(e.target.value) || 0;
                                  const secTotal = h + (m / 60);
                                  const priTotal = availableHours * (splitRatio/100);
                                  const total = priTotal + secTotal;
                                  setAvailableHours(total);
                                  setDailyTarget(selectedDateStr, total);
                                  if (onUpdateTargetHours) onUpdateTargetHours(total);
                                  setSplitRatio(total > 0 ? (priTotal / total) * 100 : 100);
                                }}
                                placeholder="0"
                                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-sm text-teal-300 font-bold focus:border-teal-500 focus:outline-none shadow-inner"
                              />
                              <span className="absolute right-3 top-2.5 text-[10px] text-slate-500 font-bold pointer-events-none">Min</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>`;

if (content.includes(targetSection)) {
  fs.writeFileSync('src/components/TimetablePlanner.tsx', content.replace(targetSection, newSection));
  console.log('Successfully patched TimetablePlanner.tsx');
} else {
  console.log('Target section not found exactly. Finding index...');
  const startIdx = content.indexOf('<div className="space-y-4 pt-4 border-t border-slate-700/50">');
  const endMarker = `                  <div className="space-y-4 pt-4 border-t border-slate-700/50">\n                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>`;
  const endIdx = content.indexOf(endMarker);
  
  if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
     const toReplace = content.substring(startIdx, endIdx);
     fs.writeFileSync('src/components/TimetablePlanner.tsx', content.replace(toReplace, newSection + '\n'));
     console.log('Successfully patched using index replacement.');
  } else {
     console.log('Failed to find start/end indices.');
  }
}
