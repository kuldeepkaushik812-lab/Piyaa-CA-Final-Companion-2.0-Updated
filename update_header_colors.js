const fs = require('fs');
let content = fs.readFileSync('src/components/Header.tsx', 'utf8');

// Replace unconditional text-amber-300 in Header.tsx
content = content.replace(/text-amber-300/g, '${isStrictMode ? "text-red-400" : "text-emerald-400"}');
// But wait, if they are already inside template literals like `text-white : "text-amber-300"`
// it will become `text-white : "${isStrictMode ? ...}"` which is nested template literals.
// Let's do it carefully.

