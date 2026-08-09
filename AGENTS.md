# CA Final Study Companion - System Memory & Instructions

## User Preferences & System Rules

1. **Background Study & Timer Behavior**:
   - The Study Timer MUST run continuously in the background on Windows and Android without auto-pausing or stopping when the user is watching YouTube revision videos, lectures, or reading offline.
   - `isIdleGuardEnabled` defaults to `false` (OFF) so inactivity checks do not interrupt background YouTube video watching or tab switches.
   - Timer session state (`ca_companion_active_timer_session`) is persisted in `localStorage` and recalculated against real wall-clock time (`Date.now()`) on visibility change / app rehydration.

2. **Timetable & Schedule Constraints**:
   - **Consecutive Breaks Prohibition**: NEVER place two break slots back-to-back/consecutively in AI or manual timetables. Combine consecutive breaks into a single break block.
   - **Manual Slot Time Ripple**: When updating or deleting manual timetable slots on current/future dates, subsequent pending slots MUST automatically ripple and adjust their start/end times sequentially.
   - **Past Date Immutability**: Past dates and completed slots are strictly read-only and immutable. Never ripple or modify past completed/frozen slots.

3. **Backend & AI Server Rules**:
   - Server AI timetable generation (`/api/generate-timetable`) has a 180-second timeout to handle full GEMINI schedule creation safely.
