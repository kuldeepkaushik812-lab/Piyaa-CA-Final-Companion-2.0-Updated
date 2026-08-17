sed -i '1667,2096c\
      <div className={`overflow-x-auto bg-[#0A121E]/60 rounded-xl border border-slate-700/80 shadow-lg ${isPastDate ? "pointer-events-none opacity-80 grayscale-[20%]" : ""}`}>\
        <table className="w-full text-left border-collapse text-xs">\
          <thead>\
            <tr className="bg-slate-800/80 text-slate-300 border-b border-slate-700">\
              <th className="px-4 py-3 font-semibold w-1/4">Time</th>\
              <th className="px-4 py-3 font-semibold w-1/4">Subject</th>\
              <th className="px-4 py-3 font-semibold w-1/3">Chapter</th>\
              <th className="px-4 py-3 font-semibold w-auto">Remarks</th>\
            </tr>\
          </thead>\
          <tbody className="divide-y divide-slate-800/50">\
            {filteredSlots.map((slot) => {\
              const isBreak = slot.category === "break" || slot.subject.toLowerCase() === "break" || slot.activity.toLowerCase().includes("break");\
              const isCompleted = slot.status === "COMPLETED" || slot.completed;\
\
              if (isBreak) {\
                return (\
                  <tr key={slot.id} className="bg-amber-950/10 text-amber-200/80">\
                    <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">{slot.time}</td>\
                    <td className="px-4 py-3 font-medium" colSpan={2}>☕ {slot.activity || slot.subject || "Rest Break"}</td>\
                    <td className="px-4 py-3">\
                       <button onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }} className={`px-3 py-1 rounded text-[10px] font-bold uppercase ${slot.completed ? "bg-slate-800 text-slate-400" : "bg-amber-950/40 border border-amber-500/30 text-amber-300"}`}>\
                         {slot.completed ? "Undo" : "Done"}\
                       </button>\
                    </td>\
                  </tr>\
                );\
              }\
\
              return (\
                <tr key={slot.id} className={`${isCompleted ? "opacity-50 text-slate-400" : "text-slate-100"} hover:bg-slate-800/30 transition-colors cursor-pointer`} onClick={() => setEditForm(slot)}>\
                  <td className="px-4 py-3 font-mono text-[11px] whitespace-nowrap">\
                    {slot.time}\
                  </td>\
                  <td className="px-4 py-3 font-medium">\
                    {slot.subject}\
                  </td>\
                  <td className="px-4 py-3">\
                    <div className="truncate max-w-[200px]" title={slot.activity}>{slot.activity}</div>\
                  </td>\
                  <td className="px-4 py-3">\
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>\
                      <button \
                        onClick={(e) => { e.stopPropagation(); handleToggle(slot.id, true); }}\
                        className={`px-3 py-1 rounded border text-[10px] uppercase font-bold tracking-wider ${isCompleted ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30" : "bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700"}`}\
                      >\
                        {isCompleted ? "Undo" : "Done"}\
                      </button>\
                      {!isCompleted && !isPastDate && (\
                         <button\
                           onClick={(e) => {\
                             e.stopPropagation();\
                             setTimerTargetSlotId(slot.id);\
                             setCurrentSubject(subjects.find(s => s.name.toLowerCase().includes(slot.subject.toLowerCase()) || s.code.toLowerCase().includes(slot.subject.toLowerCase()))?.id || "general");\
                             setActiveTab("timer");\
                           }}\
                           className="text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-3 py-1 rounded border border-cyan-500/30 text-[10px] uppercase font-bold tracking-wider"\
                         >\
                           Start\
                         </button>\
                      )}\
                    </div>\
                  </td>\
                </tr>\
              );\
            })}\
          </tbody>\
        </table>\
      </div>\
' src/components/TimetablePlanner.tsx
