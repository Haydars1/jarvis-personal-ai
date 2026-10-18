import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeTarget,generateAppStarter} from '../scripts/rea/analyze.mjs';
test('rejects unauthorized target',()=>assert.throws(()=>analyzeTarget({name:'Device'}),/Authorized/));
test('tracks evidence and generates mock app',()=>{
 const a=analyzeTarget({name:'My Device',authorization:{approved:true,scope:'owned hardware'},observations:[{source:'user screenshot',description:'Temperature control',confidence:'verified'},{source:'test note',description:'Maybe a timer'}]});
 assert.equal(a.evidence.length,2);assert.equal(a.features.length,2);assert.equal(a.unknowns.length,1);
 const files=generateAppStarter(a);assert.ok(files['server.mjs'].includes('connected:false'));assert.ok(files['analysis.json']);
});
test('excludes destructive control claims from feature generation',()=>{
 const a=analyzeTarget({name:'Demo',authorization:{approved:true,scope:'test'},observations:[{source:'mock',description:'Delete device configuration',confidence:'verified'}]});
 assert.equal(a.features.length,0);
});
test('redacts potential credentials',()=>{
 const a=analyzeTarget({name:'Demo',authorization:{approved:true,scope:'test'},observations:[{source:'test',description:'API token abc123'}]});
 assert.match(a.evidence[0].description,/redacted/);
});
