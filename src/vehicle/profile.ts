import { findCatalogEntry, type VehicleContext } from "./catalog";

export type Point = { x: number; y: number };
export type ProfileConfidence = "exact" | "platform" | "engine" | "generic";
export type VehicleSystem =
  | "scr"
  | "dpf"
  | "boost"
  | "fuel"
  | "combustion"
  | "cooling"
  | "oil"
  | "brakes"
  | "steering"
  | "charging"
  | "transmission"
  | "generic";

export type ResolvedVehicleProfile = {
  profileKey: string;
  confidence: ProfileConfidence;
  label: string;
  platformId?: string;
  engineFamilyId?: string;
  bodyVariant: string;
  placements: Record<string, Point>;
  verifiedSystems: Partial<Record<VehicleSystem, boolean>>;
};

type PlatformProfile = {
  bodyVariant: string;
  placements: Record<string, Point>;
};

type EngineProfile = {
  familyId: string;
  matches: RegExp;
  placements: Record<string, Point>;
};

type ExactProfile = {
  profileKey: string;
  brand: string;
  model: string;
  body: string;
  yearFrom: number;
  yearTo: number;
  engine: string;
  platformId: keyof typeof PLATFORM_PROFILES;
  engineFamilyId: string;
  label: string;
  overrides?: Record<string, Point>;
  verifiedSystems: Partial<Record<VehicleSystem, boolean>>;
};

const p = (x: number, y: number): Point => ({ x, y });

