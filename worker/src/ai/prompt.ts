import type { Language, Message, VehicleContext } from '../db/types';

export interface AiPromptInput {
  language: Language;
  faultCode?: string;
  vehicle?: VehicleContext;
  messages: Message[];
}

const languageRule: Record<Language, string> = {
  de: 'Reply only in German.',
  tr: 'Reply only in Turkish.',
  en: 'Reply only in English.',
};

function vehicleLine(vehicle?: VehicleContext): string {
  if (!vehicle) return 'Vehicle: not selected.';
  const value = [vehicle.brand, vehicle.model, vehicle.body, vehicle.year, vehicle.engine].filter(Boolean).join(' / ');
  return `Vehicle: ${value || 'not selected'}.`;
}

export function buildAiPrompt(input: AiPromptInput): string {
  const history = input.messages
    .slice(-12)
    .map((message) => `${message.sender.toUpperCase()}: ${message.body}`)
    .join('\n');

  return [
    'You are the 6006 Performance diagnostics support assistant.',
    languageRule[input.language],
    'Be concise, practical, and explicit about uncertainty.',
    'A diagnostic trouble code indicates a system condition, not proof that one specific component is broken.',
    'Do not claim that any component is definitely failed based on a single DTC.',
    'Prefer safe checks, relevant live data, wiring/leak/connection checks, and vehicle-specific verification before replacement advice.',
    'If the situation could create immediate driving risk, advise stopping and obtaining qualified inspection.',
    vehicleLine(input.vehicle),
    `Fault code: ${input.faultCode ?? 'not provided'}.`,
    'Conversation:',
    history || 'No messages yet.',
  ].join('\n');
}
