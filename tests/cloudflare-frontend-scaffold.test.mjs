import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

test('standalone frontend scaffold exists without Floot runtime', async () => {
  assert.equal(await exists('src/App.tsx'), true, 'src/App.tsx must exist');
  assert.equal(await exists('src/main.tsx'), true, 'src/main.tsx must exist');
  assert.equal(await exists('vite.config.ts'), true, 'vite.config.ts must exist');
  assert.equal(await exists('tsconfig.json'), true, 'tsconfig.json must exist');

  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  assert.equal(typeof pkg.scripts?.build, 'string');
  assert.equal(typeof pkg.scripts?.typecheck, 'string');
  assert.equal(typeof pkg.scripts?.test, 'string');

  const app = await readFile('src/App.tsx', 'utf8');
  assert.match(app, /fehlercodes\/?:code|fehlercodes\/\$\{code\}|fehlercodes/);
  assert.doesNotMatch(app, /@floot\//);
});
