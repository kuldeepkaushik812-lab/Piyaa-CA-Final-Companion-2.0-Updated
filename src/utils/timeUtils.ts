export function parseSlotHours(timeStr: string): number {
  if (!timeStr || !timeStr.includes('-')) return 1.5;
  try {
    const parts = timeStr.split('-').map((s) => s.trim());
    if (parts.length !== 2) return 1.5;

    const parseTime = (t: string): number => {
      const match = t.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3] ? match[3].toUpperCase() : null;

      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return hours + minutes / 60;
    };

    const start = parseTime(parts[0]);
    let end = parseTime(parts[1]);
    if (end < start) end += 24; // Handles overnight e.g. 11 PM - 1 AM

    const diff = end - start;
    return diff > 0 ? diff : 1.5;
  } catch (err) {
    return 1.5;
  }
}

export function formatMinutesToTimeStr(totalMinutes: number): string {
  const mins = (totalMinutes + 1440) % 1440;
  let hrs = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  if (hrs === 0) hrs = 12;
  const hrStr = hrs.toString().padStart(2, '0');
  const minStr = m.toString().padStart(2, '0');
  return `${hrStr}:${minStr} ${ampm}`;
}

export function parseTimeToMinutes(tStr: string): number {
  const match = tStr.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
  if (!match) return 420; // Default to 07:00 AM
  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3] ? match[3].toUpperCase() : 'AM';

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function enforceStrictTimetableClamping(
  rawSlots: any[],
  targetHours: number
): any[] {
  const studySlots = rawSlots.filter(s => s.category !== 'break');
  if (studySlots.length === 0) return rawSlots;

  const n = studySlots.length;
  // Ensure base duration is at least 0.5
  const baseDuration = Math.max(0.5, Math.floor((targetHours / n) * 2) / 2);
  const durations = Array(n).fill(baseDuration);
  let currentSum = baseDuration * n;

  if (currentSum < targetHours) {
    let idx = 0;
    while (currentSum < targetHours) {
      durations[idx % n] += 0.5;
      currentSum += 0.5;
      idx++;
    }
  } else if (currentSum > targetHours) {
    let idx = 0;
    while (currentSum > targetHours && durations.some(d => d > 0.5)) {
      if (durations[idx % n] > 0.5) {
        durations[idx % n] -= 0.5;
        currentSum -= 0.5;
      }
      idx++;
    }
  }

  // Re-assign durations to study slots
  let studyIdx = 0;
  const processedSlots = rawSlots.map(s => {
    if (s.category !== 'break') {
      const dur = durations[studyIdx++];
      return { ...s, duration: dur };
    } else {
      const dur = parseSlotHours(s.time) || 0.5;
      return { ...s, duration: dur };
    }
  });

  const nonZeroSlots = processedSlots.filter(s => s.duration > 0);

  // Reconstruct sequential times starting at 07:00 AM
  let currentMinutes = 7 * 60; // 07:00 AM

  return nonZeroSlots.map(s => {
    const startMin = currentMinutes;
    const endMin = currentMinutes + Math.round(s.duration * 60);
    const timeStr = `${formatMinutesToTimeStr(startMin)} - ${formatMinutesToTimeStr(endMin)}`;
    currentMinutes = endMin;
    return {
      ...s,
      time: timeStr
    };
  });
}


export function parseTimeStr(timeStr: string) {
  if (!timeStr || !timeStr.includes('-')) return null;
  const parts = timeStr.split('-').map(s => s.trim());
  if (parts.length !== 2) return null;
  
  const start = parseTimeToMinutes(parts[0]);
  let end = parseTimeToMinutes(parts[1]);
  if (end < start) end += 1440; // overnight
  return { start, end };
}

export function isBreakSlot(slot: any): boolean {
  if (!slot) return false;
  const cat = (slot.category || '').toLowerCase();
  const subj = (slot.subject || '').toLowerCase();
  const act = (slot.activity || '').toLowerCase();

  if (cat === 'break') return true;
  if (cat === 'na') return false;
  
  if (subj === 'break' || subj === 'personal care' || subj === 'rest & lunch' || subj === 'evening break' || subj.includes('break')) {
    return true;
  }
  if (act.includes('lunch') || act.includes('dinner') || act.includes('tea break') || act.includes('coffee break') || act.includes('power nap')) {
    if (!subj.includes('financial') && !subj.includes('audit') && !subj.includes('tax') && !subj.includes('law') && !subj.includes('costing') && !subj.includes('afm') && !subj.includes('fr')) {
      return true;
    }
  }
  return false;
}

export function sanitizeAndMergeConsecutiveBreaks<T extends { category?: string; subject?: string; activity?: string; time?: string; companionTip?: string }>(slots: T[]): T[] {
  if (!Array.isArray(slots) || slots.length === 0) return slots;

  const result: T[] = [];

  for (const rawSlot of slots) {
    const isBreak = isBreakSlot(rawSlot);
    const slot = {
      ...rawSlot,
      category: (isBreak ? 'break' : (rawSlot.category || 'study')) as any
    };

    if (result.length === 0) {
      result.push(slot);
      continue;
    }

    const prevSlot = result[result.length - 1];
    const prevIsBreak = isBreakSlot(prevSlot) || prevSlot.category === 'break';

    if (prevIsBreak && isBreak) {
      // Merge two consecutive breaks into a single break slot
      let newTime = prevSlot.time || slot.time;
      if (prevSlot.time && slot.time) {
        const prevParts = prevSlot.time.split('-').map(s => s.trim());
        const currParts = slot.time.split('-').map(s => s.trim());
        if (prevParts[0] && currParts[1]) {
          newTime = `${prevParts[0]} - ${currParts[1]}`;
        }
      }

      const prevSubj = prevSlot.subject || 'Break';
      const currSubj = slot.subject || 'Break';
      let combinedSubject = prevSubj === currSubj ? prevSubj : `${prevSubj} & ${currSubj}`;
      combinedSubject = combinedSubject.replace('Break & Break', 'Break');

      const prevAct = prevSlot.activity || 'Refreshment';
      const currAct = slot.activity || 'Rest';
      const combinedActivity = `${prevAct} / ${currAct}`;
      const combinedTip = prevSlot.companionTip || slot.companionTip || 'Rest & Recharge ☕';

      result[result.length - 1] = {
        ...prevSlot,
        time: newTime,
        subject: combinedSubject,
        activity: combinedActivity,
        companionTip: combinedTip,
        category: 'break' as any
      };
    } else {
      result.push(slot);
    }
  }

  return result;
}

