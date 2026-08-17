const fs = require('fs');
let code = fs.readFileSync('src/components/WeeklyPlannerModal.tsx', 'utf8');

const regex = /const allocatedSecondaryHours = useMemo\(\(\) => \{[\s\S]*?\}, \[.*?\]\);/;

const replacement = `const allocatedSecondaryHours = useMemo(() => {
    if (activeConfig.secondarySubject === 'N/A') return 0;
    return activeConfig.availableHours - allocatedPrimaryHours;
  }, [activeConfig.availableHours, allocatedPrimaryHours, activeConfig.secondarySubject]);

  const pSubObjFilteredTopics = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
       if (activeConfig.revisionMode === 'R1') return !t.rev1;
       if (activeConfig.revisionMode === 'R2') return !t.rev2;
       if (activeConfig.revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [pSubObj, activeConfig.revisionMode]);

  const sSubObjFilteredTopics = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
       if (activeConfig.revisionMode === 'R1') return !t.rev1;
       if (activeConfig.revisionMode === 'R2') return !t.rev2;
       if (activeConfig.revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [sSubObj, activeConfig.revisionMode]);`;

if (code.match(regex)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/components/WeeklyPlannerModal.tsx', code);
    console.log("Variables successfully inserted.");
} else {
    console.log("Could not find insertion point.");
}
