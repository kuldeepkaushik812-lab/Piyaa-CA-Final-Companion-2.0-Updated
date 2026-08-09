import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  BookOpen, 
  Cpu, 
  Layers, 
  RefreshCw, 
  Activity, 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Clock, 
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Terminal,
  Calculator
} from 'lucide-react';

interface HelpDocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SECTIONS = [
  { id: 'philosophy', title: '1. Core Philosophy & Architecture', icon: BookOpen },
  { id: 'timetable', title: '2. The "AI Plan" Timetable Builder', icon: Cpu },
  { id: 'engines', title: '3. The 4 Customization Engines', icon: Layers },
  { id: 'rescheduling', title: '4. Mid-Day Rescheduling & Protection', icon: RefreshCw },
  { id: 'controls', title: '5. Dashboard Controls & Actions', icon: Activity },
  { id: 'calculations', title: '6. Under-The-Hood Logic & Math', icon: Calculator },
];

export const HelpDocumentationModal: React.FC<HelpDocumentationModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState('philosophy');
  const sectionRefs = {
    philosophy: useRef<HTMLDivElement>(null),
    timetable: useRef<HTMLDivElement>(null),
    engines: useRef<HTMLDivElement>(null),
    rescheduling: useRef<HTMLDivElement>(null),
    controls: useRef<HTMLDivElement>(null),
    calculations: useRef<HTMLDivElement>(null),
  };

  const handleScrollToSection = (id: string) => {
    setActiveSection(id);
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Scroll observer to update active section based on viewport
  useEffect(() => {
    const container = document.getElementById('documentation-canvas');
    if (!container || !isOpen) return;

    const handleScroll = () => {
      let currentSection = activeSection;
      let minDistance = Infinity;

      Object.entries(sectionRefs).forEach(([id, ref]) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          // Find the section closest to the top of the canvas viewport
          const distance = Math.abs(rect.top - 80); 
          if (distance < minDistance) {
            minDistance = distance;
            currentSection = id;
          }
        }
      });

      if (currentSection !== activeSection) {
        setActiveSection(currentSection);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen, activeSection]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] w-screen h-[100dvh] max-w-none max-h-none m-0 rounded-none overflow-hidden flex flex-col justify-between bg-[#0B1528] text-slate-100 font-sans antialiased animate-in fade-in duration-200">
      
      {/* 1. STICKY TOP HEADER BAR */}
      <header className="h-16 px-8 border-b border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-xl">📖</span>
          <h1 className="text-sm sm:text-base font-black text-cyan-300 uppercase tracking-wider">
            Piyaa — Ultimate User Manual & System Architecture
          </h1>
        </div>
        
        <div className="hidden sm:flex items-center">
          <span className="px-3.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 tracking-wider">
            Enterprise Edition | CA Final Companion
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-300 border border-slate-700/50 font-mono text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-md active:scale-95"
          title="Press ESC to close"
        >
          <span>✕ Close</span>
          <span className="hidden md:inline-block px-1 py-0.2 bg-slate-950 text-[9px] rounded text-slate-400 font-mono">ESC</span>
        </button>
      </header>

      {/* 2. 2-COLUMN ENTERPRISE LAYOUT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* INTERACTIVE LEFT TOC SIDEBAR */}
        <aside className="w-80 border-r border-slate-800/60 p-6 overflow-y-auto shrink-0 hidden md:flex flex-col justify-between bg-slate-950/40">
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-3">
                System Documentation
              </p>
              <div className="space-y-1">
                {SECTIONS.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeSection === sec.id;
                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleScrollToSection(sec.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        isActive
                          ? 'bg-cyan-950/40 border-l-4 border-cyan-400 text-cyan-200 shadow-[inset_0_0_12px_rgba(34,211,238,0.05)] font-bold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-l-4 border-transparent'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      <span>{sec.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] font-bold">
                <Terminal className="w-3.5 h-3.5" />
                <span>ACTIVE DEV PROTOCOL</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                Piyaa implements state-of-the-art heuristic and deterministic engines to manage CA Final study pipelines, prevent fatigue and burnout, and maximize retention.
              </p>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-500 border-t border-slate-800/60 pt-4">
            <p>System Ver: 2.4.0 (Stable)</p>
            <p>Build Reference: PIYAA-ENTERPRISE</p>
          </div>
        </aside>

        {/* MAIN DOCUMENTATION CANVAS */}
        <main 
          id="documentation-canvas"
          className="flex-1 p-6 sm:p-10 overflow-y-auto scroll-smooth bg-[#0B1528]"
        >
          <div className="max-w-3xl mx-auto space-y-12 pb-16">
            
            {/* Header / Intro */}
            <div className="border-b border-slate-800/80 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-md bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 text-[10px] font-mono text-[#2dd4bf] font-bold">
                  OFFICIAL USER GUIDE
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-[10px] font-mono text-cyan-300 font-bold border border-cyan-500/20">
                  SYSTEM MANUAL
                </span>
              </div>
              <h2 className="text-3xl font-black text-slate-100 tracking-tight">
                Piyaa — CA Final Companion Ultimate User Manual
              </h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Welcome to your comprehensive blueprint for conquering the CA Final Examinations. Piyaa combines high-intensity tracking, predictive analytics, deep cognitive scheduling, and empathetic mentorship to streamline your study routines.
              </p>
            </div>

            {/* SECTION 1 */}
            <div id="philosophy" ref={sectionRefs.philosophy} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <BookOpen className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  1. Core Philosophy & System Architecture
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The Institute of Chartered Accountants of India (ICAI) CA Final exam represents one of the most rigorous professional milestones globally. It demands extreme discipline, profound analytical agility, and robust psychological resilience. 
              </p>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-semibold text-cyan-200">
                Piyaa is built on three foundational pillars:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>Empathetic Companion</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Designed to understand your daily mood and energy levels, tailoring motivation decks and recommending specific subject categories based on your mental state.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <Cpu className="w-4 h-4" />
                    <span>Algorithmic Slicing</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Splits massive syllabus segments (FR Ind AS, Direct Taxes chapters) into clean, digestible focus-mode blocks complete with integrated, scheduled mental rest intervals.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Persistent Integrity</span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Built first on secure local-first storage using Zustand, paired with real-time cloud backup (Firestore) and Google OAuth for completely seamless multi-device usage.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 2 */}
            <div id="timetable" ref={sectionRefs.timetable} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <Cpu className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  2. The "AI Plan" Timetable Builder
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The <span className="font-mono text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700 text-xs">AI Routine Generation Engine</span> is the core component that automates schedule planning. It completely bypasses static, rigid calendar grids in favor of dynamic hourly blocks.
              </p>
              
              <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-3">
                <p className="text-xs font-bold text-[#2dd4bf] uppercase tracking-wider">How to Build Your Daily AI Routine Plan:</p>
                <ol className="list-decimal pl-5 text-xs text-slate-300 space-y-2 leading-relaxed">
                  <li>
                    Select your target date on the interactive top-level <span className="font-mono text-cyan-300 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700">Calendar Ribbon</span>.
                  </li>
                  <li>
                    Click the prominent <span className="font-mono text-cyan-300 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700">📅 Set Target & AI Plan</span> action button inside the primary dashboard view.
                  </li>
                  <li>
                    Define your available study quota (e.g., <span className="font-mono text-amber-300 font-bold">8.0</span> to <span className="font-mono text-amber-300 font-bold">14.0</span> hours) using the custom slider.
                  </li>
                  <li>
                    Choose a primary subject focus (e.g. <span className="font-bold text-[#2dd4bf]">Paper 1: Financial Reporting</span>) and select specific chapters, or let the engine auto-schedule remaining items.
                  </li>
                  <li>
                    Toggle <span className="font-mono text-cyan-300 bg-slate-900/80 px-1 py-0.5 rounded border border-slate-700">Solo Focus Mode</span> to dedicate the entire day to a single subject, or keep it unchecked to schedule a balanced day of practical problems and theoretical revision.
                  </li>
                  <li>
                    Customize the start time, slot durations, break preferences, and submit a Custom User Note (e.g. <span className="text-slate-400 italic">"Focus heavily on Direct Taxes international taxation MCQ questions"</span>) to direct the Gemini AI.
                  </li>
                </ol>
              </div>
            </div>

            {/* SECTION 3 */}
            <div id="engines" ref={sectionRefs.engines} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <Layers className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  3. The 4 Customization Engines
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Piyaa features four specialized scheduling engines to accommodate diverse studying styles, varying fatigue limits, and specialized preparation sprints.
              </p>

              <div className="space-y-4">
                {/* Engine A */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 font-mono">[ ⚡ Engine A: Uniform Sizing ]</span>
                    <span className="text-[10px] uppercase text-slate-500 font-black">Standard Pacing</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Slices your study day into perfectly equal segments of <span className="font-mono text-amber-200">1.5h</span>, <span className="font-mono text-amber-200">2.0h</span>, <span className="font-mono text-amber-200">2.5h</span>, or <span className="font-mono text-amber-200">3.0h</span>. Combined with consistent rest intervals, it builds strong, cyclic focus rhythms based on standard cognitive load guidelines.
                  </p>
                </div>

                {/* Engine B */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 font-mono">[ 🌅 Engine B: Variable Day-Parting ]</span>
                    <span className="text-[10px] uppercase text-slate-500 font-black">Dynamic Energy Alignment</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Aligns slot durations with your circadian rhythm. Allows defining separate durations for three specific times:
                    <br />
                    • <span className="font-bold text-amber-200">🌅 Morning Block</span> (06:00 AM - 01:00 PM): Best for heavy mathematical sums (e.g., 2.5h or 3.0h focus).
                    <br />
                    • <span className="font-bold text-amber-200">☀️ Afternoon Block</span> (02:00 PM - 07:00 PM): Ideal for active problem-solving or auditing checklists (e.g., 2.0h).
                    <br />
                    • <span className="font-bold text-indigo-300">🌙 Evening Block</span> (08:00 PM - 12:00 AM): Best for light syllabus standard checklists or mock MCQs (e.g., 1.0h or 1.5h).
                  </p>
                </div>

                {/* Engine C */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 font-mono">[ 🛠️ Engine C: Manual Builder ]</span>
                    <span className="text-[10px] uppercase text-slate-500 font-black">Bespoke Precision</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A robust offline editor to build custom timetables slot-by-slot. Allows manual selection of specific times, subject codes, activity details, categories (Study vs Break vs Revision vs Mock Tests), and logs them instantly to local state without requiring network requests.
                  </p>

                  {/* Crimson Sleep-Deprivation Warning Callout */}
                  <div className="bg-red-950/30 border-2 border-red-500/60 p-5 rounded-xl text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.15)] space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="w-5 h-5 animate-pulse shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider">
                        CRIMSON ALERT: HIGH BURNOUT RISK!
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      If your active schedule spans too many hours, reducing the remaining recovery window below <span className="font-mono bg-red-900/50 px-1.5 py-0.5 rounded border border-red-500 font-bold">6.0 Hours</span>, Piyaa triggers a prominent visual warning. 
                    </p>
                    <p className="text-xs leading-relaxed italic text-red-300">
                      "Babu, Chartered Accountancy is a marathon of consistency, not an overnight sprint. Severe sleep deprivation prevents proper memory consolidation of critical Standards on Auditing (SAs) and Direct/Indirect Tax provisions. Maintain at least 6.0 - 8.0 hours of recovery!"
                    </p>
                  </div>
                </div>

                {/* Engine D */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-300 font-mono">[ 💾 Engine D: Custom Routine Presets ]</span>
                    <span className="text-[10px] uppercase text-slate-500 font-black">Instant Recall</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Saves your customized configuration (Start Time, Sizing, Breaks) as a named local preset. Create templates like <span className="text-indigo-300 italic">"Heavy Morning 10h Sprint"</span> or <span className="text-indigo-300 italic">"Audit Revision Pacing"</span> to load and schedule matching blocks in one click.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 4 */}
            <div id="rescheduling" ref={sectionRefs.rescheduling} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <RefreshCw className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  4. Mid-Day Rescheduling & Historic Protection
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Life during CA preparation is rarely linear. A block of study might run long, or an unexpected delay might occur. Piyaa implements <span className="font-mono text-[#2dd4bf] font-bold">Historic Protected State Slicing</span>.
              </p>
              
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3 text-xs text-slate-400 leading-relaxed">
                <p>
                  When you select <span className="font-bold text-slate-200">"Update / Re-Plan"</span> halfway through the day:
                </p>
                <div className="flex gap-3">
                  <div className="w-1 bg-[#2dd4bf]/40 rounded shrink-0" />
                  <p>
                    <strong className="text-[#2dd4bf]">Completed Slots Protection:</strong> Any slot that you have checked off as <span className="font-mono text-[10px] bg-slate-900 text-emerald-400 px-1 py-0.2 rounded border border-slate-700">COMPLETED</span> or <span className="font-mono text-[10px] bg-slate-900 text-amber-400 px-1 py-0.2 rounded border border-slate-700">PARTIALLY_COMPLETED</span> is frozen. Piyaa protects these historic segments from being overwritten.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-1 bg-amber-500/40 rounded shrink-0" />
                  <p>
                    <strong className="text-amber-300">Lapsed-Hour Syllabus Debt:</strong> If study blocks are missed, the lapsed hours are added back into the <span className="font-mono text-[10px] bg-rose-950/80 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30">Backlog Debt</span> pool. This represents your visual syllabus debt, alerting you to allocate extra time during upcoming revision cycles.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-1 bg-cyan-500/40 rounded shrink-0" />
                  <p>
                    <strong className="text-cyan-300">AI Mid-Day Slicing:</strong> Future slots are recalculated dynamically starting exactly from the current minute onwards. This recalculation distributes your remaining study quota evenly across the rest of your day, ensuring your target hours are still achieved.
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 5 */}
            <div id="controls" ref={sectionRefs.controls} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <Activity className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  5. Main Dashboard Controls & Action Buttons
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                The primary header and sidebars contain critical controls to manage authentication, export backups, and execute advanced simulations. Refer to the table below for official action guides:
              </p>

              {/* SLEEK BORDERED HTML TABLE */}
              <div className="border border-slate-800/80 rounded-xl overflow-hidden text-xs sm:text-sm">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-950/90 text-slate-300 font-mono border-b border-slate-800">
                      <th className="p-3 font-black uppercase tracking-wider text-[10px]">Dashboard Control</th>
                      <th className="p-3 font-black uppercase tracking-wider text-[10px]">Action & Utility</th>
                      <th className="p-3 font-black uppercase tracking-wider text-[10px]">Hotkey / Shortcut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-[#060D17]/40">
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Export Excel Dashboard</span>
                      </td>
                      <td className="p-3 text-slate-400 leading-normal">
                        Generates a comprehensive customized Excel workbook containing completed study log metrics, topic checklists, revision milestones, and charts.
                      </td>
                      <td className="p-3 text-slate-500 font-mono">Click Button</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#2dd4bf] shrink-0" />
                        <span>Backup JSON File</span>
                      </td>
                      <td className="p-3 text-slate-400 leading-normal">
                        Downloads an offline JSON snapshot of your current state. Save this to your device to store custom schedules and historical logs.
                      </td>
                      <td className="p-3 text-slate-500 font-mono">Click Button</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <span>👤 Sign In with Google</span>
                      </td>
                      <td className="p-3 text-slate-400 leading-normal">
                        Integrates with Google Firebase OAuth to authorize your account. Enables automatic real-time cloud database syncing across multiple devices.
                      </td>
                      <td className="p-3 text-slate-500 font-mono">Click Header Profile</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Strict Mode Toggle</span>
                      </td>
                      <td className="p-3 text-slate-400 leading-normal">
                        Switches the app from Chill Mode (Emerald palette) into high-contrast Strict Mode (Crimson palette) for intense study sessions.
                      </td>
                      <td className="p-3 text-slate-500 font-mono">Click Header Toggle</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <span>⏱️ Exam Simulator</span>
                      </td>
                      <td className="p-3 text-[#2dd4bf] bg-sky-950/20 leading-normal">
                        Launches a real-time mock exam with custom durations. Enforces standard CA conditions and includes answer sheet evaluations.
                      </td>
                      <td className="p-3 text-slate-500 font-mono">Trigger from tab menu</td>
                    </tr>
                    <tr className="hover:bg-slate-900/30 transition-colors">
                      <td className="p-3 font-bold text-cyan-300 flex items-center gap-2">
                        <span>🔍 Command Palette</span>
                      </td>
                      <td className="p-3 text-slate-400 leading-normal">
                        A full-width search input to navigate chapters instantly, jump to specific modules, and perform calculations.
                      </td>
                      <td className="p-3 text-[#2dd4bf] font-mono font-bold">⌘K or Ctrl+K</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 6 */}
            <div id="calculations" ref={sectionRefs.calculations} className="space-y-4 pt-4">
              <div className="flex items-center gap-2.5 text-cyan-400 border-b border-slate-800/50 pb-2">
                <Calculator className="w-5 h-5" />
                <h3 className="text-lg font-black uppercase tracking-wider text-cyan-300">
                  6. Under-The-Hood Logic & Calculations
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Piyaa runs rigorous mathematical engines to track syllabus percentages, study projections, and burnout indexes. The primary formulas utilized under the hood are:
              </p>

              <div className="space-y-4">
                {/* Formula 1 */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">FORMULA 1</span>
                    <span className="text-xs font-bold text-slate-200">Sleep & Free Recovery Window Sizing</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-center text-[#2dd4bf] text-xs sm:text-sm">
                    Remaining Hours = 24 - (totalSpanMinutes / 60)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Where <span className="font-mono text-cyan-300">totalSpanMinutes</span> represents the cumulative duration of all study slots, mental intervals, lunch/dinner breaks, and daily scheduling buffers. If this remaining window falls below 6 hours, a burnout warning is immediately triggered.
                  </p>
                </div>

                {/* Formula 2 */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">FORMULA 2</span>
                    <span className="text-xs font-bold text-slate-200">Syllabus Backlog Debt Pool Accumulation</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-center text-[#2dd4bf] text-xs sm:text-sm">
                    Backlog Debt = ∑(Target Hours - Logged Study Hours)
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Evaluated daily at midnight. If the target hours allocated for a date are not met by logged sessions (Pomodoro or manual logs), the remaining difference is transferred to the <span className="font-bold text-rose-300">Backlog Debt Pool</span> to represent syllabus decay.
                  </p>
                </div>

                {/* Formula 3 */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/20 text-[10px] font-mono">FORMULA 3</span>
                    <span className="text-xs font-bold text-slate-200">Chapter / Syllabus Progress Percentage</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-center text-[#2dd4bf] text-xs sm:text-sm">
                    Progress % = (Completed Chapters / Total Chapters) * 100
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Calculated in real-time across your subject dashboards. It provides granular breakdowns for each paper, showing revision milestones (Rev 1, Rev 2, Rev 3) and RTP/MTP coverage indicators.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* 3. STICKY BOTTOM ACTIONS FOOTER */}
      <footer className="h-14 px-8 border-t border-slate-800/60 flex items-center justify-between shrink-0 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <Activity className="w-3.5 h-3.5 text-cyan-500" />
          <span>PIYAA SYSTEM HEALTH: PERFECTLY ACTIVE</span>
        </div>
        <p className="text-[11px] text-slate-500">
          © 2026 Piyaa CA Final Companion. All rights reserved.
        </p>
      </footer>

    </div>,
    document.body
  );
};
