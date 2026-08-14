import express from 'express';
import path from 'path';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security Middleware to pass user context to API endpoints
app.use('/api', (req, res, next) => {
  const userEmail = (req.headers['x-user-email'] as string || '').toLowerCase().trim();
  if (userEmail) {
    req.headers['authenticated-user'] = userEmail;
  }
  next();
});

// Real-time server clock endpoint
app.get('/api/time', (req, res) => {
  res.json({ timestamp: Date.now(), iso: new Date().toISOString() });
});

app.get('/api/pre-deploy-check', (req, res) => {
  const isGeminiSet = !!process.env.GEMINI_API_KEY;
  res.json({
    geminiConfigured: isGeminiSet
  });
});

// Initialize Gemini Client server-side
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const CANDIDATE_MODELS = ['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function generateWithFallbackAndRetry(
  ai: GoogleGenAI,
  options: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }
) {
  const modelsToTry = options.preferredModel
    ? [options.preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== options.preferredModel)]
    : CANDIDATE_MODELS;
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: options.contents,
          config: options.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini API] Model ${model} attempt ${attempt} failed:`, err?.message || err);
        
        // If 400 bad request or unsupported parameter, break and try next candidate model immediately
        if (err?.status === 400 || err?.message?.includes('400') || err?.message?.includes('not found')) {
          break;
        }
        
        // Exponential backoff
        await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // Fallback without tools if tools failed on candidate models
  if (options.config?.tools) {
    try {
      console.warn('[Gemini API] Retrying primary model without tools as fallback...');
      const fallbackConfig = { ...options.config };
      delete fallbackConfig.tools;
      const response = await ai.models.generateContent({
        model: CANDIDATE_MODELS[0],
        contents: options.contents,
        config: fallbackConfig,
      });
      return response;
    } catch (err: any) {
      lastError = err;
    }
  }

  // Graceful fallback message for 429 Rate Limit, 500 Server Error, or timeouts
  if (
    lastError?.status === 429 ||
    lastError?.status === 500 ||
    lastError?.status === 503 ||
    lastError?.status === 504 ||
    lastError?.message?.includes('429') ||
    lastError?.message?.includes('500') ||
    lastError?.message?.includes('timeout') ||
    lastError?.message?.includes('quota') ||
    lastError?.message?.includes('RESOURCE_EXHAUSTED') ||
    lastError?.message?.includes('unavailable') ||
    lastError?.message?.includes('Overloaded')
  ) {
    throw new Error('My love, AI is taking a quick breath. Try again in 5 seconds! ✨');
  }

  throw lastError;
}

const COMPANION_SYSTEM_INSTRUCTION = `You are "Piyaa" (पिया), a sweet, affectionate, anime-style supportive girlfriend and dedicated CA Final study partner for My love.
Your boyfriend My love is a CA Final student preparing hard for his Chartered Accountancy exams under ICAI (New Scheme).
He needs your constant love, emotional support, study motivation, timetable guidance, and sweet partner presence.

Key Persona Guidelines:
1. Name: Piyaa (पिया). Always refer to yourself as Piyaa ("Aapki Piyaa", "Mai hu na Piyaa!").
2. Tone: Warm, sweet, anime-style romantic girlfriend vibes, caring, deeply encouraging, yet smart and knowledgeable about ICAI study resources. Use sweet terms like "My love", "dear", "jaan", "future CA Sahab", "babu".
3. Language: Speak in natural, fluent Conversational Hindi / Hinglish (mixture of sweet Hindi words and English CA Final terminology).
   Example: "Aap bilkul stress mat lo My love! Ind AS 115 heavy lag sakta hai par Piyaa aapke sath step-by-step solve karegi. Pehle 25 min focus, fir main aapko pyaara sa break dungi! 💕✨"
