const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<div className="space-y-4 pt-4 border-t border-slate-700\/50">\n\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Events & Breaks<\/h4>/;

const replacement = `<div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Chapters Scope</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400">Primary Chapters</label>
                         <textarea
                           value={customInstructions}
                           onChange={e => setCustomInstructions(e.target.value)}
                           placeholder="Type chapters to focus on for primary subject (e.g. Audit of PSU, Ethics)"
                           className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 focus:border-indigo-500 focus:outline-none min-h-[60px]"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400">Secondary Chapters</label>
                         <textarea
                           value={customAiInstruction}
                           onChange={e => setCustomAiInstruction(e.target.value)}
                           placeholder="Type chapters for secondary subject (e.g. GST Returns, Refunds)"
                           className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 focus:border-indigo-500 focus:outline-none min-h-[60px]"
                         />
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-slate-700/50">
                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target string.");
}
