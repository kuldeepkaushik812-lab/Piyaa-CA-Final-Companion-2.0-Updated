sed -i '/const handleGeneratePlan = async () => {/,/      setShowModal(false);/c\
  const handleGeneratePlan = async () => {\
    setIsGenerating(true);\
    try {\
      let hrsToGenerate = availableHours;\
      let aiStartTime = startTimePreference;\
\
      const mergedInstructions = `\
Target Date: ${selectedDateStr}.\
Primary Subject: ${primarySubject}.\
${secondarySubject === '\''N/A'\'' ? '\''SECONDARY SUBJECT: None (Solo Focus Mode)'\'' : `Secondary Subject: ${secondarySubject}`}.\
Target Study Hours: ${availableHours} hours.\
User Note: ${customInstructions || '\''None'\''}\
      `.trim();\
\
      let routineText = `First Slot Start Time: ${startTimePreference}, Preferred Slot Duration: 2 Hours, Short Break Duration: 15 mins`;\
\
      const promptObj = {\
        date: selectedDateStr,\
        targetHours: hrsToGenerate,\
        primarySubject: primarySubject,\
        secondarySubject: secondarySubject !== '\''N/A'\'' ? secondarySubject : null,\
        instructions: mergedInstructions,\
        routine: routineText\
      };\
\
      const res = await fetch('\''/api/generate-timetable'\'', {\
        method: '\''POST'\'',\
        headers: { '\''Content-Type'\'': '\''application/json'\'' },\
        body: JSON.stringify({ prompt: JSON.stringify(promptObj), subjects })\
      });\
\
      const data = await res.json();\
      if (data.error) throw new Error(data.error);\
\
      let apiSlots: TimetableSlot[] = data.timetable || [];\
      apiSlots = apiSlots.map((s, idx) => ({\
        ...s,\
        id: `ai-${selectedDateStr}-${idx}-${Date.now()}`,\
        status: '\''PENDING'\''\
      }));\
\
      clearStudyLogsForDate(selectedDateStr);\
      saveSlots(apiSlots);\
      setDailyTarget(selectedDateStr, availableHours);\
      if (onUpdateTargetHours) {\
        onUpdateTargetHours(availableHours);\
      }\
    } catch (err) {\
      console.error(err);\
      alert('\''Failed to generate timetable. Please try again.'\'');\
    } finally {\
      setIsGenerating(false);\
      setShowModal(false);\
    }\
  };\
' src/components/TimetablePlanner.tsx
