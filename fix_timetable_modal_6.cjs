const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<div className="space-y-4 pt-4 border-t border-slate-700\/50">\n\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Chapters Scope<\/h4>[\s\S]*?<div className="space-y-4 pt-4 border-t border-slate-700\/50">\n\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Events & Breaks<\/h4>/;

const replacement = `<div className="space-y-4 pt-4 border-t border-slate-700/50">
                    <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Chapters Scope</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400">Primary Chapters ({pSubObj?.name})</label>
                         <div className="h-32 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                           {pSubObj?.topics?.map(topic => (
                             <label key={topic.id} className="flex items-start gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                               <input
                                 type="checkbox"
                                 checked={selectedPrimaryChapterIds.includes(topic.id)}
                                 onChange={(e) => {
                                   if (e.target.checked) {
                                     setSelectedPrimaryChapterIds(prev => [...prev, topic.id]);
                                   } else {
                                     setSelectedPrimaryChapterIds(prev => prev.filter(id => id !== topic.id));
                                   }
                                 }}
                                 className="mt-0.5 accent-indigo-500 rounded bg-slate-800 border-slate-600 shrink-0"
                               />
                               <span className="text-[11px] text-slate-300 leading-tight group-hover:text-indigo-300">{topic.title}</span>
                             </label>
                           ))}
                           {(!pSubObj?.topics || pSubObj.topics.length === 0) && (
                             <div className="text-xs text-slate-500 text-center py-4">No chapters available</div>
                           )}
                         </div>
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-bold text-slate-400">Secondary Chapters {sSubObj ? \`(\${sSubObj.name})\` : '(None)'}</label>
                         <div className="h-32 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                           {!sSubObj ? (
                             <div className="text-xs text-slate-500 text-center py-4">Solo Mode Active</div>
                           ) : (
                             sSubObj.topics?.map(topic => (
                               <label key={topic.id} className="flex items-start gap-2 p-1.5 hover:bg-slate-800 rounded cursor-pointer group transition-colors">
                                 <input
                                   type="checkbox"
                                   checked={selectedSecondaryChapterIds.includes(topic.id)}
                                   onChange={(e) => {
                                     if (e.target.checked) {
                                       setSelectedSecondaryChapterIds(prev => [...prev, topic.id]);
                                     } else {
                                       setSelectedSecondaryChapterIds(prev => prev.filter(id => id !== topic.id));
                                     }
                                   }}
                                   className="mt-0.5 accent-teal-500 rounded bg-slate-800 border-slate-600 shrink-0"
                                 />
                                 <span className="text-[11px] text-slate-300 leading-tight group-hover:text-teal-300">{topic.title}</span>
                               </label>
                             ))
                           )}
                         </div>
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
