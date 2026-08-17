const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

const regexInsertState = /const \[selectedSecondaryChapterIds, setSelectedSecondaryChapterIds\] = useState<string\[\]>\(\[\]\);/;

if (code.match(regexInsertState)) {
    code = code.replace(regexInsertState, `const [selectedSecondaryChapterIds, setSelectedSecondaryChapterIds] = useState<string[]>([]);\n  const [revisionMode, setRevisionMode] = useState<'First Time' | 'R1' | 'R2' | 'R3'>('First Time');`);
}

const regexInsertFilteredTopics = /const sSubObj = useMemo\(\(\) => \{[\s\S]*?\}, \[subjects, secondarySubject\]\);/;

if(code.match(regexInsertFilteredTopics)) {
    code = code.replace(regexInsertFilteredTopics, `const sSubObj = useMemo(() => {
    if (secondarySubject === 'N/A') return null;
    return subjects.find(
      (s) => s.name === secondarySubject || secondarySubject.includes(s.name) || s.name.includes(secondarySubject)
    );
  }, [subjects, secondarySubject]);

  const pSubObjFilteredTopics = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
       if (revisionMode === 'First Time') return !t.completed;
       if (revisionMode === 'R1') return t.completed && !t.rev1;
       if (revisionMode === 'R2') return t.rev1 && !t.rev2;
       if (revisionMode === 'R3') return t.rev2 && !t.rev3;
       return true;
    });
  }, [pSubObj, revisionMode]);

  const sSubObjFilteredTopics = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
       if (revisionMode === 'First Time') return !t.completed;
       if (revisionMode === 'R1') return t.completed && !t.rev1;
       if (revisionMode === 'R2') return t.rev1 && !t.rev2;
       if (revisionMode === 'R3') return t.rev2 && !t.rev3;
       return true;
    });
  }, [sSubObj, revisionMode]);`);
} else {
    console.log("Could not find filtered topics insertion point");
}

fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log('Variables inserted.');
