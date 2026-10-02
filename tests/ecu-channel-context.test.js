import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createEcuChannelStore } from '../src/application/ecu/channels.js';

const request = body => new Request('https://jarvis.test/api/chat/send', {
  method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)
});
const attachment = (name, bytes) => ({name, type:'application/octet-stream', base64:Buffer.from(bytes).toString('base64')});

function database(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const DB={prepare(sql){
    const stmt=db.prepare(sql);
    const bound=args=>({
      all:async()=>({results:stmt.all(...args)}),
      first:async()=>stmt.get(...args)||null,
      run:async()=>stmt.run(...args)
    });
    return {...bound([]),bind:(...args)=>bound(args)};
  }};
  return {db,DB};
}

test('ECU follow-up keeps file identity without resending binary and forwards lightweight context', async t => {
  const env=database(t), seen=[];
  const core={fetch:async req=>{
    const body=await req.json();
    seen.push(body);
    return new Response(JSON.stringify({reply:'ok',provider:'test'}),{headers:{'content-type':'application/json'}});
  }};
  const handler=createEcuChannelStore(core);
  const first=await (await handler.fetch(request({channel:'ecu',text:'analiz et',attachments:[attachment('original.bin',[1,2,3])]}),env,{})).json();
  const before=env.db.prepare('SELECT title,file_name,file_sha256,file_size FROM ecu_chat_channels WHERE id=?').get(first.channelId);
  assert.equal(before.title,'original.bin');

  const second=await (await handler.fetch(request({channel:'ecu',channelId:first.channelId,text:'orijinal dosyasını yükledim ya'}),env,{})).json();
  const after=env.db.prepare('SELECT title,file_name,file_sha256,file_size FROM ecu_chat_channels WHERE id=?').get(first.channelId);

  assert.deepEqual(after,before);
  assert.equal(second.channel.file_name,'original.bin');
  assert.equal(second.channel.file_sha256,before.file_sha256);
  assert.equal(seen[1].attachments?.length||0,0);
  assert.equal(seen[1].ecuContext.fileName,'original.bin');
  assert.equal(seen[1].ecuContext.fileSize,3);
  assert.equal(seen[1].ecuContext.sha256,before.file_sha256);
});
