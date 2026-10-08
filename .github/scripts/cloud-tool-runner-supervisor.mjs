import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const MAX_RESTARTS = clampInteger(process.env.JARVIS_CLOUD_MAX_RESTARTS, 3, 0, 5);
const BASE_DELAY_MS = clampInteger(process.env.JARVIS_CLOUD_RESTART_DELAY_MS, 1_000, 250, 10_000);
const RUNNER = new URL('./cloud-tool-runner.mjs', import.meta.url);

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function runOnce(attempt) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [RUNNER.pathname], {
      env: {
        ...process.env,
        JARVIS_CLOUD_SUPERVISED: '1',
        JARVIS_CLOUD_SUPERVISOR_ATTEMPT: String(attempt),
      },
      stdio: 'inherit',
      windowsHide: true,
    });

    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code: code ?? 1, signal: signal || null }));
  });
}

async function main() {
  let restarts = 0;
  let lastFailure = null;

  for (let attempt = 1; attempt <= MAX_RESTARTS + 1; attempt += 1) {
    console.log(`Cloud runner supervisor attempt ${attempt}/${MAX_RESTARTS + 1}.`);

    try {
      const result = await runOnce(attempt);
      if (result.code === 0) {
        console.log(`CLOUD_RUNNER_SUPERVISOR_SUMMARY ${JSON.stringify({ ok: true, attempts: attempt, restarts })}`);
        return;
      }
      lastFailure = `exit=${result.code}${result.signal ? ` signal=${result.signal}` : ''}`;
    } catch (error) {
      lastFailure = String(error?.message || error);
    }

    if (attempt > MAX_RESTARTS) break;

    restarts += 1;
    const delayMs = Math.min(BASE_DELAY_MS * (2 ** (attempt - 1)), 10_000);
    console.warn(`Cloud runner process failed (${lastFailure}). Restarting in ${delayMs}ms; completed jobs remain persisted server-side.`);
    await sleep(delayMs);
  }

  console.error(`CLOUD_RUNNER_SUPERVISOR_SUMMARY ${JSON.stringify({ ok: false, attempts: MAX_RESTARTS + 1, restarts, last_failure: lastFailure })}`);
  process.exitCode = 1;
}

await main();
