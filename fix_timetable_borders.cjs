const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /const isMissed = isPast && !isCompleted && slot\.status !== 'IN_PROGRESS';[\s\S]*?let rowStyle = "hover:bg-slate-800\/30 transition-colors cursor-pointer ";[\s\S]*?if \(isBreak\) \{[\s\S]*?\} else \{[\s\S]*?rowStyle \+= "border-l-\[3px\] border-slate-700 bg-transparent text-slate-100";\n\s*\}/;

const replacement = `const isMissed = isPast && !isCompleted && slot.status !== 'IN_PROGRESS' && (slot.studiedDurationHours || 0) === 0;

              let rowStyle = "hover:bg-slate-800/30 transition-colors cursor-pointer ";
              
              const studiedHrs = slot.studiedDurationHours || 0;
              const totalHrs = parseSlotHours(slot.time) || 2;
              const progressPercent = Math.min(100, (studiedHrs / totalHrs) * 100);
              const isPomodoroActive = progressPercent > 0 && progressPercent < 100;
              
              if (isBreak) {
                rowStyle += "bg-amber-950/10 text-amber-200/80 border-l-[3px] border-amber-500/30";
              } else if (isCompleted || progressPercent >= 100) {
                rowStyle += "opacity-60 text-slate-400 border-l-[3px] border-emerald-500/50 bg-emerald-950/5";
              } else if (isPomodoroActive) {
                rowStyle += "border-l-[3px] border-cyan-400 bg-cyan-950/20 text-white shadow-[inset_4px_0_15px_rgba(34,211,238,0.15)]";
              } else if (isLive) {
                rowStyle += "border-l-[3px] border-amber-400 bg-amber-950/20 text-white shadow-[inset_4px_0_15px_rgba(251,191,36,0.15)]";
              } else if (slot.status === 'FAILED' || isMissed) {
                rowStyle += "border-l-[3px] border-rose-500/50 bg-rose-950/10 text-rose-300/80";
              } else {
                rowStyle += "border-l-[3px] border-slate-700 bg-transparent text-slate-100";
              }`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Timetable borders logic successfully updated.");
} else {
    console.log("Regex match failed.");
}
