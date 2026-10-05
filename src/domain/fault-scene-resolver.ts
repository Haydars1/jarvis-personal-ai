import type { FaultEntry } from "./faults.types";
import { FAULT_SCENES, type FaultScene, type FaultSceneId } from "./fault-scenes";

const EXACT_CODE_SCENES: Record<string, FaultSceneId> = {
  P0299: "boost",
  DPF: "dpf",
  P2002: "dpf",
  P2453: "dpf",
  ADBLUE: "scr",
  SCR: "scr",
  ABS: "brakes",
  OIL: "oil",
  COOLANT: "cooling",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function containsAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

export function resolveFaultScene(fault: FaultEntry): FaultScene | undefined {
  const code = String(fault.code ?? fault.label ?? "").trim().toUpperCase();
  const exact = EXACT_CODE_SCENES[code];
  if (exact) return FAULT_SCENES[exact];

  const text = normalize(`${code} ${fault.system} ${fault.title}`);

  if (containsAny(text, ["partikelfilter", " dpf", "dpf "])) return FAULT_SCENES.dpf;
  if (containsAny(text, ["adblue", " scr", "scr ", "nox"])) return FAULT_SCENES.scr;
  if (containsAny(text, [" abs", "abs ", "brem", "brake"])) return FAULT_SCENES.brakes;
  if (containsAny(text, ["oldruck", "schmierung", "oil pressure", "lubrication"])) return FAULT_SCENES.oil;
  if (containsAny(text, ["kuhl", "coolant", "radiator", "cooling"])) return FAULT_SCENES.cooling;
  if (containsAny(text, ["ladedruck", "turbo", "boost"])) return FAULT_SCENES.boost;

  return undefined;
}
