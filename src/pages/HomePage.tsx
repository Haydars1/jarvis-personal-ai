import { useEffect, useMemo, useState } from "react";
import { DriftShowcase } from "../components/DriftShowcase";
import { FaultField } from "../components/FaultField";
import { FaultLibrary } from "../components/FaultLibrary";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { PublicSupportChat } from "../components/PublicSupportChat";
import { VehicleSelector } from "../components/VehicleSelector";
import { loadLanguage, saveLanguage, t, type Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import "./HomePage.css";

const processCopy: Record<Language, Array<{ no: string; title: string; text: string }>> = {
  de: [
    { no: "01", title: "Verstehen", text: "Fehlercode, Warnsymbol, Live-Daten und Fahrzeugkontext zusammen betrachten." },
    { no: "02", title: "Prüfen", text: "Nicht raten: mögliche Ursachen eingrenzen und relevante Baugruppen systematisch prüfen." },
    { no: "03", title: "Anpassen", text: "Codierung oder Software nur dort einsetzen, wo sie zum Fahrzeug und Ziel passt." },
  ],
  tr: [
    { no: "01", title: "Anla", text: "Arıza kodunu, uyarı sembolünü, canlı verileri ve araç bilgisini birlikte değerlendir." },
    { no: "02", title: "Kontrol et", text: "Tahmin yürütmek yerine olası nedenleri daralt ve ilgili sistemleri sistematik kontrol et." },
    { no: "03", title: "Uyarla", text: "Kodlama veya yazılımı yalnızca araca ve hedefe gerçekten uyduğu yerde kullan." },
  ],
  en: [
    { no: "01", title: "Understand", text: "Read the fault code, warning symbol, live data and vehicle context together." },
    { no: "02", title: "Verify", text: "Do not guess: narrow the likely causes and inspect the relevant systems methodically." },
    { no: "03", title: "Adapt", text: "Use coding or software only where it actually fits the vehicle and the goal." },
  ],
};

const sectionCopy: Record<Language, { services: string; vehicle: string; faults: string; process: string; contact: string; faultIntro: string; vehicleIntro: string; contactIntro: string }> = {
  de: {
    services: "LEISTUNGEN",
    vehicle: "FAHRZEUG",
    faults: "FEHLERCODES & WARNUNGEN",
    process: "ARBEITSWEISE",
    contact: "KONTAKT",
    faultIntro: "Warnsymbol oder Code auswählen, Bedeutung verstehen und die betroffenen Systeme einordnen.",
    vehicleIntro: "Fahrzeug wählen, damit technische Darstellungen und Hinweise so spezifisch wie verifiziert möglich werden.",
    contactIntro: "Für fahrzeugspezifische Fragen direkt per WhatsApp, Telefon oder E-Mail Kontakt aufnehmen.",
  },
  tr: {
    services: "HİZMETLER",
    vehicle: "ARAÇ",
    faults: "ARIZA KODLARI & UYARILAR",
    process: "ÇALIŞMA ŞEKLİ",
    contact: "İLETİŞİM",
    faultIntro: "Uyarı sembolünü veya kodu seç, anlamını öğren ve ilgili sistemleri doğru bağlamda değerlendir.",
    vehicleIntro: "Teknik gösterim ve açıklamaların doğrulanabildiği kadar araca özel olması için aracını seç.",
    contactIntro: "Araca özel sorular için WhatsApp, telefon veya e-posta üzerinden doğrudan iletişime geç.",
  },
  en: {
    services: "SERVICES",
    vehicle: "VEHICLE",
    faults: "FAULT CODES & WARNINGS",
    process: "WORKFLOW",
    contact: "CONTACT",
    faultIntro: "Choose a warning symbol or code, understand what it means and place the affected systems in context.",
    vehicleIntro: "Select the vehicle so technical diagrams and guidance can be as vehicle-specific as verified data allows.",
    contactIntro: "For vehicle-specific questions, get in touch directly by WhatsApp, phone or email.",
  },
};

const fixedCopy: Record<Language, { status: string; diagnosis: string; coding: string; software: string; ready: string; signalPath: string; code: string; system: string; cause: string; contactHeadline: string; phone: string; email: string; footer: string }> = {
  de: {
    status: "SYSTEMSTATUS", diagnosis: "DIAGNOSE", coding: "CODIERUNG", software: "SOFTWARE", ready: "BEREIT",
    signalPath: "SIGNALWEG", code: "Code", system: "System", cause: "Ursache", contactHeadline: "Direkt. Persönlich. 6006.",
    phone: "Telefon", email: "E-Mail", footer: "Diagnose · Codierung · Softwareoptimierung · individuelle Fahrzeuganpassung",
  },
  tr: {
    status: "SİSTEM DURUMU", diagnosis: "TEŞHİS", coding: "KODLAMA", software: "YAZILIM", ready: "HAZIR",
    signalPath: "SİNYAL YOLU", code: "Kod", system: "Sistem", cause: "Neden", contactHeadline: "Doğrudan. Kişisel. 6006.",
    phone: "Telefon", email: "E-posta", footer: "Teşhis · Kodlama · Yazılım optimizasyonu · araca özel uyarlama",
  },
  en: {
    status: "SYSTEM STATUS", diagnosis: "DIAGNOSIS", coding: "CODING", software: "SOFTWARE", ready: "READY",
    signalPath: "SIGNAL PATH", code: "Code", system: "System", cause: "Cause", contactHeadline: "Direct. Personal. 6006.",
    phone: "Phone", email: "Email", footer: "Diagnostics · Coding · Software optimization · individual vehicle adaptation",
  },
};

function deviceLanguage(): string {
  return typeof navigator === "undefined" ? "de" : navigator.language || "de";
}

export function HomePage() {
  const [language, setLanguage] = useState<Language>(() => loadLanguage(localStorage, deviceLanguage()));
  const [vehicle, setVehicle] = useState<VehicleContext>({});
  const section = sectionCopy[language];
  const fixed = fixedCopy[language];
  const vehicleSummary = useMemo(
    () => [vehicle.brand, vehicle.model, vehicle.body, vehicle.year, vehicle.engine].filter(Boolean).join(" · "),
    [vehicle],
  );

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (next: Language) => {
    const saved = saveLanguage(localStorage, next);
    setLanguage(saved);
  };

  return (
    <div className="homePage">
      <FaultField language={language} />
      <div className="homeVignette" aria-hidden="true" />

      <div className="homeContent">
        <header className="siteHeader">
          <a className="brandMark" href="#top" aria-label="6006 Performance home">
            <strong>6006</strong><span>PERFORMANCE</span>
          </a>
          <nav aria-label="Primary">
            <a href="#services">{t(language, "nav.services")}</a>
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
              <p className="eyebrow">{t(language, "home.eyebrow")}</p>
              <h1>{t(language, "home.lead1")} <em>{t(language, "home.lead2")}</em></h1>
              <p className="heroIntro">{t(language, "home.intro")}</p>
              <div className="heroActions">
                <a className="primaryButton" href="https://wa.me/491788354756">{t(language, "home.whatsapp")}</a>
                <a href="mailto:6006performance@gmail.com">{t(language, "home.email")}</a>
              </div>
              <p className="heroHint">↗ {t(language, "home.hint")}</p>
            </div>
            <aside className="heroStatus" aria-label="6006 services status">
              <span>6006 / {fixed.status}</span>
              <div><small>{fixed.diagnosis}</small><b>{fixed.ready}</b></div>
              <div><small>{fixed.coding}</small><b>{fixed.ready}</b></div>
              <div><small>{fixed.software}</small><b>{fixed.ready}</b></div>
              <p>{vehicleSummary || t(language, "vehicle.general")}</p>
            </aside>
          </section>

          <section id="services" className="serviceGrid" aria-labelledby="services-title">
            <h2 id="services-title" className="srOnly">{section.services}</h2>
            <article><span>01</span><div><h3>{t(language, "service.diagnosis")}</h3><p>{t(language, "service.diagnosisText")}</p></div></article>
            <article><span>02</span><div><h3>{t(language, "service.coding")}</h3><p>{t(language, "service.codingText")}</p></div></article>
            <article><span>03</span><div><h3>{t(language, "service.software")}</h3><p>{t(language, "service.softwareText")}</p></div></article>
          </section>

          <section className="storySection" aria-label="6006 diagnostic flow">
            <DriftShowcase />
            <div className="storyCopy">
              <span>6006 / {fixed.signalPath}</span>
              <h2>{fixed.code} → <em>{fixed.system}</em> → {fixed.cause}</h2>
              <p>{section.faultIntro}</p>
            </div>
          </section>

          <section className="contentSection vehicleSection">
            <div className="sectionHead">
              <div><span>{section.vehicle}</span><h2>{t(language, "vehicle.choose")}</h2></div>
              <p>{section.vehicleIntro}</p>
            </div>
            <VehicleSelector language={language} onChange={setVehicle} />
          </section>

          <section id="faults" className="contentSection faultSection">
            <div className="sectionHead">
              <div><span>{section.faults}</span><h2>{t(language, "nav.faults")}</h2></div>
              <p>{section.faultIntro}</p>
            </div>
            <FaultLibrary language={language} />
          </section>

          <section className="contentSection processSection">
            <div className="sectionHead compactHead"><div><span>{section.process}</span><h2>6006 / Workflow</h2></div></div>
            <div className="processGrid">
              {processCopy[language].map((item) => (
                <article key={item.no}><span>{item.no}</span><h3>{item.title}</h3><p>{item.text}</p></article>
              ))}
            </div>
          </section>

          <section id="contact" className="contactSection">
            <div className="contactCopy">
              <span>{section.contact}</span>
              <h2>{fixed.contactHeadline}</h2>
              <p>{section.contactIntro}</p>
            </div>
            <div className="contactList">
              <a href="https://wa.me/491788354756"><span>WhatsApp</span><strong>+49 178 8354756</strong><b>↗</b></a>
              <a href="tel:+491788354756"><span>{fixed.phone}</span><strong>0178 8354756</strong><b>↗</b></a>
              <a href="mailto:6006performance@gmail.com"><span>{fixed.email}</span><strong>6006performance@gmail.com</strong><b>↗</b></a>
            </div>
          </section>
        </main>

        <footer className="siteFooter">
          <strong>6006 PERFORMANCE</strong>
          <p>{fixed.footer}</p>
          <span>© 6006 Performance</span>
        </footer>
      </div>

      <PublicSupportChat language={language} vehicle={vehicle} />
    </div>
  );
}