import React, { useState, useEffect, useRef } from 'react';
import { Search, Compass, Zap, FileSpreadsheet, Download, ShieldCheck, Heart, FileText, Calendar, Clock, BookOpen, Layers, BarChart2, MessageCircle, X } from 'lucide-react';

interface CommandItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  category: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: any) => void;
  onToggleStrictMode: () => void;
  isStrictMode: boolean;
  onOpenExamSimulator: () => void;
  onOpenExportExcel: () => void;
  onOpenExportJson: () => void;
  onToggleChat: () => void;
  isChatOpen: boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onToggleStrictMode,
  isStrictMode,
  onOpenExamSimulator,
  onOpenExportExcel,
  onOpenExportJson,
  onToggleChat,
  isChatOpen,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-timer', icon: <Clock className="w-4 h-4 text-sky-400" />, label: 'Go to Study Timer', category: 'Navigation', action: () => onNavigateTab('timer') },
    { id: 'nav-subjects-hub', icon: <Layers className="w-4 h-4 text-purple-400" />, label: 'Go to Subject Hub & KPIs', category: 'Navigation', action: () => onNavigateTab('subjects-hub') },
    { id: 'nav-timetable', icon: <Calendar className="w-4 h-4 text-pink-400" />, label: 'Go to Plan & Timetable', category: 'Navigation', action: () => onNavigateTab('timetable') },
    { id: 'nav-analytics', icon: <BarChart2 className="w-4 h-4 text-emerald-400" />, label: 'Go to Analytics & Forecast', category: 'Navigation', action: () => onNavigateTab('analytics') },
    { id: 'nav-calendar-tracker', icon: <Calendar className="w-4 h-4 text-amber-400" />, label: 'Go to Sync & Days Left', category: 'Navigation', action: () => onNavigateTab('calendar-tracker') },
    { id: 'nav-history', icon: <BookOpen className="w-4 h-4 text-orange-400" />, label: 'Go to Study History Ledger', category: 'Navigation', action: () => onNavigateTab('study-history') },
    { id: 'nav-readiness', icon: <ShieldCheck className="w-4 h-4 text-teal-400" />, label: 'Go to Master Readiness', category: 'Navigation', action: () => onNavigateTab('master-summary') },
    { id: 'nav-evaluator', icon: <FileText className="w-4 h-4 text-cyan-400" />, label: 'Go to AI Answer Evaluator', category: 'Navigation', action: () => onNavigateTab('evaluator') },
    
    // Actions
    { id: 'action-exam-sim', icon: <FileText className="w-4 h-4 text-yellow-400" />, label: 'Open Exam Simulator', category: 'Actions', action: onOpenExamSimulator },
    { id: 'action-strict', icon: <Zap className="w-4 h-4 text-red-400" />, label: isStrictMode ? 'Disable Strict Mode' : 'Enable Strict Mode (Anti-Distraction)', category: 'Actions', action: onToggleStrictMode },
    { id: 'action-chat', icon: <Heart className="w-4 h-4 text-pink-500" />, label: isChatOpen ? 'Close Piyaa AI Companion' : 'Open Piyaa AI Companion', category: 'Actions', action: onToggleChat },
    
    // Export & Backup
    { id: 'export-excel', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />, label: 'Export Data to Excel', category: 'Data & Sync', action: onOpenExportExcel },
    { id: 'export-json', icon: <Download className="w-4 h-4 text-sky-400" />, label: 'Download Backup JSON', category: 'Data & Sync', action: onOpenExportJson },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
      
      <div 
        className="relative w-full max-w-xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10 bg-slate-900/50">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-slate-100 placeholder:text-slate-500 text-lg focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-2 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              No results found.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredCommands.map((cmd, index) => {
                const isSelected = index === selectedIndex;
                const showCategory = index === 0 || filteredCommands[index - 1].category !== cmd.category;
                
                return (
                  <React.Fragment key={cmd.id}>
                    {showCategory && (
                      <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        {cmd.category}
                      </div>
                    )}
                    <button
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors text-left cursor-pointer ${
                        isSelected 
                          ? 'bg-sky-500/10 text-white border border-sky-500/20 shadow-[inset_0_0_10px_rgba(14,165,233,0.1)]' 
                          : 'text-slate-300 hover:bg-white/5 border border-transparent'
                      }`}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
                        {cmd.icon}
                      </div>
                      <span className="font-medium">{cmd.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="px-4 py-2 border-t border-white/5 bg-slate-950/50 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] font-mono">↑</kbd> <kbd className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] font-mono">↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] font-mono">Enter</kbd> Select</span>
          </div>
          <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[9px] font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};
