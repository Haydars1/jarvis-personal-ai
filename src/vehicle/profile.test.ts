import { describe, expect, it } from "vitest";
import { getVehicleOptions } from "./catalog";
import { resolveVehicleProfile } from "./profile";

describe("vehicle profile resolution", () => {
  it("resolves the supported exact vehicle profiles", () => {
    const passat = resolveVehicleProfile({
      brand: "Volkswagen",
      model: "Passat",
      body: "B8",
      year: 2017,
      engine: "2.0 TDI CRLB",
    });
    const bmw = resolveVehicleProfile({
      brand: "BMW",
      model: "3er",
      body: "G20/G21",
      year: 2021,
      engine: "320d B47",
    });
    const ford = resolveVehicleProfile({
      brand: "Ford",
      model: "Focus",
      body: "MK4",
      year: 2020,
      engine: "2.0 EcoBlue",
    });
    const mercedes = resolveVehicleProfile({
      brand: "Mercedes-Benz",
      model: "E-Klasse",
      body: "W213/S213",
      year: 2020,
      engine: "E 220 d OM654",
    });

    expect(passat).toMatchObject({
      profileKey: "vw-passat-b8-crlb",
      confidence: "exact",
      platformId: "vw-mqb-long",
    });
    expect(bmw).toMatchObject({
      profileKey: "bmw-g20-g21-320d-b47",
      confidence: "exact",
      platformId: "bmw-clar-rwd",
    });
    expect(ford).toMatchObject({
      profileKey: "ford-focus-mk4-ecoblue-2.0",
      confidence: "exact",
      platformId: "ford-c2-fwd",
    });
    expect(mercedes).toMatchObject({
      profileKey: "mercedes-w213-s213-e220d-om654",
      confidence: "exact",
      platformId: "mercedes-mra-rwd",
    });

    expect(new Set([passat.bodyVariant, bmw.bodyVariant, ford.bodyVariant, mercedes.bodyVariant]).size).toBe(4);
  });

  it("falls back from exact vehicle to platform, engine, then generic", () => {
    expect(
      resolveVehicleProfile({
        brand: "Volkswagen",
        model: "Passat",
        body: "B8",
        year: 2019,
        engine: "unknown engine",
      }).confidence,
    ).toBe("platform");

    expect(
      resolveVehicleProfile({
        brand: "Other",
        model: "Custom",
        body: "X",
        year: 2021,
        engine: "2.0 diesel B47",
      }).confidence,
    ).toBe("engine");

    expect(
      resolveVehicleProfile({
        brand: "Other",
        model: "Unknown",
        body: "Unknown",
        year: 2021,
        engine: "Unknown",
      }).confidence,
    ).toBe("generic");
  });

  it("does not claim a verified SCR layout for Passat B8 CRLB", () => {
    const profile = resolveVehicleProfile({
      brand: "Volkswagen",
      model: "Passat",
      body: "B8",
      year: 2017,
      engine: "2.0 TDI CRLB",
    });

    expect(profile.verifiedSystems.scr).toBe(false);
  });

  it("returns cascading catalog options", () => {
    expect(getVehicleOptions({}).brands).toContain("Volkswagen");
    expect(getVehicleOptions({ brand: "BMW" }).models).toContain("3er");
    expect(getVehicleOptions({ brand: "BMW", model: "3er" }).bodies).toContain("G20/G21");
    expect(
      getVehicleOptions({ brand: "BMW", model: "3er", body: "G20/G21" }).years,
    ).toContain(2021);
    expect(
      getVehicleOptions({ brand: "BMW", model: "3er", body: "G20/G21", year: 2021 }).engines,
    ).toContain("320d B47");
  });
});
