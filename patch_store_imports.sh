sed -i 's/setActiveTab,/setActiveTab,\n    setCurrentSubject,/g' src/components/TimetablePlanner.tsx
sed -i 's/setEditForm(slot)/handleStartEdit(slot)/g' src/components/TimetablePlanner.tsx
