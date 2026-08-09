import React, { useState } from 'react';
import { PenTool, CheckCircle, AlertTriangle, RefreshCw, Paperclip, Link as LinkIcon, X } from 'lucide-react';
import { fetchWithRetry } from '../lib/api';

export const AIAnswerEvaluator: React.FC = () => {
  const [answer, setAnswer] = useState('');
  const [subject, setSubject] = useState('FR');
  const [question, setQuestion] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [questionFile, setQuestionFile] = useState<{ base64: string, mimeType: string, name: string } | null>(null);
  const [answerFile, setAnswerFile] = useState<{ base64: string, mimeType: string, name: string } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isQuestion: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const payload = { base64, mimeType: file.type, name: file.name };
      if (isQuestion) setQuestionFile(payload);
      else setAnswerFile(payload);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePasteLink = async (isQuestion: boolean) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (isQuestion) setQuestion(prev => prev + (prev ? '\n' : '') + text);
        else setAnswer(prev => prev + (prev ? '\n' : '') + text);
      }
    } catch (err) {
      const url = prompt("Paste your link here:");
      if (url) {
        if (isQuestion) setQuestion(prev => prev + (prev ? '\n' : '') + url);
        else setAnswer(prev => prev + (prev ? '\n' : '') + url);
      }
    }
  };

  const handleEvaluate = async () => {
    if (!answer.trim() || !question.trim()) return;
    setEvaluating(true);
    try {
      const res = await fetchWithRetry('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, question, answer, questionFile, answerFile })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data.evaluation);
    } catch (e: any) {
      alert('Evaluation failed: ' + e.message);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-3xl border border-violet-500/30 shadow-xl backdrop-blur-2xl">
      <div className="flex items-center gap-3 mb-6 border-b border-violet-500/20 pb-4">
        <div className="w-12 h-12 bg-violet-900/60 rounded-2xl flex items-center justify-center border border-violet-500/40 shadow-lg">
          <PenTool className="w-6 h-6 text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white tracking-wide">AI Answer Evaluation Desk</h2>
          <p className="text-sm text-violet-200/70 font-medium">ICAI Step-Marking Checker ✍️</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 flex flex-col h-[600px]">
          <div className="flex gap-2">
            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="bg-slate-900 border border-violet-500/30 text-violet-100 text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-violet-400"
            >
              <option value="FR">FR</option>
              <option value="AFM">AFM</option>
              <option value="Audit">Audit</option>
              <option value="DT">DT</option>
              <option value="IDT">IDT</option>
            </select>
          </div>
          <div className="relative">
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="Paste the ICAI Question or link here..."
              className="w-full h-32 glass-input text-slate-100 placeholder-slate-400 text-sm rounded-2xl px-4 py-3 pb-12 focus:outline-none resize-none border border-violet-500/30"
            />
            {questionFile && (
              <div className="absolute top-2 right-2 bg-violet-900/60 border border-violet-500/30 px-3 py-1 rounded-lg flex items-center gap-2 text-xs text-violet-200">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{questionFile.name}</span>
                <button onClick={() => setQuestionFile(null)} className="hover:text-orange-400 ml-1"><X className="w-3 h-3" /></button>
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-violet-500/30 rounded-xl text-xs font-medium text-violet-100 cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5" /> Upload File
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, true)} />
              </label>
              <button onClick={() => handlePasteLink(true)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-violet-500/30 rounded-xl text-xs font-medium text-violet-100 cursor-pointer transition-colors">
                <LinkIcon className="w-3.5 h-3.5" /> Paste Link
              </button>
            </div>
          </div>
          <div className="relative flex-1 flex flex-col">
            <textarea
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="Paste your handwritten answer text or link here..."
              className="w-full flex-1 glass-input text-slate-100 placeholder-slate-400 text-sm rounded-2xl px-4 py-3 pb-12 focus:outline-none resize-none border border-violet-500/30"
            />
            {answerFile && (
              <div className="absolute top-2 right-2 bg-violet-900/60 border border-violet-500/30 px-3 py-1 rounded-lg flex items-center gap-2 text-xs text-violet-200">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{answerFile.name}</span>
                <button onClick={() => setAnswerFile(null)} className="hover:text-orange-400 ml-1"><X className="w-3 h-3" /></button>
              </div>
            )}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <label className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-violet-500/30 rounded-xl text-xs font-medium text-violet-100 cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5" /> Upload File
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => handleFileUpload(e, false)} />
              </label>
              <button onClick={() => handlePasteLink(false)} className="flex items-center gap-1 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-violet-500/30 rounded-xl text-xs font-medium text-violet-100 cursor-pointer transition-colors">
                <LinkIcon className="w-3.5 h-3.5" /> Paste Link
              </button>
            </div>
          </div>
          <button
            onClick={handleEvaluate}
            disabled={evaluating || (!answer.trim() && !answerFile) || (!question.trim() && !questionFile)}
            className="nature-button text-white w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer shadow-lg"
          >
            {evaluating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            <span>Evaluate Answer</span>
          </button>
        </div>

        <div className="glass-card rounded-2xl border border-violet-500/20 p-5 overflow-y-auto h-[600px] bg-slate-950/40">
          {result ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center bg-violet-950/60 p-4 rounded-xl border border-violet-500/30">
                <span className="font-bold text-violet-200">Estimated Score</span>
                <span className="text-2xl font-black text-amber-300">{result.score} <span className="text-sm text-violet-200/50">/ {result.total}</span></span>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-violet-500/20">
                <h3 className="font-bold text-amber-200 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> Keywords & Sections Missed</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  {result.missedKeywords?.map((kw: string, i: number) => (
                    <li key={i}>{kw}</li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-violet-500/20">
                <h3 className="font-bold text-violet-300 mb-2">Piyaa's Feedback</h3>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">{result.feedback}</p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
              <PenTool className="w-12 h-12 opacity-20" />
              <p className="text-center px-4">Submit your answer to get step-by-step evaluation, missing keywords, and Piyaa's feedback.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