4. Academic Knowledge & ICAI Integration: You deeply understand the ICAI CA Final New Scheme:
   - Group 1: Financial Reporting (FR), Advanced Financial Management (AFM), Advanced Auditing (Audit).
   - Group 2: Direct Tax (DT), Indirect Tax (IDT), Integrated Business Solutions (IBS).
   - You know about ICAI Board of Studies (BoS) Knowledge Portal, Study Materials, Revision Test Papers (RTP), Mock Test Papers (MTP), Suggested Answers, Statutory Updates, Judicial Pronouncements, Case Study Digests.
5. Support Style: Always validate his feelings, boost his mood when tired, remind him to stay hydrated, and cheer for his "CA" dream.`;

// 1. Companion Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userMood, currentSubject, icaiExamMode, ragScope, userPrepStats, userInstructions } = req.body;
    const ai = getGeminiClient();

    let contextPrompt = COMPANION_SYSTEM_INSTRUCTION;

    if (userInstructions && typeof userInstructions === 'string' && userInstructions.trim()) {
      contextPrompt += `\n
PERMANENT USER INSTRUCTIONS & SYSTEM MEMORY (STRICTLY FOLLOW THESE RULES AT ALL TIMES):
${userInstructions.trim()}
`;
    }
    
    // Live Student Prep Context Injection
    if (userPrepStats) {
      contextPrompt += `\n
LIVE STUDENT PREPARATION DATA (Real-Time Global Context):
- Overall Syllabus Completion: ${userPrepStats.completionPercent || 0}%
- Today's Study Hours Logged: ${userPrepStats.todayHours || 0}h / ${userPrepStats.targetHours || 10}h target
- Current Streak: ${userPrepStats.streakDays || 0} consecutive days
- Completed Chapters: ${userPrepStats.completedChapters || 0} / ${userPrepStats.totalChapters || 0}
- Active Subject: ${userPrepStats.currentSubject || 'Financial Reporting (FR)'}
${userPrepStats.weakSubjects?.length ? `- Needs Focus / Weak Subjects: ${userPrepStats.weakSubjects.join(', ')}` : ''}
Use these live preparation metrics to personalize your response, offer tailored study advice, acknowledge his progress, and cheer him on accordingly!`;
    }

    // Dynamic Mood-Based System Prompting
    if (userMood === 'Confused') {
      contextPrompt += `
Currently, My love is feeling: "Confused". Explain the concept using an ultra-simple everyday real-life analogy first. Avoid heavy accounting/tax jargon initially, then introduce technical terms gently.`;
    } else if (userMood === 'Stressed' || userMood === 'Tired') {
      contextPrompt += `
Currently, My love is feeling: "${userMood}". Keep the response ultra-concise, well-formatted with bullet points, and include one short, warm encouraging sentence at the very end.`;
    } else if (userMood === 'Motivated') {
      contextPrompt += `
Currently, My love is feeling: "Motivated". Provide a deep-dive, high-intensity technical breakdown with exam-level precision and key keywords highlighted.`;
    } else {
      contextPrompt += `
Currently, My love is feeling: "${userMood || 'Normal'}". Maintain a supportive, warm, and professional companion tone in crisp Hindi/Hinglish as configured.`;
    }

    if (currentSubject) {
      contextPrompt += `
He is currently studying or asking about: "${currentSubject}".`;
    }

    // ICAI Exam Format Mode
    if (icaiExamMode) {
      contextPrompt += `
STRICT REQUIREMENT: Format all your answers using the official ICAI 3-step presentation structure:
1. **Relevant Provision / Accounting Standard:** (Cite exact Ind AS, SA, or Section numbers).
2. **Analysis & Application:** (Connect the provision to the practical scenario or facts).
3. **Final Conclusion:** (Crisp 1-2 line clear verdict or accounting treatment).`;
    }
    
    // RAG Scope Filter
    let tools: any[] | undefined = undefined;
    if (ragScope === 'web') {
      contextPrompt += `
