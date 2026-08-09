import { getISTTimeString } from "../lib/dateUtils";
import React, { useState, useRef, useEffect } from 'react';
import { Send, Heart, Link, Paperclip, Volume2, Sparkles, RefreshCw, Smile, BookOpen, Coffee, Globe, X, Target, Calendar, FileText, CheckCircle2, Flame, Award, Maximize2, ShieldCheck, Zap } from 'lucide-react';
import { ChatMessage } from '../types';
import { useStore } from '../store';
import { fetchWithRetry } from '../lib/api';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

interface CompanionChatProps {
  targetStudyHours?: number;
  currentSubject?: string;
  onTimetableRequest?: () => void;
  onNavigateTab?: (tab: string) => void;
  isFullPage?: boolean;
  studyHoursToday?: number;
  isStrictMode?: boolean;
}

export const CompanionChat: React.FC<CompanionChatProps> = ({
  currentSubject,
  onTimetableRequest,
  onNavigateTab,
  isFullPage = false,
  studyHoursToday = 4.5,
  isStrictMode = false,
}) => {
  // Global Store Access
  const subjects = useStore((state) => state.subjects);
  const timetable = useStore((state) => state.timetable);
  const targetStudyHours = useStore((state) => state.targetStudyHours);
  const chatMessages = useStore((state) => state.chatMessages);
  const setChatMessages = useStore((state) => state.setChatMessages);
  const userInstructions = useStore((state) => state.userInstructions);
  const setUserInstructions = useStore((state) => state.setUserInstructions);
  const clearChatHistory = useStore((state) => state.clearChatHistory);

  // Live Preparation Metrics Calculations
  const totalChapters = subjects.reduce((acc, s) => acc + s.topics.length, 0);
  const completedChapters = subjects.reduce((acc, s) => acc + s.topics.filter((t) => t.completed).length, 0);
  const completionPercent = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
  const activeSubjectObj = subjects.find((s) => s.id === currentSubject) || subjects[0];
  
  // Sorted weak subjects
  const sortedWeakSubjects = [...subjects].sort((a, b) => {
    const aRatio = a.topics.length > 0 ? a.completedChapters / a.topics.length : 0;
    const bRatio = b.topics.length > 0 ? b.completedChapters / b.topics.length : 0;
    return aRatio - bRatio;
  });

  // Ensure initial welcome message exists if chat history is empty
  useEffect(() => {
    if (!chatMessages || chatMessages.length === 0) {
      const initMsg: ChatMessage = {
        id: 'init-1',
        role: 'assistant',
        content: `Konnichiwa My love! 💕✨ Main aapki Piyaa (पिया) hu! Main hamesha aapke sath hu aapke CA Final ke is safar mein.\n\nAapki live prep update mujhe mil rahi hai:\n• Overall Completion: ${completionPercent}%\n• Today's Logged Study: ${studyHoursToday}h / ${targetStudyHours}h\n• Active Subject: ${activeSubjectObj?.name || 'Financial Reporting'}\n\nAaj konse Ind AS / Section concept ya question par milkar kaam karein?`,
        timestamp: getISTTimeString(),
      };
      setChatMessages([initMsg]);
    }
  }, [chatMessages]);

  const fallbackMessages: ChatMessage[] = [
    {
      id: 'init-1',
      role: 'assistant',
      content: `Konnichiwa My love! 💕✨ Main aapki Piyaa (पिया) hu! Main hamesha aapke sath hu aapke CA Final ke is safar mein.\n\nAapki live prep update mujhe mil rahi hai:\n• Overall Completion: ${completionPercent}%\n• Today's Logged Study: ${studyHoursToday}h / ${targetStudyHours}h\n• Active Subject: ${activeSubjectObj?.name || 'Financial Reporting'}\n\nAaj konse Ind AS / Section concept ya question par milkar kaam karein?`,
      timestamp: getISTTimeString(),
    },
  ];

  const messages: ChatMessage[] = chatMessages && chatMessages.length > 0 ? chatMessages : fallbackMessages;

  const setMessages = (updater: any) => {
    if (typeof updater === 'function') {
      setChatMessages(updater);
    } else {
      setChatMessages(updater);
    }
  };

  const [input, setInput] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('Normal');
  const [isLoading, setIsLoading] = useState(false);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [icaiExamMode, setIcaiExamMode] = useState(false);
  const [ragScope, setRagScope] = useState<'local' | 'web'>('local');
  const [attachment, setAttachment] = useState<{ name: string; base64: string; mimeType: string } | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Context-Aware Quick Action Handlers
  const quickActions = [
    {
      label: "📅 Optimize Today's Schedule",
      icon: Calendar,
      color: "from-amber-500 to-mentor-600",
      prompt: `Piyaa, meri aaj ki padhai optimize kar do! Target ${targetStudyHours} hours, active subject (${activeSubjectObj?.name || 'Financial Reporting'}), aur logged ${studyHoursToday} hours ke hisaab se best strategy aur slots suggest karo.`,
    },
    {
      label: "⚠️ Quiz Me on Weak Chapters",
      icon: Target,
      color: "from-red-500 to-amber-600",
      prompt: `Piyaa, mere weak subject (${sortedWeakSubjects[0]?.name || 'Audit/DT'}) par 3 targeted ICAI exam-style concept questions pucho aur step-marking format mein evaluate karna!`,
    },
    {
      label: "📊 Analyze My MTP Progress",
      icon: Award,
      color: "from-blue-500 to-indigo-600",
      prompt: `Piyaa, meri overall syllabus completion (${completionPercent}%, ${completedChapters}/${totalChapters} chapters) aur RTP/MTP readiness analyze kar ke actionable tips do.`,
    },
    {
      label: "📝 Evaluate My CA Answer",
      icon: FileText,
      color: "from-purple-500 to-pink-600",
      action: () => {
        handleSend("Piyaa, main aapko ek answer evaluating for CA Final share kar raha hu. Strictly ICAI 3-step guidelines apply karna!");
      },
      prompt: `Piyaa, main aapko ek answer evaluating for CA Final share kar raha hu. Strictly ICAI 3-step guidelines apply karna!`,
    },
    {
      label: "🔍 Search ICAI BoS Portal",
      icon: Globe,
      color: "from-mentor-alt-500 to-mentor-600",
      action: () => {
        setRagScope('web');
        handleSend("Piyaa, ICAI BoS Knowledge Portal se latest CA Final RTP, MTP, aur statutory amendments search kar ke key updates summary do.");
      },
      prompt: `Piyaa, ICAI BoS Knowledge Portal se latest CA Final RTP, MTP, aur statutory amendments search kar ke key updates summary do.`,
    },
    {
      label: "💖 Daily Piyaa Love Note & Pep Talk",
      icon: Heart,
      color: "from-pink-500 to-rose-600",
      prompt: "Piyaa, mujhe padhai ke liye ek pyaara sa motivational love note do!",
    },
  ];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setAttachment({ base64, mimeType: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePasteLink = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput((prev) => prev + (prev ? '\n' : '') + text);
      }
    } catch {
      const url = prompt("Paste your link here:");
      if (url) {
        setInput((prev) => prev + (prev ? '\n' : '') + url);
      }
    }
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if ((!text.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: getISTTimeString(),
      mood: selectedMood !== 'Normal' ? selectedMood : undefined,
      attachment: attachment || undefined,
    };

    setMessages((prev) => {
      // Avoid duplicate user message if retrying
      const last = prev[prev.length - 1];
      if (last && last.role === 'user' && last.content === text) {
        return prev;
      }
      return [...prev, userMsg];
    });

    if (!textToSend) setInput('');
    setAttachment(null);
    setIsLoading(true);

    try {
      const response = await fetchWithRetry('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content, attachment: m.attachment })),
          userMood: selectedMood,
          currentSubject: activeSubjectObj?.name || currentSubject,
          icaiExamMode,
          ragScope,
          userInstructions: userInstructions || undefined,
          userPrepStats: {
            completionPercent,
            todayHours: studyHoursToday,
            targetHours: targetStudyHours,
            completedChapters,
            totalChapters,
            currentSubject: activeSubjectObj?.name || currentSubject,
            weakSubjects: sortedWeakSubjects.slice(0, 3).map((s) => s.name),
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get companion reply');

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        sources: data.sources,
        timestamp: getISTTimeString(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Chat error after retries:', err);
      const isRateOrServerOrTimeout = 
        err.message?.includes('429') || 
        err.message?.includes('500') || 
        err.message?.toLowerCase().includes('timeout') ||
        err.message?.includes('status 429') ||
        err.message?.includes('status 500');
      
      const fallbackContent = isRateOrServerOrTimeout
        ? "My love, AI is taking a quick breath. Try again in 5 seconds! ✨"
        : "Aapki Piyaa hamesha aapke paas hai babu! Network me thoda sa delay tha, par maine aapka message save kar liya hai. Dobara click karke easily send kar lijiye! 💕✨";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: fallbackContent,
          timestamp: getISTTimeString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Convert raw 24kHz 16-bit PCM base64 to WAV blob for HTML5 Audio playback
  const playPcmAudio = (base64Pcm: string, msgId: string) => {
    try {
      const binaryStr = atob(base64Pcm);
      const len = binaryStr.length;
      const pcmBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        pcmBytes[i] = binaryStr.charCodeAt(i);
      }

      const sampleRate = 24000;
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
      const blockAlign = (numChannels * bitsPerSample) / 8;
      const dataSize = pcmBytes.length;
      const chunkSize = 36 + dataSize;

      const wavBuffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(wavBuffer);

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, chunkSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      const wavUint8 = new Uint8Array(wavBuffer);
      wavUint8.set(pcmBytes, 44);

      const blob = new Blob([wavUint8], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      setPlayingAudioId(msgId);
      audio.play();

      audio.onended = () => {
        setPlayingAudioId(null);
      };
    } catch (e) {
      console.error('Audio playback error:', e);
      setPlayingAudioId(null);
    }
  };

  const handleListenVoiceNote = async (msg: ChatMessage) => {
    if (playingAudioId === msg.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }

    if (msg.audioBase64) {
      playPcmAudio(msg.audioBase64, msg.id);
      return;
    }

    setTtsLoadingId(msg.id);
    try {
      const res = await fetchWithRetry('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.content.substring(0, 300) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TTS failed');

      msg.audioBase64 = data.audio;
      playPcmAudio(data.audio, msg.id);
    } catch (e) {
      console.error(e);
      alert('Voice note generation error. Piyaa ki aawaz abhi load nahi ho saki.');
    } finally {
      setTtsLoadingId(null);
    }
  };

  // Render Full Command Center Layout (for main page view) vs Compact Overlay
  return (
    <div className={`w-full text-slate-100 ${isFullPage ? 'space-y-6' : 'h-full flex flex-col bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-mentor-500/30'}`}>
      
      {/* FULL-PAGE HEADER BANNER (Only when rendered as main page tab) */}
      {isFullPage && (
        <div className={`glass-panel p-5 sm:p-6 rounded-3xl border border-mentor-500/30 bg-gradient-to-r from-slate-950 via-mentor-950/40 to-slate-950 shadow-2xl relative overflow-hidden`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-mentor-400 via-mentor-alt-300 to-amber-300 p-0.5 shadow-lg shadow-mentor-500/40`}>
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl sm:text-3xl">
                    🌸
                  </div>
                </div>
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 bg-mentor-400 border-2 border-slate-950 rounded-full animate-pulse shadow-[0_0_10px_#34d399]`} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight nature-gradient-text drop-shadow">
                    ✨ Piyaa AI Study Command Center
                  </h2>
                  <span className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-mentor-500/20 text-mentor-300 border border-mentor-400/30`}>
                    Live Context Active
                  </span>
                </div>
                <p className={`text-xs sm:text-sm text-mentor-100/90 font-medium mt-0.5`}>
                  Interactive CA Final Doubt Solver & Personalized Real-Time AI Mentor
                </p>
              </div>
            </div>

            {/* Quick Live Stats Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className={`glass-card px-3 py-1.5 rounded-xl border border-mentor-500/30 flex items-center gap-1.5`}>
                <Target className="w-3.5 h-3.5 text-amber-300" />
                <span className="text-slate-300">Syllabus:</span>
                <span className={`font-extrabold text-mentor-300`}>{completionPercent}%</span>
              </div>

              <div className={`glass-card px-3 py-1.5 rounded-xl border border-mentor-500/30 flex items-center gap-1.5`}>
                <Coffee className={`w-3.5 h-3.5 text-mentor-alt-300`} />
                <span className="text-slate-300">Today:</span>
                <span className={`font-extrabold text-mentor-alt-200`}>{studyHoursToday}h / {targetStudyHours}h</span>
              </div>

              <div className={`glass-card px-3 py-1.5 rounded-xl border border-mentor-500/30 flex items-center gap-1.5`}>
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300">Streak:</span>
              </div>

              {onTimetableRequest && (
                <button
                  onClick={onTimetableRequest}
                  className={`glass-card px-3 py-1.5 rounded-xl border border-mentor-400/40 hover:bg-mentor-900/40 text-mentor-200 hover:text-white transition-all font-bold cursor-pointer flex items-center gap-1.5`}
                >
                  <Calendar className={`w-3.5 h-3.5 text-mentor-400`} />
                  <span>Timetable Planner</span>
                </button>
              )}

              <button
                onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                className={`glass-card px-3 py-1.5 rounded-xl border ${isInstructionsOpen ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-mentor-400/40 hover:bg-mentor-900/40 text-mentor-200 hover:text-white'} transition-all font-bold cursor-pointer flex items-center gap-1.5`}
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                <span>System Memory & Instructions {userInstructions ? '• Active' : ''}</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Clear chat history saved in IndexedDB?")) {
                    clearChatHistory();
                  }
                }}
                className={`glass-card px-3 py-1.5 rounded-xl border border-red-500/30 hover:bg-red-950/40 text-red-300 transition-all font-bold cursor-pointer flex items-center gap-1.5 text-xs`}
                title="Clear IndexedDB Chat History"
              >
                <RefreshCw className="w-3.5 h-3.5 text-red-400" />
                <span>Clear Chat</span>
              </button>
            </div>
          </div>

          {/* User Instructions & System Memory Persistent Panel */}
          {isInstructionsOpen && (
            <div className="mt-4 p-4 rounded-2xl border border-amber-500/40 bg-slate-900/95 shadow-2xl backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <div>
                    <h4 className="font-extrabold text-sm text-amber-200">
                      User Instructions & System Memory (Strict IndexedDB Persistence)
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Rules entered here are stored permanently in IndexedDB and sent with all Piyaa AI requests.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsInstructionsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <textarea
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  placeholder="Enter custom instructions or system rules (e.g., 'Study Timer MUST run continuously in background without auto-pausing', 'Never place two consecutive breaks', 'Prefer Hinglish companion tone', etc.)"
                  className="w-full h-28 p-3 bg-slate-950 border border-amber-500/30 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Quick Rule Presets:</span>
                  <button
                    onClick={() => {
                      const rule = "• Study Timer MUST run continuously in background on Windows/Android without auto-pausing.";
                      setUserInstructions(userInstructions ? `${userInstructions}\n${rule}` : rule);
                    }}
                    className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer text-[11px]"
                  >
                    + Background Timer Rule
                  </button>
                  <button
                    onClick={() => {
                      const rule = "• NEVER place two break slots consecutively in AI timetables.";
                      setUserInstructions(userInstructions ? `${userInstructions}\n${rule}` : rule);
                    }}
                    className="px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 cursor-pointer text-[11px]"
                  >
                    + No Consecutive Breaks
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-400 font-semibold">Saved in IndexedDB</span>
                  <button
                    onClick={() => setIsInstructionsOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-mentor-600 text-slate-950 font-bold hover:brightness-110 cursor-pointer text-xs shadow-md"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WORKSPACE GRID: 2 Columns on Desktop in Full Mode */}
      <div className={isFullPage ? 'grid grid-cols-1 lg:grid-cols-12 gap-6' : 'flex-1 flex flex-col h-full overflow-hidden'}>
        
        {/* LEFT COLUMN: Live Prep Intelligence & Quick Command Bar (Full Mode Only) */}
        {isFullPage && (
          <div className="lg:col-span-4 space-y-4">
            
            {/* 1. Live Student Prep Intelligence Card */}
            <div className={`glass-panel p-4 sm:p-5 rounded-2xl border border-mentor-500/30 bg-slate-900/80 shadow-xl space-y-4`}>
              <div className={`flex items-center justify-between border-b border-mentor-500/20 pb-2.5`}>
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`w-4 h-4 text-mentor-400`} />
                  <h3 className={`font-bold text-sm text-mentor-200`}>Live Student Context</h3>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Synced</span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1 font-semibold">
                    <span>Syllabus Completion</span>
                    <span className={`text-mentor-300 font-bold`}>{completedChapters} / {totalChapters} Ch. ({completionPercent}%)</span>
                  </div>
                  <div className={`w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-mentor-500/20`}>
                    <div
                      className={`h-full bg-gradient-to-r from-mentor-500 via-mentor-alt-400 to-amber-400 transition-all duration-500`}
                      style={{ width: `${Math.min(100, completionPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className={`glass-card p-2.5 rounded-xl border border-mentor-500/20`}>
                    <p className="text-[10px] text-slate-400 font-medium">Logged Today</p>
                    <p className={`text-base font-black text-mentor-300 mt-0.5`}>{studyHoursToday} hrs</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Target: {targetStudyHours} hrs</p>
                  </div>

                  <div className={`glass-card p-2.5 rounded-xl border border-mentor-500/20`}>
                    <p className="text-[10px] text-slate-400 font-medium">Active Focus</p>
                    <p className="text-xs font-bold text-amber-200 truncate mt-0.5">{activeSubjectObj?.name || 'Financial Reporting'}</p>
                  </div>
                </div>

                {sortedWeakSubjects.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] uppercase font-bold text-amber-400/90 mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" /> Recommended Priority Subject:
                    </p>
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-500/30 text-amber-200 font-bold text-xs">
                      {sortedWeakSubjects[0].name} ({sortedWeakSubjects[0].completedChapters}/{sortedWeakSubjects[0].topics.length} completed)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Context-Aware Quick Commands */}
            <div className={`glass-panel p-4 rounded-2xl border border-mentor-500/30 bg-slate-900/80 shadow-xl space-y-2.5`}>
              <p className={`text-xs font-bold text-mentor-300 flex items-center gap-1.5 uppercase tracking-wider`}>
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>Context-Aware Quick Actions</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {quickActions.map((qa, idx) => {
                  const Icon = qa.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        if (qa.action) qa.action();
                        else handleSend(qa.prompt);
                      }}
                      className={`w-full glass-card p-2.5 rounded-xl border border-mentor-500/20 hover:border-mentor-400/50 hover:bg-mentor-900/40 transition-all text-left flex items-center gap-2.5 cursor-pointer group min-h-[44px]`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${qa.color} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-bold text-slate-200 group-hover:text-white">{qa.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. AI Personality & ICAI Exam Mode Controls */}
            <div className={`glass-panel p-4 rounded-2xl border border-mentor-500/30 bg-slate-900/80 shadow-xl space-y-3 text-xs`}>
              <p className={`font-bold text-mentor-300 flex items-center gap-1.5`}>
                <Smile className="w-4 h-4 text-amber-300" />
                <span>AI Tutor Personality & ICAI Controls</span>
              </p>

              {/* Mood Selector */}
              <div>
                <label className="text-[11px] text-slate-400 font-semibold mb-1 block">Select Mood / Mindset:</label>
                <div className="flex flex-wrap gap-1.5">
                  {['Normal', 'Stressed 😫', 'Motivated ⚡', 'Tired 😴', 'Confused ❓', 'Romantic 🥰'].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setSelectedMood(m);
                        if (m !== 'Normal') {
                          handleSend(`Piyaa, I am feeling ${m} right now.`);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer font-bold ${
                        selectedMood === m
                          ? 'bg-gradient-to-r from-mentor-500 to-mentor-alt-600 text-white shadow-md'
                          : 'bg-slate-950 border border-mentor-500/20 text-slate-300 hover:text-white'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode Toggles */}
              <div className={`space-y-2 pt-1 border-t border-mentor-500/20`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">ICAI 3-Step Presentation Mode</span>
                  <button
                    onClick={() => setIcaiExamMode(!icaiExamMode)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                      icaiExamMode ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${icaiExamMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">Google Search Grounding (Web)</span>
                  <button
                    onClick={() => setRagScope(ragScope === 'web' ? 'local' : 'web')}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                      ragScope === 'web' ? 'bg-mentor-500' : 'bg-slate-800'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${ragScope === 'web' ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* RIGHT COLUMN / MAIN PANEL: Interactive Doubt Solver Workspace */}
        <div className={isFullPage ? 'lg:col-span-8 flex flex-col h-[700px] sm:h-[750px] bg-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-mentor-500/30' : 'flex-1 flex flex-col h-full overflow-hidden'}>
          
          {/* Top Bar for Chat */}
          <div className={`bg-slate-900 px-4 sm:px-5 py-3 border-b border-mentor-500/25 flex items-center justify-between`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-mentor-400 via-mentor-alt-300 to-white/90 p-0.5 shadow-md shadow-mentor-500/40`}>
                  <div className={`w-full h-full bg-mentor-950/90 rounded-xl flex items-center justify-center text-xl sm:text-2xl`}>
                    🌸
                  </div>
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 bg-mentor-400 border-2 border-slate-900 rounded-full`} />
              </div>
              <div className="min-w-0">
                <div className={`font-extrabold text-mentor-100 text-sm sm:text-base flex items-center gap-2 truncate`}>
                  <span className="nature-gradient-text">Piyaa</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-mentor-500/20 text-mentor-300 border border-mentor-400/30`}>
                    {ragScope === 'web' ? '🌐 Web Search Enabled' : '📚 ICAI Mat Mode'}
                  </span>
                </div>
                <div className={`text-[11px] text-mentor-200/80 flex items-center gap-2 font-medium truncate`}>
                  <span className="truncate">Active Subject: {activeSubjectObj?.name || 'Financial Reporting'}</span>
                </div>
              </div>
            </div>

            {/* Action buttons on top bar */}
            <div className="flex items-center gap-2 shrink-0">
              {!isFullPage && onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('chat')}
                  className={`text-xs bg-mentor-900/60 hover:bg-mentor-800 border border-mentor-400/40 text-mentor-200 hover:text-white px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer font-bold`}
                  title="Enlarge to Full Command Center"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Enlarge</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact Mood Bar for Overlay View */}
          {!isFullPage && (
            <div className={`bg-slate-950/80 px-4 py-2 border-b border-mentor-500/20 flex items-center gap-2 overflow-x-auto text-xs scrollbar-none`}>
              <span className={`text-mentor-300 font-semibold flex items-center gap-1 whitespace-nowrap`}>
                <Smile className="w-3.5 h-3.5" /> Mood:
              </span>
              {['Normal', 'Stressed 😫', 'Motivated ⚡', 'Tired 😴', 'Confused ❓'].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMood(m);
                    if (m !== 'Normal') {
                      handleSend(`Piyaa, I am feeling ${m} right now.`);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer font-medium text-[11px] ${
                    selectedMood === m
                      ? (isStrictMode ? 'strict-button' : 'mentor-button') + ' text-white font-bold shadow-md'
                      : 'bg-slate-800 border border-mentor-400/30 text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          {/* Message History */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-mentor-900/50`}>
            {messages.filter(msg => msg && msg.content && msg.content.trim() !== '').map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group`}
              >
                <div className="flex items-end gap-2 max-w-[90%] sm:max-w-[80%]">
                  {msg.role === 'assistant' && (
                    <div className={`w-8 h-8 rounded-2xl bg-gradient-to-tr from-mentor-500 to-mentor-alt-500 flex items-center justify-center text-base shrink-0 border border-mentor-300/40 shadow-md mb-1`}>
                      🌸
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                      msg.role === 'user'
                        ? (isStrictMode ? 'strict-button' : 'mentor-button') + ' text-white rounded-br-none border border-mentor-400/30'
                        : 'bg-slate-800/90 border border-mentor-400/30 text-mentor-50 rounded-bl-none'
                    }`}
                  >
                    {msg.mood && (
                      <div className={`text-[10px] uppercase font-bold text-mentor-300 mb-1 opacity-90`}>
                        Mood: {msg.mood}
                      </div>
                    )}
                    <div className="markdown-body text-sm leading-relaxed whitespace-pre-wrap">
                      <Markdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </Markdown>
                    </div>

                    {msg.attachment && (
                      <div className={`mt-2 flex items-center gap-2 bg-black/30 rounded-lg p-2 text-xs border border-mentor-500/20`}>
                        <Paperclip className={`w-3.5 h-3.5 text-mentor-400`} />
                        <span className="truncate max-w-[180px] font-semibold">{msg.attachment.name}</span>
                      </div>
                    )}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {msg.sources.map((s, idx) => (
                          <div key={idx}>
                            {s.isLocal ? (
                              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-mentor-950/80 border border-mentor-500/40 rounded-full text-[10px] text-mentor-200 shadow-sm`}>
                                <span className={`w-1.5 h-1.5 rounded-full bg-mentor-400 animate-pulse`}></span>
                                <span className="font-bold">Source: {s.title}</span>
                              </div>
                            ) : (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-mentor-500/30 rounded-full text-[10px] text-mentor-300 hover:text-mentor-200 hover:bg-slate-800 transition-colors max-w-[250px] truncate`}
                              >
                                <Globe className={`w-3 h-3 text-mentor-400 shrink-0`} />
                                <span className="truncate">Web Source: {s.title}</span>
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Assistant Audio Voice Note Button */}
                    {msg.role === 'assistant' && (
                      <div className={`mt-2.5 pt-2 border-t border-mentor-500/20 flex items-center justify-between gap-3 text-xs`}>
                        <button
                          onClick={() => handleListenVoiceNote(msg)}
                          disabled={ttsLoadingId === msg.id}
                          className={`flex items-center gap-1.5 text-mentor-200 hover:text-amber-200 bg-mentor-950/80 hover:bg-mentor-900 px-2.5 py-1 rounded-xl border border-mentor-500/30 transition-all cursor-pointer font-bold`}
                        >
                          {ttsLoadingId === msg.id ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                              <span>Generating Voice...</span>
                            </>
                          ) : playingAudioId === msg.id ? (
                            <>
                              <span className={`w-2 h-2 rounded-full bg-mentor-400 animate-ping`} />
                              <span className="font-bold text-amber-300">Playing Voice Note 🔊</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className={`w-3.5 h-3.5 text-mentor-400`} />
                              <span>Listen Piyaa's Voice 🎧</span>
                            </>
                          )}
                        </button>

                        <span className="text-[10px] text-slate-400 font-medium">{msg.timestamp}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className={`flex items-center gap-3 text-mentor-200 text-xs bg-slate-800/90 border border-mentor-400/40 p-3 rounded-2xl w-fit shadow-lg`}>
                <div className={`w-7 h-7 rounded-xl bg-mentor-600/80 flex items-center justify-center text-xs animate-pulse`}>
                  🌸
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">Piyaa typing answer for My love...</span>
                  <span className={`inline-block w-1.5 h-1.5 bg-mentor-400 rounded-full animate-ping`} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <div className={`p-3 sm:p-4 bg-slate-950/95 border-t border-mentor-500/30 flex items-center gap-2`}>
            <button
              onClick={handlePasteLink}
              className={`p-2.5 text-mentor-400 hover:text-white bg-slate-900 hover:bg-mentor-900/60 rounded-xl border border-mentor-500/30 transition-all cursor-pointer shadow-sm`}
              title="Paste Clipboard Text or Link"
            >
              <Link className="w-4 h-4" />
            </button>

            <label
              className={`p-2.5 text-mentor-400 hover:text-white bg-slate-900 hover:bg-mentor-900/60 rounded-xl border border-mentor-500/30 transition-all cursor-pointer shadow-sm flex items-center justify-center`}
              title="Upload Question / Notes Document or Image"
            >
              <Paperclip className="w-4 h-4" />
              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
            </label>

            <div className="flex-1 relative flex items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask Piyaa any doubt, Ind AS section, tax formula, or study strategy..."
                rows={1}
                className={`w-full bg-slate-900 border border-mentor-400/30 text-slate-100 placeholder-slate-400 text-xs sm:text-sm rounded-2xl px-3.5 py-2.5 focus:outline-none focus:border-mentor-400 transition-all resize-none`}
              />
              {attachment && (
                <div className={`absolute right-2 top-1/2 -translate-y-1/2 bg-mentor-900/80 border border-mentor-500/30 px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs text-mentor-200`}>
                  <Paperclip className="w-3 h-3" />
                  <span className="truncate max-w-[80px]">{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="hover:text-orange-400 ml-1">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachment) || isLoading}
              className={(isStrictMode ? "strict-button" : "mentor-button") + " text-white p-3 rounded-2xl disabled:opacity-50 transition-all shadow-lg cursor-pointer flex items-center justify-center shrink-0 min-w-[44px]"}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
