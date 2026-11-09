// Commit-stage syntax gate: runs `node --check` on every .js file under the given folders.
// Usage: node scripts/check-syntax.js <dir> [<dir> ...]
const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');

function jsFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name === 'node_modules') return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsFiles(path);
    return path.endsWith('.js') ? [path] : [];
  });
}

let checked = 0;
let failed = 0;
for (const dir of process.argv.slice(2)) {
  for (const file of jsFiles(dir)) {
    checked++;
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    } catch {
      failed++;
    }
  }
}

if (failed) {
  console.error(`Syntax check failed in ${failed} of ${checked} files`);
  process.exit(1);
}
console.log(`Syntax check passed (${checked} files)`);
