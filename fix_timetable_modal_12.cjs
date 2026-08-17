const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Chapters Scope<\/h4>\s*<div className="grid grid-cols-1 md:grid-cols-2 gap-4">\s*<div className="space-y-2">\s*<label className="text-\[10px\] font-bold text-slate-400">Primary Chapters \(\{pSubObj\?\.name \|\| primarySubject\}\)<\/label>\s*<textarea[\s\S]*?<\/div>\s*<div className="space-y-2">\s*<label className="text-\[10px\] font-bold text-slate-400">Secondary Chapters \{\(secondarySubject === \'N\/A\'\) \? \'\(None\)\' : \`\(\$\{sSubObj\?\.name \|\| secondarySubject\}\)\`\}<\/label>\s*<textarea[\s\S]*?<\/div>\s*<\/div>/;

const replacement = `<h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Chapters Scope</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400">Primary Chapters ({pSubObj?.name || primarySubject})</label>
                       <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                         {pSubObjFilteredTopics.length === 0 ? (
                           <div className="text-xs text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                         ) : (
                           pSubObjFilteredTopics.map(topic => (
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
                           ))
                         )}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400">Secondary Chapters {(secondarySubject === 'N/A') ? '(None)' : \`(\${sSubObj?.name || secondarySubject})\`}</label>
                       <div className="h-36 overflow-y-auto bg-slate-900 border border-slate-700/80 rounded-xl p-2 custom-scrollbar">
                         {secondarySubject === 'N/A' ? (
                           <div className="text-xs text-slate-500 text-center py-6">Solo Mode Active</div>
                         ) : sSubObjFilteredTopics.length === 0 ? (
                           <div className="text-xs text-slate-500 text-center py-6">No matching chapters for this revision mode.</div>
                         ) : (
                           sSubObjFilteredTopics.map(topic => (
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
                  </div>`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Checklists replaced successfully.");
} else {
    console.log("Could not find checklists replacement target.");
}
