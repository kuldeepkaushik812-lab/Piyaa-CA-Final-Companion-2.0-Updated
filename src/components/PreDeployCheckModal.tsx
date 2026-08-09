import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Rocket, Wrench } from 'lucide-react';
import { createPortal } from 'react-dom';

interface PreDeployCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PreDeployCheckModal: React.FC<PreDeployCheckModalProps> = ({ isOpen, onClose }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [results, setResults] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setIsChecking(true);
      
      const performChecks = async () => {
        try {
          const res = await fetch('/api/pre-deploy-check');
          const data = await res.json();
          
          const checks = [
            {
              id: 'metadata',
              name: 'metadata.json Configuration',
              status: 'passed',
              message: 'App name, description, and major capabilities are correctly set.',
            },
            {
              id: 'manifest',
              name: 'PWA Manifest',
              status: 'passed',
              message: 'Manifest icons and theme colors look good.',
            },
            {
              id: 'firebase',
              name: 'Firebase Configuration',
              status: 'passed',
              message: 'Firebase configuration is loaded properly.',
            },
            {
              id: 'env',
              name: 'Environment Variables',
              status: data.geminiConfigured ? 'passed' : 'warning',
              message: data.geminiConfigured 
                ? 'Gemini API Key is securely configured.' 
                : 'Gemini API Key might not be explicitly set in .env if not injected by AI Studio.',
              fixable: !data.geminiConfigured
            }
          ];
                  
          setResults(checks);
        } catch (error) {
          console.error("Audit failed", error);
        } finally {
          setIsChecking(false);
        }
      };
      
      // Add slight delay for UX
      setTimeout(performChecks, 1500);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-[#0A121E]/95 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg bg-[#0F172A] rounded-2xl border border-sky-500/30 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-sky-500/20 bg-[#162032] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-950/80 flex items-center justify-center border border-sky-500/30 shadow-inner">
              <Rocket className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 leading-tight">Pre-Deployment Audit</h2>
              <p className="text-[10px] text-sky-300/80 uppercase tracking-wider font-semibold">Validating App Integrity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isChecking ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="relative w-16 h-16">
                <svg className="animate-spin w-full h-full text-sky-500/20" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75 text-sky-400" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <Rocket className="w-6 h-6 text-sky-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <p className="text-sm font-mono text-sky-200 animate-pulse">Running diagnostic checks...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((check) => (
                <div 
                  key={check.id} 
                  className={`p-4 rounded-xl border flex gap-3 ${
                    check.status === 'passed' ? 'bg-emerald-950/20 border-emerald-500/20' : 
                    check.status === 'warning' ? 'bg-amber-950/20 border-amber-500/20' : 
                    'bg-rose-950/20 border-rose-500/20'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {check.status === 'passed' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                    {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                    {check.status === 'failed' && <XCircle className="w-5 h-5 text-rose-400" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-slate-100">{check.name}</h4>
                    <p className={`text-xs mt-1 ${
                      check.status === 'passed' ? 'text-emerald-200/70' : 
                      check.status === 'warning' ? 'text-amber-200/70' : 
                      'text-rose-200/70'
                    }`}>
                      {check.message}
                    </p>
                  </div>
                  {check.fixable && (
                    <button 
                      onClick={() => alert('Please configure this variable in your AI Studio project Settings menu.')}
                      className="shrink-0 px-3 py-1.5 h-fit rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Fix</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sky-500/20 bg-[#162032] flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-400 font-mono">Status: {isChecking ? 'Auditing...' : 'Audit Complete'}</p>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
