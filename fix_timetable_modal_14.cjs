const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// Remove the two auto-selecting useEffects
const useEffectPrimaryRegex = /useEffect\(\(\) => \{\s*if \(pSubObj\) \{\s*const pendingIds = pSubObj\.topics\.filter\(t => !t\.completed\)\.map\(t => t\.id\);\s*setSelectedPrimaryChapterIds\(pendingIds\.length > 0 \? pendingIds : pSubObj\.topics\.map\(t => t\.id\)\);\s*\}\s*setPrimarySearch\(''\);\s*\}, \[primarySubject, pSubObj\]\);/;
const useEffectSecondaryRegex = /useEffect\(\(\) => \{\s*if \(sSubObj\) \{\s*const pendingIds = sSubObj\.topics\.filter\(t => !t\.completed\)\.map\(t => t\.id\);\s*setSelectedSecondaryChapterIds\(pendingIds\.length > 0 \? pendingIds : sSubObj\.topics\.map\(t => t\.id\)\);\s*\}\s*setSecondarySearch\(''\);\s*\}, \[secondarySubject, sSubObj\]\);/;

code = code.replace(useEffectPrimaryRegex, '');
code = code.replace(useEffectSecondaryRegex, '');

// Add Select All / Clear All buttons
const primaryLabelRegex = /<label className="text-\[10px\] font-bold text-slate-400">Primary Chapters \(\{pSubObj\?\.name \|\| primarySubject\}\)<\/label>/;
const primaryLabelReplacement = `<div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-400">Primary Chapters ({pSubObj?.name || primarySubject})</label>
                         <div className="flex items-center gap-2">
                           <button onClick={() => setSelectedPrimaryChapterIds(pSubObjFilteredTopics.map(t => t.id))} className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300">Select All</button>
                           <button onClick={() => setSelectedPrimaryChapterIds([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                         </div>
                       </div>`;

const secondaryLabelRegex = /<label className="text-\[10px\] font-bold text-slate-400">Secondary Chapters \{\(secondarySubject === 'N\/A'\) \? '\(None\)' : \`\(\$\{sSubObj\?\.name \|\| secondarySubject\}\)\`\}<\/label>/;
const secondaryLabelReplacement = `<div className="flex items-center justify-between">
                         <label className="text-[10px] font-bold text-slate-400">Secondary Chapters {(secondarySubject === 'N/A') ? '(None)' : \`(\${sSubObj?.name || secondarySubject})\`}</label>
                         {secondarySubject !== 'N/A' && (
                           <div className="flex items-center gap-2">
                             <button onClick={() => setSelectedSecondaryChapterIds(sSubObjFilteredTopics.map(t => t.id))} className="text-[9px] font-bold text-teal-400 hover:text-teal-300">Select All</button>
                             <button onClick={() => setSelectedSecondaryChapterIds([])} className="text-[9px] font-bold text-slate-500 hover:text-slate-400">Clear</button>
                           </div>
                         )}
                       </div>`;

code = code.replace(primaryLabelRegex, primaryLabelReplacement);
code = code.replace(secondaryLabelRegex, secondaryLabelReplacement);

fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log('Fixed auto-selection and added clear buttons.');
