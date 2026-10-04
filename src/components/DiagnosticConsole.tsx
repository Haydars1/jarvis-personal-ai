import type { Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import "./DiagnosticConsole.css";

type Copy = {
  kicker: string;
  title: string;
  sample: string;
  vehicle: string;
  code: string;
  system: string;
  verification: string;
  next: string;
  systemValue: string;
  verifyValue: string;
  nextValue: string;
  ready: string;
  note: string;
};

const COPY: Record<Language, Copy> = {
  de: {
    kicker: "6006 / DIAGNOSE-WORKFLOW",
    title: "Vom Fehlercode zur belastbaren Prüfung.",
    sample: "Beispiel",
    vehicle: "Fahrzeug",
    code: "DTC",
    system: "Systembezug",
    verification: "Prüfung",
    next: "Nächster Schritt",
    systemValue: "Ladedruck / Ansaug- und Ladeluftstrecke",
    verifyValue: "Live-Daten, Dichtheit, Sensorik und Aktuatorik abgleichen",
    nextValue: "Ursache eingrenzen, erst danach reparieren oder anpassen",
    ready: "SYSTEM BEREIT",
    note: "Ein DTC benennt eine Richtung – nicht automatisch ein defektes Bauteil.",
  },
  tr: {
    kicker: "6006 / TEŞHİS AKIŞI",
    title: "Arıza kodundan doğrulanabilir kontrole.",
    sample: "Örnek",
    vehicle: "Araç",
    code: "DTC",
    system: "İlgili sistem",
    verification: "Doğrulama",
    next: "Sonraki adım",
    systemValue: "Turbo basıncı / emiş ve basınçlı hava hattı",
    verifyValue: "Canlı veri, kaçak, sensör ve aktüatörü birlikte kontrol et",
    nextValue: "Önce nedeni daralt, sonra onarım veya uyarlamaya geç",
    ready: "SİSTEM HAZIR",
    note: "Tek bir DTC yön gösterir; tek başına belirli bir parçanın bozuk olduğunu kanıtlamaz.",
  },
  en: {
    kicker: "6006 / DIAGNOSTIC WORKFLOW",
    title: "From fault code to a verifiable test path.",
    sample: "Example",
    vehicle: "Vehicle",
    code: "DTC",
    system: "System context",
    verification: "Verification",
    next: "Next step",
    systemValue: "Boost pressure / intake and charge-air path",
    verifyValue: "Cross-check live data, leaks, sensors and actuators",
    nextValue: "Narrow the cause first, repair or adapt only afterwards",
    ready: "SYSTEM READY",
    note: "A DTC points to a direction; it does not prove one specific failed component.",
  },
};

export function DiagnosticConsole({ language, vehicle }: { language: Language; vehicle: VehicleContext }) {
  const copy = COPY[language];
  const vehicleSummary = [vehicle.brand, vehicle.model, vehicle.body, vehicle.year, vehicle.engine]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="diagnosticConsole" data-diagnostic-console="true" aria-label={copy.title}>
      <div className="diagnosticConsoleTopline">
        <span>{copy.kicker}</span>
        <b><i />{copy.ready}</b>
      </div>

      <div className="diagnosticConsoleHero">
        <div>
          <small>{copy.sample}</small>
          <strong>P0299</strong>
        </div>
        <p>{copy.title}</p>
      </div>

      <div className="diagnosticConsoleVehicle">
        <span>{copy.vehicle}</span>
        <strong>{vehicleSummary || "Mercedes-Benz E-Klasse · BMW 3er · VW Passat · Ford Focus"}</strong>
      </div>

      <div className="diagnosticFlow" aria-label="diagnostic process">
        <article>
          <span>01 / {copy.code}</span>
          <strong>P0299</strong>
          <p>Underboost / boost pressure control</p>
        </article>
        <article>
          <span>02 / {copy.system}</span>
          <strong>{copy.systemValue}</strong>
        </article>
        <article>
          <span>03 / {copy.verification}</span>
          <strong>{copy.verifyValue}</strong>
        </article>
        <article>
          <span>04 / {copy.next}</span>
          <strong>{copy.nextValue}</strong>
        </article>
      </div>

      <div className="diagnosticConsoleNote">
        <i aria-hidden="true" />
        <p>{copy.note}</p>
      </div>
    </section>
  );
}
