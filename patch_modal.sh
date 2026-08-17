sed -i 's/interface TodayStudyBreakdownModalProps {/interface TodayStudyBreakdownModalProps {\n  studyHoursToday: number;/g' src/components/TodayStudyBreakdownModal.tsx
sed -i 's/export const TodayStudyBreakdownModal: React.FC<TodayStudyBreakdownModalProps> = ({/export const TodayStudyBreakdownModal: React.FC<TodayStudyBreakdownModalProps> = ({\n  studyHoursToday,/g' src/components/TodayStudyBreakdownModal.tsx
sed -i '/const studyHoursToday = useMemo(() => {/,/}, \[todayHistoryLogs, todaySlots\]);/d' src/components/TodayStudyBreakdownModal.tsx
sed -i 's/<TodayStudyBreakdownModal/<TodayStudyBreakdownModal studyHoursToday={studyHoursToday}/g' src/components/Header.tsx
