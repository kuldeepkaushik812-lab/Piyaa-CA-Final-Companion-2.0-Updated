const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// Ensure that customInstructions and customAiInstruction are properly placed in the prompt
const promptRegex = /const mergedInstructions = \`[\s\S]*?Target Date: \$\{selectedDateStr\}\.[\s\S]*?User Note: \$\{customInstructions \|\| 'None'\}\n\s*\$\{customAiInstruction \? \`CRITICAL USER MID-DAY ADVICE TO APPLY TO REMAINING FUTURE SLOTS: \$\{customAiInstruction\}\` : ''\}\n\s*\`\.trim\(\);/;

const promptReplacement = `const mergedInstructions = \`
Target Date: \${selectedDateStr}.
Scheduling Mode: \${schedulingMode}.
\${primarySubject} Selected Chapters: \${customInstructions ? customInstructions : (pSelChapters.length > 0 ? pSelChapters.join('; ') : 'All chapters')}.
\${isSolo ? 'SECONDARY SUBJECT: None (Solo Focus Mode)' : \`\${secondarySubject} Selected Chapters: \${customAiInstruction ? customAiInstruction : (sSelChapters.length > 0 ? sSelChapters.join('; ') : 'All chapters')}\`}.
Short Break Duration Preference: \${shortBreakDuration}
\${lunchDuration === 'N/A' ? 'Lunch Break: DO NOT schedule any lunch break today (Omitted / Skip Break).' : \`Lunch Break: Start EXACTLY at \${lunchStartTime} for \${lunchDuration}.\`}
\${dinnerDuration === 'N/A' ? 'Dinner Break: DO NOT schedule any dinner break today (Omitted / Skip Break).' : \`Dinner Break: Start EXACTLY at \${dinnerStartTime} for \${dinnerDuration}.\`}
\`.trim();`;

if(code.match(promptRegex)) {
    code = code.replace(promptRegex, promptReplacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the target string.");
}
