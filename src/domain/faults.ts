import type { Language } from '../i18n/language';
import { faultData } from './fault-data.generated';
import { faultTranslations } from './fault-localizations.generated';
import type { FaultEntry } from './faults.types';

export type { FaultEntry } from './faults.types';

const faultIndex = faultData as Record<string, FaultEntry>;

export function faultByCode(code: string): FaultEntry | undefined {
  const normalized = String(code ?? '').trim().toUpperCase();
  const source = faultIndex[normalized];
  return source ? { ...source, code: normalized } : undefined;
}

export function localizeFault(fault: FaultEntry, language: Language): FaultEntry {
  if (language === 'de') return fault;
  const code = fault.code ?? Object.entries(faultIndex).find(([, entry]) => entry === fault)?.[0];
  if (!code) return fault;
  const pack = faultTranslations[language] as Record<string, Partial<FaultEntry>>;
  const translation = pack[code];
  return translation ? { ...fault, ...translation } : fault;
}

export function allFaults(): FaultEntry[] {
  return Object.entries(faultIndex).map(([code, entry]) => ({ ...entry, code }));
}
