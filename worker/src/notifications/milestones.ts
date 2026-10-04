import type { Conversation, Message } from '../db/types';
import type { PushNotification, PushSender } from './push';

export type OwnerMilestone = 'phone_captured' | 'vehicle_complete' | 'dtc_symptom' | 'human_requested';

export interface MilestoneStore {
  recordMilestone(conversationId: string, milestone: string): Promise<boolean>;
}

const humanRequestPattern = /(insan|biriyle konuş|yetkili|mensch|mitarbeiter|jemandem sprechen|human|person|agent|representative)/i;

function hasCompleteVehicle(conversation: Conversation): boolean {
  const vehicle = conversation.vehicle;
  return Boolean(vehicle?.brand && vehicle.model && vehicle.body && vehicle.year && vehicle.engine);
}

function visitorMessages(messages: Message[]): Message[] {
  return messages.filter((message) => message.sender === 'visitor');
}

export function detectOwnerMilestones(conversation: Conversation, messages: Message[]): OwnerMilestone[] {
  const milestones: OwnerMilestone[] = [];
  const visitor = visitorMessages(messages);

  if (conversation.contactPhone?.trim()) milestones.push('phone_captured');
  if (hasCompleteVehicle(conversation)) milestones.push('vehicle_complete');
  if (conversation.faultCode && visitor.some((message) => message.body.trim().length >= 8)) milestones.push('dtc_symptom');
  if (visitor.some((message) => humanRequestPattern.test(message.body))) milestones.push('human_requested');

  return milestones;
}

const milestoneCopy: Record<OwnerMilestone, { title: string; body: string }> = {
  phone_captured: { title: '6006 · Telefon alındı', body: 'Müşteri telefon numarası bıraktı.' },
  vehicle_complete: { title: '6006 · Araç bilgisi tamam', body: 'Marka, model, kasa, yıl ve motor bilgisi mevcut.' },
  dtc_symptom: { title: '6006 · Arıza + belirti', body: 'Arıza kodu ve müşteri belirtisi birlikte mevcut.' },
  human_requested: { title: '6006 · Canlı destek istendi', body: 'Müşteri bir kişiyle görüşmek istiyor.' },
};

export async function notifyOwnerMilestones(
  store: MilestoneStore,
  push: PushSender,
  conversation: Conversation,
  messages: Message[],
): Promise<OwnerMilestone[]> {
  const sent: OwnerMilestone[] = [];

  for (const milestone of detectOwnerMilestones(conversation, messages)) {
    const firstOccurrence = await store.recordMilestone(conversation.id, milestone);
    if (!firstOccurrence) continue;
    const copy = milestoneCopy[milestone];
    const notification: PushNotification = {
      conversationId: conversation.id,
      milestone,
      title: copy.title,
      body: copy.body,
      url: `/admin/chat/${encodeURIComponent(conversation.id)}`,
    };
    await push.send(notification);
    sent.push(milestone);
  }

  return sent;
}
