const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// The block to remove:
const regex = /\{getTotalBacklogDebtHours && getTotalBacklogDebtHours\(\) > 0 && \([\s\S]*?<\/button>\s*\)\}/;

if (code.match(regex)) {
    code = code.replace(regex, '');
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Backlog button removed from UI");
} else {
    console.log("Could not find backlog button");
}
