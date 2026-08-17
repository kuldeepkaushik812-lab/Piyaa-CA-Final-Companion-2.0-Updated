const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<div className="space-y-3 pt-2">[\s\S]*?<span>16h \(Heavy\)<\/span>\n                    <\/div>\n                  <\/div>/;

const replacement = `<div className="space-y-4 pt-4 border-t border-slate-700/50">
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
                         <div className="flex flex-col gap-1 text-[10px] text-slate-300 font-mono bg-slate-800/50 p-2 rounded-lg border border-slate-700/50">
                           <div className="flex justify-between"><span>Primary:</span> <span>{Math.floor(availableHours * (splitRatio/100))}h {Math.round((availableHours * (splitRatio/100) % 1) * 60)}m</span></div>
                           <div className="flex justify-between"><span>Secondary:</span> <span>{Math.floor(availableHours * ((100-splitRatio)/100))}h {Math.round((availableHours * ((100-splitRatio)/100) % 1) * 60)}m</span></div>
                         </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400">Lunch Time (Start)</label>
                           <input type="text" value={lunchStartTime} onChange={e => setLunchStartTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold text-slate-400">Dinner Time (Start)</label>
                           <input type="text" value={dinnerStartTime} onChange={e => setDinnerStartTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                        </div>
                     </div>
                  </div>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target string.");
}
