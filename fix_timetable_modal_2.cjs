const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<label className="block text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider">\n\s*Day Start Time\n\s*<\/label>\n\s*<input\n\s*type="text"\n\s*value=\{startTimePreference\}\n\s*onChange=\{\(e\) => setStartTimePreference\(e\.target\.value\)\}\n\s*placeholder="e\.g\. 09:00 AM"\n\s*className="w-full bg-slate-900 border border-slate-700\/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"\n\s*\/>\n\s*<\/div>\n\s*<\/div>/;

const replacement = `<label className="block text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">
                        Day Start Time
                      </label>
                      <input
                        type="text"
                        value={startTimePreference}
                        onChange={(e) => setStartTimePreference(e.target.value)}
                        placeholder="e.g. 09:00 AM"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"
                      />
                    </div>
                  </div>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target string. Using fallback regex.");
    const regex2 = /<div className="space-y-2">\n\s*<label className="block text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider">\n\s*Day Start Time[\s\S]*?<\/div>\n\s*<\/div>/;
    if (code.match(regex2)) {
         code = code.replace(regex2, replacement);
         fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
         console.log("Fallback Replaced successfully!");
    } else {
         console.log("Could not find the target string with fallback.");
    }
}