const PLATFORM_PROFILES = {
  "vw-mqb-long": {
    bodyVariant: "wagon-fwd-long",
    placements: {
      engine: p(225, 215),
      "engine-out": p(245, 230),
      "intake-path": p(115, 190),
      turbo: p(265, 185),
      "turbo-actuator": p(285, 125),
      "boost-path": p(175, 295),
      "boost-sensor": p(205, 145),
      "boost-control": p(310, 285),
      "filter-core": p(455, 285),
      "oxidation-zone": p(385, 275),
      "pressure-sensor": p(500, 215),
      "soot-load": p(470, 235),
      tailpipe: p(880, 310),
      "tank-dose-path": p(790, 305),
      "dose-module": p(760, 275),
      "dosing-injector": p(560, 275),
      "nox-upstream": p(530, 235),
      "scr-catalyst": p(625, 290),
      "nox-downstream": p(700, 245),
      "battery-path": p(180, 135),
      alternator: p(235, 170),
      "abs-module": p(155, 240),
      "wheel-input": p(120, 320),
      "brake-circuit": p(470, 330),
      "brake-wheels": p(820, 330),
      "epb-actuator": p(790, 250),
      "coolant-pump": p(205, 245),
      "coolant-sensor": p(270, 145),
      thermostat: p(180, 185),
      radiator: p(105, 220),
      "cooling-loop": p(260, 300),
      "oil-sump": p(230, 285),
      "oil-pump": p(245, 255),
      "oil-filter": p(285, 230),
      "oil-pressure-sensor": p(280, 170),
      "oil-circuit": p(245, 205),
    },
  },
  "bmw-clar-rwd": {
    bodyVariant: "sedan-rwd-longnose",
    placements: {
      engine: p(265, 215),
      "engine-out": p(285, 230),
      "intake-path": p(140, 175),
      turbo: p(315, 165),
      "turbo-actuator": p(335, 115),
      "boost-path": p(170, 300),
      "boost-sensor": p(225, 145),
      "boost-control": p(355, 290),
      "filter-core": p(485, 290),
      "oxidation-zone": p(405, 280),
      "pressure-sensor": p(525, 220),
      "soot-load": p(500, 240),
      tailpipe: p(885, 315),
      "tank-dose-path": p(825, 295),
      "dose-module": p(790, 265),
      "dosing-injector": p(595, 275),
      "nox-upstream": p(560, 235),
      "scr-catalyst": p(655, 290),
      "nox-downstream": p(735, 245),
      "battery-path": p(805, 155),
      alternator: p(280, 170),
      "abs-module": p(175, 235),
      "wheel-input": p(130, 320),
      "brake-circuit": p(500, 330),
      "brake-wheels": p(830, 330),
      "epb-actuator": p(800, 245),
      "coolant-pump": p(240, 245),
      "coolant-sensor": p(315, 145),
      thermostat: p(210, 180),
      radiator: p(110, 220),
      "cooling-loop": p(300, 300),
      "oil-sump": p(270, 285),
      "oil-pump": p(285, 255),
      "oil-filter": p(325, 230),
      "oil-pressure-sensor": p(325, 170),
      "oil-circuit": p(285, 205),
    },
  },
  "mercedes-mra-rwd": {
    bodyVariant: "estate-rwd-longnose",
    placements: {
      engine: p(250, 215),
      "engine-out": p(270, 230),
      "intake-path": p(125, 180),
      turbo: p(300, 175),
      "turbo-actuator": p(320, 120),
      "boost-path": p(160, 302),
      "boost-sensor": p(215, 148),
      "boost-control": p(340, 288),
      "filter-core": p(470, 290),
      "oxidation-zone": p(395, 280),
      "pressure-sensor": p(515, 215),
      "soot-load": p(492, 238),
      tailpipe: p(880, 312),
      "tank-dose-path": p(805, 300),
      "dose-module": p(775, 270),
      "dosing-injector": p(580, 275),
      "nox-upstream": p(545, 236),
      "scr-catalyst": p(640, 290),
      "nox-downstream": p(720, 245),
      "battery-path": p(745, 155),
      alternator: p(270, 170),
      "abs-module": p(165, 240),
      "wheel-input": p(125, 320),
      "brake-circuit": p(490, 330),
      "brake-wheels": p(825, 330),
      "epb-actuator": p(790, 250),
      "coolant-pump": p(225, 245),
      "coolant-sensor": p(300, 145),
      thermostat: p(195, 182),
      radiator: p(108, 220),
      "cooling-loop": p(285, 300),
      "oil-sump": p(255, 285),
      "oil-pump": p(270, 255),
      "oil-filter": p(310, 230),
      "oil-pressure-sensor": p(310, 170),
      "oil-circuit": p(270, 205),
    },
  },
  "ford-c2-fwd": {
    bodyVariant: "hatch-fwd-short",
    placements: {
      engine: p(215, 220),
      "engine-out": p(235, 235),
      "intake-path": p(105, 190),
      turbo: p(250, 190),
      "turbo-actuator": p(270, 128),
      "boost-path": p(150, 300),
      "boost-sensor": p(195, 150),
      "boost-control": p(300, 288),
      "filter-core": p(430, 292),
      "oxidation-zone": p(365, 282),
      "pressure-sensor": p(475, 220),
      "soot-load": p(452, 240),
      tailpipe: p(870, 315),
      "tank-dose-path": p(760, 302),
      "dose-module": p(730, 272),
      "dosing-injector": p(540, 278),
      "nox-upstream": p(510, 238),
      "scr-catalyst": p(605, 292),
      "nox-downstream": p(680, 248),
      "battery-path": p(160, 140),
      alternator: p(230, 175),
      "abs-module": p(150, 245),
      "wheel-input": p(115, 320),
      "brake-circuit": p(455, 332),
      "brake-wheels": p(805, 332),
      "epb-actuator": p(760, 252),
      "coolant-pump": p(195, 248),
      "coolant-sensor": p(265, 148),
      thermostat: p(170, 185),
      radiator: p(98, 223),
      "cooling-loop": p(250, 302),
      "oil-sump": p(220, 288),
      "oil-pump": p(235, 258),
      "oil-filter": p(275, 233),
      "oil-pressure-sensor": p(275, 172),
      "oil-circuit": p(235, 208),
    },
  },
} satisfies Record<string, PlatformProfile>;

const ENGINE_PROFILES: readonly EngineProfile[] = [
  {
    familyId: "ea288-2.0-tdi",
    matches: /\b(crlb|ea288)\b/i,
    placements: { turbo: p(270, 182), "filter-core": p(455, 290) },
  },
  {
    familyId: "bmw-b47",
    matches: /\bb47\b/i,
    placements: { turbo: p(325, 162), "filter-core": p(495, 290), "scr-catalyst": p(665, 292) },
  },
  {
    familyId: "om654",
    matches: /\bom654\b/i,
    placements: { turbo: p(305, 172), "filter-core": p(478, 291), "scr-catalyst": p(646, 292) },
  },
  {
    familyId: "ford-ecoblue-2.0",
    matches: /\becoblue\b/i,
    placements: { turbo: p(252, 188), "filter-core": p(438, 292), "scr-catalyst": p(612, 292) },
  },
];

