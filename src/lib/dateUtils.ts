let internetTimeOffset = 0;

const checkClockDrift = (offset: number) => {
  if (typeof window !== 'undefined') {
    if (Math.abs(offset) > 30000) {
      window.dispatchEvent(new CustomEvent('clock-desync', {
        detail: {
          message: `⚠️ Time Calibration: Your device time is off by ~${Math.round(Math.abs(offset) / 1000)} seconds from IST. Timers may be inaccurate.`,
          offsetMs: offset,
          warning: true
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('clock-desync', {
        detail: {
          message: null,
          offsetMs: offset,
          warning: false
        }
      }));
    }
  }
};

export const syncInternetTime = async () => {
  try {
    const start = Date.now();
    const res = await fetch('/api/time');
    if (res.ok) {
      const data = await res.json();
      const latency = Math.round((Date.now() - start) / 2);
      const serverUTC = data.timestamp + latency;
      const deviceUTC = Date.now();
      internetTimeOffset = serverUTC - deviceUTC;
      checkClockDrift(internetTimeOffset);
      return;
    }
  } catch {
    // Fallback
  }

  try {
    const start = Date.now();
    const res = await fetch('https://worldtimeapi.org/api/timezone/Asia/Kolkata');
    if (res.ok) {
      const data = await res.json();
      const latency = Math.round((Date.now() - start) / 2);
      const internetUTC = new Date(data.utc_datetime).getTime() + latency;
      const deviceUTC = Date.now();
      internetTimeOffset = internetUTC - deviceUTC;
      checkClockDrift(internetTimeOffset);
    }
  } catch {
    // Fallback to device time
  }
};

export const getISTDate = (): Date => {
  return new Date(Date.now() + internetTimeOffset);
};

export const getISTYMD = (date: Date = getISTDate()): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
};

export const getISTTimeString = (date: Date = getISTDate()): string => {
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
};

export const getISTDateString = (date: Date = getISTDate()): string => {
  const ymd = getISTYMD(date);
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
};

export const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD-MM-YYYY
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD-MM-YYYY
        return dateStr;
      }
    }
  }
  return dateStr;
};

export const addDaysToYMD = (ymdStr: string, days: number): string => {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return getISTYMD(date);
};

export const createRealDateFromIST = (istYear: number, istMonth: number, istDate: number, istHours: number = 0, istMins: number = 0): Date => {
  const utcTime = Date.UTC(istYear, istMonth, istDate, istHours, istMins) - 5.5 * 60 * 60000;
  return new Date(utcTime);
};
