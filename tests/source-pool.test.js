import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { OBD_PDF_SEEDS } from '../src/lib/obd-pdf-seeds.js';
import { cloneArgs, fetchArgs, repoLocalPath, sourcePoolSeeds, syncRepository } from '../local-bridge/source-pool-sync.mjs';

const sourcePath = fileURLToPath(new URL('../local-bridge/source-pool-sync.mjs', import.meta.url));
const packagePath = fileURLToPath(new URL('../package.json', import.meta.url));

test('both uploaded OBD PDFs are represented as 78 unique repositories', () => {
  assert.equal(OBD_PDF_SEEDS.length, 78);
  assert.equal(new Set(OBD_PDF_SEEDS.map(seed => seed.repo.toLowerCase())).size, 78);
  const repos = new Set(OBD_PDF_SEEDS.map(seed => seed.repo));
  for (const repo of [
    'cubigato/thinkcar-tc-reader',
    'rnd-ash/OpenVehicleDiag',
    'Wal33D/dtc-database',
    'sanketh-1850/OBDPlus',
    'oxibus/automotive_diag',
    'RJ-6463/Bosch_EDC15_EEPROM_Tool',
    'Luke-k-dev/SportPyOBD'
  ]) assert.ok(repos.has(repo), repo);
});

test('source pool merges the general curated catalog and OBD PDFs without duplicates', () => {
  const seeds = sourcePoolSeeds();
  const keys = seeds.map(seed => seed.repo.toLowerCase());
  assert.equal(keys.length, new Set(keys).size);
  const repos = new Set(seeds.map(seed => seed.repo));
  for (const seed of OBD_PDF_SEEDS) assert.ok(repos.has(seed.repo), seed.repo);
  assert.ok(seeds.length > 154, 'combined source pool should be larger than the previous curated catalog');
});

test('source sync performs real shallow clones without LFS or submodules by default', () => {
  const args = cloneArgs('owner/tool', '/tmp/tool');
  assert.deepEqual(args.slice(0, 2), ['clone', '--depth']);
  assert.ok(args.includes('1'));
  assert.ok(args.includes('--filter=blob:none'));
  assert.ok(args.includes('--single-branch'));
  assert.ok(args.includes('--no-tags'));
  assert.ok(!args.some(arg => /submodule|recurse/i.test(arg)));
  assert.deepEqual(fetchArgs(), ['fetch', '--depth', '1', '--no-tags', 'origin', 'HEAD']);
  const source = readFileSync(sourcePath, 'utf8');
  assert.match(source, /GIT_LFS_SKIP_SMUDGE:\s*'1'/);
  assert.match(source, /spawn\(command, args/);
  assert.match(source, /git\(cloneArgs\(/);
});

test('source pool path is deterministic and dry-run never needs network', async () => {
  assert.match(repoLocalPath('/tmp/jarvis', 'owner/tool'), /sources[\\/]owner[\\/]tool$/);
  const result = await syncRepository({ repo: 'owner/tool', category: 'test', executionTarget: 'local-cpu' }, { root: '/tmp/jarvis-source-pool-test', dryRun: true });
  assert.equal(result.repo, 'owner/tool');
  assert.equal(result.status, 'dry-run');
});

test('sensitive ECU write/calibration sources are downloaded but never auto-executed', () => {
  const byRepo = new Map(OBD_PDF_SEEDS.map(seed => [seed.repo, seed]));
  for (const repo of [
    'RJ-6463/Bosch_EDC15_EEPROM_Tool',
    'comey246/romHEX14-ECU-Tuning',
    'murdinc/ELMFlash',
    'speeduino/speeduino'
  ]) {
    assert.equal(byRepo.get(repo)?.autoExecute, false, repo);
  }
});

test('package exposes real source-pool synchronization commands', () => {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.scripts['sources:sync'], 'node local-bridge/source-pool-sync.mjs');
  assert.equal(pkg.scripts['sources:sync:dry'], 'node local-bridge/source-pool-sync.mjs --dry-run');
  assert.match(pkg.scripts['check:syntax'], /source-pool-sync\.mjs/);
  assert.match(pkg.scripts['check:syntax'], /obd-pdf-seeds\.js/);
});
