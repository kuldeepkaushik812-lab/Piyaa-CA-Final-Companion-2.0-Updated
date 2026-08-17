const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// I'm going to also add table-like rendering logic for the time split to match the exact image (Time Split | Hrs | Min).
const regex = /<div className="flex flex-col gap-1 text-\[10px\] text-slate-300 font-mono bg-slate-800\/50 p-2 rounded-lg border border-slate-700\/50">[\s\S]*?<\/div>\n\s*<\/div>/;

const replacement = `<div className="flex flex-col text-[10px] text-slate-300 font-mono bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden">
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
                      </div>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target string.");
}
