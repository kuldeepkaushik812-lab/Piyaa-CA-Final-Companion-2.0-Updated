const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

code = code.replace(/\{isSolo \? '\(None\)' : \\\`\\\(\\\$\\{sSubObj\?\\.name \|\| secondarySubject\\}\\\)\\\`\}/g, "{(secondarySubject === 'N/A') ? '(None)' : `(${sSubObj?.name || secondarySubject})`}");
code = code.replace(/disabled=\{isSolo\}/g, "disabled={secondarySubject === 'N/A'}");
code = code.replace(/placeholder=\{isSolo \? "Solo Mode Active" : "Type chapters for secondary subject \(e\.g\. GST Returns, Refunds\)"\}/g, "placeholder={secondarySubject === 'N/A' ? \"Solo Mode Active\" : \"Type chapters for secondary subject (e.g. GST Returns, Refunds)\"}");

fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log('Fixed isSolo references');
