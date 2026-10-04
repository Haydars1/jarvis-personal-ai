import { describe, expect, it } from "vitest";
import { loadVehicle, saveVehicle, VEHICLE_STORAGE_KEY } from "./persistence";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("vehicle persistence", () => {
  it("round-trips a complete vehicle selection", () => {
    const storage = new MemoryStorage();
    const vehicle = {
      brand: "Volkswagen",
      model: "Passat",
      body: "B8",
      year: 2017,
      engine: "2.0 TDI CRLB",
    };

    saveVehicle(storage, vehicle);

    expect(loadVehicle(storage)).toEqual(vehicle);
  });

  it("returns an empty safe context for corrupt or incomplete storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(VEHICLE_STORAGE_KEY, "{not-json");
    expect(loadVehicle(storage)).toEqual({});

    storage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify({ brand: "BMW" }));
    expect(loadVehicle(storage)).toEqual({});
  });

  it("removes persisted state when saving an empty context", () => {
    const storage = new MemoryStorage();
    storage.setItem(VEHICLE_STORAGE_KEY, "stale");

    saveVehicle(storage, {});

    expect(storage.getItem(VEHICLE_STORAGE_KEY)).toBeNull();
  });
});
