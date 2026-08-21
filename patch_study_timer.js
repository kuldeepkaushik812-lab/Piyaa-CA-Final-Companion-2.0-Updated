import fs from 'fs';
let code = fs.readFileSync('src/components/StudyTimer.tsx', 'utf-8');

if (!code.includes('isEndingSessionRef.current')) {
  code = code.replace(
    'const wakeLockRef = useRef<any>(null);',
    'const wakeLockRef = useRef<any>(null);\n  const isEndingSessionRef = useRef(false);'
  );

  code = code.replace(
    '  const handleSessionEnd = () => {',
    '  const handleSessionEnd = () => {\n    if (isEndingSessionRef.current) return;\n    isEndingSessionRef.current = true;\n    setTimeout(() => { isEndingSessionRef.current = false; }, 2000);'
  );
  
  fs.writeFileSync('src/components/StudyTimer.tsx', code);
  console.log('Patched handleSessionEnd');
} else {
  console.log('Already patched');
}
