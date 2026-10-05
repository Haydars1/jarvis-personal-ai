import { describe, expect, it } from "vitest";
import { faultByCode } from "./faults";
import type { FaultEntry } from "./faults.types";
import { FAULT_SCENES } from "./fault-scenes";
import { resolveFaultScene } from "./fault-scene-resolver";

function synthetic(overrides: Partial<FaultEntry>): FaultEntry {
  return {
    code: "X0000",
    title: "Generic fault",
    system: "Generic system",
    severity: "Mittel",
    drive: "Prüfen",
    meaning: "Generic meaning",
    symptoms: [],
    causes: [],
    diagnosis: [],
    solutions: [],
    note: "Generic note",
    ...overrides,
  };
}

describe("fault scene resolver", () => {
  it("resolves P0299 to boost", () => {
    const fault = faultByCode("P0299");
    expect(fault).toBeDefined();
    expect(resolveFaultScene(fault!)).toMatchObject({ id: "boost" });
  });

  it("resolves current DPF records to dpf", () => {
    expect(resolveFaultScene(faultByCode("DPF")!)).toMatchObject({ id: "dpf" });
    expect(resolveFaultScene(faultByCode("P2002")!)).toMatchObject({ id: "dpf" });
    expect(resolveFaultScene(faultByCode("P2453")!)).toMatchObject({ id: "dpf" });
  });

  it("resolves SCR AdBlue and NOx wording to scr case-insensitively", () => {
    expect(resolveFaultScene(synthetic({ system: "Abgas / SCR", title: "AdBlue dosing fault" }))).toMatchObject({ id: "scr" });
    expect(resolveFaultScene(synthetic({ system: "nox treatment", title: "sensor plausibility" }))).toMatchObject({ id: "scr" });
  });

  it("resolves brakes oil and cooling wording conservatively", () => {
    expect(resolveFaultScene(faultByCode("ABS")!)).toMatchObject({ id: "brakes" });
    expect(resolveFaultScene(faultByCode("OIL")!)).toMatchObject({ id: "oil" });
    expect(resolveFaultScene(synthetic({ system: "Motor / Kühlung", title: "Kühlmitteltemperatur zu hoch" }))).toMatchObject({ id: "cooling" });
    expect(resolveFaultScene(synthetic({ system: "engine cooling", title: "coolant temperature" }))).toMatchObject({ id: "cooling" });
  });

  it("does not invent a scene for an unrelated fault", () => {
    expect(resolveFaultScene(synthetic({ code: "U0100", system: "CAN-Bus / Kommunikation", title: "Kommunikationsfehler" }))).toBeUndefined();
  });
});

describe("fault scene data", () => {
  it("keeps every scene focused to four through six nodes with valid flow ids", () => {
    for (const scene of Object.values(FAULT_SCENES)) {
      expect(scene.nodes.length).toBeGreaterThanOrEqual(4);
      expect(scene.nodes.length).toBeLessThanOrEqual(6);
      expect(scene.flow.length).toBe(scene.nodes.length);
      const nodeIds = new Set(scene.nodes.map((node) => node.id));
      for (const id of scene.flow) expect(nodeIds.has(id)).toBe(true);
    }
  });
});
