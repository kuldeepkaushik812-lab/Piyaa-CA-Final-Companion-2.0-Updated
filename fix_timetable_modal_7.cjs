const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<div className="space-y-4 pt-4 border-t border-slate-700\/50">\n\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Events & Breaks<\/h4>\n\s*<div className="grid grid-cols-2 gap-4">\n\s*<div className="space-y-2">\n\s*<label className="text-\[10px\] font-bold text-slate-400">Lunch Time \(Start\)<\/label>\n\s*<input type="text" value=\{lunchStartTime\} onChange=\{e => setLunchStartTime\(e.target.value\)\} className="w-full bg-slate-900 border border-slate-700\/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" \/>\n\s*<\/div>\n\s*<div className="space-y-2">\n\s*<label className="text-\[10px\] font-bold text-slate-400">Dinner Time \(Start\)<\/label>\n\s*<input type="text" value=\{dinnerStartTime\} onChange=\{e => setDinnerStartTime\(e.target.value\)\} className="w-full bg-slate-900 border border-slate-700\/80 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" \/>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/;

const replacement = `<div className="space-y-4 pt-4 border-t border-slate-700/50">
                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Lunch Time (Start)</label>
                             <input type="text" value={lunchStartTime} onChange={e => setLunchStartTime(e.target.value)} placeholder="e.g. 01:00 PM" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Lunch Duration (e.g. 45 mins)</label>
                             <input type="text" value={lunchDuration} onChange={e => setLunchDuration(e.target.value)} placeholder="e.g. 45 mins" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                        </div>
                        <div className="space-y-3 p-3 bg-slate-900/50 border border-slate-700/50 rounded-xl">
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Dinner Time (Start)</label>
                             <input type="text" value={dinnerStartTime} onChange={e => setDinnerStartTime(e.target.value)} placeholder="e.g. 08:30 PM" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
                           <div className="space-y-1.5">
                             <label className="text-[10px] font-bold text-slate-400">Dinner Duration (e.g. 45 mins)</label>
                             <input type="text" value={dinnerDuration} onChange={e => setDinnerDuration(e.target.value)} placeholder="e.g. 45 mins" className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-bold focus:border-indigo-500 focus:outline-none" />
                           </div>
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
