import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { 
  LayoutDashboard, 
  BookOpen, 
  Clock, 
  Sparkles, 
  Search, 
  Volume2, 
  VolumeX, 
  PlusCircle, 
  ChevronDown, 
  ChevronUp, 
  Headphones, 
  Layers, 
  Zap,
  Check,
  Music,
  Flame,
  X,
  CalendarDays,
  BarChart2,
  Home,
  ClipboardCheck,
  Calendar
} from 'lucide-react';
import { getISTYMD } from '../lib/dateUtils';

// Web Audio API Synthesizer for Ambient Soundscapes (Offline & 0 Latency)
class AmbientSoundSynthesizer {
  private audioCtx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentMode: 'binaural' | 'rain' | 'cozy' = 'binaural';
  private gainNode: GainNode | null = null;
  private activeNodes: (OscillatorNode | AudioBufferSourceNode | BiquadFilterNode)[] = [];

  private initContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public setVolume(val: number) {
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.audioCtx.currentTime, 0.05);
    }
  }

  public stop() {
    this.activeNodes.forEach(node => {
      try {
        if ('stop' in node && typeof node.stop === 'function') {
          node.stop();
        }
        node.disconnect();
      } catch (e) {}
    });
    this.activeNodes = [];
    this.isPlaying = false;
  }

  public play(mode: 'binaural' | 'rain' | 'cozy', volume: number = 0.3) {
    this.stop();
    this.initContext();
    if (!this.audioCtx) return;

    this.currentMode = mode;
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    this.gainNode.connect(this.audioCtx.destination);

    if (mode === 'binaural') {
      // 40Hz Gamma Focus Binaural Beat (200Hz Left, 240Hz Right)
      const merger = this.audioCtx.createChannelMerger(2);

      const oscLeft = this.audioCtx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.setValueAtTime(200, this.audioCtx.currentTime);

      const oscRight = this.audioCtx.createOscillator();
      oscRight.type = 'sine';
      oscRight.frequency.setValueAtTime(240, this.audioCtx.currentTime);

      oscLeft.connect(merger, 0, 0); // Left channel
      oscRight.connect(merger, 0, 1); // Right channel

      merger.connect(this.gainNode);
      oscLeft.start();
      oscRight.start();

      this.activeNodes.push(oscLeft, oscRight);
    } else if (mode === 'rain' || mode === 'cozy') {
      // Synthesize noise buffer for Rain or Cozy Ambiance
      const bufferSize = this.audioCtx.sampleRate * 3; // 3 second looping noise
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink / Brown noise filter math
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
      }

      const whiteSource = this.audioCtx.createBufferSource();
      whiteSource.buffer = noiseBuffer;
      whiteSource.loop = true;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(mode === 'rain' ? 800 : 350, this.audioCtx.currentTime);

      whiteSource.connect(filter);
      filter.connect(this.gainNode);
      whiteSource.start();

      this.activeNodes.push(whiteSource, filter);
    }

    this.isPlaying = true;
  }

  public toggle(mode: 'binaural' | 'rain' | 'cozy', volume: number = 0.3) {
    if (this.isPlaying && this.currentMode === mode) {
      this.stop();
      return false;
    } else {
      this.play(mode, volume);
      return true;
    }
  }

  public getStatus() {
    return { isPlaying: this.isPlaying, mode: this.currentMode };
  }
}

const synthInstance = new AmbientSoundSynthesizer();

