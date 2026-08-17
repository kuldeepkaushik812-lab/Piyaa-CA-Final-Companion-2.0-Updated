const fs = require('fs');
let code = fs.readFileSync('src/components/TimetablePlanner.tsx', 'utf8');

// Update state definition
code = code.replace(
  "const [revisionMode, setRevisionMode] = useState<'First Time' | 'R1' | 'R2' | 'R3'>('First Time');",
  "const [revisionMode, setRevisionMode] = useState<'R1' | 'R2' | 'R3'>('R1');"
);

// Update dropdown options
const regexDropdownOptions = /<option value="First Time">First Time \(Pending Chapters\)<\/option>\s*<option value="R1">R1 Revision<\/option>\s*<option value="R2">R2 Revision<\/option>\s*<option value="R3">R3 Revision<\/option>/;
code = code.replace(regexDropdownOptions, `<option value="R1">R1 Revision (Remaining for R1)</option>
                        <option value="R2">R2 Revision (Remaining for R2)</option>
                        <option value="R3">R3 Revision (Remaining for R3)</option>`);

// Update logic
const filterRegexP = /const pSubObjFilteredTopics = useMemo\(\(\) => \{[\s\S]*?\}, \[pSubObj, revisionMode\]\);/;
code = code.replace(filterRegexP, `const pSubObjFilteredTopics = useMemo(() => {
    if (!pSubObj) return [];
    return pSubObj.topics.filter(t => {
       if (revisionMode === 'R1') return !t.rev1;
       if (revisionMode === 'R2') return !t.rev2;
       if (revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [pSubObj, revisionMode]);`);

const filterRegexS = /const sSubObjFilteredTopics = useMemo\(\(\) => \{[\s\S]*?\}, \[sSubObj, revisionMode\]\);/;
code = code.replace(filterRegexS, `const sSubObjFilteredTopics = useMemo(() => {
    if (!sSubObj) return [];
    return sSubObj.topics.filter(t => {
       if (revisionMode === 'R1') return !t.rev1;
       if (revisionMode === 'R2') return !t.rev2;
       if (revisionMode === 'R3') return !t.rev3;
       return true;
    });
  }, [sSubObj, revisionMode]);`);

fs.writeFileSync('src/components/TimetablePlanner.tsx', code);
console.log('Fixed filters and removed first time option.');
