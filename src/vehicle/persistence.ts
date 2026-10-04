import type { VehicleContext } from "./catalog";

export const VEHICLE_STORAGE_KEY = "6006_vehicle";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isCompleteVehicle(value: unknown): value is Required<VehicleContext> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.brand === "string" && candidate.brand.trim().length > 0 &&
    typeof candidate.model === "string" && candidate.model.trim().length > 0 &&
    typeof candidate.body === "string" && candidate.body.trim().length > 0 &&
    Number.isFinite(Number(candidate.year)) &&
    typeof candidate.engine === "string" && candidate.engine.trim().length > 0
  );
}

export function loadVehicle(storage: StorageLike | undefined = globalThis.localStorage): VehicleContext {
  try {
    const raw = storage?.getItem(VEHICLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isCompleteVehicle(parsed)) return {};
    return {
      brand: parsed.brand.trim(),
      model: parsed.model.trim(),
      body: parsed.body.trim(),
      year: Number(parsed.year),
      engine: parsed.engine.trim(),
    };
  } catch {
    return {};
  }
}

export function saveVehicle(
  storage: StorageLike | undefined = globalThis.localStorage,
  vehicle: VehicleContext,
): void {
  if (!storage) return;
  if (!vehicle || Object.keys(vehicle).length === 0) {
    storage.removeItem(VEHICLE_STORAGE_KEY);
    return;
  }

  if (!isCompleteVehicle(vehicle)) {
    storage.removeItem(VEHICLE_STORAGE_KEY);
    return;
  }

  storage.setItem(
    VEHICLE_STORAGE_KEY,
    JSON.stringify({
      brand: vehicle.brand.trim(),
      model: vehicle.model.trim(),
      body: vehicle.body.trim(),
      year: Number(vehicle.year),
      engine: vehicle.engine.trim(),
    }),
  );
}
