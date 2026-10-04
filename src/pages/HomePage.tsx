import { useEffect, useMemo, useState } from "react";
import { DiagnosticConsole } from "../components/DiagnosticConsole";
import { FaultLibrary } from "../components/FaultLibrary";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { PublicSupportChat } from "../components/PublicSupportChat";
import { VehicleSelector } from "../components/VehicleSelector";
import { loadLanguage, saveLanguage, t, type Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import "./HomePage.css";

const processCopy: Record<Language, Array<{ no: string; title: string; text: string }>> = {
  de: [
    { no: "01", title: "Kontext erfassen", text: "Fahrzeug, DTC, Warnsymbol und verfügbare Messwerte gemeinsam lesen." },
    { no: "02", title: "System eingrenzen", text: "Betroffene Baugruppen logisch verbinden und wahrscheinliche Ursachen priorisieren." },
    { no: "03", title: "Prüfen", text: "Live-Daten, Sensorik, Aktuatorik und mechanische Ursachen gezielt verifizieren." },
    { no: "04", title: "Handeln", text: "Erst nach der Prüfung reparieren, codieren oder Software anpassen." },
  ],
  tr: [
    { no: "01", title: "Bağlamı topla", text: "Araç, DTC, uyarı sembolü ve mevcut ölçüm verilerini birlikte değerlendir." },
    { no: "02", title: "Sistemi daralt", text: "İlgili bileşenleri mantıksal olarak bağla ve olası nedenleri önceliklendir." },
    { no: "03", title: "Doğrula", text: "Canlı veri, sensör, aktüatör ve mekanik nedenleri hedefli olarak kontrol et." },
    { no: "04", title: "Uygula", text: "Onarım, kodlama veya yazılım işlemini ancak doğrulamadan sonra yap." },
  ],
  en: [
    { no: "01", title: "Capture context", text: "Read the vehicle, DTC, warning symbol and available measurements together." },
    { no: "02", title: "Narrow the system", text: "Connect relevant components logically and prioritize likely causes." },
    { no: "03", title: "Verify", text: "Check live data, sensors, actuators and mechanical causes with intent." },
    { no: "04", title: "Act", text: "Repair, code or modify software only after the cause is verified." },
  ],
};

const copy: Record<Language, {
  platform: string; hero: string; intro: string; vehicle: string; vehicleIntro: string; faults: string; faultIntro: string;
  workflow: string; contact: string; contactIntro: string; services: string; phone: string; email: string; selected: string;
}> = {
  de: {
    platform: "FAHRZEUGDIAGNOSE · CODIERUNG · SOFTWARE",
    hero: "Diagnose mit System. Nicht mit Vermutungen.",
    intro: "6006 verbindet Fehlercodes, Fahrzeugkontext und technische Systemlogik zu einem nachvollziehbaren Prüfpfad – mit direktem Diagnose-Chat, wenn du weitergehen willst.",
    vehicle: "FAHRZEUGKONTEXT", vehicleIntro: "Wähle dein Fahrzeug. Darstellungen und Hinweise werden nur so spezifisch, wie die hinterlegten Daten verifiziert sind.",
    faults: "DTC & WARNUNGEN", faultIntro: "Code suchen, Bedeutung verstehen, Systembezug prüfen und sinnvolle nächste Schritte ableiten.",
    workflow: "ARBEITSWEISE", contact: "DIREKTER KONTAKT", contactIntro: "Fahrzeugspezifische Frage? Direkt per WhatsApp, Telefon oder E-Mail.",
    services: "LEISTUNGEN", phone: "Telefon", email: "E-Mail", selected: "Aktueller Fahrzeugkontext",
  },
  tr: {
    platform: "ARAÇ TEŞHİSİ · KODLAMA · YAZILIM",
    hero: "Tahminle değil, sistemle teşhis.",
    intro: "6006; arıza kodunu, araç bilgisini ve teknik sistem mantığını tek bir doğrulanabilir kontrol akışında birleştirir. Gerektiğinde doğrudan teşhis sohbetiyle devam edersin.",
    vehicle: "ARAÇ BAĞLAMI", vehicleIntro: "Aracını seç. Görseller ve teknik açıklamalar yalnızca doğrulanmış veri kadar araca özel hale gelir.",
    faults: "DTC & UYARILAR", faultIntro: "Kodu bul, anlamını öğren, ilgili sistemi gör ve mantıklı sonraki kontrol adımını belirle.",
    workflow: "ÇALIŞMA AKIŞI", contact: "DOĞRUDAN İLETİŞİM", contactIntro: "Araca özel sorun mu var? WhatsApp, telefon veya e-posta üzerinden doğrudan ulaş.",
    services: "HİZMETLER", phone: "Telefon", email: "E-posta", selected: "Seçili araç bağlamı",
  },
  en: {
    platform: "VEHICLE DIAGNOSTICS · CODING · SOFTWARE",
    hero: "Diagnose with a system, not a guess.",
    intro: "6006 combines fault codes, vehicle context and technical system logic into a traceable verification path, with direct diagnostic chat when you need to go further.",
    vehicle: "VEHICLE CONTEXT", vehicleIntro: "Choose the vehicle. Visuals and guidance become vehicle-specific only where the underlying data is verified.",
    faults: "DTC & WARNINGS", faultIntro: "Find the code, understand its meaning, inspect the related system and determine the next sensible test.",
    workflow: "WORKFLOW", contact: "DIRECT CONTACT", contactIntro: "Vehicle-specific question? Reach out directly by WhatsApp, phone or email.",
    services: "SERVICES", phone: "Phone", email: "Email", selected: "Current vehicle context",
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
                <a href="#vehicle">{language === "tr" ? "Araç seç" : language === "en" ? "Select vehicle" : "Fahrzeug wählen"}</a>
              </div>
            </div>

            <aside className="heroStatus" aria-label="6006 platform status">
              <div className="heroStatusTop"><span>6006 / SYSTEM</span><b><i /> ONLINE</b></div>
              <div className="heroStatusRows">
                <div><small>DTC</small><strong>Context-aware</strong></div>
                <div><small>Vehicle</small><strong>Profile-based</strong></div>
                <div><small>Support</small><strong>AI + Live</strong></div>
              </div>
              <p><span>{text.selected}</span>{vehicleSummary || t(language, "vehicle.general")}</p>
            </aside>
          </section>

          <section className="consoleSection" aria-label="6006 diagnostic console">
            <DiagnosticConsole language={language} vehicle={vehicle} />
          </section>

          <section id="services" className="serviceSection">
            <div className="sectionHead">
              <div><span>{text.services}</span><h2>{language === "tr" ? "Araç elektroniği ve diagnostik, tek akışta." : language === "en" ? "Vehicle electronics and diagnostics, in one workflow." : "Fahrzeugelektronik und Diagnose in einem Ablauf."}</h2></div>
            </div>
            <div className="serviceGrid">
              <article><span>01</span><h3>{t(language, "service.diagnosis")}</h3><p>{t(language, "service.diagnosisText")}</p></article>
              <article><span>02</span><h3>{t(language, "service.coding")}</h3><p>{t(language, "service.codingText")}</p></article>
              <article><span>03</span><h3>{t(language, "service.software")}</h3><p>{t(language, "service.softwareText")}</p></article>
            </div>
          </section>

          <section id="vehicle" className="contentSection vehicleSection">
            <div className="sectionHead splitHead">
              <div><span>{text.vehicle}</span><h2>{t(language, "vehicle.choose")}</h2></div>
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
            <div className="sectionHead"><div><span>{text.workflow}</span><h2>{language === "tr" ? "Önce doğrula. Sonra işlem yap." : language === "en" ? "Verify first. Act second." : "Erst prüfen. Dann handeln."}</h2></div></div>
            <div className="processGrid">
              {processCopy[language].map((item) => (
                <article key={item.no}><span>{item.no}</span><h3>{item.title}</h3><p>{item.text}</p></article>
              ))}
            </div>
          </section>

          <section id="contact" className="contactSection">
            <div className="contactCopy">
              <span>{text.contact}</span>
              <h2>{language === "tr" ? "Aracını anlat. Sistemi birlikte daraltalım." : language === "en" ? "Tell us the vehicle. Narrow the system with us." : "Fahrzeug nennen. System gemeinsam eingrenzen."}</h2>
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
