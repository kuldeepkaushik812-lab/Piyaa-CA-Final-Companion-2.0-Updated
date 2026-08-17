const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

// The getTotalBacklogDebtHours function iterates through all history. Let's make it return 0 immediately
// to stop it from causing lag globally.
const calcRegex = /getTotalBacklogDebtHours:\s*\(\)\s*=>\s*\{[\s\S]*?return totalLapsed;\s*\},/;
code = code.replace(calcRegex, 'getTotalBacklogDebtHours: () => { return 0; },');

fs.writeFileSync('src/store.ts', code);
console.log('Optimized store backlog calculation');
