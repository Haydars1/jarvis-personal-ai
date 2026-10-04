import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaultSystemAnimation } from "../components/FaultSystemAnimation";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { PublicSupportChat } from "../components/PublicSupportChat";
import { VehicleSelector } from "../components/VehicleSelector";
import { faultByCode, localizeFault } from "../domain/faults";
import { loadLanguage, saveLanguage, type Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import { loadVehicle } from "../vehicle/persistence";
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
  vehicle: string;
  unknownTitle: string;
  unknownText: string;
};

const COPY: Record<Language, Copy> = {
  de: {
    back: "Zur Fehlerübersicht", system: "System", severity: "Priorität", drive: "Weiterfahren", meaning: "Bedeutung", symptoms: "Mögliche Symptome", causes: "Mögliche Ursachen", diagnosis: "Diagnose", solutions: "Lösungen", note: "Hinweis", vehicle: "Fahrzeugkontext", unknownTitle: "Unbekannter Fehlercode", unknownText: "Dieser Code ist nicht in der 6006 Fehlerbibliothek. Es wird keine technische Diagnose erfunden; bitte Fahrzeug, Steuergerät und vollständigen Diagnosebericht prüfen.",
  },
  tr: {
    back: "Arıza listesine dön", system: "Sistem", severity: "Öncelik", drive: "Sürüş", meaning: "Anlamı", symptoms: "Olası belirtiler", causes: "Olası nedenler", diagnosis: "Teşhis", solutions: "Çözümler", note: "Not", vehicle: "Araç bilgisi", unknownTitle: "Bilinmeyen arıza kodu", unknownText: "Bu kod 6006 arıza kütüphanesinde bulunmuyor. Teknik teşhis uydurulmaz; araç, kontrol ünitesi ve tam teşhis raporu kontrol edilmelidir.",
  },
  en: {
    back: "Back to fault library", system: "System", severity: "Priority", drive: "Driving", meaning: "Meaning", symptoms: "Possible symptoms", causes: "Possible causes", diagnosis: "Diagnosis", solutions: "Solutions", note: "Note", vehicle: "Vehicle context", unknownTitle: "Unknown fault code", unknownText: "This code is not in the 6006 fault library. No technical diagnosis is invented; check the vehicle, control unit and complete diagnostic report.",
  },
};

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="faultDetailList">
      <h2>{title}</h2>
      <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
    </section>
  );
}

export function FaultPage() {
  const { code: routeCode } = useParams<{ code: string }>();
  const code = String(routeCode ?? "").trim().toUpperCase();
  const [language, setLanguage] = useState<Language>(() => loadLanguage(localStorage, "de"));
  const [vehicle, setVehicle] = useState<VehicleContext>(() => loadVehicle(localStorage));
  const source = faultByCode(code);
  const fault = source ? localizeFault(source, language) : undefined;
  const copy = COPY[language];

  const changeLanguage = (next: Language) => {
    const saved = saveLanguage(localStorage, next);
    setLanguage(saved);
    document.documentElement.lang = saved;
  };

  return (
    <div className="faultPage">
      <header className="faultHeader">
        <Link to="/" className="faultBrand" aria-label="6006 Performance home"><strong>6006</strong><span>PERFORMANCE</span></Link>
        <div className="faultHeaderActions">
          <Link to="/#faults" className="faultBack">← {copy.back}</Link>
          <LanguageSwitch language={language} onChange={changeLanguage} />
        </div>
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

            <section className="faultVehicleContext">
              <div className="faultSectionHead">
                <div><span>{copy.vehicle}</span><h2>{language === "tr" ? "Aracını seç" : language === "en" ? "Select your vehicle" : "Fahrzeug wählen"}</h2></div>
                <p>{language === "tr" ? "Şema, yalnız doğrulanmış profil bulunduğunda araca özel konumlar kullanır." : language === "en" ? "The schematic only uses vehicle-specific positions when a verified profile is available." : "Die Darstellung nutzt fahrzeugspezifische Positionen nur bei verifiziertem Profil."}</p>
              </div>
              <VehicleSelector language={language} onChange={setVehicle} />
            </section>

            <FaultSystemAnimation code={fault.code ?? code} language={language} vehicle={vehicle} />

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

      <PublicSupportChat language={language} vehicle={vehicle} faultCode={code || undefined} />
    </div>
  );
}
