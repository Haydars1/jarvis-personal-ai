// Explicit local HyperFrames runner. Workers cannot execute Chromium or FFmpeg.
// Does not install packages or contact a renderer on its own.
import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTIONS = new Set(['doctor', 'lint', 'check', 'preview', 'render']);

export function hyperframesCommand(action, platform = process.platform) {
  if (!ACTIONS.has(action)) throw new RangeError('HYPERFRAMES_INVALID_ACTION');
  const command = platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['--no-install', 'hyperframes', action];
  if (action === 'render') args.push('--output', 'final.mp4');
  return { command, args };
}

export async function runHyperframes(action, projectFolder = process.cwd(), options = {}) {
  const folder = path.resolve(projectFolder);
  const { command, args } = hyperframesCommand(action);
  if (action !== 'doctor') {
    await access(path.join(folder, 'index.html'));
  }
  const maxMs = action === 'preview' ? 0 : action === 'render' ? 20 * 60 * 1000 : 2 * 60 * 1000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      cwd: folder,
      stdio: 'inherit',
      windowsHide: false,
      // Windows needs a shell to execute .cmd; command and arguments are
      // strictly allowlisted and contain no user-supplied shell fragments.
      shell: process.platform === 'win32',
      env: process.env,
      ...(options.spawnOptions || {})
    });
    const timeout = maxMs ? setTimeout(() => child.kill(), maxMs) : null;
    const finish = (error, code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (error) reject(error);
      else if (code === 0) resolve({ ok: true, action, project: folder, output: action === 'render' ? path.join(folder, 'final.mp4') : null });
      else reject(new Error('HYPERFRAMES_' + action.toUpperCase() + '_FAILED:' + (code ?? 'terminated')));
    };
    child.once('error', error => finish(error));
    child.once('close', code => finish(null, code));
  });
}

async function main() {
  const [action, folder] = process.argv.slice(2);
  if (!action || action === '--help' || action === '-h') {
    process.stdout.write('Usage: node local-bridge/hyperframes-bridge.mjs <doctor|lint|check|preview|render> [project-folder]\n');
    process.stdout.write('Install hyperframes in the chosen project first: npm install --save-dev hyperframes\n');
    return;
  }
  const result = await runHyperframes(action, folder || process.cwd());
  process.stdout.write(JSON.stringify(result) + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
