export type VehicleContext = {
  brand?: string;
  model?: string;
  body?: string;
  year?: number;
  engine?: string;
};

export type VehicleCatalogEntry = {
  brand: string;
  model: string;
  body: string;
  yearFrom: number;
  yearTo: number;
  engines: readonly string[];
  platformId: string;
};

export type VehicleOptions = {
  brands: string[];
  models: string[];
  bodies: string[];
  years: number[];
  engines: string[];
};

export const VEHICLE_CATALOG: readonly VehicleCatalogEntry[] = [
  { brand: "Volkswagen", model: "Passat", body: "B8", yearFrom: 2014, yearTo: 2023, engines: ["2.0 TDI CRLB", "2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Volkswagen", model: "Golf", body: "7", yearFrom: 2012, yearTo: 2020, engines: ["2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Volkswagen", model: "Golf", body: "8", yearFrom: 2019, yearTo: 2026, engines: ["2.0 TDI EA288 evo"], platformId: "vw-mqb-long" },
  { brand: "Volkswagen", model: "Tiguan", body: "II", yearFrom: 2016, yearTo: 2024, engines: ["2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Audi", model: "A3", body: "8V", yearFrom: 2012, yearTo: 2020, engines: ["2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Audi", model: "A3", body: "8Y", yearFrom: 2020, yearTo: 2026, engines: ["2.0 TDI EA288 evo"], platformId: "vw-mqb-long" },
  { brand: "Skoda", model: "Octavia", body: "III", yearFrom: 2013, yearTo: 2020, engines: ["2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Skoda", model: "Octavia", body: "IV", yearFrom: 2020, yearTo: 2026, engines: ["2.0 TDI EA288 evo"], platformId: "vw-mqb-long" },
  { brand: "Seat / Cupra", model: "Leon", body: "III", yearFrom: 2012, yearTo: 2020, engines: ["2.0 TDI EA288"], platformId: "vw-mqb-long" },
  { brand: "Seat / Cupra", model: "Leon", body: "IV", yearFrom: 2020, yearTo: 2026, engines: ["2.0 TDI EA288 evo"], platformId: "vw-mqb-long" },
  { brand: "BMW", model: "3er", body: "F30/F31", yearFrom: 2012, yearTo: 2019, engines: ["320d B47"], platformId: "bmw-clar-rwd" },
  { brand: "BMW", model: "3er", body: "G20/G21", yearFrom: 2019, yearTo: 2026, engines: ["320d B47"], platformId: "bmw-clar-rwd" },
  { brand: "BMW", model: "5er", body: "G30/G31", yearFrom: 2017, yearTo: 2024, engines: ["520d B47"], platformId: "bmw-clar-rwd" },
  { brand: "BMW", model: "X3", body: "G01", yearFrom: 2017, yearTo: 2024, engines: ["xDrive20d B47"], platformId: "bmw-clar-rwd" },
  { brand: "Mercedes-Benz", model: "C-Klasse", body: "W205/S205", yearFrom: 2014, yearTo: 2021, engines: ["C 220 d OM654"], platformId: "mercedes-mra-rwd" },
  { brand: "Mercedes-Benz", model: "E-Klasse", body: "W213/S213", yearFrom: 2016, yearTo: 2023, engines: ["E 220 d OM654"], platformId: "mercedes-mra-rwd" },
  { brand: "Mercedes-Benz", model: "GLC", body: "X253", yearFrom: 2015, yearTo: 2022, engines: ["220 d OM654"], platformId: "mercedes-mra-rwd" },
  { brand: "Ford", model: "Focus", body: "MK4", yearFrom: 2018, yearTo: 2026, engines: ["2.0 EcoBlue"], platformId: "ford-c2-fwd" },
  { brand: "Ford", model: "Mondeo", body: "MK5", yearFrom: 2014, yearTo: 2022, engines: ["2.0 EcoBlue"], platformId: "ford-c2-fwd" },
  { brand: "Ford", model: "Kuga", body: "III", yearFrom: 2019, yearTo: 2026, engines: ["2.0 EcoBlue"], platformId: "ford-c2-fwd" },
];

const unique = <T,>(values: T[]) => Array.from(new Set(values));
const eq = (left: unknown, right: unknown) =>
  String(left ?? "").trim().toLocaleLowerCase("de-DE") ===
  String(right ?? "").trim().toLocaleLowerCase("de-DE");

export function getVehicleOptions(context: VehicleContext): VehicleOptions {
  const brands = unique(VEHICLE_CATALOG.map((entry) => entry.brand));
  const byBrand = context.brand
    ? VEHICLE_CATALOG.filter((entry) => eq(entry.brand, context.brand))
    : [];
  const models = unique(byBrand.map((entry) => entry.model));
  const byModel = context.model
    ? byBrand.filter((entry) => eq(entry.model, context.model))
    : [];
  const bodies = unique(byModel.map((entry) => entry.body));
  const byBody = context.body
    ? byModel.filter((entry) => eq(entry.body, context.body))
    : [];
  const years = unique(
    byBody.flatMap((entry) =>
      Array.from({ length: entry.yearTo - entry.yearFrom + 1 }, (_, index) => entry.yearFrom + index),
    ),
  ).sort((a, b) => b - a);
  const byYear = Number.isFinite(context.year)
    ? byBody.filter(
        (entry) => Number(context.year) >= entry.yearFrom && Number(context.year) <= entry.yearTo,
      )
    : [];
  const engines = unique(byYear.flatMap((entry) => [...entry.engines]));

  return { brands, models, bodies, years, engines };
}

export function findCatalogEntry(context: VehicleContext): VehicleCatalogEntry | undefined {
  if (!context.brand || !context.model || !context.body || !Number.isFinite(context.year)) return undefined;
  return VEHICLE_CATALOG.find(
    (entry) =>
      eq(entry.brand, context.brand) &&
      eq(entry.model, context.model) &&
      eq(entry.body, context.body) &&
      Number(context.year) >= entry.yearFrom &&
      Number(context.year) <= entry.yearTo,
  );
}
