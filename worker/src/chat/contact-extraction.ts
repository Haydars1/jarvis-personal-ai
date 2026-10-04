import type { ConversationContextPatch } from '../db/types';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:\+|00)?\d(?:[\s().\/-]*\d){7,14}/g;
const NAME_PATTERNS = [
  /(?:benim\s+adım|adım)\s+([\p{L}][\p{L}'’\-]*(?:\s+[\p{L}][\p{L}'’\-]*){0,3})(?=[,.;:!?]|$)/iu,
  /(?:mein\s+name\s+ist|ich\s+hei(?:ß|ss)e)\s+([\p{L}][\p{L}'’\-]*(?:\s+[\p{L}][\p{L}'’\-]*){0,3})(?=[,.;:!?]|$)/iu,
  /my\s+name\s+is\s+([\p{L}][\p{L}'’\-]*(?:\s+[\p{L}][\p{L}'’\-]*){0,3})(?=[,.;:!?]|$)/iu,
];

function normalizePhone(candidate: string): string | undefined {
  const trimmed = candidate.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return undefined;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00') && digits.length > 10) return `+${digits.slice(2)}`;
  return digits;
}

function extractPhone(message: string): string | undefined {
  for (const match of message.matchAll(PHONE_PATTERN)) {
    const normalized = normalizePhone(match[0]);
    if (normalized) return normalized;
  }
  return undefined;
}

function extractName(message: string): string | undefined {
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern);
    const value = match?.[1]?.trim().replace(/\s+/g, ' ');
    if (value && value.length >= 2 && value.length <= 80) return value;
  }
  return undefined;
}

function preferredContact(message: string, phone?: string, email?: string): string | undefined {
  if (/\bwhats?app\b/i.test(message)) return 'whatsapp';
  if (email && /(?:e-?posta|e-?mail|mail)/i.test(message)) return 'email';
  if (phone && /(?:telefon|phone|call|ara(?:yin|yın|ma|mak)?|anruf)/i.test(message)) return 'phone';
  return undefined;
}

export function extractContactPatch(message: string): ConversationContextPatch {
  const contactEmail = message.match(EMAIL_PATTERN)?.[0]?.toLowerCase();
  const contactPhone = extractPhone(message);
  const contactName = extractName(message);
  const contactPreference = preferredContact(message, contactPhone, contactEmail);

  const patch: ConversationContextPatch = {};
  if (contactName) patch.contactName = contactName;
  if (contactPhone) patch.contactPhone = contactPhone;
  if (contactEmail) patch.contactEmail = contactEmail;
  if (contactPreference) patch.preferredContact = contactPreference;
  return patch;
}
