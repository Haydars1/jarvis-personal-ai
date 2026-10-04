import { useEffect, useMemo, useState } from "react";
import { DiagnosticConsole } from "../components/DiagnosticConsole";
import { DriftShowcase } from "../components/DriftShowcase";
import { FaultLibrary } from "../components/FaultLibrary";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { PublicSupportChat } from "../components/PublicSupportChat";
import { VehicleSelector } from "../components/VehicleSelector";
import { loadLanguage, saveLanguage, t, type Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import "./HomePage.css";

const processCopy: Record<Language, Array<{ no: string; title: string; text: string }>> = {
  de: [
    { no: "01", title: "Code verstehen", text: "DTC oder Warnsymbol identifizieren und den betroffenen Systembereich einordnen." },
    { no: "02", title: "Ursachen priorisieren", text: "Typische Ursachen logisch ordnen statt vorschnell ein Bauteil zu verurteilen." },
    { no: "03", title: "Prüfen", text: "Messwerte, Sensorik, Aktuatorik und mechanische Ursachen gezielt verifizieren." },
    { no: "04", title: "Handeln", text: "Erst nach der Prüfung reparieren, codieren oder Software anpassen." },
  ],
  tr: [
    { no: "01", title: "Kodu anla", text: "DTC veya uyarı sembolünü belirle ve ilgili sistem bölgesini doğru konumlandır." },
    { no: "02", title: "Nedenleri sırala", text: "Tek bir parçaya atlamadan tipik nedenleri mantıklı biçimde önceliklendir." },
    { no: "03", title: "Doğrula", text: "Ölçüm verisi, sensör, aktüatör ve mekanik nedenleri hedefli kontrol et." },
    { no: "04", title: "Uygula", text: "Onarım, kodlama veya yazılım işlemini ancak doğrulamadan sonra yap." },
  ],
  en: [
    { no: "01", title: "Understand the code", text: "Identify the DTC or warning and place it in the correct system context." },
    { no: "02", title: "Prioritize causes", text: "Order likely causes logically instead of blaming one component too early." },
    { no: "03", title: "Verify", text: "Check measurements, sensors, actuators and mechanical causes with intent." },
    { no: "04", title: "Act", text: "Repair, code or modify software only after the cause is verified." },
  ],
};

const copy: Record<Language, {
  platform: string; hero: string; intro: string; faults: string; faultIntro: string;
  workflow: string; contact: string; contactIntro: string; services: string; phone: string; email: string;
  vehicle: string; vehicleTitle: string; vehicleIntro: string;
}> = {
  de: {
    platform: "FAHRZEUGDIAGNOSE · CODIERUNG · SOFTWARE",
    hero: "Diagnose mit System. Nicht mit Vermutungen.",
    intro: "6006 erklärt Fehlercodes verständlich, ordnet sie dem richtigen System zu und zeigt einen sinnvollen Prüfweg. Für fahrzeugspezifische Details geht es danach direkt in den Diagnose-Chat.",
    faults: "DTC & WARNUNGEN", faultIntro: "Code suchen, Bedeutung verstehen, Systembezug prüfen und sinnvolle nächste Schritte ableiten.",
    workflow: "ARBEITSWEISE", contact: "DIREKTER KONTAKT", contactIntro: "Fahrzeugspezifische Frage? Direkt per WhatsApp, Telefon oder E-Mail.",
    services: "LEISTUNGEN", phone: "Telefon", email: "E-Mail",
    vehicle: "FAHRZEUGPROFIL", vehicleTitle: "Fahrzeug wählen. Schaltbild passend anzeigen.", vehicleIntro: "Marke, Modell, Baureihe, Baujahr und Motor werden gespeichert. Unterstützte Fahrzeuge erhalten ein verifiziertes, modellspezifisches Systemschaltbild; unbekannte Varianten bleiben klar als generisch markiert.",
  },
  tr: {
    platform: "ARAÇ TEŞHİSİ · KODLAMA · YAZILIM",
    hero: "Tahminle değil, sistemle teşhis.",
    intro: "6006 arıza kodlarını anlaşılır biçimde açıklar, doğru sistemle ilişkilendirir ve mantıklı kontrol yolunu gösterir. Araca özel ayrıntı gerekiyorsa teşhis sohbetinde devam edilir.",
    faults: "DTC & UYARILAR", faultIntro: "Kodu bul, anlamını öğren, ilgili sistemi gör ve mantıklı sonraki kontrol adımını belirle.",
    workflow: "ÇALIŞMA AKIŞI", contact: "DOĞRUDAN İLETİŞİM", contactIntro: "Araca özel sorun mu var? WhatsApp, telefon veya e-posta üzerinden doğrudan ulaş.",
    services: "HİZMETLER", phone: "Telefon", email: "E-posta",
    vehicle: "ARAÇ PROFİLİ", vehicleTitle: "Aracı seç. Şemayı araca göre göster.", vehicleIntro: "Marka, model, kasa/seri, yıl ve motor kaydedilir. Desteklenen araçlarda doğrulanmış model-özel sistem şeması gösterilir; bilinmeyen varyantlarda genel şema olduğu açıkça belirtilir.",
  },
  en: {
    platform: "VEHICLE DIAGNOSTICS · CODING · SOFTWARE",
    hero: "Diagnose with a system, not a guess.",
    intro: "6006 explains fault codes clearly, connects them to the right system and shows a sensible verification path. Vehicle-specific details can continue in the diagnostic chat when needed.",
    faults: "DTC & WARNINGS", faultIntro: "Find the code, understand its meaning, inspect the related system and determine the next sensible test.",
    workflow: "WORKFLOW", contact: "DIRECT CONTACT", contactIntro: "Vehicle-specific question? Reach out directly by WhatsApp, phone or email.",
    services: "SERVICES", phone: "Phone", email: "Email",
    vehicle: "VEHICLE PROFILE", vehicleTitle: "Choose the vehicle. Show the matching schematic.", vehicleIntro: "Make, model, body/series, year and engine are stored. Supported vehicles get a verified model-specific system schematic; unknown variants remain clearly marked as generic.",
  },
};

function deviceLanguage(): string {
  return typeof navigator === "undefined" ? "de" : navigator.language || "de";
}

export function HomePage() {
  const [language, setLanguage] = useState<Language>(() => loadLanguage(localStorage, deviceLanguage()));
  const [vehicle, setVehicle] = useState<VehicleContext>({});
  const text = copy[language];
  const vehicleSummary = useMemo(
    () => [vehicle.brand, vehicle.model, vehicle.body, vehicle.year, vehicle.engine].filter(Boolean).join(" · "),
    [vehicle],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (next: Language) => {
    setLanguage(saveLanguage(localStorage, next));
  };

  const driftTitle = language === "tr"
    ? "Performans sadece rakam değil. Kontrol de onun parçası."
    : language === "en"
      ? "Performance is not only numbers. Control is part of it."
      : "Performance ist nicht nur eine Zahl. Kontrolle gehört dazu.";
  const driftText = language === "tr"
    ? "6006 pist sahnesinde farklı gövde tipleri aynı hat üzerinde akarken sistemin hareket, denge ve araç karakteri tarafını görselleştirir."
    : language === "en"
      ? "The 6006 circuit visual puts different body styles on the same line to express motion, balance and vehicle character."
      : "Die 6006 Streckenszene zeigt verschiedene Karosserieformen auf derselben Linie und verbindet Bewegung, Balance und Fahrzeugcharakter.";

  return (
    <div className="homePage" data-ui-version="6006-v2">
      <div className="homeBackdrop" aria-hidden="true" />
      <div className="homeContent">
        <header className="siteHeader">
          <a className="brandMark" href="#top" aria-label="6006 Performance home">
            <strong>6006</strong><span>PERFORMANCE</span>
          </a>
          <nav aria-label="Primary">
            <a href="#services">{t(language, "nav.services")}</a>
            <a href="#vehicle">{language === "tr" ? "Araç" : language === "en" ? "Vehicle" : "Fahrzeug"}</a>
            <a href="#faults">{t(language, "nav.faults")}</a>
            <a href="#contact">{t(language, "nav.contact")}</a>
          </nav>
          <div className="headerActions">
            <LanguageSwitch language={language} onChange={changeLanguage} />
            <a className="headerContact" href="https://wa.me/491788354756">WhatsApp</a>
          </div>
        </header>

        <main id="top" className="homeMain">
          <section className="heroSection">
            <div className="heroCopy">
              <p className="eyebrow">{text.platform}</p>
              <h1>{text.hero}</h1>
              <p className="heroIntro">{text.intro}</p>
              <div className="heroActions">
                <a className="primaryButton" href="#faults">{t(language, "nav.faults")}</a>
                <a href="https://wa.me/491788354756">{language === "tr" ? "Sorunu anlat" : language === "en" ? "Describe the issue" : "Problem schildern"}</a>
              </div>
            </div>

            <aside className="heroStatus" aria-label="6006 platform status">
              <div className="heroStatusTop"><span>6006 / SYSTEM</span><b><i /> ONLINE</b></div>
              <div className="heroStatusRows">
                <div><small>DTC</small><strong>System context</strong></div>
                <div><small>Diagnosis</small><strong>Verification path</strong></div>
                <div><small>Support</small><strong>AI + Live</strong></div>
              </div>
              <p><span>6006</span>{vehicleSummary || (language === "tr" ? "Araç seçildiğinde arıza şeması profile göre uyarlanır." : language === "en" ? "Select a vehicle to adapt fault schematics to its verified profile." : "Fahrzeug wählen, damit Fehlerbilder an das verifizierte Profil angepasst werden.")}</p>
            </aside>
          </section>

          <section className="consoleSection" aria-label="6006 diagnostic console">
            <DiagnosticConsole language={language} />
          </section>

          <section className="storySection" aria-label="6006 performance circuit">
            <div className="storyCopy">
              <span>6006 / PERFORMANCE LOOP</span>
              <h2>{driftTitle}</h2>
              <p>{driftText}</p>
            </div>
            <DriftShowcase />
          </section>

          <section id="services" className="serviceSection">
            <div className="sectionHead">
              <div><span>{text.services}</span><h2>{language === "tr" ? "Diagnostik, kodlama ve yazılım tek yerde." : language === "en" ? "Diagnostics, coding and software in one place." : "Diagnose, Codierung und Software an einem Ort."}</h2></div>
            </div>
            <div className="serviceGrid">
              <article><span>01</span><h3>{t(language, "service.diagnosis")}</h3><p>{t(language, "service.diagnosisText")}</p></article>
              <article><span>02</span><h3>{t(language, "service.coding")}</h3><p>{t(language, "service.codingText")}</p></article>
              <article><span>03</span><h3>{t(language, "service.software")}</h3><p>{t(language, "service.softwareText")}</p></article>
            </div>
          </section>

          <section id="vehicle" className="contentSection vehicleSection">
            <div className="sectionHead splitHead">
              <div><span>{text.vehicle}</span><h2>{text.vehicleTitle}</h2></div>
              <p>{text.vehicleIntro}</p>
            </div>
            <VehicleSelector language={language} onChange={setVehicle} />
          </section>

          <section id="faults" className="contentSection faultSection">
            <div className="sectionHead splitHead">
              <div><span>{text.faults}</span><h2>{t(language, "nav.faults")}</h2></div>
              <p>{text.faultIntro}</p>
            </div>
            <FaultLibrary language={language} />
          </section>

          <section className="contentSection processSection">
            <div className="sectionHead"><div><span>{text.workflow}</span><h2>{language === "tr" ? "Önce kodu anla. Sonra doğrula." : language === "en" ? "Understand the code first. Then verify." : "Erst Code verstehen. Dann prüfen."}</h2></div></div>
            <div className="processGrid">
              {processCopy[language].map((item) => (
                <article key={item.no}><span>{item.no}</span><h3>{item.title}</h3><p>{item.text}</p></article>
              ))}
            </div>
          </section>

          <section id="contact" className="contactSection">
            <div className="contactCopy">
              <span>{text.contact}</span>
              <h2>{language === "tr" ? "Arızanı anlat. Beraber daraltalım." : language === "en" ? "Describe the fault. Narrow it down with us." : "Fehler schildern. Gemeinsam eingrenzen."}</h2>
              <p>{text.contactIntro}</p>
            </div>
            <div className="contactList">
              <a href="https://wa.me/491788354756"><span>WhatsApp</span><strong>+49 178 8354756</strong><b>↗</b></a>
              <a href="tel:+491788354756"><span>{text.phone}</span><strong>0178 8354756</strong><b>↗</b></a>
              <a href="mailto:6006performance@gmail.com"><span>{text.email}</span><strong>6006performance@gmail.com</strong><b>↗</b></a>
            </div>
          </section>
        </main>

        <footer className="siteFooter">
          <strong>6006 PERFORMANCE</strong>
          <p>Diagnostics · Coding · Software · Vehicle Systems</p>
          <span>© 6006 Performance</span>
        </footer>
      </div>

      <PublicSupportChat language={language} vehicle={vehicle} />
    </div>
  );
}
