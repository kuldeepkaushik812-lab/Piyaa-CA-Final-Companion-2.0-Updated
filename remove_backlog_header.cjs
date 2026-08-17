const fs = require('fs');
let code = fs.readFileSync('src/components/Header.tsx', 'utf8');

// 1. Remove the Backlog Debt Trigger button
const triggerRegex = /\{\/\* Backlog Debt Trigger \*\/\}[\s\S]*?totalBacklogDebt > 0 && \([\s\S]*?<\/button>\s*<\/>\s*\)\}/;
code = code.replace(triggerRegex, '');

// 2. Remove the Backlog Modal JSX
const modalRegex = /\{isBacklogModalOpen && createPortal\([\s\S]*?document\.body\s*\)\}/;
code = code.replace(modalRegex, '');

// 3. Optional: we can remove the state and the `totalBacklogDebt` variable if needed.
// But removing the rendering will immediately stop the lag caused by the DOM rendering of that huge modal and the button.
fs.writeFileSync('src/components/Header.tsx', code);
console.log('Removed Backlog from Header.tsx');
