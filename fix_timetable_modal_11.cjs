const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<div className="text-sm font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500\/10 pb-3 flex items-center gap-2">\s*<Clock className="w-4 h-4 text-indigo-400" \/>\s*<span>Time Setup<\/span>\s*<\/div>/;

const replacement = `<div className="space-y-4">
                  <div className="text-sm font-black uppercase text-pink-400 tracking-widest border-b border-pink-500/10 pb-3 flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-pink-400" />
                    <span>Revision Strategy</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <select
                        value={revisionMode}
                        onChange={e => setRevisionMode(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-pink-300 font-bold focus:border-pink-500 focus:outline-none shadow-inner"
                      >
                        <option value="First Time">First Time (Pending Chapters)</option>
                        <option value="R1">R1 Revision</option>
                        <option value="R2">R2 Revision</option>
                        <option value="R3">R3 Revision</option>
                      </select>
                      <p className="mt-2 text-[10px] text-slate-500 font-medium">Chapters in the scope lists below are automatically filtered based on syllabus completion & this mode.</p>
                    </div>
                  </div>
                </div>

                <div className="text-sm font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500/10 pb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span>Time Setup</span>
                </div>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Revision Strategy Dropdown Inserted");
} else {
    console.log("Could not match insertion target");
}
