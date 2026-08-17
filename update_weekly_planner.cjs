const fs = require('fs');
let code = fs.readFileSync('src/components/WeeklyPlannerModal.tsx', 'utf8');

// 1. Add revisionMode to DayConfig interface
const interfaceRegex = /interface DayConfig \{[\s\S]*?customInstructions: string;\s*\}/;
code = code.replace(interfaceRegex, (match) => {
    return match.replace('customInstructions: string;', "customInstructions: string;\n  revisionMode: 'R1' | 'R2' | 'R3';");
});

// 2. Add revisionMode to createDefaultDayConfig
const defaultDayRegex = /createDefaultDayConfig = \(day: DayName\): DayConfig => \{\s*return \{[\s\S]*?customInstructions: '',/;
code = code.replace(defaultDayRegex, (match) => {
    return match + "\n      revisionMode: 'R1',";
});

// 3. Remove AbsorbBacklog toggle since it's deleted
const backlogRegex = /\{\/\* Sunday Backlog Debt Toggle \*\/\}[\s\S]*?\}\(\)\}/;
code = code.replace(backlogRegex, '');

fs.writeFileSync('src/components/WeeklyPlannerModal.tsx', code);
console.log('DayConfig and initializers updated.');
