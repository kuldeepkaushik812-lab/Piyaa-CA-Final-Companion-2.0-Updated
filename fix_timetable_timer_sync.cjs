const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<td className="px-4 py-3">\s*<div className="truncate max-w-\[200px\]" title=\{slot\.activity\}>\{slot\.activity\}<\/div>\s*<\/td>/;

const replacement = `<td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="truncate max-w-[200px]" title={slot.activity}>{slot.activity}</div>
                      {(slot.studiedDurationHours !== undefined && slot.studiedDurationHours > 0) && (
                        <div className="flex items-center gap-2">
                           <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400" style={{ width: \`\${Math.min(100, ((slot.studiedDurationHours || 0) / (parseSlotHours(slot.time) || 2)) * 100)}%\` }}></div>
                           </div>
                           <span className="text-[9px] font-mono font-bold text-amber-400">{slot.studiedDurationHours.toFixed(2)}h / {parseSlotHours(slot.time)}h</span>
                        </div>
                      )}
                    </div>
                  </td>`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Timetable rendering updated to include dynamic progress bars.");
} else {
    console.log("Could not find table cell.");
}
