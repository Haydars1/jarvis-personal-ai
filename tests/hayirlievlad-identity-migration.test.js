import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read = p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('staged Worker uses new name, existing D1 and no duplicate cron/public URL',()=>{
 const next=JSON.parse(read('wrangler.hayirlievlad.jsonc'));
 const live=JSON.parse(read('wrangler.jsonc'));
 assert.equal(next.name,'hayirlievlad');
 assert.equal(next.workers_dev,false);
 assert.deepEqual(next.triggers.crons,[]);
 assert.equal(next.d1_databases[0].database_id,live.d1_databases[0].database_id);
 assert.equal(next.d1_databases[0].binding,live.d1_databases[0].binding);
});
test('native app identity is new and previous app source path is not present',()=>{
 const project=read('ios/project.yml');
 assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER: com\.hayirlievlad\.app\b/);
 assert.match(project,/PRODUCT_BUNDLE_IDENTIFIER: com\.hayirlievlad\.app\.share/);
 assert.match(project,/path: Hayirlievlad\/Info\.plist/);
 assert.match(project,/CFBundleURLSchemes:\s*\n\s*- hayirlievlad/);
 assert.ok(existsSync(new URL('../ios/Hayirlievlad/HayirlievladApp.swift',import.meta.url)));
 assert.ok(!existsSync(new URL('../ios/JARVIS/JARVISApp.swift',import.meta.url)));
 assert.match(read('ios/Hayirlievlad/HayirlievladAPI.swift'),/hayirlievlad\.hayirlievlad\.workers\.dev/);
});
test('new native app group is consistent with sharing and state',()=>{
 for(const path of ['ios/Hayirlievlad/Hayirlievlad.entitlements','ios/ShareExtension/HayirlievladShare.entitlements','ios/Hayirlievlad/AppState.swift','ios/ShareExtension/ShareViewController.swift']){
  assert.match(read(path),/group\.com\.hayirlievlad\.app/,path);
 }
});