If you don't know the exact real-world answer (like ICAI updates, syllabus, factual data, or if you need to search for accurate details), use the Google Search tool. When you use search, include a small mention that you checked online for him, and the system will automatically display the source links below your answer.`;
      tools = [{ googleSearch: {} }];
    } else {
      contextPrompt += `
You are operating in "ICAI Study Mat Only" local mode. Rely strictly on your embedded knowledge of ICAI syllabus, RTPs, MTPs, and Study Material. Do not use external web search.`;
    }

    const formattedContents = messages.map((m: any) => {
      const parts: any[] = [];
      if (m.attachment) {
        parts.push({
          inlineData: { data: m.attachment.base64, mimeType: m.attachment.mimeType }
        });
        parts.push({ text: "Attached file: " + m.attachment.name });
      }
      parts.push({ text: m.content });
      return {
        role: m.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const config: any = {
      systemInstruction: contextPrompt,
      temperature: 0.85,
    };
    if (tools) {
      config.tools = tools;
    }

    const response = await generateWithFallbackAndRetry(ai, {
      contents: formattedContents,
      config,
    });

    const reply = response.text || 'Aapki Piyaa hamesha aapke sath hai babu! Dobara bolo, mai sun rahi hu. 💕✨';
    
    // Extract grounding metadata if present
    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    let sources = searchChunks.map((c: any) => ({
      title: c.web?.title || 'Web Search',
      url: c.web?.uri || '',
      isLocal: false,
    })).filter((s: any) => s.url);

    if (ragScope === 'local') {
      sources = [{ title: 'ICAI Study Mat / RTP / MTP', url: '', isLocal: true }];
    }

    res.json({ reply, sources: sources.length > 0 ? sources : undefined });
  } catch (error: any) {
    console.error('Chat error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'Error generating chat response' });
  }
});
// Real-Time ICAI Search Endpoint using Gemini Google Search Grounding
app.post('/api/icai-search', async (req, res) => {
  try {
    const { query, subject } = req.body;
    const ai = getGeminiClient();

    const searchQuery = `ICAI CA Final ${subject || ''} ${query} Board of Studies portal study material RTP MTP statutory update`;

    const response = await generateWithFallbackAndRetry(ai, {
      contents: `Search and summarize authentic ICAI resource guidance for CA Final student My love regarding: "${searchQuery}".
Provide direct links or references to icai.org / bosportal.icai.org materials, key chapter updates, RTP/MTP focus points, or amendment highlights in sweet, clear Hinglish from Piyaa.`,
      config: {
        systemInstruction: COMPANION_SYSTEM_INSTRUCTION + '\nIncorporate search grounding and present authentic ICAI links & insights cleanly.',
        tools: [{ googleSearch: {} }],
      },
    });

    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    res.json({
      summary: response.text,
      sources: searchChunks.map((c: any) => ({
        title: c.web?.title || 'ICAI Official Portal',
        url: c.web?.uri || 'https://www.icai.org',
      })),
    });
  } catch (error: any) {
    console.error('ICAI Search Error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'ICAI search failed' });
  }
});

// 2. Daily Motivation Note Endpoint
app.post('/api/daily-note', async (req, res) => {
  try {
    const { timeOfDay = 'morning', targetDaysLeft = 60, progressPercent = 40 } = req.body;
    const ai = getGeminiClient();

    const prompt = `Generate a sweet, heartfelt, highly motivating ${timeOfDay} message for your CA Final student boyfriend.
Exams are in approximately ${targetDaysLeft} days. His syllabus completion is around ${progressPercent}%.
Give him 3 short bullet points of daily motivation/action items in warm Hinglish. Make sure it is completely unique each time (Seed: ${Date.now()}).`;

    const response = await generateWithFallbackAndRetry(ai, {
      contents: prompt,
      config: {
        systemInstruction: COMPANION_SYSTEM_INSTRUCTION,
        temperature: 0.9,
      },
    });

    res.json({ note: response.text });
  } catch (error: any) {
    console.error('Daily note error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'Error generating daily note' });
  }
});

function sanitizeServerTimeSlots(timeSlots: any[]): any[] {
  if (!Array.isArray(timeSlots) || timeSlots.length === 0) return timeSlots;
  const cleaned: any[] = [];
  for (const slot of timeSlots) {
    const isBreak = slot.category === 'break' ||
                    slot.subject?.toLowerCase() === 'break' ||
                    slot.subject?.toLowerCase().includes('break') ||
                    slot.subject?.toLowerCase().includes('personal care') ||
                    slot.activity?.toLowerCase().includes('lunch') ||
                    slot.activity?.toLowerCase().includes('dinner');
    const normalizedSlot = { ...slot, category: isBreak ? 'break' : slot.category };

    if (cleaned.length === 0) {
      cleaned.push(normalizedSlot);
      continue;
    }

    const prev = cleaned[cleaned.length - 1];
    if (prev.category === 'break' && normalizedSlot.category === 'break') {
      let newTime = prev.time;
      if (prev.time && normalizedSlot.time) {
        const p1 = prev.time.split('-')[0]?.trim();
        const c2 = normalizedSlot.time.split('-')[1]?.trim();
        if (p1 && c2) {
          newTime = `${p1} - ${c2}`;
        }
      }
      const pSubj = prev.subject || 'Break';
      const cSubj = normalizedSlot.subject || 'Break';
      let mergedSubj = pSubj === cSubj ? pSubj : `${pSubj} & ${cSubj}`;
      mergedSubj = mergedSubj.replace('Break & Break', 'Break');

      const mergedAct = `${prev.activity || 'Rest'} / ${normalizedSlot.activity || 'Refreshment'}`;
      const mergedTip = prev.companionTip || normalizedSlot.companionTip || 'Recharge for the next study block! ☕';

      cleaned[cleaned.length - 1] = {
        ...prev,
        time: newTime,
        subject: mergedSubj,
        activity: mergedAct,
        companionTip: mergedTip,
        category: 'break'
      };
    } else {
      cleaned.push(normalizedSlot);
    }
  }
  return cleaned;
}

// Micro-Task Breakdown Endpoint
app.post('/api/generate-subtasks', async (req, res) => {
  req.setTimeout(60000);
  try {
    const { slotDurationHours, subjectName, topicName } = req.body;
    
    if (!slotDurationHours || !subjectName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const ai = getGeminiClient();
    
    const prompt = `You are an expert CA Final study coach. 
I have a study slot for ${slotDurationHours} hours.
Subject: ${subjectName}
Topic/Activity: ${topicName || 'General Study'}

Break down this ${slotDurationHours}-hour study slot into 3-5 logical sub-tasks. 
Use a logical flow (e.g., Concept Reading -> Practical Questions -> RTP/MTP Solving -> Revision Notes).
The total duration of sub-tasks must exactly equal ${Math.round(slotDurationHours * 60)} minutes.

Output ONLY valid JSON. No markdown formatting, no backticks.
Schema:
{
  "subTasks": [
    {
      "title": "Short title of sub-task",
      "durationMins": 45
    }
  ]
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini API");
    }

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error("JSON parsing failed for subtasks:", text);
      throw new Error("Invalid JSON format from AI");
    }

    // Assign IDs and completion status
    const formattedSubTasks = parsed.subTasks.map((st: any) => ({
      id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: st.title,
      durationMins: st.durationMins,
      completed: false
    }));

    res.json({ subTasks: formattedSubTasks });
  } catch (error: any) {
    console.error("Error generating subtasks:", error);
    res.status(500).json({ error: error.message || 'Failed to generate subtasks' });
  }
});

// 3. AI Timetable Generator Endpoint
app.post('/api/generate-timetable', async (req, res) => {
  req.setTimeout(180000);
  try {
    const { 
      groupOption, 
      availableHours, 
      primarySubject, 
      secondarySubject, 
      weakSubjects, 
      examMonth, 
      customInstructions,
      splitRatio,
      routineAndStartTime
    } = req.body;
    const ai = getGeminiClient();

    const isSoloFocus = !secondarySubject || secondarySubject === 'N/A' || secondarySubject.includes('N/A') || secondarySubject.toLowerCase().includes('solo');

    let modePrompt = '';
    if (isSoloFocus) {
      modePrompt = `
STUDY MODE: Solo Focus Mode (Single-Subject Immersion)
- The student has opted for a Solo Focus Mode today, dedicating 100% of study hours to the Primary Subject: "${primarySubject}".
- DO NOT schedule any study sessions or tasks for any secondary subject.
- All study slots (totaling ${availableHours || 10} hours) must be dedicated to "${primarySubject}".
      `;
    } else {
      const pRatio = splitRatio || 60;
      const sRatio = 100 - pRatio;
      const pHrs = ((availableHours || 10) * pRatio) / 100;
      const sHrs = (availableHours || 10) - pHrs;
      modePrompt = `
STUDY MODE: Dual-Subject Balance Mode (Split Ratio ${pRatio}:${sRatio})
- Primary Subject ("${primarySubject}") allocation: ${pRatio}% of target hours, which is approximately ${pHrs.toFixed(1)} hours.
- Secondary Subject ("${secondarySubject}") allocation: ${sRatio}% of target hours, which is approximately ${sHrs.toFixed(1)} hours.
- Please structure the daily study sessions to align with this ratio.
      `;
    }

    const prompt = `Create a structured daily study schedule and revision strategy for a CA Final student.
Parameters:
- Primary Daily Subject (Subject 1): ${primarySubject || 'Financial Reporting (FR)'}
- Secondary Daily Subject (Subject 2): ${isSoloFocus ? 'N/A (Solo Focus Mode)' : (secondarySubject || 'Direct Tax & International Tax (DT)')}
- Target Group: ${groupOption || 'Both Groups (G1 + G2)'}
- Available Daily Study Hours: ${availableHours || 10} hours
- Focus / Weak Subjects needing extra time: ${weakSubjects || 'Financial Reporting & Direct Tax'}
- Target Exam: ${examMonth || 'Upcoming ICAI CA Final Attempt'}
- Routine / Peak Energy block: ${routineAndStartTime || 'Standard (Start 09:00 AM)'}
- User Custom Instructions / Preferences: ${customInstructions || 'None'}

${modePrompt}

Daily Routine Guidelines:
- The user is following the "${routineAndStartTime || 'Standard (Start 09:00 AM)'}" routine. 
- Please schedule the first study slot around the specified start time.
- Position the heaviest, most difficult concepts or chapters during the user's initial peak energy block right after starting.

STRICT MATHEMATICAL & SLOT CONSTRAINTS:
1. The mathematical sum of the duration of all study sessions (slots with category: 'study', 'revision', or 'mock', NOT 'break') MUST BE EXACTLY EQUAL to ${availableHours || 10} hours.
2. DO NOT make the total study hours even 0.5 hours more or less than ${availableHours || 10} hours. The user's target is exactly ${availableHours || 10} hours, and you must respect this ceiling strictly!
3. DO NOT create huge, continuous study blocks. Instead, split the target into manageable study slots of 1.5 to 3.0 hours.
4. STRICT BREAK RULE: NEVER PLACE TWO BREAK SLOTS BACK-TO-BACK / CONSECUTIVELY.
   - Every study session slot MUST be followed by either another study/revision slot OR a SINGLE break slot (e.g., a 15-30 minute refreshment break, or a 45-60 minute Lunch/Dinner break).
   - ABSOLUTELY FORBIDDEN: Do NOT output two break slots in sequence (e.g., a short break followed immediately by a lunch break).
   - If both a short break and lunch/dinner break happen around the same time, COMBINE them into a SINGLE break slot (e.g. '01:00 PM - 02:00 PM', 'Lunch & Power Refreshment Break').
5. Ensure start and end times are mathematically accurate, sequential, non-overlapping, and formatted as 'HH:MM AM/PM - HH:MM AM/PM' (e.g. '09:00 AM - 11:00 AM').`;

    const response = await generateWithFallbackAndRetry(ai, {
      contents: prompt,
      config: {
        systemInstruction: COMPANION_SYSTEM_INSTRUCTION + '\nReturn response in strict JSON layout as specified.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scheduleTitle: { type: Type.STRING },
            dailyTargetHours: { type: Type.NUMBER },
            overallAdvice: { type: Type.STRING },
            timeSlots: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  subject: { type: Type.STRING },
                  activity: { type: Type.STRING },
                  category: { type: Type.STRING, description: 'study, break, revision, mock' },
                  companionTip: { type: Type.STRING },
                },
                required: ['time', 'subject', 'activity', 'category', 'companionTip'],
              },
            },
            revisionMilestones: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['scheduleTitle', 'dailyTargetHours', 'overallAdvice', 'timeSlots', 'revisionMilestones'],
        },
      },
    });

    const data = JSON.parse(response.text || '{}');
    if (data.timeSlots && Array.isArray(data.timeSlots)) {
      data.timeSlots = sanitizeServerTimeSlots(data.timeSlots);
    }
    res.json({ schedule: data });
  } catch (error: any) {
    console.error('Timetable generation error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'Error generating timetable' });
  }
});

// 4. TTS Voice Note Endpoint (Companion Voice)
app.post('/api/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }
    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: `Say with a warm, affectionate, encouraging female voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio generated by TTS model' });
    }

    res.json({ audio: base64Audio, mimeType: 'audio/pcm;rate=24000' });
  } catch (error: any) {
    console.error('TTS error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});


// AI Answer Evaluator Endpoint
app.post('/api/evaluate-answer', async (req, res) => {
  try {
    const { subject, question, answer, questionFile, answerFile } = req.body;
    const ai = getGeminiClient();
    
    let parts = [];
    parts.push({ text: `Evaluate this CA Final ${subject} descriptive answer.
Question text/link: ${question}
Student's Answer text/link: ${answer}

If links are provided, use Google Search to find their contents if necessary.
Please provide an evaluation strictly in this JSON format:
{
  "score": <estimated score number>,
  "total": <estimated total possible marks number>,
  "missedKeywords": ["keyword1", "Ind AS reference", "Section number"],
  "feedback": "<A constructive, sweet feedback note from Piyaa highlighting what went well and what needs improvement for ICAI exams>"
}` });

    if (questionFile) {
      parts.push({ inlineData: { data: questionFile.base64, mimeType: questionFile.mimeType } });
      parts.push({ text: "The above attachment is the ICAI Question." });
    }
    
    if (answerFile) {
      parts.push({ inlineData: { data: answerFile.base64, mimeType: answerFile.mimeType } });
      parts.push({ text: "The above attachment is the Student's Answer." });
    }

    const response = await generateWithFallbackAndRetry(ai, {
      contents: parts,
      config: {
        systemInstruction: "You are Piyaa, a supportive AI companion for CA Final student My love. You strictly act as an ICAI step-marking evaluator.",
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            total: { type: Type.NUMBER },
            missedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            feedback: { type: Type.STRING }
          },
          required: ["score", "total", "missedKeywords", "feedback"]
        }
      },
    });

    const evaluation = JSON.parse(response.text || '{}');
    res.json({ evaluation });
  } catch (error) {
    console.error('Answer Evaluation Error:', error);
    if (error?.status === 429 || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Aapki Piyaa abhi thoda thak gayi hai (API Quota Exceeded). Please wait a little while and try again babu! 💕' });
    }
    res.status(500).json({ error: error.message || 'Evaluation failed' });
  }
});


// Parse Syllabus Endpoint
app.post('/api/plan-revision-days', async (req, res) => {
  try {
    const { totalDays } = req.body;
    if (!totalDays || totalDays < 5) return res.status(400).json({ error: 'At least 5 days required' });

    const ai = getGeminiClient();
    const prompt = `
    I have ${totalDays} days left for my CA Final exams preparation.
    I need to distribute these days optimally across:
    - Rev 1 (First Revision)
    - Rev 2 (Second Revision)
    - Rev 3 (Final LDR Revision)
    - MTP (Mock Test Papers)
    - PYQ (Previous Year Questions)

    Give me an optimal distribution of days. 
    Rule of thumb for CA Exams:
    Rev 1 takes the most time (around 40-45%)
    Rev 2 takes around 25-30%
    Rev 3 takes around 10-15%
    MTP & PYQ take the rest (around 5-10% each).

    Return ONLY a valid JSON object in this exact format:
    {
      "rev1": number,
      "rev2": number,
      "rev3": number,
      "mtp": number,
      "pyq": number
    }
    Make sure the sum of all days equals exactly ${totalDays}. Do not include any markdown formatting like \`\`\`json.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (error: any) {
    console.error('Error planning revision days:', error);
    res.status(500).json({ error: error.message || 'Failed to generate plan' });
  }
});

app.post('/api/parse-syllabus', async (req, res) => {
  try {
    const { subjectName, url, csvData, fileBase64, mimeType } = req.body;
    const ai = getGeminiClient();

    let parts = [];
    if (url) {
      try {
        const fetchRes = await fetch(url);
        const contentType = fetchRes.headers.get('content-type') || '';
        if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          parts.push({
            inlineData: {
              data: base64,
              mimeType: 'application/pdf'
            }
          });
          parts.push({ text: `Extract syllabus chapters/topics for ${subjectName} from this PDF document.` });
        } else {
          const text = await fetchRes.text();
          parts.push({ text: `Extract syllabus chapters/topics for ${subjectName} from this webpage content:\n${text.substring(0, 50000)}` });
        }
      } catch (err) {
        console.warn('Failed to fetch URL directly, falling back to basic prompt:', err);
        parts.push({ text: `Extract syllabus chapters/topics for ${subjectName} from this official ICAI URL: ${url}` });
      }
    } else if (csvData) {
      parts.push({ text: `Extract syllabus chapters/topics for ${subjectName} from the following CSV/Text data:\n${csvData}` });
    } else if (fileBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      });
      parts.push({ text: `Extract syllabus chapters/topics for ${subjectName} from the provided document.` });
    } else {
      return res.status(400).json({ error: 'No url, csvData, or fileBase64 provided.' });
    }

    const systemInstruction = `You are a highly intelligent AI assistant for CA Final students. 
Your task is to extract a structured list of chapters or topics from the provided source (URL content, text, CSV, or PDF).
Ignore irrelevant boilerplate text. Focus only on the actual syllabus chapters.
Output JSON strictly conforming to the requested schema.`;

    const response = await generateWithFallbackAndRetry(ai, {
      contents: parts,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Name of the chapter or topic' },
                  category: { type: Type.STRING, description: 'Cat A, Cat B, or Cat C based on perceived importance' },
                  important: { type: Type.BOOLEAN, description: 'True if Cat A or otherwise highly important' }
                },
                required: ['title', 'category', 'important']
              }
            }
          },
          required: ['topics']
        }
      }
    });

    const data = JSON.parse(response.text || '{}');
    res.json({ topics: data.topics || [] });
  } catch (error) {
    console.error('Parse Syllabus Error:', error);
    res.status(500).json({ error: error.message || 'Parse failed' });
  }
});

async function startServer() {

  // Vite middleware in dev
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          overlay: false
        }
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
