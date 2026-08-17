const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<td className="px-4 py-3 font-medium flex items-center gap-2">[\s\S]*?<td className="px-4 py-3">[\s\S]*?<\/div>\s*<\/td>/;

const replacement = `<td className="px-4 py-3 font-medium flex items-center gap-2">
                    {isCompleted && (
                       <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-in zoom-in spin-in-12 duration-500 shadow-sm" />
                    )}
                    {isLive && !isCompleted && (
                       <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                    )}
                    <span className={\`\${isCompleted ? 'line-through decoration-emerald-500/30 text-emerald-100/70' : ''}\`}>
                       {slot.subject}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="truncate max-w-[200px]" title={slot.activity}>{slot.activity}</div>
                      
                      {/* Quick Tag Inline Editor */}
                      <div onClick={(e) => e.stopPropagation()}>
                        {activeTagEditId === slot.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={activeTagValue}
                              onChange={e => setActiveTagValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleSaveQuickTag(slot.id);
                                if (e.key === 'Escape') setActiveTagEditId(null);
                              }}
                              onBlur={() => handleSaveQuickTag(slot.id)}
                              placeholder="e.g. Concept Review"
                              className="bg-slate-900 border border-emerald-500/50 rounded px-2 py-0.5 text-[10px] text-white focus:outline-none w-32"
                            />
                          </div>
                        ) : slot.quickTag ? (
                          <div 
                            className="inline-flex items-center gap-1.5 bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded cursor-pointer hover:bg-indigo-900/60 transition-colors w-fit"
                            onClick={() => {
                              setActiveTagValue(slot.quickTag || '');
                              setActiveTagEditId(slot.id);
                            }}
                          >
                            <span className="text-[9px] font-bold tracking-wide uppercase">{slot.quickTag}</span>
                            <Edit3 className="w-2.5 h-2.5 opacity-50" />
                          </div>
                        ) : (
                          <button 
                            className="text-[9px] font-bold text-slate-500 hover:text-indigo-400 transition-colors uppercase tracking-wide flex items-center gap-1"
                            onClick={() => {
                              setActiveTagValue('');
                              setActiveTagEditId(slot.id);
                            }}
                          >
                            <Plus className="w-3 h-3" /> Add Tag
                          </button>
                        )}
                      </div>

                      {(slot.studiedDurationHours !== undefined && slot.studiedDurationHours > 0) && (
                        <div className="flex items-center gap-2 mt-0.5">
                           <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-inner border border-slate-700/50">
                              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-1000 ease-out relative" style={{ width: \`\${Math.min(100, ((slot.studiedDurationHours || 0) / (parseSlotHours(slot.time) || 2)) * 100)}%\` }}>
                                {isCompleted && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                              </div>
                           </div>
                           <span className="text-[9px] font-mono font-bold text-amber-400">{slot.studiedDurationHours.toFixed(2)}h / {parseSlotHours(slot.time)}h</span>
                        </div>
                      )}
                    </div>
                  </td>`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Table UI updated for animation and Quick Tag.");
} else {
    console.log("Regex match failed. Check the table pattern.");
}
