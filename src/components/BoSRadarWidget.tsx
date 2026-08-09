import React from 'react';
import { Radar, ExternalLink, MessageCircle, FileText, Download } from 'lucide-react';

const mockUpdates = [
  { id: 1, title: 'ICAI Announcements', link: 'https://www.icai.org/category/announcements', tag: 'ICAI', date: 'Official' },
  { id: 2, title: 'BOS Announcement', link: 'https://boslive.icai.org/bos_announcement.php', tag: 'BOS', date: 'Official' },
  { id: 3, title: 'Exam Announcement', link: 'https://boslive.icai.org/examination_announcement.php', tag: 'Exam', date: 'Official' }
];

export const BoSRadarWidget: React.FC<{ onAskPiyaa?: () => void }> = ({ onAskPiyaa }) => {
  return (
    <div className="glass-panel p-4 mb-6 rounded-3xl border border-teal-500/30 shadow-lg relative overflow-hidden backdrop-blur-2xl">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Radar className="w-32 h-32 text-teal-400 animate-spin-slow" />
      </div>
      
      <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-4">
        <div className="shrink-0 pt-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            <h3 className="font-bold text-teal-100 text-sm flex items-center gap-2">
              <Radar className="w-4 h-4 text-teal-400" />
              ICAI BoS Live Radar
            </h3>
          </div>
          <p className="text-xs text-teal-200/70 mt-1 max-w-[200px]">Auto-fetching latest announcements, RTPs & MTPs from ICAI Portal.</p>
        </div>

        <div className="flex-1 flex flex-col gap-2">
          {mockUpdates.map(update => (
            <div key={update.id} className="glass-card flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-teal-500/20 gap-3">
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase bg-teal-900/60 text-teal-300 px-1.5 py-0.5 rounded border border-teal-500/30">
                      {update.tag}
                    </span>
                    <span className="text-[10px] text-slate-400">{update.date}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-200">{update.title}</h4>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={update.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-900/40 hover:bg-teal-800/60 border border-teal-500/30 transition-colors text-[10px] font-bold text-teal-200 cursor-pointer no-underline"
                >
                  <ExternalLink className="w-3 h-3" /> View
                </a>
                <button
                  onClick={onAskPiyaa}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-900/40 hover:bg-amber-800/60 border border-amber-500/30 transition-colors text-[10px] font-bold text-amber-200 cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3" /> Ask Piyaa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
