import React, { useEffect, useState } from 'react';
import { Cpu, AlertTriangle, X, RefreshCw } from 'lucide-react';

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export const MemoryMonitor: React.FC = () => {
  const [memoryStats, setMemoryStats] = useState<{
    usedMB: number;
    totalMB: number;
    limitMB: number;
    percent: number;
  } | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkMemory = () => {
      const perf = window.performance as any;
      if (perf && perf.memory) {
        const mem = perf.memory as MemoryInfo;
        if (mem.jsHeapSizeLimit > 0) {
          const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
          const totalMB = Math.round(mem.totalJSHeapSize / (1024 * 1024));
          const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
          const percent = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);

          setMemoryStats({ usedMB, totalMB, limitMB, percent });

          if (percent >= 80) {
            console.warn(
              `[Memory Monitor Warning] High browser memory heap usage detected: ${usedMB}MB / ${limitMB}MB (${percent}%).`
            );
          }
        }
      }
    };

    // Check immediately
    checkMemory();

    // Check every 10 seconds
    const interval = setInterval(checkMemory, 10000);

    // Also check on tab focus / visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkMemory();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!memoryStats || memoryStats.percent < 85 || isDismissed) {
    return null;
  }

  const handleClearUnusedCache = () => {
    // Clear image/icon temporary caches or session storage cache if needed
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        // Safe fallback
      }
    }
    // Trigger memory check again after brief delay
    setTimeout(() => {
      const perf = window.performance as any;
      if (perf && perf.memory) {
        const mem = perf.memory as MemoryInfo;
        const usedMB = Math.round(mem.usedJSHeapSize / (1024 * 1024));
        const limitMB = Math.round(mem.jsHeapSizeLimit / (1024 * 1024));
        const percent = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
        setMemoryStats({ usedMB, totalMB: Math.round(mem.totalJSHeapSize / (1024 * 1024)), limitMB, percent });
      }
      setIsDismissed(true);
    }, 500);
  };

  return (
    <div
      id="memory-usage-alert"
      className="fixed bottom-20 right-4 z-50 max-w-sm rounded-xl bg-amber-950/90 border border-amber-500/30 p-3.5 text-amber-200 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>High Browser Memory Usage ({memoryStats.percent}%)</span>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-amber-400 hover:text-amber-200 p-0.5 rounded-lg hover:bg-amber-900/50"
          title="Dismiss warning"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="mt-1.5 text-xs text-amber-300/80 leading-relaxed">
        Browser RAM heap is at <strong className="text-amber-200">{memoryStats.usedMB} MB</strong> / {memoryStats.limitMB} MB limit due to parallel software or multi-tab usage.
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="h-1.5 w-full bg-amber-900/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${Math.min(100, memoryStats.percent)}%` }}
          />
        </div>
        <span className="text-[10px] font-mono font-medium text-amber-400 shrink-0">
          {memoryStats.usedMB}MB
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          onClick={handleClearUnusedCache}
          className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Optimize Memory
        </button>
      </div>
    </div>
  );
};
