// Download vetted automotive source trees without running third-party code.
// Default is dry-run. --apply only clones sources; apps/services need their own setup.
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(readFileSync(join(here,'automotive-install-manifest.json'),'utf8'));
const args=process.argv.slice(2);
const apply=args.includes('--apply');
const showStatus=args.includes('--status');
const root=resolve(here,'..',manifest.install_root);
const allowedKinds=new Set(['python-library','device-adapter-source','reference-data-source','desktop-application-source','reference-client-source','self-hosted-service-source','coding-agent-source']);
if(!Array.isArray(manifest.entries)||manifest.entries.length!==12)throw Error('INSTALL_MANIFEST_INVALID');
const entries=manifest.entries.map(entry=>{
 if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(entry.repo)||!/^[a-z0-9-]+$/.test(entry.id)||!allowedKinds.has(entry.kind))throw Error('INVALID_TOOL_ENTRY');
 return {...entry,destination:join(root,entry.id)};
});
if(new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('DUPLICATE_TOOL_ID');
for(const entry of entries){
 const installed=existsSync(join(entry.destination,'.git'));
 const state=installed?'SOURCE_PRESENT':existsSync(entry.destination)?'EXISTING_DIRECTORY_NOT_GIT':'NOT_INSTALLED';
 console.log(entry.repo+' => '+state+' ('+entry.kind+')');
 if(showStatus||!apply||installed)continue;
 if(state==='EXISTING_DIRECTORY_NOT_GIT'){console.error('SKIPPED existing non-git directory: '+entry.destination);continue;}
 mkdirSync(root,{recursive:true});
 const command=spawnSync('git',['clone','--depth','1','--filter=blob:none','--no-tags','https://github.com/'+entry.repo+'.git',entry.destination],{encoding:'utf8',stdio:'inherit',timeout:180000});
 if(command.status!==0){process.exitCode=1;console.error('FAILED '+entry.repo);}
}
console.log(apply?'Source acquisition complete; no packages, hardware drivers, services or third-party scripts were executed.':'DRY RUN only. To fetch all sources locally: node local-bridge/install-automotive-tools.mjs --apply');
