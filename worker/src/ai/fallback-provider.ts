import type { AiProvider, AiReply, AiReplyInput } from './provider';

const replies = {
  de: 'Ein einzelner Fehlercode reicht nicht für eine sichere Bauteildiagnose. Beschreiben Sie bitte die Symptome und wann der Fehler auftritt; dann lassen sich die nächsten Prüfungen eingrenzen.',
  tr: 'Tek bir arıza kodu kesin parça teşhisi için yeterli değildir. Belirtileri ve hatanın ne zaman oluştuğunu yazın; ardından kontrol edilmesi gereken noktaları daraltabiliriz.',
  en: 'A single fault code is not enough for a definite component diagnosis. Please describe the symptoms and when the fault occurs so the next checks can be narrowed down.',
} as const;

export class FallbackAiProvider implements AiProvider {
  async reply(input: AiReplyInput): Promise<AiReply> {
    return { body: replies[input.language] };
  }
}
