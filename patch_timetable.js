import fs from 'fs';
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf-8');

const target1 = `            // If they didn't study using the timer, assume they completed the whole slot offline
            if (currentStudied === 0) {
              hoursToLog = slotHrs;
              finalStudied = slotHrs;
            }`;

const replacement1 = `            // If they didn't study the full time using the timer, assume they completed the rest offline
            if (currentStudied < slotHrs) {
              hoursToLog = slotHrs - currentStudied;
              finalStudied = slotHrs;
            }`;

const target2 = `      if (currentStudied === 0) {
        hoursToLog = slotHrs;
        finalStudied = slotHrs;
      }`;

const replacement2 = `      if (currentStudied < slotHrs) {
        hoursToLog = slotHrs - currentStudied;
        finalStudied = slotHrs;
      }`;

let patched = false;
if (code.includes('if (currentStudied === 0) {')) {
  code = code.replace(target1, replacement1).replace(target2, replacement2);
  fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
  patched = true;
  console.log('Patched TimetablePlanner.tsx');
}
if (!patched) console.log('Already patched or target not found');
