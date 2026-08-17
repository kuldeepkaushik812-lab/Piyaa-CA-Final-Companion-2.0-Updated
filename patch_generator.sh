sed -i '2139,3272c\
            {/* Layer 2: Simplified Modal Body */}\
            <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto">\
              <div className="bg-slate-950/40 p-5 sm:p-8 rounded-3xl border border-slate-800/80 space-y-8 shadow-2xl">\
                <div className="space-y-6">\
                  <div className="text-sm font-black uppercase text-indigo-400 tracking-widest border-b border-indigo-500/10 pb-3 flex items-center gap-2">\
                    <Clock className="w-4 h-4 text-indigo-400" />\
                    <span>Time Setup</span>\
                  </div>\
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">\
                    <div className="space-y-2">\
                      <label className="block text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">\
                        Target Study Date\
                      </label>\
                      <input\
                        type="date"\
                        value={selectedDateStr}\
                        onChange={(e) => setSelectedDateStr(e.target.value)}\
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"\
                      />\
                    </div>\
                    <div className="space-y-2">\
                      <label className="block text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">\
                        Day Start Time\
                      </label>\
                      <input\
                        type="text"\
                        value={startTimePreference}\
                        onChange={(e) => setStartTimePreference(e.target.value)}\
                        placeholder="e.g. 09:00 AM"\
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-amber-300 font-bold focus:border-indigo-500 focus:outline-none transition-colors shadow-inner"\
                      />\
                    </div>\
                  </div>\
                  <div className="space-y-3 pt-2">\
                    <div className="flex items-center justify-between">\
                      <label className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider">\
                        Target Study: {availableHours} Hrs/Day\
                      </label>\
                    </div>\
                    <input\
                      type="range"\
                      min={4}\
                      max={16}\
                      step={1}\
                      value={availableHours}\
                      onChange={(e) => {\
                        const nextHrs = Number(e.target.value);\
                        setAvailableHours(nextHrs);\
                        setDailyTarget(selectedDateStr, nextHrs);\
                        if (onUpdateTargetHours) onUpdateTargetHours(nextHrs);\
                      }}\
                      className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"\
                    />\
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono font-medium">\
                      <span>4h (Light)</span>\
                      <span className="text-indigo-400/80">8h (Optimal)</span>\
                      <span>16h (Heavy)</span>\
                    </div>\
                  </div>\
                </div>\
                <div className="space-y-6">\
                  <div className="text-sm font-black uppercase text-amber-400/80 tracking-widest border-b border-amber-500/10 pb-3 flex items-center gap-2">\
                    <BookOpen className="w-4 h-4 text-amber-400/80" />\
                    <span>Subject Focus</span>\
                  </div>\
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">\
                    <div className="space-y-2">\
                      <label className="block text-[10px] font-extrabold text-amber-300/80 uppercase tracking-wider">\
                        Primary Subject\
                      </label>\
                      <select\
                        value={primarySubject}\
                        onChange={(e) => setPrimarySubject(e.target.value)}\
                        className="w-full text-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer shadow-inner"\
                      >\
                        {subjects.map((s) => (\
                          <option key={`p-${s.id}`} value={s.name}>{s.code}: {s.name}</option>\
                        ))}\
                      </select>\
                    </div>\
                    <div className="space-y-2">\
                      <label className="block text-[10px] font-extrabold text-amber-300/80 uppercase tracking-wider">\
                        Secondary Subject\
                      </label>\
                      <select\
                        value={secondarySubject}\
                        onChange={(e) => setSecondarySubject(e.target.value)}\
                        className="w-full text-slate-200 text-sm font-bold rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none bg-slate-900 border border-slate-700/80 cursor-pointer shadow-inner"\
                      >\
                        <option value="N/A">🚫 N/A (Solo Focus Mode)</option>\
                        {subjects.map((s) => (\
                          <option key={`s-${s.id}`} value={s.name}>{s.code}: {s.name}</option>\
                        ))}\
                      </select>\
                    </div>\
                  </div>\
                </div>\
                <div className="space-y-4 pt-4 border-t border-slate-800/80">\
                  <label className="block text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-wider flex items-center gap-2">\
                    <Zap className="w-3.5 h-3.5" />\
                    <span>Custom Instructions for AI (Optional)</span>\
                  </label>\
                  <textarea\
                    value={customInstructions}\
                    onChange={(e) => setCustomInstructions(e.target.value)}\
                    placeholder="e.g. Focus deeply on tricky MCQs, shorter breaks..."\
                    className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/60 min-h-[80px] shadow-inner resize-none transition-colors"\
                  />\
                </div>\
              </div>\
            </main>\
            {/* Layer 3: Sticky Action Footer */}\
            <footer className="px-6 sm:px-8 py-4 border-t border-slate-800/60 backdrop-blur-md shrink-0 flex items-center justify-end gap-3 sticky bottom-0 z-20 bg-[#0B1528] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">\
              <button\
                type="button"\
                onClick={() => setShowModal(false)}\
                className="px-6 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors cursor-pointer border border-slate-700"\
              >\
                Cancel\
              </button>\
              <button\
                type="button"\
                onClick={handleGeneratePlan}\
                disabled={isGenerating}\
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-95 text-white font-extrabold text-sm shadow-xl flex items-center gap-2.5 cursor-pointer disabled:opacity-50 transition-all"\
              >\
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />\
                <span>{isGenerating ? '\''Generating...\'' : '\''Generate AI Schedule'\''}</span>\
              </button>\
            </footer>\
          </div>\
        </div>,\
        document.body\
      )}' src/components/TimetablePlanner.tsx
