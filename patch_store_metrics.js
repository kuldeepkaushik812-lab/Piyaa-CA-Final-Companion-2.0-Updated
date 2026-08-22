import fs from 'fs';
let code = fs.readFileSync('src/store.ts', 'utf-8');

const target = `              let counted = 0;
              if (slot.status === 'COMPLETED' || slot.completed) {
                counted = totalSlotHours;
              } else if (slot.status === 'PARTIALLY_COMPLETED' || slot.status === 'IN_PROGRESS') {`;

const replacement = `              let counted = 0;
              if (slot.status === 'COMPLETED' || slot.completed) {
                // If they explicitly tracked some time, use it. Otherwise fallback to the full slot hours
                counted = studied > 0 ? studied : totalSlotHours;
              } else if (slot.status === 'PARTIALLY_COMPLETED' || slot.status === 'IN_PROGRESS') {`;

if (code.includes('counted = totalSlotHours;')) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/store.ts', code);
  console.log('Patched recalculateAllMetrics');
} else {
  console.log('Already patched or string not found');
}