export function FloatingActionDock() {
  const activeTab = useStore(state => state.activeTab);
  const setActiveTab = useStore(state => state.setActiveTab);
  const subjects = useStore(state => state.subjects);
  const logStudyActivity = useStore(state => state.logStudyActivity);
  const addStudyLog = useStore(state => state.addStudyLog);

  const [isMinimized, setIsMinimized] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [soundMode, setSoundMode] = useState<'binaural' | 'rain' | 'cozy'>('binaural');
  const [volume, setVolume] = useState(0.3);

  // Quick Log State
  const [selectedSubjectCode, setSelectedSubjectCode] = useState(subjects[0]?.code || 'AFM');
  const [logHours, setLogHours] = useState<number>(1);
  const [logNotes, setLogNotes] = useState('');
  const [logSuccessMessage, setLogSuccessMessage] = useState(false);

  const soundMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (soundMenuRef.current && !soundMenuRef.current.contains(e.target as Node)) {
        setShowSoundMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSoundToggle = (mode: 'binaural' | 'rain' | 'cozy') => {
    const active = synthInstance.toggle(mode, volume);
    setIsPlayingSound(active);
    setSoundMode(mode);
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    synthInstance.setVolume(newVal);
  };

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (logHours <= 0) return;

    const todayStr = getISTYMD();
    addStudyLog(selectedSubjectCode, logHours, todayStr);
    logStudyActivity({
      dateStr: todayStr,
      subjectId: selectedSubjectCode,
      subject: selectedSubjectCode,
      durationHours: logHours,
      sourceType: 'MANUAL',
      notes: logNotes || 'Quick log via Floating Dock'
    });

    setLogSuccessMessage(true);
    setTimeout(() => {
      setLogSuccessMessage(false);
      setShowQuickLogModal(false);
      setLogNotes('');
    }, 1200);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40 animate-in fade-in zoom-in-90 duration-200">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-slate-950/90 border border-[#2dd4bf]/60 hover:border-[#2dd4bf] text-[#2dd4bf] shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer font-extrabold text-xs group"
          title="Expand Quick Action Navigation Dock"
        >
          <Zap className="w-4 h-4 text-[#2dd4bf] group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline text-white">Dock</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Floating Action Navigation Dock */}
      <div className="fixed bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-none animate-in fade-in slide-in-from-bottom-3 duration-300">
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-full bg-slate-950/90 border border-indigo-500/40 hover:border-indigo-400/70 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-white/10 text-slate-200">
          
          {/* 0. Home Button */}
          <button
            onClick={() => setActiveTab('master-summary')}
            className={`flex items-center justify-center p-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'master-summary'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Home - Master Summary"
          >
            <Home className="w-4 h-4 text-indigo-400" />
          </button>

          {/* 1. Daily Time Table */}
          <button
            onClick={() => setActiveTab('timetable')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'timetable'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Daily Time Table Planner"
          >
            <CalendarDays className="w-4 h-4 text-indigo-400" />
            <span className="hidden md:inline">Daily Time Table</span>
          </button>

          {/* 2. Syllabus */}
          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'subjects'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Syllabus Tracker"
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline">Syllabus</span>
          </button>

          {/* 3. Focus Timer */}
          <button
            onClick={() => setActiveTab('timer')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Pomodoro Focus Timer"
          >
            <Clock className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Timer</span>
          </button>

          {/* 4. Audit */}
          <button
            onClick={() => setActiveTab('study-history')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'study-history'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Study Audit Ledger"
          >
            <ClipboardCheck className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Audit</span>
          </button>

          {/* 5. Daily Tracker */}
          <button
            onClick={() => setActiveTab('calendar-tracker')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'calendar-tracker'
                ? 'bg-gradient-to-r from-indigo-500/30 to-sky-500/30 border border-indigo-400 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)] scale-105'
                : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
            }`}
            title="Daily Study Tracker & Log"
          >
            <Calendar className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">Daily Tracker</span>
          </button>

          {/* 6. Instant +Log Study Hours */}
          <button
            onClick={() => setShowQuickLogModal(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-sky-500/20 hover:from-indigo-500/35 hover:to-sky-500/35 border border-indigo-500/40 text-indigo-200 font-extrabold text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Instant Log Study Session"
          >
            <PlusCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="hidden sm:inline">Log Study</span>
          </button>

          {/* 7. Search Command Trigger */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="p-1.5 sm:px-2.5 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Open Command Palette (Cmd/Ctrl + K)"
          >
            <Search className="w-4 h-4 text-indigo-400" />
          </button>

          {/* Minimize Button */}
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer ml-0.5"
            title="Minimize Dock"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Log Modal */}
      {showQuickLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-[#2dd4bf]/40 rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.9)] space-y-4 relative">
            <button
              onClick={() => setShowQuickLogModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#2dd4bf]/20 text-[#2dd4bf]">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Quick Log Study Session</h3>
                <p className="text-xs text-slate-400">Log study hours directly into today's analytics!</p>
              </div>
            </div>

            {logSuccessMessage ? (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-center font-bold text-sm flex items-center justify-center gap-2 animate-in zoom-in-95">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>Successfully logged {logHours}h for {selectedSubjectCode}! 🎉</span>
              </div>
            ) : (
              <form onSubmit={handleQuickLogSubmit} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1">Select CA Subject</label>
                  <select
                    value={selectedSubjectCode}
                    onChange={(e) => setSelectedSubjectCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#2dd4bf] focus:outline-none"
                  >
                    {subjects.map(s => (
                      <option key={s.code} value={s.code}>
                        {s.code}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1">Hours Spent</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 1, 1.5, 2, 3, 4].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setLogHours(h)}
                        className={`py-2 rounded-xl font-mono font-extrabold text-xs border cursor-pointer transition-all ${
                          logHours === h
                            ? 'bg-[#2dd4bf] text-slate-950 border-[#2dd4bf] shadow-[0_0_10px_rgba(45,212,191,0.5)]'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-300 mb-1">Topics / Notes (Optional)</label>
                  <input
                    type="text"
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="e.g. Chapter 4 Practice Questions & Revisions"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-[#2dd4bf] focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQuickLogModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#2dd4bf] to-teal-400 hover:from-teal-300 hover:to-emerald-400 text-slate-950 font-black text-xs cursor-pointer shadow-md active:scale-98"
                  >
                    Save Log
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
