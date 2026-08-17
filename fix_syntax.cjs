const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// Fix the JSX syntax error inside the TimetablePlanner around 2324-2347.
// Currently it's trying to close </main> but the div structure is likely malformed from previous `sed` replacements.

code = code.replace(/<\/div>\n\s*<\/main>\n\s*\{\/\* Layer 3: Sticky Action Footer \*\/\}/g, '</main>\n            {/* Layer 3: Sticky Action Footer */}');

fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log("Ran fix_syntax.cjs");
