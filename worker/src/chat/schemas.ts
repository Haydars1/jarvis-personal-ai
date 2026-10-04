import type { ConversationContextPatch, CreateConversationInput, Language, VehicleContext } from '../db/types';

export const MAX_PUBLIC_BODY_BYTES = 16_384;
const MAX_MESSAGE_CHARS = 4_000;

export class PayloadError extends Error {
  constructor(public readonly status: 400 | 413, message: string) {
    super(message);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PayloadError(400, 'invalid_json_object');
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, max = 240): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string') throw new PayloadError(400, 'invalid_string');
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new PayloadError(400, 'invalid_string');
  return normalized;
}

function normalizeLanguage(value: unknown): Language {
  if (typeof value !== 'string') return 'de';
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return base === 'tr' || base === 'en' || base === 'de' ? base : 'de';
}

function normalizeFaultCode(value: unknown): string | undefined {
  const code = optionalString(value, 32);
  return code?.toUpperCase();
}

function parseVehicle(value: unknown): VehicleContext | undefined {
  if (value == null) return undefined;
  const row = asRecord(value);
  const yearValue = row.year;
  let year: number | undefined;
  if (yearValue != null && yearValue !== '') {
    const parsed = typeof yearValue === 'number' ? yearValue : Number(yearValue);
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2200) throw new PayloadError(400, 'invalid_vehicle_year');
    year = parsed;
  }

  const vehicle: VehicleContext = {
    brand: optionalString(row.brand, 80),
    model: optionalString(row.model, 80),
    body: optionalString(row.body, 80),
    year,
    engine: optionalString(row.engine, 120),
  };
  return Object.values(vehicle).some((entry) => entry != null) ? vehicle : undefined;
}

function requiredMessage(value: unknown): string {
  if (typeof value !== 'string') throw new PayloadError(400, 'message_required');
  const message = value.trim();
  if (!message) throw new PayloadError(400, 'message_required');
  if (message.length > MAX_MESSAGE_CHARS) throw new PayloadError(400, 'message_too_long');
  return message;
}

export async function readPublicJson(request: Request): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_PUBLIC_BODY_BYTES) throw new PayloadError(413, 'payload_too_large');
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PUBLIC_BODY_BYTES) {
    throw new PayloadError(413, 'payload_too_large');
  }
  try {
    return asRecord(JSON.parse(raw));
  } catch (error) {
    if (error instanceof PayloadError) throw error;
    throw new PayloadError(400, 'invalid_json');
  }
}

export interface StartChatPayload extends Omit<CreateConversationInput, 'id'> {
  message: string;
}

export interface VisitorMessagePayload extends ConversationContextPatch {
  message: string;
}

function contextFields(row: Record<string, unknown>) {
  return {
    language: normalizeLanguage(row.language),
    pagePath: optionalString(row.pagePath, 500),
    faultCode: normalizeFaultCode(row.faultCode),
    vehicle: parseVehicle(row.vehicle),
    visitorSessionId: optionalString(row.visitorSessionId, 200),
  };
}

export function parseStartChatPayload(row: Record<string, unknown>): StartChatPayload {
  return {
    ...contextFields(row),
    message: requiredMessage(row.message),
  };
}

export function parseVisitorMessagePayload(row: Record<string, unknown>): VisitorMessagePayload {
  const context = contextFields(row);
  const patch: VisitorMessagePayload = {
    message: requiredMessage(row.message),
    language: context.language,
  };
  if (context.pagePath) patch.pagePath = context.pagePath;
  if (context.faultCode) patch.faultCode = context.faultCode;
  if (context.vehicle) patch.vehicle = context.vehicle;
  if (context.visitorSessionId) patch.visitorSessionId = context.visitorSessionId;
  return patch;
}
