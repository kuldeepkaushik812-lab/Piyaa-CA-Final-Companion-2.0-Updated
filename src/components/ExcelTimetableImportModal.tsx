import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, 
  Calendar, Clock, BookOpen, Layers, X, Sparkles, RefreshCw, 
  ChevronRight, ArrowRight, ShieldCheck, HelpCircle, Info
} from 'lucide-react';
import { useStore } from '../store';
import { getISTYMD, getISTDate, formatDisplayDate, addDaysToYMD } from '../lib/dateUtils';
import { 
  downloadDayTimetableTemplate, 
  downloadWeekTimetableTemplate, 
  downloadMonthTimetableTemplate, 
  parseExcelTimetableWorkbook, 
  ParsedImportResult 
} from '../lib/excelImport';
import { TimetableSlot } from '../types';

interface ExcelTimetableImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDateStr?: string;
  onSuccessToast?: (msg: string) => void;
}

export const ExcelTimetableImportModal: React.FC<ExcelTimetableImportModalProps> = ({
  isOpen,
  onClose,
  initialDateStr,
  onSuccessToast
}) => {
  const [importMode, setImportMode] = useState<'DAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [targetDate, setTargetDate] = useState<string>(initialDateStr || getISTYMD());
  const [conflictStrategy, setConflictStrategy] = useState<'REPLACE' | 'MERGE'>('REPLACE');
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedImportResult | null>(null);
  const [previewActiveDate, setPreviewActiveDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'TEMPLATES' | 'RECOMMENDATIONS'>('IMPORT');
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    setScheduleForDate,
    setDailyTarget,
    getScheduleForDate,
    recalculateAllMetrics,
    selectedDateStr,
    timetable,
    setTimetable,
    isTodaySyncedWithWeekly
  } = useStore();

  // Scroll-lock on body when modal is open
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

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when modal re-opens
  useEffect(() => {
    if (isOpen) {
      if (initialDateStr) setTargetDate(initialDateStr);
      setParseError(null);
      setParsedData(null);
      setSelectedFile(null);
      setPreviewActiveDate(null);
    }
  }, [isOpen, initialDateStr]);

  const handleFileChange = async (file: File) => {
    if (!file) return;
    setSelectedFile(file);
    setIsParsing(true);
    setParseError(null);

    try {
      const result = await parseExcelTimetableWorkbook(file, targetDate, importMode);
      if (result.totalDatesCount === 0 || result.totalSlotsCount === 0) {
        throw new Error('No valid timetable slots could be found in this spreadsheet. Please ensure headers like "Time Range", "Subject", and "Chapter" exist, or use our official downloadable template.');
      }
      setParsedData(result);
      if (result.sampleDates.length > 0) {
        setPreviewActiveDate(result.sampleDates[0]);
      }
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse Excel file. Please verify file format.');
      setParsedData(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleApplySchedule = () => {
    if (!parsedData) return;
    setIsApplying(true);

    try {
      const todayStr = getISTYMD();
      const datesToApply = Object.keys(parsedData.days).sort();

      datesToApply.forEach((dStr) => {
        const daySchedule = parsedData.days[dStr];
        let finalSlots: TimetableSlot[] = daySchedule.slots;

        if (conflictStrategy === 'MERGE') {
          const existing = getScheduleForDate(dStr) || [];
          // Preserve completed existing slots
          const completedExisting = existing.filter(s => s.completed || s.status === 'COMPLETED');
          finalSlots = [...completedExisting, ...daySchedule.slots];
        }

        // Save to store for this date
        setScheduleForDate(dStr, finalSlots);

        // Update daily target hours
        const studyHours = Number(daySchedule.totalStudyHours.toFixed(1));
        if (studyHours > 0) {
          setDailyTarget(dStr, studyHours);
        }

        // Recalculate metrics
        recalculateAllMetrics(dStr);
      });

      // If today is among the imported dates, also sync today's active timetable
      if (datesToApply.includes(todayStr)) {
        const todaySlots = parsedData.days[todayStr].slots;
        if (todaySlots && todaySlots.length > 0) {
          setTimetable(todaySlots);
        }
      }

      const count = datesToApply.length;
      const msg = count === 1 
        ? `✅ Successfully imported custom timetable for ${formatDisplayDate(datesToApply[0])}!`
        : `🚀 Successfully imported custom timetable across ${count} days (${formatDisplayDate(datesToApply[0])} to ${formatDisplayDate(datesToApply[count - 1])})!`;

      if (onSuccessToast) {
        onSuccessToast(msg);
      }
      onClose();
    } catch (err: any) {
      setParseError(err.message || 'Error applying imported schedule to app state.');
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b1322] border border-emerald-500/30 rounded-3xl shadow-2xl shadow-emerald-500/10 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Import Custom Excel Timetable</span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  Day • Week • Month
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Upload your personalized study schedule from Excel, Google Sheets, or CSV
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/30 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('IMPORT')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'IMPORT' 
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload & Import</span>
          </button>

          <button
            onClick={() => setActiveTab('TEMPLATES')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'TEMPLATES' 
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel Templates</span>
          </button>

          <button
            onClick={() => setActiveTab('RECOMMENDATIONS')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'RECOMMENDATIONS' 
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20' 
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Study Strategy & Views</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* TAB 1: UPLOAD & IMPORT */}
          {activeTab === 'IMPORT' && (
            <div className="space-y-6">
              {/* Step 1: Configuration Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Import Scope</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setImportMode('DAY')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                        importMode === 'DAY' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('WEEK')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                        importMode === 'WEEK' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Week
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('MONTH')}
                      className={`py-1.5 px-2 rounded-lg font-bold transition-all ${
                        importMode === 'MONTH' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Month
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Target Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Conflict Handling</span>
                  </label>
                  <select
                    value={conflictStrategy}
                    onChange={(e) => setConflictStrategy(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                  >
                    <option value="REPLACE">Overwrite Existing Timetable</option>
                    <option value="MERGE">Preserve Completed & Merge</option>
                  </select>
                </div>
              </div>

              {/* Step 2: Drag & Drop Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  selectedFile 
                    ? 'border-emerald-500/60 bg-emerald-950/20' 
                    : 'border-slate-700/80 hover:border-emerald-500/40 bg-slate-900/40 hover:bg-slate-900/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                />

                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5">
                  <Upload className="w-7 h-7 animate-pulse" />
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-100">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag & drop your Excel file'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) spreadsheets
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{(selectedFile.size / 1024).toFixed(1)} KB • Loaded Successfully</span>
                  </div>
                )}
              </div>

              {/* Loading State */}
              {isParsing && (
                <div className="flex items-center justify-center gap-3 py-6 text-sm text-emerald-400">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Parsing dates, subjects, time slots and validating non-overlapping hours...</span>
                </div>
              )}

              {/* Error Message */}
              {parseError && (
                <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Import Warning: </strong>
                    <span>{parseError}</span>
                  </div>
                </div>
              )}

              {/* Step 3: Parsed Results & Interactive Live Preview */}
              {parsedData && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Days Found</p>
                        <p className="text-sm font-extrabold text-indigo-300">{parsedData.totalDatesCount} Days</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Total Slots</p>
                        <p className="text-sm font-extrabold text-emerald-300">{parsedData.totalSlotsCount} Slots</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Study Hours</p>
                        <p className="text-sm font-extrabold text-cyan-300">{parsedData.totalStudyHours}h</p>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                        ☕
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Break Hours</p>
                        <p className="text-sm font-extrabold text-amber-300">{parsedData.totalBreakHours}h</p>
                      </div>
                    </div>
                  </div>

                  {/* Day Picker for Multi-Day schedules */}
                  {parsedData.sampleDates.length > 1 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 mb-2">
                        Select a Day to Preview Parsed Slots:
                      </label>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                        {parsedData.sampleDates.map((dStr) => {
                          const isActive = previewActiveDate === dStr;
                          const dayObj = parsedData.days[dStr];
                          return (
                            <button
                              key={dStr}
                              type="button"
                              onClick={() => setPreviewActiveDate(dStr)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold shrink-0 transition-all cursor-pointer ${
                                isActive 
                                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' 
                                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800 border border-slate-800'
                              }`}
                            >
                              <span>{formatDisplayDate(dStr)}</span>
                              <span className="ml-1.5 opacity-75">({daySchedule(dayObj)})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Table of Preview Slots */}
                  {previewActiveDate && parsedData.days[previewActiveDate] && (
                    <div className="bg-[#080d16] rounded-2xl border border-slate-800 overflow-hidden shadow-inner">
                      <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-400">
                          📅 Preview for {formatDisplayDate(previewActiveDate)}
                        </span>
                        <span className="text-slate-400">
                          {parsedData.days[previewActiveDate].slots.length} Slots • {parsedData.days[previewActiveDate].totalStudyHours.toFixed(1)} Study Hours
                        </span>
                      </div>

                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                              <th className="px-3 py-2 w-32">Time</th>
                              <th className="px-3 py-2 w-44">Subject</th>
                              <th className="px-3 py-2">Chapter / Activity</th>
                              <th className="px-3 py-2 w-24 text-center">Type</th>
                              <th className="px-3 py-2 w-16 text-right">Hrs</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {parsedData.days[previewActiveDate].slots.map((slot, idx) => {
                              const isBreak = slot.category === 'break';
                              return (
                                <tr 
                                  key={idx} 
                                  className={isBreak ? 'bg-amber-950/10 text-amber-200/90' : 'hover:bg-slate-900/30 text-slate-200'}
                                >
                                  <td className="px-3 py-2 font-mono text-emerald-400 font-bold whitespace-nowrap">
                                    {slot.time}
                                  </td>
                                  <td className="px-3 py-2 font-semibold">
                                    {slot.subject}
                                  </td>
                                  <td className="px-3 py-2 text-slate-300">
                                    {slot.activity}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isBreak ? 'bg-amber-900/40 text-amber-300 border border-amber-500/30' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                    }`}>
                                      {isBreak ? 'BREAK' : 'STUDY'}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold text-slate-300">
                                    {slot.totalDurationHours?.toFixed(1) || '1.5'}h
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Apply Action Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleApplySchedule}
                      disabled={isApplying}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      {isApplying ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Applying to Timetable...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Save & Apply to App ({parsedData.totalDatesCount} Days) 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOWNLOAD EXCEL TEMPLATES */}
          {activeTab === 'TEMPLATES' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-start gap-3">
                <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-300 text-sm mb-1">
                    Download Pre-formatted Excel Templates (.xlsx)
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Download any template below, open it in Microsoft Excel, Apple Numbers, or Google Sheets, customize your subjects, chapters, and time slots, and upload it in the <strong>Upload & Import</strong> tab!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Day Template Card */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
                  <div className="space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                      1-Day Timetable Template
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Perfect for planning an intense single-day routine or detailed revision sprint.
                    </p>
                  </div>

                  <button
                    onClick={() => downloadDayTimetableTemplate(targetDate)}
                    className="mt-4 w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-emerald-500/30 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Day Template</span>
                  </button>
                </div>

                {/* 2. Week Template Card */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
                  <div className="space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                      7-Day (Weekly) Template
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Full Monday-to-Sunday blueprint with 2-subject daily rotation and balanced breaks.
                    </p>
                  </div>

                  <button
                    onClick={() => downloadWeekTimetableTemplate(targetDate)}
                    className="mt-4 w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-indigo-500 hover:text-slate-950 text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-indigo-500/30 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Week Template</span>
                  </button>
                </div>

                {/* 3. Month Template Card */}
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
                  <div className="space-y-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      30-Day Master Template
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Comprehensive 30-day master schedule across all CA Final Group 1 & Group 2 subjects.
                    </p>
                  </div>

                  <button
                    onClick={() => downloadMonthTimetableTemplate(targetDate, 30)}
                    className="mt-4 w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-cyan-500/30 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download 30-Day Template</span>
                  </button>
                </div>
              </div>

              {/* Template Columns Reference */}
              <div className="bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs">
                <p className="font-bold text-slate-200">💡 Standard Column Headers Supported by the App:</p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Date (YYYY-MM-DD)</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Time Range (e.g. 07:00 AM - 09:30 AM)</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Subject / Paper</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Chapter & Topic Details</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Category (STUDY / BREAK)</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Duration (Hrs)</span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">Status (PENDING / COMPLETED)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OUR STRATEGY RECOMMENDATION & VIEW */}
          {activeTab === 'RECOMMENDATIONS' && (
            <div className="space-y-5 text-xs leading-relaxed text-slate-300">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                  <Sparkles className="w-4 h-4" />
                  <span>Strategic View: The "Excel Macro + App Micro" CA Final Formula</span>
                </div>
                <p className="text-slate-200">
                  Many CA Final rankers and serious aspirants face a common dilemma: <em>"Should I maintain my study plan in an Excel sheet, or use an interactive study tracker app?"</em>
                </p>
                <p className="text-slate-200">
                  The most effective answer is a <strong>hybrid workflow</strong>: Plan macro targets in Excel, but execute and track micro-focus through the App!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-cyan-300 text-sm">
                    <span>🗓️ Monthly Planning</span>
                  </div>
                  <p className="text-slate-400">
                    <strong>Rule: Keep it Block-Based, not Minute-by-Minute.</strong> Assign 4-5 day blocks per subject (e.g. Days 1-5 for FR Ind AS, Days 6-10 for AFM Forex). Planning 30 days of rigid 7:00 AM slots in advance usually breaks due to articleship or unexpected topics.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300 text-sm">
                    <span>📅 Weekly Planning</span>
                  </div>
                  <p className="text-slate-400">
                    <strong>The Sweet Spot for Excel Import!</strong> Plan your upcoming 7 days every Sunday evening in Excel. Define exactly which 2 subjects and 2 chapters you will conquer each day, then import it in one click into the app!
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <span>⚡ Daily Execution</span>
                  </div>
                  <p className="text-slate-400">
                    <strong>Let the App Handle Real-World Friction.</strong> If you wake up 30 mins late or get stuck on Ind AS 110 consolidation, use the app's <em>"Shift Schedule"</em> or <em>"Pomodoro Focus Timer"</em> to keep your timetable dynamically aligned without manual recalculation.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 space-y-2">
                <p className="font-bold text-slate-200">🌟 Top 3 Recommendations for Your Custom Timetable:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-300 pl-1">
                  <li><strong>Never skip breaks:</strong> Mark lunch and short tea breaks as <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">BREAK</code> category so the app doesn't count them as study debt.</li>
                  <li><strong>Pair Practical with Theory:</strong> Avoid scheduling 10 hours of pure theory (Audit/DT) on a single day. Alternate between FR/AFM and Audit/IDT for sustained cognitive stamina.</li>
                  <li><strong>Reserve Sunday Night for Retrospective:</strong> Use the Excel Export button at week's end to review your actual completed vs scheduled hours!</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 shrink-0 text-xs">
          <div className="text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Automatic non-overlapping slot alignment & break consolidation enabled</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

function daySchedule(dayObj: any): string {
  if (!dayObj) return '0 Slots';
  return `${dayObj.slots?.length || 0} slots • ${dayObj.totalStudyHours?.toFixed(1) || 0}h`;
}
