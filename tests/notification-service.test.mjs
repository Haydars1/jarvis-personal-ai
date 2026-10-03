import test from 'node:test';
import assert from 'node:assert/strict';
import { NotificationService } from '../js/notification-service.mjs';

test('sends push and email once for engaged milestone', async () => {
  const claimed=new Set(); const sent=[];
  const service=new NotificationService({
    claim: async key => claimed.has(key)?false:(claimed.add(key),true),
    push: async p => sent.push(['push',p]),
    email: async p => sent.push(['email',p])
  });
  const payload={conversationId:'c1',faultCode:'P0299',vehicleLabel:'VW Passat B8'};
  assert.equal(await service.notify('engaged',payload),true);
  assert.equal(await service.notify('engaged',payload),false);
  assert.deepEqual(sent.map(x=>x[0]),['push','email']);
});

test('notification carries deep link to exact admin conversation', async () => {
  let captured;
  const service=new NotificationService({claim:async()=>true,push:async p=>captured=p,email:async()=>{}});
  await service.notify('qualified_lead',{conversationId:'abc',faultCode:'P2453'});
  assert.equal(captured.url,'/admin/chat/abc');
  assert.match(captured.title,/6006/);
});
