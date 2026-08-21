import React, { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Play, Pause, Square, ExternalLink, Timer } from 'lucide-react';

export const GlobalTimerOverlay: React.FC = () => {
  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  
  const [timerState, setTimerState] = useState<any>(null);

  useEffect(() => {
    // Try to load initial state from sessionStorage
    try {
      const saved = sessionStorage.getItem('ca_companion_live_pomodoro');
      if (saved) {
        setTimerState(JSON.parse(saved));
      }
    } catch (e) {}

    const handlePomodoroState = (e: any) => {
      setTimerState(e.detail);
    };

    window.addEventListener('pomodoro-state-changed', handlePomodoroState);
    return () => window.removeEventListener('pomodoro-state-changed', handlePomodoroState);
  }, []);

  // Ensure we don't show the overlay if we are ON the timer tab, 
  // or if there's no state, or if time left is <= 0 AND it's not running
  if (activeTab === 'timer' || !timerState || (timerState.timeLeft <= 0 && !timerState.isRunning)) return null;

  const m = Math.floor(timerState.timeLeft / 60).toString().padStart(2, '0');
  const s = (timerState.timeLeft % 60).toString().padStart(2, '0');

  const handleGoToTimer = () => {
    setActiveTab('timer');
  };

  const subjectName = timerState.subjectName || 'Study Session';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div 
        onClick={handleGoToTimer}
        className="bg-slate-900 border border-slate-700 shadow-2xl rounded-2xl p-3 flex items-center gap-4 cursor-pointer hover:border-amber-500/50 hover:bg-slate-800 transition-all group"
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${timerState.isRunning ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
          <Timer className={`w-5 h-5 ${timerState.isRunning ? 'animate-pulse' : ''}`} />
        </div>
        
        <div className="flex flex-col min-w-[100px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            {timerState.mode === 'work' ? (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${timerState.isRunning ? 'bg-amber-400 animate-ping' : 'bg-slate-500'}`} />
                {subjectName}
              </>
            ) : 'BREAK'}
          </span>
          <span className={`text-xl font-mono font-black tracking-tight ${timerState.isRunning ? 'text-white' : 'text-slate-400'}`}>
            {m}:{s}
          </span>
        </div>

        <div className="pl-2 border-l border-slate-800 text-slate-500 group-hover:text-amber-400 transition-colors">
           <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
