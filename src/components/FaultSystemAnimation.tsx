import { useEffect, useMemo, useState } from "react";
import { getFaultVisual, type SystemSceneId } from "../domain/fault-visual";
import type { Language } from "../i18n/language";
import type { VehicleContext } from "../vehicle/catalog";
import { resolveVehicleProfile, type Point } from "../vehicle/profile";
import { VehicleBodyShell } from "./VehicleBodyShell";
import "./FaultSystemAnimation.css";

type Shape = "tank" | "sensor" | "module" | "filter" | "engine" | "wheel" | "pump" | "gear" | "battery";
type Localized = Record<Language, string>;
type SceneNode = { id: string; label: Localized; role: Localized; x: number; y: number; shape: Shape };
type Scene = { title: Localized; subtitle: Localized; nodes: SceneNode[] };

const l = (de: string, tr: string, en: string): Localized => ({ de, tr, en });
const n = (id: string, label: Localized, role: Localized, x: number, y: number, shape: Shape): SceneNode => ({ id, label, role, x, y, shape });

const SCENES: Record<SystemSceneId, Scene> = {
  boost: {
    title: l("Ansaugluft → Turbo → Ladeluft → Motor", "Emiş havası → Turbo → Basınçlı hava → Motor", "Intake → Turbo → Charge air → Engine"),
    subtitle: l("Turbolader, Sensorik und Regelung arbeiten als eine Ladedruckstrecke.", "Turbo, sensörler ve kontrol elemanları tek bir basınç sistemi olarak çalışır.", "Turbocharger, sensors and control hardware work as one boost system."),
    nodes: [
      n("intake-path", l("Ansaugluft / LMM", "Emiş / MAF", "Intake / MAF"), l("Führt und misst die einströmende Luft.", "Giren havayı ölçer ve yönlendirir.", "Measures and routes incoming air."), 90, 210, "sensor"),
      n("turbo", l("Turbolader", "Turbo", "Turbocharger"), l("Verdichtet Frischluft mit Abgasenergie.", "Egzoz enerjisiyle emiş havasını sıkıştırır.", "Compresses intake air using exhaust energy."), 260, 210, "pump"),
      n("turbo-actuator", l("VTG / Wastegate", "VTG / Wastegate", "VGT / Wastegate"), l("Regelt die Turboladergeometrie oder Klappe.", "Turbo geometrisini veya wastegate'i kumanda eder.", "Controls turbo geometry or wastegate."), 300, 100, "module"),
      n("boost-path", l("Ladeluftstrecke", "Basınçlı hava hattı", "Charge-air path"), l("Führt verdichtete Luft über Kühler und Rohre zum Motor.", "Sıkıştırılmış havayı intercooler ve borular üzerinden motora taşır.", "Routes compressed air through cooler and pipes to the engine."), 500, 210, "filter"),
      n("boost-sensor", l("Ladedrucksensor", "Basınç sensörü", "Boost pressure sensor"), l("Meldet den tatsächlichen Ladedruck.", "Gerçek turbo basıncını ölçer.", "Measures actual boost pressure."), 640, 105, "sensor"),
      n("boost-control", l("Regelventil", "Kontrol valfi", "Boost control valve"), l("Steuert Unterdruck oder elektrischen Aktuator.", "Vakum veya elektrikli aktüatörü kumanda eder.", "Controls vacuum or the electric actuator."), 635, 300, "module"),
      n("engine", l("Motor", "Motor", "Engine"), l("Nutzt die verdichtete Luft für die Verbrennung.", "Sıkıştırılmış havayı yanma için kullanır.", "Uses compressed air for combustion."), 820, 210, "engine"),
    ],
  },
  dpf: {
    title: l("Abgas → DPF → Differenzdruck", "Egzoz → DPF → Diferansiyel basınç", "Exhaust → DPF → Differential pressure"),
    subtitle: l("Filterbeladung, Temperatur und Drucksignale bestimmen den Regenerationsbedarf.", "Filtre yükü, sıcaklık ve basınç sinyalleri rejenerasyon ihtiyacını belirler.", "Soot load, temperature and pressure signals determine regeneration demand."),
    nodes: [
      n("engine-out", l("Motor / Abgas", "Motor / Egzoz", "Engine / Exhaust"), l("Erzeugt Abgas und Partikel.", "Egzoz ve partikül üretir.", "Produces exhaust gas and particulates."), 95, 210, "engine"),
      n("oxidation-zone", l("Abgasvorstufe", "Egzoz ön arıtma", "Exhaust pre-treatment"), l("Bereitet Abgas für die Filterung vor.", "Egzozu filtreleme için hazırlar.", "Conditions exhaust before filtration."), 265, 210, "filter"),
      n("filter-core", l("DPF", "DPF", "DPF"), l("Speichert Ruß und regeneriert ihn.", "Kurum tutar ve rejenerasyonla yakar.", "Stores soot and burns it during regeneration."), 475, 210, "filter"),
      n("soot-load", l("Filterbeladung", "Filtre doluluğu", "Soot load"), l("Beschreibt die berechnete oder gemessene Rußmenge.", "Hesaplanan veya ölçülen kurum yükünü ifade eder.", "Represents calculated or measured soot loading."), 605, 105, "filter"),
      n("pressure-sensor", l("Differenzdrucksensor", "Diferansiyel basınç sensörü", "Differential pressure sensor"), l("Vergleicht Druck vor und nach dem DPF.", "DPF öncesi ve sonrası basıncı karşılaştırır.", "Compares pressure before and after the DPF."), 650, 285, "sensor"),
      n("tailpipe", l("Auslass", "Egzoz çıkışı", "Tailpipe"), l("Leitet behandeltes Abgas aus.", "Arıtılmış egzozu dışarı atar.", "Releases treated exhaust gas."), 820, 210, "module"),
    ],
  },
  scr: {
    title: l("AdBlue → Dosierung → SCR", "AdBlue → Dozajlama → SCR", "AdBlue → Dosing → SCR"),
    subtitle: l("AdBlue-Dosierung und NOx-Sensorik überwachen die SCR-Wirkung.", "AdBlue dozajlama ve NOx sensörleri SCR verimini izler.", "AdBlue dosing and NOx sensors monitor SCR effectiveness."),
    nodes: [
      n("tank-dose-path", l("AdBlue-Tank", "AdBlue deposu", "AdBlue tank"), l("Speichert und versorgt das Reduktionsmittel.", "İndirgeme sıvısını depolar ve sisteme verir.", "Stores and supplies reductant."), 90, 250, "tank"),
      n("dose-module", l("Pumpe / Modul", "Pompa / Modül", "Pump / Module"), l("Fördert und regelt AdBlue.", "AdBlue beslemesini ve basıncını düzenler.", "Pumps and regulates AdBlue."), 255, 185, "pump"),
      n("dosing-injector", l("Dosierinjektor", "Dozaj enjektörü", "Dosing injector"), l("Dosiert AdBlue in den Abgasstrom.", "AdBlue'yu egzoz akışına dozajlar.", "Meters AdBlue into the exhaust stream."), 420, 225, "sensor"),
      n("nox-upstream", l("NOx-Sensor vor SCR", "SCR öncesi NOx", "Upstream NOx sensor"), l("Misst NOx vor der Reduktion.", "SCR öncesi NOx seviyesini ölçer.", "Measures NOx before reduction."), 535, 120, "sensor"),
      n("scr-catalyst", l("SCR-Katalysator", "SCR katalizörü", "SCR catalyst"), l("Reduziert Stickoxide mit Reduktionsmittel.", "AdBlue yardımıyla NOx emisyonunu azaltır.", "Reduces NOx using reductant."), 650, 220, "filter"),
      n("nox-downstream", l("NOx-Sensor nach SCR", "SCR sonrası NOx", "Downstream NOx sensor"), l("Kontrolliert die Wirkung nach SCR.", "SCR sonrası sonucu kontrol eder.", "Checks effectiveness after SCR."), 800, 135, "sensor"),
    ],
  },
  brakes: {
    title: l("Radsensoren → ABS/ESC → Hydraulik", "Teker sensörleri → ABS/ESC → Hidrolik", "Wheel sensors → ABS/ESC → Hydraulics"),
    subtitle: l("Raddrehzahlen und Hydraulikdruck werden für Stabilität und Bremsregelung kombiniert.", "Teker hızları ve hidrolik basınç fren ve denge kontrolünde birlikte kullanılır.", "Wheel speeds and hydraulic pressure work together for braking and stability control."),
    nodes: [
      n("wheel-input", l("Raddrehzahlsensoren", "Teker hız sensörleri", "Wheel speed sensors"), l("Messen einzelne Raddrehzahlen.", "Her tekerin hızını ölçer.", "Measure individual wheel speeds."), 95, 210, "wheel"),
      n("abs-data-link", l("CAN / Datenbus", "CAN / Veri yolu", "CAN / Data bus"), l("Verbindet ABS/ESC mit anderen Steuergeräten.", "ABS/ESC'yi diğer kontrol ünitelerine bağlar.", "Connects ABS/ESC to other controllers."), 250, 100, "module"),
      n("esc-control", l("ESC-Regelung", "ESC kontrolü", "ESC control"), l("Berechnet Stabilitätseingriffe.", "Denge müdahalelerini hesaplar.", "Calculates stability interventions."), 390, 145, "module"),
      n("abs-module", l("ABS-Hydraulikblock", "ABS hidrolik modülü", "ABS hydraulic module"), l("Regelt Bremsdruck radselektiv.", "Her teker için fren basıncını düzenler.", "Modulates brake pressure per wheel."), 485, 250, "module"),
      n("brake-circuit", l("Bremskreise", "Fren devreleri", "Brake circuits"), l("Übertragen Hydraulikdruck.", "Hidrolik basıncı tekerlere iletir.", "Transfer hydraulic pressure."), 660, 250, "pump"),
      n("epb-actuator", l("EPB-Aktuator", "EPB aktüatörü", "EPB actuator"), l("Betätigt die elektrische Parkbremse.", "Elektrikli park frenini çalıştırır.", "Operates the electric parking brake."), 790, 115, "module"),
      n("brake-wheels", l("Radbremsen", "Teker frenleri", "Wheel brakes"), l("Setzen Druck in Bremsmoment um.", "Basıncı fren kuvvetine çevirir.", "Convert pressure into braking force."), 820, 300, "wheel"),
    ],
  },
  oil: {
    title: l("Ölwanne → Pumpe → Filter → Motor", "Yağ karteri → Pompa → Filtre → Motor", "Sump → Pump → Filter → Engine"),
    subtitle: l("Stabiler Öldruck schützt Lager, Steuertrieb und Turbolader.", "Kararlı yağ basıncı yatakları, zamanlama sistemini ve turboyu korur.", "Stable oil pressure protects bearings, timing hardware and turbocharger."),
    nodes: [
      n("oil-sump", l("Ölwanne", "Yağ karteri", "Oil sump"), l("Sammelt zurücklaufendes Motoröl.", "Geri dönen motor yağını toplar.", "Collects returning engine oil."), 90, 270, "tank"),
      n("oil-pump", l("Ölpumpe", "Yağ pompası", "Oil pump"), l("Erzeugt den Systemdruck.", "Sistem yağ basıncını üretir.", "Creates system oil pressure."), 260, 225, "pump"),
      n("oil-filter", l("Ölfilter", "Yağ filtresi", "Oil filter"), l("Filtert Verunreinigungen.", "Yağdaki kirleri filtreler.", "Filters contaminants."), 420, 225, "filter"),
      n("oil-pressure-sensor", l("Öldrucksensor", "Yağ basınç sensörü", "Oil pressure sensor"), l("Überwacht den Hauptölkanal.", "Ana yağ kanalındaki basıncı izler.", "Monitors the main oil gallery."), 520, 105, "sensor"),
      n("oil-circuit", l("Hauptölkanal", "Ana yağ devresi", "Main oil circuit"), l("Verteilt Drucköl zu den Verbrauchern.", "Basınçlı yağı motor bileşenlerine dağıtır.", "Distributes pressurized oil to components."), 620, 225, "module"),
      n("oil-engine", l("Motor / Turbo", "Motor / Turbo", "Engine / Turbo"), l("Benötigt stabilen Ölfluss.", "Kararlı yağ akışına ihtiyaç duyar.", "Requires stable oil flow."), 820, 210, "engine"),
    ],
  },
  cooling: {
    title: l("Pumpe → Motor → Thermostat → Kühler", "Pompa → Motor → Termostat → Radyatör", "Pump → Engine → Thermostat → Radiator"),
    subtitle: l("Kühlmittel transportiert Wärme aus dem Motor zum Kühler.", "Soğutma sıvısı motor ısısını radyatöre taşır.", "Coolant moves heat from the engine to the radiator."),
    nodes: [
      n("coolant-pump", l("Wasserpumpe", "Su pompası", "Coolant pump"), l("Zirkuliert Kühlmittel.", "Soğutma sıvısını dolaştırır.", "Circulates coolant."), 95, 230, "pump"),
      n("hot-zone", l("Motor / Zylinderkopf", "Motor / Silindir kapağı", "Engine / Cylinder head"), l("Gibt Wärme an Kühlmittel ab.", "Isıyı soğutma sıvısına aktarır.", "Transfers heat to coolant."), 300, 210, "engine"),
      n("coolant-sensor", l("Temperatursensor", "Sıcaklık sensörü", "Temperature sensor"), l("Meldet Kühlmitteltemperatur.", "Soğutma sıvısı sıcaklığını bildirir.", "Reports coolant temperature."), 430, 95, "sensor"),
      n("thermostat", l("Thermostat", "Termostat", "Thermostat"), l("Regelt den Weg zum Kühler.", "Radyatöre giden akışı düzenler.", "Controls flow to the radiator."), 535, 220, "module"),
      n("radiator", l("Kühler", "Radyatör", "Radiator"), l("Gibt Wärme an Umgebungsluft ab.", "Isıyı dış havaya verir.", "Rejects heat to ambient air."), 750, 210, "filter"),
      n("cooling-loop", l("Rücklauf", "Geri dönüş", "Return circuit"), l("Führt abgekühltes Kühlmittel zurück.", "Soğutulmuş sıvıyı geri taşır.", "Returns cooled coolant."), 470, 315, "module"),
    ],
  },
  charging: {
    title: l("Generator → Batterie → Bordnetz", "Alternatör → Akü → Elektrik sistemi", "Alternator → Battery → Electrical system"),
    subtitle: l("Generator, Batterie und Energiemanagement stabilisieren die Versorgung.", "Alternatör, akü ve enerji yönetimi beslemeyi dengeler.", "Alternator, battery and energy management stabilize supply voltage."),
    nodes: [
      n("alternator", l("Generator", "Alternatör", "Alternator"), l("Erzeugt elektrische Energie.", "Elektrik enerjisi üretir.", "Generates electrical energy."), 95, 210, "pump"),
      n("battery-path", l("Batterie", "Akü", "Battery"), l("Speichert Energie und puffert das Netz.", "Enerji depolar ve sistemi dengeler.", "Stores energy and buffers the system."), 285, 210, "battery"),
      n("energy-management", l("Energiemanagement", "Enerji yönetimi", "Energy management"), l("Überwacht Ladezustand und Verbraucher.", "Şarj durumunu ve tüketicileri izler.", "Monitors state of charge and loads."), 470, 105, "module"),
      n("low-voltage-bus", l("12-V-Bordnetz", "12 V elektrik sistemi", "12 V electrical bus"), l("Versorgt Steuergeräte und Verbraucher.", "Kontrol ünitelerini ve tüketicileri besler.", "Supplies controllers and loads."), 520, 260, "module"),
      n("starter", l("Starter", "Marş motoru", "Starter"), l("Benötigt hohe Stromreserve.", "Yüksek akım rezervi gerektirir.", "Requires high current reserve."), 700, 110, "module"),
      n("loads", l("Steuergeräte / Verbraucher", "Kontrol üniteleri / Tüketiciler", "Controllers / Loads"), l("Reagieren auf Unterspannung.", "Düşük voltajdan etkilenir.", "Can be affected by low voltage."), 815, 265, "module"),
    ],
  },
  steering: {
    title: l("Lenkwinkel → Steuergerät → Servoantrieb", "Direksiyon açısı → Kontrol ünitesi → Servo", "Steering angle → Controller → Assist motor"),
    subtitle: l("Sensorik und Servoantrieb erzeugen bedarfsgerechte Lenkunterstützung.", "Sensörler ve servo motor ihtiyaca göre direksiyon desteği sağlar.", "Sensors and assist motor provide demand-based steering support."),
    nodes: [
      n("steer-input", l("Lenkrad / Lenkwinkel", "Direksiyon / Açı", "Steering wheel / Angle"), l("Erfasst Fahrerwunsch.", "Sürücü yön talebini algılar.", "Captures driver steering input."), 100, 205, "wheel"),
      n("steer-sensor", l("Drehmoment-/Winkelsensor", "Tork / Açı sensörü", "Torque / Angle sensor"), l("Misst Winkel und Lenkmoment.", "Açı ve direksiyon torkunu ölçer.", "Measures angle and steering torque."), 290, 205, "sensor"),
      n("steer-control", l("Lenksteuergerät", "Direksiyon kontrol ünitesi", "Steering controller"), l("Berechnet Unterstützung.", "Gerekli desteği hesaplar.", "Calculates required assistance."), 480, 205, "module"),
      n("assist-unit", l("Servomotor", "Servo motor", "Assist motor"), l("Erzeugt Lenkunterstützung.", "Direksiyon desteğini üretir.", "Creates steering assistance."), 655, 205, "pump"),
      n("steer-rack", l("Zahnstange / Räder", "Direksiyon kremayeri / Tekerler", "Steering rack / Wheels"), l("Überträgt die Lenkbewegung.", "Direksiyon hareketini tekerlere aktarır.", "Transfers steering movement."), 820, 205, "wheel"),
    ],
  },
  fuel: {
    title: l("Tank → Hochdruck → Rail → Injektoren", "Depo → Yüksek basınç → Rail → Enjektörler", "Tank → High pressure → Rail → Injectors"),
    subtitle: l("Kraftstoff wird gefördert, verdichtet und zylinderweise dosiert.", "Yakıt taşınır, basınçlandırılır ve silindirlere dozajlanır.", "Fuel is supplied, pressurized and metered per cylinder."),
    nodes: [
      n("fuel-tank", l("Kraftstofftank", "Yakıt deposu", "Fuel tank"), l("Speichert Kraftstoff.", "Yakıtı depolar.", "Stores fuel."), 80, 230, "tank"),
      n("low-pressure", l("Vorförderung", "Düşük basınç besleme", "Low-pressure supply"), l("Fördert zur Hochdruckpumpe.", "Yakıtı yüksek basınç pompasına taşır.", "Feeds the high-pressure pump."), 240, 230, "pump"),
      n("fuel-pressure", l("Hochdruckpumpe / Rail", "Yüksek basınç pompası / Rail", "High-pressure pump / Rail"), l("Erzeugt Einspritzdruck.", "Enjeksiyon basıncını üretir.", "Creates injection pressure."), 430, 230, "module"),
      n("injector-1", l("Injektoren", "Enjektörler", "Injectors"), l("Dosieren Kraftstoff in die Zylinder.", "Yakıtı silindirlere dozajlar.", "Meter fuel into cylinders."), 650, 170, "sensor"),
      n("fuel-engine", l("Motor", "Motor", "Engine"), l("Verbrennt Kraftstoff-Luft-Gemisch.", "Yakıt-hava karışımını yakar.", "Burns the fuel-air mixture."), 820, 215, "engine"),
    ],
  },
  combustion: {
    title: l("Sensorik → Steuergerät → Verbrennung", "Sensörler → ECU → Yanma", "Sensors → ECU → Combustion"),
    subtitle: l("Kurbel-/Nockenwellensignale synchronisieren Einspritzung und Verbrennung.", "Krank ve eksantrik sinyalleri enjeksiyon ve yanmayı senkronize eder.", "Crank and cam signals synchronize injection and combustion."),
    nodes: [
      n("crank-sensor", l("Kurbelwellensensor", "Krank sensörü", "Crank sensor"), l("Liefert Drehzahl und Position.", "Devir ve konum bilgisini verir.", "Provides speed and position."), 100, 270, "sensor"),
      n("cam-sensor", l("Nockenwellensensor", "Eksantrik sensörü", "Cam sensor"), l("Liefert Phasenlage.", "Faz bilgisini verir.", "Provides cam phase."), 220, 110, "sensor"),
      n("engine-control", l("Motorsteuergerät", "Motor ECU", "Engine ECU"), l("Steuert Verbrennungsereignisse.", "Yanma olaylarını yönetir.", "Controls combustion events."), 385, 195, "module"),
      n("glow-control", l("Glüh-/Zündsteuerung", "Kızdırma / Ateşleme kontrolü", "Glow / Ignition control"), l("Unterstützt Start und Stabilität.", "Çalıştırma ve yanma kararlılığını destekler.", "Supports starting and combustion stability."), 540, 95, "module"),
      n("engine-core", l("Zylinder / Verbrennung", "Silindir / Yanma", "Cylinder / Combustion"), l("Hier entsteht Drehmoment.", "Tork burada oluşur.", "Where torque is produced."), 675, 215, "engine"),
      n("knock-sensor", l("Klopfsensor", "Vuruntu sensörü", "Knock sensor"), l("Erfasst Körperschall.", "Motor titreşimlerini algılar.", "Detects engine vibration."), 820, 110, "sensor"),
    ],
  },
  transmission: {
    title: l("Motor → Kupplung/Wandler → Getriebe", "Motor → Debriyaj/Tork konvertörü → Şanzıman", "Engine → Clutch/Converter → Transmission"),
    subtitle: l("Drehmoment, Drehzahl und Hydraulikdruck bestimmen den Kraftfluss.", "Tork, devir ve hidrolik basınç güç aktarımını belirler.", "Torque, speed and hydraulic pressure determine power flow."),
    nodes: [
      n("trans-input", l("Motoreingang", "Motor girişi", "Engine input"), l("Liefert Drehmoment.", "Şanzımana tork iletir.", "Supplies torque."), 85, 210, "engine"),
      n("converter", l("Wandler / Kupplung", "Konvertör / Debriyaj", "Converter / Clutch"), l("Koppelt Motor und Getriebe.", "Motoru şanzımana bağlar.", "Couples engine and transmission."), 270, 210, "gear"),
      n("input-speed", l("Eingangsdrehzahl", "Giriş devri", "Input speed"), l("Überwacht Eingangsdrehzahl.", "Giriş devrini izler.", "Monitors input speed."), 390, 95, "sensor"),
      n("gearbox-zone", l("Getriebe / Hydraulik", "Şanzıman / Hidrolik", "Transmission / Hydraulics"), l("Schaltet Übersetzungen und Druck.", "Vites oranlarını ve basıncı yönetir.", "Controls ratios and pressure."), 500, 215, "gear"),
      n("output-speed", l("Ausgangsdrehzahl", "Çıkış devri", "Output speed"), l("Überwacht Abtriebsdrehzahl.", "Çıkış devrini izler.", "Monitors output speed."), 650, 95, "sensor"),
      n("trans-output", l("Abtrieb", "Çıkış", "Output"), l("Überträgt Drehmoment zu den Rädern.", "Torku tekerlere aktarır.", "Transfers torque to the wheels."), 810, 215, "wheel"),
    ],
  },
  generic: {
    title: l("Sensor → Steuergerät → System", "Sensör → Kontrol ünitesi → Sistem", "Sensor → Controller → System"),
    subtitle: l("Allgemeine Darstellung, wenn keine verifizierte spezifische Anordnung vorliegt.", "Doğrulanmış özel yerleşim olmadığında genel sistem gösterimi kullanılır.", "Generic representation when no verified specific layout is available."),
    nodes: [
      n("wheel-sensor-zone", l("Sensor / Eingang", "Sensör / Giriş", "Sensor / Input"), l("Erfasst einen Systemwert.", "Bir sistem değerini algılar.", "Captures a system value."), 100, 210, "sensor"),
      n("exhaust-sensor-zone", l("Messstrecke", "Ölçüm hattı", "Measurement path"), l("Überwacht einen Betriebswert.", "Bir çalışma değerini izler.", "Monitors an operating value."), 270, 120, "sensor"),
      n("control-data", l("Steuergerät / Datenbus", "Kontrol ünitesi / Veri yolu", "Controller / Data bus"), l("Bewertet und kommuniziert Signale.", "Sinyalleri işler ve iletişim kurar.", "Processes and communicates signals."), 450, 210, "module"),
      n("restraint-zone", l("Sicherheits-/Aktorsystem", "Güvenlik / Aktüatör sistemi", "Safety / Actuator system"), l("Setzt den Steuerbefehl um.", "Kontrol komutunu uygular.", "Executes the control command."), 650, 120, "module"),
      n("system-zone", l("Betroffenes System", "İlgili sistem", "Affected system"), l("Die genaue Anordnung ist fahrzeugabhängig.", "Kesin yerleşim araca bağlıdır.", "Exact layout depends on the vehicle."), 810, 230, "module"),
    ],
  },
};

