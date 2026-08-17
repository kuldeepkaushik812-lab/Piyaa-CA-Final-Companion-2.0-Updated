const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('quickTag?: string;')) {
    code = code.replace('subTasks?: SlotSubTask[];', 'subTasks?: SlotSubTask[];\n  quickTag?: string;');
    fs.writeFileSync('src/types.ts', code);
    console.log("Added quickTag to types.ts");
} else {
    console.log("quickTag already exists in types.ts");
}
