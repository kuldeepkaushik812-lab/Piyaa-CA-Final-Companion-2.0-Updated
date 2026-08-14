export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mood?: string;
  audioBase64?: string;
  attachment?: { name: string; base64: string; mimeType: string };
  sources?: { title: string; url: string; isLocal?: boolean }[];
}

export interface CATopic {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  important: boolean;
  rev1?: boolean;
  rev1At?: string;
  rev2?: boolean;
  rev2At?: string;
  rev3?: boolean;
  rev3At?: string;
  ldr?: boolean;
  ldrAt?: string;
  mtpScore?: number;
  category?: string;
  timeSpent?: number;
  completedDates?: string[];
  lastCompletedDate?: string;
}

export interface CASubject {
  id: string;
  code: string;
  name: string;
  group: 1 | 2;
  totalChapters: number;
  completedChapters: number;
  revisionCount: number;
  rtpMtpDone: boolean;
  status: 'Not Started' | 'In Progress' | 'Revision 1' | 'Revision 2' | 'Exam Ready';
  topics: CATopic[];
  mtpProgress?: { id: string; title: string; completed: boolean; score?: number; totalScore: number }[];
  pyqProgress?: { id: string; title: string; completed: boolean; score?: number; totalScore: number }[];
}

export type SlotStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'NA';

export interface SlotSubTask {
  id: string;
  title: string;
  durationMins: number;
  completed: boolean;
}

export interface TimetableSlot {
  id: string;
  time: string;
  subject: string;
  activity: string;
  category: 'study' | 'break' | 'revision' | 'mock' | 'na';
  companionTip?: string;
  completed?: boolean;
  progress?: number;
  status?: SlotStatus;
  isFrozen?: boolean;
  isUnlocked?: boolean;
  totalDurationHours?: number;
  studiedDurationHours?: number;
  isBacklogSettled?: boolean;
  subTasks?: SlotSubTask[];
}

export interface GeneratedTimetable {
  scheduleTitle: string;
  dailyTargetHours: number;
  overallAdvice: string;
  timeSlots: TimetableSlot[];
  revisionMilestones: string[];
}

export interface PomodoroSession {
  id: string;
  date: string;
  subject: string;
  minutes: number;
  type: 'work' | 'break';
}

export interface DailyNote {
  id: string;
  date: string;
  content: string;
  timeOfDay: 'morning' | 'afternoon' | 'night';
}

export interface StudyHistoryLog {
  id: string;
  timestamp: number;          // UTC timestamp of completion
  dateStr: string;            // Formatted YYYY-MM-DD
  subject: string;            // e.g., "Paper 1: Financial Reporting (FR)"
  subjectId: string;          // Added so we can link it back
  chapterId?: string;         // Optional specific Ind AS / Chapter
  chapterTitle?: string;      // Name of chapter / activity
  durationHours: number;      // Exact duration logged (e.g., 1.5, 3.0)
  sourceType: 'POMODORO' | 'TIME_TABLE' | 'EXAM_SIMULATOR' | 'MANUAL' | 'SYLLABUS';
  status: 'COMPLETED';
  notes?: string;
}

export interface BacklogDebtItem {
  id: string;
  dateStr: string;
  time: string;
  subject: string;
  activity: string;
  category: string;
  totalDurationHours: number;
  studiedDurationHours: number;
  debtHours: number;
  status: SlotStatus;
}

export interface TimetablePreset {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  mode: 'UNIFORM' | 'VARIABLE' | 'MANUAL';
  slotTimePreference: string;
  variableDurations?: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  shortBreakDuration: string;
  mealBreakDuration: string;
  availableHours?: number;
  manualSlots?: TimetableSlot[];
}
export interface FocusSession {
  id: string;
  timestamp: number;
  dateStr: string;
  subjectName: string;
  topicName: string;
  effectiveMs: number;
  totalElapsedMs: number;
}