const UI: Record<Language, { system: string; vehicle: string; exact: string; platform: string; engine: string; generic: string; faultArea: string; selected: string; certainty: string; genericNote: string; scrFallback: string }> = {
  de: {
    system: "SYSTEMFUNKTION", vehicle: "AUSGEWÄHLTES FAHRZEUG", exact: "FAHRZEUGPROFIL", platform: "PLATTFORMPROFIL", engine: "MOTORPROFIL", generic: "ALLGEMEINE DARSTELLUNG", faultArea: "FEHLERBEREICH", selected: "AUSGEWÄHLTES BAUTEIL", certainty: "Die Hervorhebung zeigt den mit dem Fehlercode zusammenhängenden Systembereich; sie beweist nicht, dass dieses Bauteil sicher defekt ist.", genericNote: "Allgemeine Systemdarstellung – für dieses Fahrzeug liegt noch kein verifiziertes spezifisches Profil vor.", scrFallback: "Für diese Fahrzeug-/Motorvariante liegt keine verifizierte SCR-Werksanordnung vor. Deshalb wird die allgemeine SCR-Systemdarstellung verwendet.",
  },
  tr: {
    system: "SİSTEM ÇALIŞMASI", vehicle: "SEÇİLİ ARAÇ", exact: "ARAÇ PROFİLİ", platform: "PLATFORM PROFİLİ", engine: "MOTOR PROFİLİ", generic: "GENEL GÖSTERİM", faultArea: "ARIZA BÖLGESİ", selected: "SEÇİLİ PARÇA", certainty: "Vurgu, arıza koduyla ilişkili sistem bölgesini gösterir; bu parçanın kesin olarak arızalı olduğunu kanıtlamaz.", genericNote: "Genel sistem gösterimi – bu araç için henüz doğrulanmış özel yerleşim profili yok.", scrFallback: "Bu araç/motor varyantı için doğrulanmış fabrika SCR yerleşimi yok. Bu nedenle genel SCR sistem gösterimi kullanılıyor.",
  },
  en: {
    system: "SYSTEM FUNCTION", vehicle: "SELECTED VEHICLE", exact: "VEHICLE PROFILE", platform: "PLATFORM PROFILE", engine: "ENGINE PROFILE", generic: "GENERIC REPRESENTATION", faultArea: "FAULT AREA", selected: "SELECTED COMPONENT", certainty: "The highlight shows the system area related to the fault code; it does not prove that this component is definitely defective.", genericNote: "Generic system representation – no verified vehicle-specific layout profile is available yet.", scrFallback: "There is no verified factory SCR layout for this vehicle/engine variant, so a generic SCR system representation is shown.",
  },
};

