const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// 1. Add primaryChaptersInput and secondaryChaptersInput state variables
code = code.replace(
  "const [customAiInstruction, setCustomAiInstruction] = useState<string>('');",
  "const [primaryChaptersInput, setPrimaryChaptersInput] = useState<string>('');\n  const [secondaryChaptersInput, setSecondaryChaptersInput] = useState<string>('');"
);

// 2. Fix the prompt construction logic
code = code.replace(
  /\$\{primarySubject\} Selected Chapters: \$\{customInstructions \? customInstructions : \(pSelChapters\.length > 0 \? pSelChapters\.join\(\'; \'\) : \'All chapters\'\)\}\./g,
  "${primarySubject} Selected Chapters: ${primaryChaptersInput ? primaryChaptersInput : (pSelChapters.length > 0 ? pSelChapters.join('; ') : 'All chapters')}."
);

code = code.replace(
  /\$\{isSolo \? \'SECONDARY SUBJECT: None \(Solo Focus Mode\)\' : \`\$\{secondarySubject\} Selected Chapters: \$\{customAiInstruction \? customAiInstruction : \(sSelChapters\.length > 0 \? sSelChapters\.join\(\'; \'\) : \'All chapters\'\)\}\`\}\./g,
  "${isSolo ? 'SECONDARY SUBJECT: None (Solo Focus Mode)' : `${secondarySubject} Selected Chapters: ${secondaryChaptersInput ? secondaryChaptersInput : (sSelChapters.length > 0 ? sSelChapters.join('; ') : 'All chapters')}`}."
);

// We should also append the actual global custom instructions to the prompt if they exist.
// Let's add it right after dinner break.
code = code.replace(
  /(\$\{dinnerDuration === \'N\/A\' \? \'Dinner Break: DO NOT schedule any dinner break today \(Omitted \/ Skip Break\)\.\' : \`Dinner Break: Start EXACTLY at \$\{dinnerStartTime\} for \$\{dinnerDuration\}\.\`\})/g,
  "$1\\n${customInstructions ? `Additional User Instructions: ${customInstructions}` : ''}"
);

// 3. Re-layout the modal body.
// Target 1: Remove the Chapters Scope checkboxes from under the Time setup block (before Events & Breaks)
const removeChaptersScopeRegex = /<div className="space-y-4 pt-4 border-t border-slate-700\/50">\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Chapters Scope<\/h4>[\s\S]*?<div className="space-y-4 pt-4 border-t border-slate-700\/50">\s*<h4 className="text-\[10px\] font-extrabold text-indigo-300\/80 uppercase tracking-wider mb-2">Events & Breaks<\/h4>/;

code = code.replace(removeChaptersScopeRegex, `<div className="space-y-4 pt-4 border-t border-slate-700/50">
                     <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Events & Breaks</h4>`);

// Target 2: Insert Chapters Scope textareas after Subject Focus
const insertChaptersScopeRegex = /(<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">[\s\S]*?<\/div>\s*<\/div>)\s*<div className="space-y-4 pt-4 border-t border-slate-800\/80">\s*<label className="block text-\[10px\] font-extrabold text-emerald-400\/80 uppercase tracking-wider flex items-center gap-2">/;

const textareasBlock = `$1

                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  <h4 className="text-[10px] font-extrabold text-indigo-300/80 uppercase tracking-wider mb-2">Chapters Scope</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400">Primary Chapters ({pSubObj?.name || primarySubject})</label>
                       <textarea
                         value={primaryChaptersInput}
                         onChange={e => setPrimaryChaptersInput(e.target.value)}
                         placeholder="Type chapters to focus on for primary subject (e.g. Audit of PSU, Ethics)"
                         className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 focus:border-indigo-500 focus:outline-none min-h-[60px]"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400">Secondary Chapters {isSolo ? '(None)' : \`(\${sSubObj?.name || secondarySubject})\`}</label>
                       <textarea
                         value={secondaryChaptersInput}
                         onChange={e => setSecondaryChaptersInput(e.target.value)}
                         disabled={isSolo}
                         placeholder={isSolo ? "Solo Mode Active" : "Type chapters for secondary subject (e.g. GST Returns, Refunds)"}
                         className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-amber-300 focus:border-indigo-500 focus:outline-none min-h-[60px] disabled:opacity-50 disabled:cursor-not-allowed"
                       />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800/80">
                  <label className="block text-[10px] font-extrabold text-emerald-400/80 uppercase tracking-wider flex items-center gap-2">`;

if (code.match(insertChaptersScopeRegex)) {
  code = code.replace(insertChaptersScopeRegex, textareasBlock);
  fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
  console.log('Replacements completed successfully');
} else {
  console.log('Failed to match insertion target');
}
