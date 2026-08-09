import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, User, ShieldCheck, Sparkles, LogOut, ChevronRight, BookOpen, Settings, Upload } from 'lucide-react';
import { useStore } from '../store';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLogout: () => void;
  onOpenHelpDocumentation: () => void;
  isStrictMode: boolean;
  setIsStrictMode: (val: boolean) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onOpenHelpDocumentation,
  isStrictMode,
  setIsStrictMode,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importBackupJson = useStore(state => state.importBackupJson);

  // Escape key close handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentColor = isStrictMode ? 'text-red-400' : 'text-[#2dd4bf]';
  const accentBorder = isStrictMode ? 'border-red-500/30' : 'border-[#2dd4bf]/30';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    if (fileType === 'pdf' || fileType === 'xlsx' || fileType === 'xls') {
      alert(`⚠️ Notice: Full application state restoration requires a .json backup file.\n\nThe uploaded .${fileType} file is supported for visual dashboard exports, but it lacks the complete database architecture needed for a full system restore. Please upload your JSON backup file instead.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (fileType !== 'json') {
      alert("Invalid file format. Please upload a .json backup file.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const success = importBackupJson(content);
        if (success) {
          alert('✅ Backup restored successfully!');
          onClose();
        } else {
          alert('❌ Failed to restore backup. The file might be corrupted or in an invalid format.');
        }
      } catch (error) {
        alert('❌ Error reading backup file.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0B1528]/95 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`w-full max-w-lg rounded-2xl border ${accentBorder} bg-[#0B1528] shadow-2xl relative flex flex-col text-slate-100 max-h-[90vh]`}>
        
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-slate-800 p-6 shrink-0">
          <div className="flex items-center gap-2">
            <Settings className={`w-5 h-5 ${accentColor}`} />
            <h2 className="text-sm sm:text-base font-black text-slate-100 uppercase tracking-wider">
              Aspirant Profile & System Settings
            </h2>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-800" 
            title="Close (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* User Card */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-4">
          {currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              referrerPolicy="no-referrer"
              alt={currentUser.displayName || 'User'} 
              className={`w-14 h-14 rounded-full border-2 ${isStrictMode ? 'border-red-400' : 'border-[#2dd4bf]'} object-cover`} 
            />
          ) : (
            <div className={`w-14 h-14 rounded-full bg-gradient-to-tr ${isStrictMode ? 'from-red-600 to-amber-500' : 'from-[#2dd4bf] to-teal-400'} text-slate-950 flex items-center justify-center font-black text-xl shadow-lg shrink-0`}>
              {currentUser ? (currentUser.displayName || currentUser.email || 'U')[0].toUpperCase() : <User className="w-6 h-6" />}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate">
              {currentUser ? (currentUser.displayName || 'CA Final Aspirant') : 'Guest Account'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">
              {currentUser ? currentUser.email : 'offline-only mode'}
            </p>
            
            <div className="mt-2 flex flex-wrap gap-1.5">
              {currentUser ? (
                <>
                  <div className={`inline-flex items-center gap-1 text-[9px] font-bold ${isStrictMode ? 'text-red-400 bg-red-950/40 border-red-500/20' : 'text-[#2dd4bf] bg-sky-950/80 border-[#2dd4bf]/30'} px-2 py-0.5 rounded-full border`}>
                    <Sparkles className="w-2.5 h-2.5 shrink-0" />
                    <span>Cloud Synced</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                    <span>Authorized Account</span>
                  </div>
                </>
              ) : (
                <div className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
                  <span>Guest (Local Offline Only)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Data Backup & Restore */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
            Data Backup & Restore
          </p>
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1">
                <span className="text-xs font-bold text-slate-200">Import Local Backup</span>
                <p className="text-[10px] text-slate-400 leading-snug">Restore your complete progress history and timetable from a backup file (JSON, PDF, Excel).</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg border bg-teal-950/60 border-teal-500/50 text-teal-300 shadow-sm hover:bg-teal-900/80 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Backup</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json,.pdf,.xlsx,.xls"
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>

        {/* 4. HIGH-CONTRAST TRIGGER CARD */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
            Learning & Architecture Support
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHelpDocumentation();
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/50 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5 shrink-0">📖</span>
              <div>
                <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider group-hover:text-cyan-200 transition-colors">
                  Help, Manual & System Architecture
                </h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  View official CA Final scheduling guides, 3-way engine docs & burnout rules
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition-colors shrink-0 ml-2" />
          </button>
        </div>

        {/* App Configuration Panel */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">
            Preferences & Theme Mode
          </p>
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200">Strict Theme Mode</span>
                <p className="text-[10px] text-slate-400 leading-none">Sets a Crimson palette for extreme focus</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStrictMode(!isStrictMode)}
                className={`px-3 py-1.5 text-[10px] font-bold font-mono rounded-lg border transition-all ${
                  isStrictMode 
                    ? 'bg-red-950/60 border-red-500/50 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.15)]' 
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {isStrictMode ? '🔥 Strict (Crimson)' : '🌱 Chill (Emerald)'}
              </button>
            </div>
          </div>
        </div>

        </div>

        {/* Action Controls Footer */}
        <div className="flex items-center justify-between p-6 shrink-0 border-t border-slate-800/80 gap-3">
          {currentUser ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout & Clear Session</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 font-mono">Piyaa CA Final Companion</span>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer border border-slate-700/50"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