function pathBetween(a: SceneNode, b: SceneNode) {
  const middle = (a.x + b.x) / 2;
  const bend = (a.y + b.y) / 2 + (a.y > b.y ? -18 : 18);
  return `M ${a.x} ${a.y} C ${middle} ${bend}, ${middle} ${bend}, ${b.x} ${b.y}`;
}

function withPosition(node: SceneNode, override?: Point): SceneNode {
  return override ? { ...node, x: override.x, y: override.y } : node;
}

function Glyph({ node, active }: { node: SceneNode; active: boolean }) {
  const cls = `systemNodeGlyph${active ? " systemNodeGlyphActive" : ""}`;
  const x = node.x;
  const y = node.y;
  switch (node.shape) {
    case "tank": return <g className={cls}><rect x={x - 27} y={y - 22} width="54" height="44" rx="8"/><path d={`M ${x - 12} ${y - 28} h24 v8`}/></g>;
    case "sensor": return <g className={cls}><circle cx={x} cy={y} r="21"/><circle cx={x} cy={y} r="6"/><path d={`M ${x + 21} ${y} h18`}/></g>;
    case "filter": return <g className={cls}><rect x={x - 31} y={y - 24} width="62" height="48" rx="5"/><path d={`M ${x - 20} ${y - 12} h40 M ${x - 20} ${y} h40 M ${x - 20} ${y + 12} h40`}/></g>;
    case "engine": return <g className={cls}><path d={`M ${x - 32} ${y - 18} h18 l8-10 h30 l8 10 h12 l10 10 v28 h-15 l-7 8 h-38 l-7-8 h-13 v-30z`}/></g>;
    case "wheel": return <g className={cls}><circle cx={x} cy={y} r="26"/><circle cx={x} cy={y} r="9"/><path d={`M ${x - 26} ${y} h52 M ${x} ${y - 26} v52`}/></g>;
    case "pump": return <g className={cls}><circle cx={x} cy={y} r="25"/><path d={`M ${x - 9} ${y + 10} l18-20 M ${x - 7} ${y - 9} l16 18`}/></g>;
    case "gear": return <g className={cls}><circle cx={x} cy={y} r="26"/><circle cx={x} cy={y} r="10"/><path d={`M ${x - 35} ${y} h70 M ${x} ${y - 35} v70`}/></g>;
    case "battery": return <g className={cls}><rect x={x - 31} y={y - 21} width="62" height="42" rx="4"/><path d={`M ${x - 17} ${y - 28} v7 M ${x + 17} ${y - 28} v7 M ${x - 18} ${y} h14 M ${x + 6} ${y} h14 M ${x + 13} ${y - 7} v14`}/></g>;
    default: return <g className={cls}><circle cx={x} cy={y} r="22"/></g>;
  }
}

