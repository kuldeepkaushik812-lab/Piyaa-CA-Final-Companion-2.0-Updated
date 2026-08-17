const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /\{filteredSlots\.map\(\(slot\) => \{[\s\S]*?const isBreak = slot\.category === "break"[\s\S]*?return \([\s\S]*?<\/tr>\s*\);\s*\}\)\}/;

const replacement = `{filteredSlots.map((slot) => {
              const isBreak = slot.category === "break" || slot.subject.toLowerCase() === "break" || slot.activity.toLowerCase().includes("break");
              const isCompleted = slot.status === "COMPLETED" || slot.completed;
              
              const isPast = isSlotPassed(selectedDateStr, slot.time);
              let isLive = false;
              
              if (selectedDateStr === effectiveNowDate) {
                const parts = slot.time.split('-').map(s => s.trim());
                if (parts.length === 2) {
                   let startMins = parseTimeToMinutes(parts[0]);
                   let endMins = parseTimeToMinutes(parts[1]);
                   if (endMins < startMins) endMins += 1440;
                   
                   let adjStart = startMins;
                   if (hasEveningSlots && adjStart <= 5 * 60) adjStart += 1440;
                   let adjEnd = endMins;
                   if (hasEveningSlots && adjEnd <= 5 * 60) adjEnd += 1440;
                   
                   if (effectiveCurrentMinutes >= adjStart && effectiveCurrentMinutes < adjEnd) {
                     isLive = true;
                   }
                }
              }

              const isMissed = isPast && !isCompleted && slot.status !== 'IN_PROGRESS';

              let rowStyle = "hover:bg-slate-800/30 transition-colors cursor-pointer ";
              
              if (isBreak) {
                rowStyle += "bg-amber-950/10 text-amber-200/80 border-l-[3px] border-amber-500/30";
              } else if (isCompleted) {
                rowStyle += "opacity-60 text-slate-400 border-l-[3px] border-emerald-500/50 bg-emerald-950/5";
              } else if (isLive) {
                rowStyle += "border-l-[3px] border-amber-400 bg-amber-950/20 text-white shadow-[inset_4px_0_15px_rgba(251,191,36,0.15)]";
              } else if (slot.status === 'FAILED' || isMissed) {
                rowStyle += "border-l-[3px] border-rose-500/50 bg-rose-950/10 text-rose-300/80";
              } else if (slot.status === 'IN_PROGRESS') {
                rowStyle += "border-l-[3px] border-amber-500/40 bg-amber-950/10 text-slate-100";
              } else if (slot.status === 'PARTIALLY_COMPLETED') {
                rowStyle += "border-l-[3px] border-emerald-500/30 bg-emerald-950/5 text-slate-300";
              } else {
                rowStyle += "border-l-[3px] border-slate-700 bg-transparent text-slate-100";
              }

              if (isBreak) {
                return (
                  <tr key={slot.id} className={rowStyle}>
                    <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{slot.time}</td>
                    <td className="px-4 py-3 font-medium" colSpan={2}>☕ {slot.activity || slot.subject || "Rest Break"}</td>
                    <td className="px-4 py-3">
                       <button onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }} className={\`px-3 py-1 rounded text-[10px] font-bold uppercase \${slot.completed ? "bg-slate-800 text-slate-400" : "bg-amber-950/40 border border-amber-500/30 text-amber-300"}\`}>
                         {slot.completed ? "Undo" : "Done"}
                       </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={slot.id} className={rowStyle} onClick={() => handleStartEdit(slot)}>
                  <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">
                    {slot.time}
                  </td>
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    {isLive && !isCompleted && (
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block"></span>
                    )}
                    {slot.subject}
                  </td>
                  <td className="px-4 py-3">
                    <div className="truncate max-w-[200px]" title={slot.activity}>{slot.activity}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }}
                        className={\`px-3 py-1 rounded border text-[10px] uppercase font-bold tracking-wider \${isCompleted ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"}\`}
                      >
                        {isCompleted ? "Undo" : "Done"}
                      </button>
                      {!isCompleted && !isPastDate && (
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             setTimerTargetSlotId(slot.id);
                             setCurrentSubject(subjects.find(s => s.name.toLowerCase().includes(slot.subject.toLowerCase()) || s.code.toLowerCase().includes(slot.subject.toLowerCase()))?.id || "general");
                             setActiveTab("timer");
                           }}
                           className={\`px-3 py-1 rounded border text-[10px] uppercase font-bold tracking-wider \${isLive ? "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30" : "text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border-cyan-500/30 hover:bg-cyan-900/60"}\`}
                         >
                           {isLive ? "● LIVE" : "Start"}
                         </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Color coding updated.");
} else {
    console.log("Could not find table row map.");
}
