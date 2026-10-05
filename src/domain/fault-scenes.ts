import type { FaultTone } from "./faults.types";

export type FaultSceneId = "boost" | "dpf" | "scr" | "brakes" | "oil" | "cooling";
export type FaultSceneRegion =
  | "front-engine"
  | "center-underbody"
  | "rear-underbody"
  | "wheels"
  | "engine-lower"
  | "cooling-front";

export type LocalizedText = { de: string; tr: string; en: string };

export interface FaultSceneNode {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
}

export interface FaultScene {
  id: FaultSceneId;
  title: LocalizedText;
  caption: LocalizedText;
  region: FaultSceneRegion;
  tone: FaultTone;
  nodes: FaultSceneNode[];
  flow: string[];
  focusNodeId: string;
}

const l = (de: string, tr: string, en: string): LocalizedText => ({ de, tr, en });
const n = (id: string, label: LocalizedText, description: LocalizedText): FaultSceneNode => ({ id, label, description });

export const FAULT_SCENES: Record<FaultSceneId, FaultScene> = {
  boost: {
    id: "boost",
    title: l("Ladedruck-System", "Turbo basınç sistemi", "Boost pressure system"),
    caption: l("Nur der relevante Luft- und Ladedruckpfad wird hervorgehoben.", "Yalnız ilgili hava ve turbo basınç hattı vurgulanır.", "Only the relevant intake and boost path is highlighted."),
    region: "front-engine",
    tone: "amber",
    nodes: [
      n("intake", l("Ansaugluft", "Emiş havası", "Intake"), l("Luft gelangt in das Aufladesystem.", "Hava turbo sistemine girer.", "Air enters the boost system.")),
      n("turbo", l("Turbolader", "Turbo", "Turbocharger"), l("Verdichtet die Ansaugluft.", "Emiş havasını sıkıştırır.", "Compresses intake air.")),
      n("control", l("Aktuator / Regelung", "Aktüatör / kontrol", "Actuator / control"), l("Regelt die gewünschte Ladedruckerzeugung.", "İstenen turbo basıncını kontrol eder.", "Controls requested boost generation.")),
      n("sensor", l("Ladedrucksensor", "Basınç sensörü", "Boost sensor"), l("Meldet den tatsächlichen Ladedruck.", "Gerçek basıncı bildirir.", "Reports actual boost pressure.")),
      n("engine", l("Motor", "Motor", "Engine"), l("Nutzt die verdichtete Luft für die Verbrennung.", "Sıkıştırılmış havayı yanmada kullanır.", "Uses compressed air for combustion.")),
    ],
    flow: ["intake", "turbo", "control", "sensor", "engine"],
    focusNodeId: "turbo",
  },
  dpf: {
    id: "dpf",
    title: l("DPF-System", "DPF sistemi", "DPF system"),
    caption: l("Filter, Druck- und Temperaturpfad stehen im Fokus.", "Filtre, basınç ve sıcaklık hattı öne çıkar.", "Filter, pressure and temperature path are emphasized."),
    region: "center-underbody",
    tone: "amber",
    nodes: [
      n("engine", l("Motor", "Motor", "Engine"), l("Erzeugt Abgas und Partikel.", "Egzoz ve partikül üretir.", "Produces exhaust gas and particulates.")),
      n("pretreatment", l("Abgasvorstufe", "Egzoz ön arıtma", "Exhaust pre-treatment"), l("Bereitet das Abgas für die Filterung vor.", "Egzozu filtreleme için hazırlar.", "Conditions exhaust before filtration.")),
      n("dpf", l("DPF", "DPF", "DPF"), l("Speichert Ruß und regeneriert ihn.", "Kurumu tutar ve rejenerasyonla yakar.", "Stores soot and regenerates it.")),
      n("sensing", l("Druck / Temperatur", "Basınç / sıcaklık", "Pressure / temperature"), l("Überwacht den Filterzustand.", "Filtre durumunu izler.", "Monitors filter condition.")),
      n("tailpipe", l("Auslass", "Egzoz çıkışı", "Tailpipe"), l("Führt behandeltes Abgas ab.", "Arıtılmış egzozu dışarı atar.", "Carries treated exhaust out.")),
    ],
    flow: ["engine", "pretreatment", "dpf", "sensing", "tailpipe"],
    focusNodeId: "dpf",
  },
  scr: {
    id: "scr",
    title: l("SCR / AdBlue-System", "SCR / AdBlue sistemi", "SCR / AdBlue system"),
    caption: l("Reduktionsmittel und NOx-Kontrolle werden als einfacher Pfad gezeigt.", "AdBlue ve NOx kontrolü sade bir hat olarak gösterilir.", "Reductant and NOx control are shown as a simple path."),
    region: "rear-underbody",
    tone: "amber",
    nodes: [
      n("tank", l("AdBlue-Tank", "AdBlue deposu", "AdBlue tank"), l("Speichert das Reduktionsmittel.", "AdBlue sıvısını depolar.", "Stores reductant.")),
      n("pump", l("Pumpe / Modul", "Pompa / modül", "Pump / module"), l("Fördert und regelt AdBlue.", "AdBlue beslemesini düzenler.", "Supplies and regulates AdBlue.")),
      n("injector", l("Dosierinjektor", "Dozaj enjektörü", "Dosing injector"), l("Dosiert AdBlue in den Abgasstrom.", "AdBlue'yu egzoza dozajlar.", "Meters AdBlue into exhaust.")),
      n("scr", l("SCR-Katalysator", "SCR katalizörü", "SCR catalyst"), l("Reduziert Stickoxide.", "NOx emisyonunu azaltır.", "Reduces nitrogen oxides.")),
      n("nox", l("NOx-Sensorik", "NOx sensörleri", "NOx sensing"), l("Überwacht die SCR-Wirkung.", "SCR verimini izler.", "Monitors SCR effectiveness.")),
    ],
    flow: ["tank", "pump", "injector", "scr", "nox"],
    focusNodeId: "scr",
  },
  brakes: {
    id: "brakes",
    title: l("ABS / Bremsregelung", "ABS / fren kontrolü", "ABS / brake control"),
    caption: l("Raddaten, Regelgerät und Hydraulik bilden den relevanten Pfad.", "Teker verisi, kontrol ünitesi ve hidrolik hat birlikte gösterilir.", "Wheel data, control unit and hydraulics form the relevant path."),
    region: "wheels",
    tone: "red",
    nodes: [
      n("wheel-sensors", l("Raddrehzahlsensoren", "Teker hız sensörleri", "Wheel-speed sensors"), l("Messen die Raddrehzahlen.", "Teker hızlarını ölçer.", "Measure wheel speeds.")),
      n("abs-control", l("ABS / ESC", "ABS / ESC", "ABS / ESC"), l("Berechnet den Regeleingriff.", "Kontrol müdahalesini hesaplar.", "Calculates intervention.")),
      n("hydraulic", l("Hydraulikeinheit", "Hidrolik ünite", "Hydraulic unit"), l("Regelt Bremsdruck radselektiv.", "Teker bazında fren basıncını düzenler.", "Modulates brake pressure per wheel.")),
      n("brakes", l("Bremskreise", "Fren devreleri", "Brake circuits"), l("Übertragen den Bremsdruck.", "Fren basıncını iletir.", "Transfer brake pressure.")),
    ],
    flow: ["wheel-sensors", "abs-control", "hydraulic", "brakes"],
    focusNodeId: "abs-control",
  },
  oil: {
    id: "oil",
    title: l("Motor-Schmierung", "Motor yağlama sistemi", "Engine lubrication"),
    caption: l("Ölversorgung und Drucküberwachung werden gezielt hervorgehoben.", "Yağ beslemesi ve basınç kontrolü öne çıkarılır.", "Oil supply and pressure monitoring are emphasized."),
    region: "engine-lower",
    tone: "red",
    nodes: [
      n("sump", l("Ölwanne", "Yağ karteri", "Oil sump"), l("Sammelt das Motoröl.", "Motor yağını toplar.", "Collects engine oil.")),
      n("pump", l("Ölpumpe", "Yağ pompası", "Oil pump"), l("Erzeugt den Öldruck.", "Yağ basıncını üretir.", "Creates oil pressure.")),
      n("filter", l("Ölfilter", "Yağ filtresi", "Oil filter"), l("Filtert Verunreinigungen.", "Kirleri filtreler.", "Filters contaminants.")),
      n("sensor", l("Öldrucksensor", "Yağ basınç sensörü", "Oil pressure sensor"), l("Überwacht den Hauptöldruck.", "Ana yağ basıncını izler.", "Monitors main oil pressure.")),
      n("engine", l("Motorlagerung", "Motor yağlama noktaları", "Engine lubrication points"), l("Benötigt stabilen Ölfluss.", "Kararlı yağ akışına ihtiyaç duyar.", "Requires stable oil flow.")),
    ],
    flow: ["sump", "pump", "filter", "sensor", "engine"],
    focusNodeId: "sensor",
  },
  cooling: {
    id: "cooling",
    title: l("Kühlsystem", "Soğutma sistemi", "Cooling system"),
    caption: l("Kühlmittelkreislauf und Temperaturüberwachung stehen im Fokus.", "Soğutma devresi ve sıcaklık kontrolü öne çıkar.", "Coolant circuit and temperature monitoring are emphasized."),
    region: "cooling-front",
    tone: "amber",
    nodes: [
      n("pump", l("Wasserpumpe", "Su pompası", "Coolant pump"), l("Zirkuliert Kühlmittel.", "Soğutma sıvısını dolaştırır.", "Circulates coolant.")),
      n("engine", l("Motor", "Motor", "Engine"), l("Überträgt Wärme an das Kühlmittel.", "Isıyı soğutma sıvısına aktarır.", "Transfers heat to coolant.")),
      n("thermostat", l("Thermostat", "Termostat", "Thermostat"), l("Regelt den Weg zum Kühler.", "Radyatör hattını kontrol eder.", "Controls flow to the radiator.")),
      n("radiator", l("Kühler", "Radyatör", "Radiator"), l("Gibt Wärme an die Umgebung ab.", "Isıyı dışarı atar.", "Rejects heat to ambient air.")),
      n("sensor", l("Temperatursensor", "Sıcaklık sensörü", "Temperature sensor"), l("Meldet die Kühlmitteltemperatur.", "Soğutma sıvısı sıcaklığını bildirir.", "Reports coolant temperature.")),
    ],
    flow: ["pump", "engine", "thermostat", "radiator", "sensor"],
    focusNodeId: "engine",
  },
};
