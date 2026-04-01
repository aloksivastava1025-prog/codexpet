const fs = require('fs');

const tsPath = "c:\\Users\\Akarsh\\OneDrive\\Desktop\\NEXTIDEA\\src\\buddy\\sprites.ts";

let tsCode = fs.readFileSync(tsPath, 'utf8');

// We just extract the BODIES and HAT_LINES blocks.
const bodiesMatches = tsCode.match(/const BODIES: Record<Species, string\[\]\[\]> = (\{[^]*?\n\})/);
const hatMatches = tsCode.match(/const HAT_LINES: Record<Hat, string> = (\{[^]*?\n\})/);

// We're going to strip all typescript types and eval it.
// To eval `{ [duck]: [...] }`, we need to define the variables `duck`, `cat`, etc.
const species = [
  'axolotl', 'blob', 'cactus', 'capybara', 'cat', 'chonk', 'dragon', 'duck',
  'ghost', 'goose', 'mushroom', 'octopus', 'owl', 'penguin', 'rabbit', 'robot',
  'snail', 'turtle'
];

let evalCode = '';
for (let s of species) {
  evalCode += `const ${s} = "${s}";\n`;
}

evalCode += `const BODIES = ${bodiesMatches[1]};\n`;
evalCode += `const HAT_LINES = ${hatMatches[1]};\n`;
evalCode += `return { BODIES, HAT_LINES };`;

const fn = new Function(evalCode);
const result = fn();

const pyCode = `import json\n\nBODIES = ${JSON.stringify(result.BODIES, null, 2)}\n\nHAT_LINES = ${JSON.stringify(result.HAT_LINES, null, 2)}\n\nEYE_OPTIONS = ['o', '-', '^', '>', '*', 'O', 'x', '<', '@']\n`;

fs.writeFileSync('c:\\Users\\Akarsh\\OneDrive\\Desktop\\NEXTIDEA\\roastpet_cli\\sprites.py', pyCode);
console.log("Successfully dumped valid Python dictionary structure!");