export function FaultSystemAnimation({ code, language, vehicle }: { code: string; language: Language; vehicle: VehicleContext }) {
  const visual = getFaultVisual(code);
  const profile = resolveVehicleProfile(vehicle);
  const scene = SCENES[visual.scene];
  const verifiedForScene = profile.verifiedSystems[visual.scene];
  const forceGenericLayout = verifiedForScene === false;
  const nodes = useMemo(
    () => scene.nodes.map((node) => withPosition(node, forceGenericLayout ? undefined : profile.placements[node.id])),
    [forceGenericLayout, profile.placements, scene.nodes],
  );
  const defaultNode = nodes.find((node) => node.id === visual.focus) ?? nodes[0];
  const [selectedId, setSelectedId] = useState(defaultNode.id);

  useEffect(() => setSelectedId(defaultNode.id), [code, defaultNode.id, profile.profileKey]);

  const selected = nodes.find((node) => node.id === selectedId) ?? defaultNode;
  const paths = nodes.slice(0, -1).map((node, index) => ({ id: `${node.id}-${nodes[index + 1].id}`, d: pathBetween(node, nodes[index + 1]) }));
  const ui = UI[language];
  const profileBadge = profile.confidence === "exact" ? ui.exact : profile.confidence === "platform" ? ui.platform : profile.confidence === "engine" ? ui.engine : ui.generic;
  const showGenericNote = profile.confidence === "generic" || forceGenericLayout;

  return (
    <section
      className="faultSystemAnimation"
      aria-label={`${ui.system} ${code}`}
      data-scene={visual.scene}
      data-focus={visual.focus}
      data-vehicle-profile={profile.profileKey}
      data-vehicle-confidence={profile.confidence}
    >
      <div className="systemAnimationHead">
        <div><span>{ui.system}</span><h2>{scene.title[language]}</h2></div>
        <p>{scene.subtitle[language]}</p>
      </div>

      <div className="systemVehicleBar">
        <div><span>{ui.vehicle}</span><strong>{profile.label}</strong></div>
        <b>{profileBadge}</b>
      </div>

      {forceGenericLayout && <div className="systemCompatibilityWarning">{ui.scrFallback}</div>}

      <div className={`systemStage systemTone-${visual.tone}`}>
        <svg className="systemDiagram" viewBox="0 0 900 390" role="img" aria-label={`${code}: ${selected.label[language]}`}>
          <VehicleBodyShell variant={profile.bodyVariant} />
          {paths.map((path, index) => (
            <g key={path.id}>
              <path d={path.d} className="systemTrack" />
              <path d={path.d} className="systemFlow" style={{ animationDelay: `${index * 140}ms` }} />
              <circle r="4" className="systemParticle"><animateMotion dur={`${2.4 + index * 0.15}s`} repeatCount="indefinite" path={path.d} /></circle>
            </g>
          ))}
          {nodes.map((node) => {
            const active = node.id === visual.focus;
            return (
              <g key={node.id} data-node={node.id} className={active ? "systemFocusGroup" : undefined}>
                <Glyph node={node} active={active} />
                <text x={node.x} y={node.y + 48} className="systemSvgLabel">{node.label[language]}</text>
              </g>
            );
          })}
        </svg>

        <div className="systemLegend">
          <div>
            <span>{ui.faultArea}</span>
            <strong>{defaultNode.label[language]}</strong>
            <p>{ui.certainty}</p>
          </div>
          <div>
            <span>{ui.selected}</span>
            <strong>{selected.label[language]}</strong>
            <p>{selected.role[language]}</p>
          </div>
        </div>

        <div className="systemNodeButtons">
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`${node.id === visual.focus ? "isFaultNode " : ""}${node.id === selected.id ? "isSelectedNode" : ""}`}
              onClick={() => setSelectedId(node.id)}
            >
              {node.label[language]}
            </button>
          ))}
        </div>
      </div>

      {showGenericNote && <p className="systemGenericNote">{forceGenericLayout ? ui.scrFallback : ui.genericNote}</p>}
    </section>
  );
}