const fs = require('fs');
let code = fs.readFileSync('src/components/StudyTimer.tsx', 'utf8');

const targetStr = `              {/* Digital Clock */}
              <div className="text-center py-2">
                <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
                  {formatTime(timeLeft)}
                </div>`;

const repStr = `              {/* Digital Clock */}
              <div className="text-center py-2">
                <div className={\`text-5xl sm:text-6xl font-black font-mono tracking-tight text-white \${isRunning && isStrictMode ? 'animate-pulse drop-shadow-[0_0_12px_rgba(239,68,68,0.6)] text-red-50' : 'drop-shadow-md'}\`}>
                  {formatTime(timeLeft)}
                </div>`;

code = code.replace(targetStr, repStr);
fs.writeFileSync('src/components/StudyTimer.tsx', code);