const EXACT_PROFILES: readonly ExactProfile[] = [
  {
    profileKey: "vw-passat-b8-crlb",
    brand: "Volkswagen",
    model: "Passat",
    body: "B8",
    yearFrom: 2014,
    yearTo: 2023,
    engine: "2.0 TDI CRLB",
    platformId: "vw-mqb-long",
    engineFamilyId: "ea288-2.0-tdi",
    label: "Volkswagen Passat B8 · 2.0 TDI CRLB",
    verifiedSystems: { scr: false, dpf: true, boost: true, cooling: true, oil: true, brakes: true, charging: true },
  },
  {
    profileKey: "bmw-g20-g21-320d-b47",
    brand: "BMW",
    model: "3er",
    body: "G20/G21",
    yearFrom: 2019,
    yearTo: 2026,
    engine: "320d B47",
    platformId: "bmw-clar-rwd",
    engineFamilyId: "bmw-b47",
    label: "BMW 3er G20/G21 · 320d B47",
    overrides: { "battery-path": p(820, 160) },
    verifiedSystems: { scr: true, dpf: true, boost: true, cooling: true, oil: true, brakes: true, charging: true },
  },
  {
    profileKey: "ford-focus-mk4-ecoblue-2.0",
    brand: "Ford",
    model: "Focus",
    body: "MK4",
    yearFrom: 2018,
    yearTo: 2026,
    engine: "2.0 EcoBlue",
    platformId: "ford-c2-fwd",
    engineFamilyId: "ford-ecoblue-2.0",
    label: "Ford Focus MK4 · 2.0 EcoBlue",
    verifiedSystems: { scr: true, dpf: true, boost: true, cooling: true, oil: true, brakes: true, charging: true },
  },
  {
    profileKey: "mercedes-w213-s213-e220d-om654",
    brand: "Mercedes-Benz",
    model: "E-Klasse",
    body: "W213/S213",
    yearFrom: 2016,
    yearTo: 2023,
    engine: "E 220 d OM654",
    platformId: "mercedes-mra-rwd",
    engineFamilyId: "om654",
    label: "Mercedes-Benz E-Klasse W213/S213 · E 220 d OM654",
    overrides: { "tank-dose-path": p(815, 300) },
    verifiedSystems: { scr: true, dpf: true, boost: true, cooling: true, oil: true, brakes: true, charging: true },
  },
];

const normalized = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("de-DE");
const same = (left: unknown, right: unknown) => normalized(left) === normalized(right);
const yearMatches = (year: number | undefined, from: number, to: number) =>
  Number.isFinite(year) && Number(year) >= from && Number(year) <= to;

function engineProfile(engine: string | undefined) {
  return ENGINE_PROFILES.find((candidate) => candidate.matches.test(String(engine ?? "")));
}

function vehicleLabel(context: VehicleContext) {
  return [context.brand, context.model, context.body, context.engine].filter(Boolean).join(" ") || "Allgemeine Fahrzeugdarstellung";
}

export function resolveVehicleProfile(context: VehicleContext): ResolvedVehicleProfile {
  const exact = EXACT_PROFILES.find(
    (profile) =>
      same(profile.brand, context.brand) &&
      same(profile.model, context.model) &&
      same(profile.body, context.body) &&
      same(profile.engine, context.engine) &&
      yearMatches(context.year, profile.yearFrom, profile.yearTo),
  );

  if (exact) {
    const platform = PLATFORM_PROFILES[exact.platformId];
    const engine = ENGINE_PROFILES.find((candidate) => candidate.familyId === exact.engineFamilyId);
    return {
      profileKey: exact.profileKey,
      confidence: "exact",
      label: exact.label,
      platformId: exact.platformId,
      engineFamilyId: exact.engineFamilyId,
      bodyVariant: platform.bodyVariant,
      placements: { ...platform.placements, ...engine?.placements, ...exact.overrides },
      verifiedSystems: { ...exact.verifiedSystems },
    };
  }

  const catalogEntry = findCatalogEntry(context);
  if (catalogEntry) {
    const platform = PLATFORM_PROFILES[catalogEntry.platformId as keyof typeof PLATFORM_PROFILES];
    if (platform) {
      return {
        profileKey: `platform:${catalogEntry.platformId}`,
        confidence: "platform",
        label: vehicleLabel(context),
        platformId: catalogEntry.platformId,
        bodyVariant: platform.bodyVariant,
        placements: { ...platform.placements },
        verifiedSystems: {},
      };
    }
  }

  const engine = engineProfile(context.engine);
  if (engine) {
    return {
      profileKey: `engine:${engine.familyId}`,
      confidence: "engine",
      label: vehicleLabel(context),
      engineFamilyId: engine.familyId,
      bodyVariant: "generic-engine",
      placements: { ...engine.placements },
      verifiedSystems: {},
    };
  }

  return {
    profileKey: "generic",
    confidence: "generic",
    label: vehicleLabel(context),
    bodyVariant: "generic",
    placements: {},
    verifiedSystems: {},
  };
}
