const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regex = /const handleGeneratePlan = async \(\) => \{[\s\S]*?setShowModal\(false\);\n    \}\n  \};/;

const replacement = `const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      let hrsToGenerate = availableHours;

      const mergedInstructions = \`Target Date: \${selectedDateStr}. User Note: \${customInstructions || 'None'}\`;
      let routineText = \`First Slot Start Time: \${startTimePreference}, Preferred Slot Duration: 2 Hours, Short Break Duration: 15 mins\`;

      const res = await fetch('/api/generate-timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupOption: 'Both Groups',
          availableHours: hrsToGenerate,
          primarySubject,
          secondarySubject: secondarySubject === 'N/A' ? 'N/A' : secondarySubject,
          splitRatio: 60,
          routineAndStartTime: routineText,
          weakSubjects: '',
          examMonth: '',
          customInstructions: mergedInstructions,
          lunchStartTime: '01:00 PM',
          lunchDuration: '45 mins',
          dinnerStartTime: '08:30 PM',
          dinnerDuration: '45 mins'
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.schedule) {
        const gen = data.schedule;
        let newSlots = gen.timeSlots.map((ts: any, idx: number) => ({
          id: \`gen-\${selectedDateStr}-\${idx}-\${Date.now()}\`,
          time: ts.time,
          subject: ts.subject,
          activity: ts.activity,
          category: ts.category,
          companionTip: ts.companionTip,
          completed: false,
        }));
        clearStudyLogsForDate(selectedDateStr);
        recalculateAllMetrics(selectedDateStr);
        saveSlots(newSlots);
        setDailyTarget(selectedDateStr, availableHours);
        if (onUpdateTargetHours) {
          onUpdateTargetHours(availableHours);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to generate timetable. Please try again.');
    } finally {
      setIsGenerating(false);
      setShowModal(false);
    }
  };`;

if(code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not find the function.");
}
