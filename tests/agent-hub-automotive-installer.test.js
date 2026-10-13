import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const manifest=JSON.parse(readFileSync(new URL('../local-bridge/automotive-install-manifest.json',import.meta.url),'utf8'));
test('installation manifest lists every automotive catalog repo exactly once',async()=>{
 const {AUTOMOTIVE_TOOLS}=await import('../src/lib/agent-hub-automotive-tools.js');
 const repos=manifest.entries.map(x=>x.repo.toLowerCase());
 assert.equal(repos.length,12);
 assert.deepEqual([...repos].sort(),AUTOMOTIVE_TOOLS.map(x=>x.repo.toLowerCase()).sort());
 assert.equal(new Set(manifest.entries.map(x=>x.id)).size,12);
 assert.ok(manifest.entries.every(x=>x.status==='not-installed'));
});
test('safe installation dry run never launches git clone or modifies files',()=>{
 const result=spawnSync(process.execPath,['local-bridge/install-automotive-tools.mjs'],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stderr);
 assert.match(result.stdout,/DRY RUN only/);
 for(const e of manifest.entries)assert.ok(result.stdout.includes(e.repo));
});
test('npm exposes explicit status and opt-in installation commands',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.match(pkg.scripts['automotive:status'],/--status/);
 assert.match(pkg.scripts['automotive:install'],/--apply/);
});
