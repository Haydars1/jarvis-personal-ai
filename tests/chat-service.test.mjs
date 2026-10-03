import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatService, InMemoryChatRepository } from '../js/chat-service.mjs';

function setup() {
  const repo = new InMemoryChatRepository();
  const service = new ChatService(repo, { now: (() => { let i=0; return () => new Date(1760000000000 + i++*1000).toISOString(); })() });
  return { repo, service };
}

test('creates conversation with vehicle and fault context', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1', pagePath:'/fehlercodes/P0299', faultCode:'P0299', vehicleProfileKey:'vw-passat-b8-crlb' });
  assert.equal(c.status, 'ai_active');
  assert.equal(c.faultCode, 'P0299');
  assert.equal(c.vehicleProfileKey, 'vw-passat-b8-crlb');
});

test('messages are returned in insertion order', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1' });
  await service.postVisitorMessage(c.id, 'Hallo');
  await service.postAiMessage(c.id, 'Guten Tag');
  assert.deepEqual((await service.listMessages(c.id)).map(m => m.role), ['visitor','assistant']);
});

test('owner takeover blocks later AI commit from stale generation token', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1' });
  const generation = await service.beginAiReply(c.id);
  await service.takeOver(c.id, 'owner-1');
  const committed = await service.commitAiReply(c.id, generation, 'Diese Antwort darf nicht erscheinen');
  assert.equal(committed, false);
  assert.equal((await service.listMessages(c.id)).length, 0);
});

test('owner may reply only while human takeover is active', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1' });
  await assert.rejects(() => service.postOwnerMessage(c.id, 'owner-1', 'Hallo'), /HUMAN_NOT_ACTIVE/);
  await service.takeOver(c.id, 'owner-1');
  await service.postOwnerMessage(c.id, 'owner-1', 'Hallo');
  assert.equal((await service.listMessages(c.id))[0].role, 'owner');
});

test('release returns conversation to AI active state', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1' });
  await service.takeOver(c.id, 'owner-1');
  await service.releaseToAi(c.id, 'owner-1');
  assert.equal((await service.getConversation(c.id)).status, 'ai_active');
});

test('notification milestones are deduplicated', async () => {
  const { service } = setup();
  const c = await service.createConversation({ visitorId:'v1' });
  assert.equal(await service.claimNotificationMilestone(c.id, 'engaged'), true);
  assert.equal(await service.claimNotificationMilestone(c.id, 'engaged'), false);
  assert.equal(await service.claimNotificationMilestone(c.id, 'qualified_lead'), true);
});
