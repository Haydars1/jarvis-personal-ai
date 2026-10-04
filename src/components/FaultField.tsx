import { Link } from "react-router-dom";
import { faultByCode, localizeFault } from "../domain/faults";
import type { Language } from "../i18n/language";

const warningCodes = ["ABS", "OIL", "BATTERY", "COOLANT", "AIRBAG", "BRAKE", "DPF", "ADBLUE", "STEERING", "EPC"];

function WarningGlyph({ code }: { code: string }) {
  if (code === "ABS") return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="17"/><path d="M10 18a27 27 0 0 0 0 28M54 18a27 27 0 0 1 0 28"/><text x="32" y="38">ABS</text></svg>;
  if (code === "OIL") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 38h29l10 8H13zM17 24h24l7 14H10zM35 24v-9M48 20l8 4"/><path d="M56 41c0 5-4 8-8 8"/></svg>;
  if (code === "BATTERY") return <svg viewBox="0 0 64 64" aria-hidden="true"><rect x="9" y="21" width="46" height="29" rx="2"/><path d="M19 16v5M45 16v5M18 35h12M24 29v12M39 35h9"/></svg>;
  if (code === "COOLANT") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M28 12v25a10 10 0 1 0 8 0V12a4 4 0 0 0-8 0zM32 25v17M8 52c5-4 10 4 15 0s10 4 15 0 10 4 18 0"/></svg>;
  if (code === "AIRBAG") return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="18" cy="17" r="6"/><path d="M13 28l10 8 8 18M23 32l8-8 8 18"/><circle cx="46" cy="29" r="10"/></svg>;
  if (code === "BRAKE") return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="18"/><path d="M9 18a28 28 0 0 0 0 28M55 18a28 28 0 0 1 0 28M32 20v16"/><circle cx="32" cy="43" r="1.7"/></svg>;
  if (code === "DPF") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M7 23h10l6-6h18l6 6h10v18H47l-6 6H23l-6-6H7z"/><path d="M26 27h12M26 33h12M26 39h12"/></svg>;
  if (code === "ADBLUE") return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 8c-9 13-18 24-18 35a18 18 0 0 0 36 0c0-11-9-22-18-35zM23 44h18M28 38h8"/></svg>;
  if (code === "STEERING") return <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="21"/><circle cx="32" cy="32" r="5"/><path d="M12 28h40M32 37v16M20 30l10 7M44 30l-10 7"/></svg>;
  return <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M13 23h8l5-7h17l5 7h6l5 7v16h-8l-4 5H21l-4-5h-7V29z"/></svg>;
}

export function FaultField({ language }: { language: Language }) {
  const items = Array.from({ length: 80 }, (_, index) => warningCodes[(index * 3 + Math.floor(index / 5)) % warningCodes.length]);
  return (
    <div className="faultField" aria-hidden="true">
      {items.map((code, index) => {
        const fault = faultByCode(code);
        const localized = fault ? localizeFault(fault, language) : undefined;
        return (
          <Link
            key={`${code}-${index}`}
            to={`/fehlercodes/${code}`}
            className={`faultFieldCell ${index % 4 === 0 ? "faultFieldCellRed" : ""}`}
            aria-label={`${code} ${localized?.title ?? ""}`}
            tabIndex={-1}
          >
            <WarningGlyph code={code} />
            <span>{code}</span>
          </Link>
        );
      })}
    </div>
  );
}
