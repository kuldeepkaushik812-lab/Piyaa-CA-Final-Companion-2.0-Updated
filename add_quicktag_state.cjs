const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const stateInjection = `  const [activeTagEditId, setActiveTagEditId] = useState<string | null>(null);
  const [activeTagValue, setActiveTagValue] = useState<string>('');

  const handleSaveQuickTag = (slotId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = slots.map(s => s.id === slotId ? { ...s, quickTag: activeTagValue.trim() } : s);
    setScheduleForDate(selectedDateStr, updated);
    if (selectedDateStr === todayStr) onUpdateSchedule(updated);
    setActiveTagEditId(null);
  };
  
  const [editingSlotId,`;

code = code.replace('  const [editingSlotId,', stateInjection);
fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log("Added Quick Tag state to TimetablePlanner");
