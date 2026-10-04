import { useEffect, useMemo, useState } from "react";
import { getVehicleOptions, type VehicleContext } from "../vehicle/catalog";
import { loadVehicle, saveVehicle } from "../vehicle/persistence";
import type { Language } from "../i18n/language";
import { t } from "../i18n/language";

const order: (keyof VehicleContext)[] = ["brand", "model", "body", "year", "engine"];

function nextVehicle(current: VehicleContext, field: keyof VehicleContext, raw: string): VehicleContext {
  const index = order.indexOf(field);
  const next: VehicleContext = {};
  for (let i = 0; i < index; i += 1) {
    const key = order[i];
    const value = current[key];
    if (value !== undefined && value !== "") Object.assign(next, { [key]: value });
  }
  if (raw) Object.assign(next, { [field]: field === "year" ? Number(raw) : raw });
  return next;
}

export function VehicleSelector({ language, onChange }: { language: Language; onChange?: (vehicle: VehicleContext) => void }) {
  const [vehicle, setVehicle] = useState<VehicleContext>(() => loadVehicle(localStorage));
  const [manual, setManual] = useState(false);
  const options = useMemo(() => getVehicleOptions(vehicle), [vehicle]);

  useEffect(() => {
    onChange?.(vehicle);
  }, [onChange, vehicle]);

  const update = (field: keyof VehicleContext, value: string) => {
    const next = manual
      ? { ...vehicle, [field]: field === "year" ? Number(value) || undefined : value }
      : nextVehicle(vehicle, field, value);
    setVehicle(next);
    saveVehicle(localStorage, next);
  };

  const labels = {
    brand: t(language, "vehicle.brand"),
    model: t(language, "vehicle.model"),
    body: t(language, "vehicle.generation"),
    year: t(language, "vehicle.year"),
    engine: t(language, "vehicle.engine"),
  };

  if (manual) {
    return (
      <div className="vehicleSelector manualVehicleSelector">
        {order.map((field) => (
          <label key={field}>
            <span>{labels[field]}</span>
            <input
              aria-label={labels[field]}
              inputMode={field === "year" ? "numeric" : undefined}
              value={vehicle[field] ?? ""}
              onChange={(event) => update(field, event.target.value)}
            />
          </label>
        ))}
        <button type="button" className="manualToggle" onClick={() => { setVehicle({}); saveVehicle(localStorage, {}); setManual(false); }}>
          {language === "tr" ? "Katalog seçimine dön" : language === "en" ? "Back to catalog" : "Zur Katalogauswahl"}
        </button>
      </div>
    );
  }

  return (
    <div className="vehicleSelector">
      <label>
        <span>{labels.brand}</span>
        <select aria-label={labels.brand} value={vehicle.brand ?? ""} onChange={(event) => update("brand", event.target.value)}>
          <option value="">{t(language, "vehicle.brandPlaceholder")}</option>
          {options.brands.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>{labels.model}</span>
        <select aria-label={labels.model} value={vehicle.model ?? ""} disabled={!vehicle.brand} onChange={(event) => update("model", event.target.value)}>
          <option value="">{t(language, "vehicle.modelPlaceholder")}</option>
          {options.models.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>{labels.body}</span>
        <select aria-label={labels.body} value={vehicle.body ?? ""} disabled={!vehicle.model} onChange={(event) => update("body", event.target.value)}>
          <option value="">{t(language, "vehicle.generationPlaceholder")}</option>
          {options.bodies.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>{labels.year}</span>
        <select aria-label={labels.year} value={vehicle.year ?? ""} disabled={!vehicle.body} onChange={(event) => update("year", event.target.value)}>
          <option value="">{t(language, "vehicle.yearPlaceholder")}</option>
          {options.years.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>
        <span>{labels.engine}</span>
        <select aria-label={labels.engine} value={vehicle.engine ?? ""} disabled={!vehicle.year} onChange={(event) => update("engine", event.target.value)}>
          <option value="">{t(language, "vehicle.enginePlaceholder")}</option>
          {options.engines.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" className="manualToggle" onClick={() => setManual(true)}>
        {language === "tr" ? "Araç katalogda yok" : language === "en" ? "Vehicle not in catalog" : "Fahrzeug nicht im Katalog"}
      </button>
    </div>
  );
}
