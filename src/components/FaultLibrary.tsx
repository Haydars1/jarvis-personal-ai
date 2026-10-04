import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { allFaults, localizeFault } from "../domain/faults";
import type { Language } from "../i18n/language";

type FaultGroup = "all" | "engine" | "exhaust" | "safety" | "electrical";

const labels: Record<Language, Record<FaultGroup, string>> = {
  de: { all: "Alle", engine: "Motor", exhaust: "Abgas", safety: "Bremsen / Sicherheit", electrical: "Elektrik" },
  tr: { all: "Tümü", engine: "Motor", exhaust: "Egzoz", safety: "Fren / Güvenlik", electrical: "Elektrik" },
  en: { all: "All", engine: "Engine", exhaust: "Exhaust", safety: "Brakes / Safety", electrical: "Electrical" },
};

const searchLabels: Record<Language, string> = {
  de: "Fehlercode suchen",
  tr: "Arıza kodu ara",
  en: "Search fault code",
};

function groupFor(system: string, code: string): FaultGroup {
  const text = `${system} ${code}`.toLowerCase();
  if (/abs|airbag|brem|brake|srs|lenkung|steer|tpms|reifen/.test(text)) return "safety";
  if (/abgas|dpf|scr|adblue|nox|lambda|katalys/.test(text)) return "exhaust";
  if (/batter|spannung|generator|elektr|can|steuergerät/.test(text)) return "electrical";
  return "engine";
}

export function FaultLibrary({ language }: { language: Language }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<FaultGroup>("all");

  const faults = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allFaults()
      .map((fault) => localizeFault(fault, language))
      .filter((fault) => group === "all" || groupFor(fault.system ?? "", fault.code ?? "") === group)
      .filter((fault) => {
        if (!normalizedQuery) return true;
        return `${fault.code} ${fault.title} ${fault.system} ${fault.meaning ?? ""}`.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, normalizedQuery ? 40 : 18);
  }, [group, language, query]);

  return (
    <div className="faultLibrary">
      <div className="faultTools">
        <input
          type="search"
          aria-label={searchLabels[language]}
          placeholder={searchLabels[language]}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="faultFilters" aria-label="Fault filters">
          {(Object.keys(labels[language]) as FaultGroup[]).map((key) => (
            <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)}>
              {labels[language][key]}
            </button>
          ))}
        </div>
      </div>
      <div className="faultRows">
        {faults.map((fault) => (
          <Link key={fault.code} to={`/fehlercodes/${fault.code}`} aria-label={`${fault.code} ${fault.title}`} className="faultRow">
            <span className="faultCode">{fault.code}</span>
            <strong>{fault.title}</strong>
            <small>{fault.system}</small>
            <b aria-hidden="true">↗</b>
          </Link>
        ))}
      </div>
    </div>
  );
}
