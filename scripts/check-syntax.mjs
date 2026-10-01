import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.(js|mjs)$/.test(path) ? [path] : [];
  });
}

const paths = ['src', 'public', 'local-bridge', '.github/scripts', 'scripts'].flatMap(files).sort();
for (const path of paths) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error(`Syntax check failed: ${path}\n${result.error?.message || result.stderr}`);
    process.exit(1);
  }
}
console.log(`Syntax checks passed for ${paths.length} JavaScript modules.`);
