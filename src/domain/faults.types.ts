export type FaultTone = 'amber' | 'red' | 'neutral';

export interface FaultEntry {
  code?: string;
  label?: string;
  title: string;
  system: string;
  severity: string;
  drive: string;
  meaning: string;
  symptoms: string[];
  causes: string[];
  diagnosis: string[];
  solutions: string[];
  note: string;
  tone?: FaultTone;
}

export type FaultTranslation = Partial<Omit<FaultEntry, 'code'>>;
