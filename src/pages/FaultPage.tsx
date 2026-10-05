import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaultVisualCard } from "../components/FaultVisualCard";
import { PublicSupportChat } from "../components/PublicSupportChat";
import { resolveFaultScene } from "../domain/fault-scene-resolver";
import { faultByCode, localizeFault } from "../domain/faults";
import { loadLanguage, type Language } from "../i18n/language";
import "./FaultPage.css";

type Copy = {
  back: string;
  system: string;
  severity: string;
  drive: string;
  meaning: string;
  symptoms: string;
  causes: string;
  diagnosis: string;
  solutions: string;
  note: string;
  unknownTitle: string;
  unknownText: string;
};

const COPY: Record<Language, Copy> = {
  de: {
    back: "Fehlerbibliothek",
    system: "System",
    severity: "Priorität",
    drive: "Weiterfahren",
    meaning: "Bedeutung",
    symptoms: "Mögliche Symptome",
    causes: "Mögliche Ursachen",
    diagnosis: "Diagnose",
    solutions: "Lösungen",
    note: "Hinweis",
    unknownTitle: "Unbekannter Fehlercode",
    unknownText: "Dieser Code ist nicht in der 6006 Fehlerbibliothek. Es wird keine technische Diagnose erfunden; bitte vollständigen Diagnosebericht und Steuergerät prüfen.",
  },
  tr: {
    back: "Arıza kütüphanesi",
    system: "Sistem",
    severity: "Öncelik",
    drive: "Sürüş",
    meaning: "Anlamı",
    symptoms: "Olası belirtiler",
    causes: "Olası nedenler",
    diagnosis: "Teşhis",
    solutions: "Çözümler",
    note: "Not",
    unknownTitle: "Bilinmeyen arıza kodu",
    unknownText: "Bu kod 6006 arıza kütüphanesinde bulunmuyor. Teknik teşhis uydurulmaz; tam teşhis raporu ve kontrol ünitesi kontrol edilmelidir.",
  },
  en: {
    back: "Fault library",
    system: "System",
    severity: "Priority",
    drive: "Driving",
    meaning: "Meaning",
    symptoms: "Possible symptoms",
    causes: "Possible causes",
    diagnosis: "Diagnosis",
    solutions: "Solutions",
    note: "Note",
    unknownTitle: "Unknown fault code",
    unknownText: "This code is not in the 6006 fault library. No technical diagnosis is invented; review the complete diagnostic report and control unit.",
  },
};

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="faultDetailList">
      <span>{title}</span>
      <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </section>
  );
}

function deviceLanguage(): string {
  return typeof navigator === "undefined" ? "de" : navigator.language || "de";
}

export function FaultPage() {
  const { code: routeCode } = useParams<{ code: string }>();
  const code = String(routeCode ?? "").trim().toUpperCase();
  const [language] = useState<Language>(() => loadLanguage(localStorage, deviceLanguage()));
  const source = faultByCode(code);
  const fault = source ? localizeFault(source, language) : undefined;
  const scene = fault ? resolveFaultScene(fault) : undefined;
  const copy = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <div className="faultPage" data-fault-layout="6006-v2">
      <header className="faultHeader">
        <Link to="/" className="faultBrand" aria-label="6006 Performance home"><strong>6006</strong><span>PERFORMANCE</span></Link>
        <Link to="/#faults" className="faultBack">← {copy.back}</Link>
      </header>

      <main className="faultPageMain">
        {!fault ? (
          <section className="unknownFault">
            <span>6006 / DTC</span>
            <h1>{code || "—"}</h1>
            <h2>{copy.unknownTitle}</h2>
            <p>{copy.unknownText}</p>
            <Link to="/#faults">← {copy.back}</Link>
          </section>
        ) : (
          <>
            <section className={`faultHero faultTone-${fault.tone ?? "neutral"}`}>
              <div className="faultHeroCode">
                <span>6006 / DTC</span>
                <h1>{fault.code}</h1>
              </div>
              <div className="faultHeroCopy">
                <p>{fault.system}</p>
                <h2>{fault.title}</h2>
                <p className="faultMeaningLead">{fault.meaning}</p>
              </div>
            </section>

            <section className="faultMetaGrid">
              <article><span>{copy.system}</span><strong>{fault.system}</strong></article>
              <article><span>{copy.severity}</span><strong>{fault.severity}</strong></article>
              <article><span>{copy.drive}</span><strong>{fault.drive}</strong></article>
            </section>

            {scene && <FaultVisualCard scene={scene} language={language} />}

            <section className="faultMeaningSection">
              <span>{copy.meaning}</span>
              <h2>{fault.meaning}</h2>
              <p>{fault.note}</p>
            </section>

            <div className="faultDetailGrid">
              <DetailList title={copy.symptoms} items={fault.symptoms} />
              <DetailList title={copy.causes} items={fault.causes} />
              <DetailList title={copy.diagnosis} items={fault.diagnosis} />
              <DetailList title={copy.solutions} items={fault.solutions} />
            </div>

            <section className="faultSafetyNote">
              <span>{copy.note}</span>
              <p>{fault.note}</p>
              <strong>{language === "tr" ? "Tek bir DTC, tek bir parçanın kesin arızalı olduğunu kanıtlamaz." : language === "en" ? "A single DTC does not prove that one specific component has definitely failed." : "Ein einzelner DTC beweist nicht, dass ein bestimmtes Bauteil sicher defekt ist."}</strong>
            </section>
          </>
        )}
      </main>

      <PublicSupportChat language={language} vehicle={{}} faultCode={code || undefined} />
    </div>
  );
}
