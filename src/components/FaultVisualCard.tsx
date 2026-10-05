import type { FaultScene } from "../domain/fault-scenes";
import type { Language } from "../i18n/language";
import { FaultFlowDiagram } from "./FaultFlowDiagram";
import { GenericVehicleSilhouette } from "./GenericVehicleSilhouette";
import "./FaultVisualCard.css";

const COPY: Record<Language, { kicker: string; location: string; note: string }> = {
  de: {
    kicker: "6006 / SYSTEMVISUALISIERUNG",
    location: "Betroffener Bereich",
    note: "Schematische, marken- und modellneutrale Darstellung. Sie zeigt den Systemzusammenhang, nicht die exakte Bauteillage eines bestimmten Fahrzeugs.",
  },
  tr: {
    kicker: "6006 / SİSTEM GÖRSELİ",
    location: "İlgili bölge",
    note: "Şematik, marka ve modelden bağımsız gösterim. Belirli bir aracın kesin parça konumunu değil, sistem ilişkisini gösterir.",
  },
  en: {
    kicker: "6006 / SYSTEM VISUAL",
    location: "Affected area",
    note: "Schematic, brand- and model-neutral representation. It shows system context, not the exact component location of a specific vehicle.",
  },
};

export function FaultVisualCard({ scene, language }: { scene: FaultScene; language: Language }) {
  const copy = COPY[language];

  return (
    <section
      className={`faultVisualCard faultVisualTone-${scene.tone}`}
      data-fault-visual="true"
      data-scene={scene.id}
      aria-labelledby={`fault-visual-title-${scene.id}`}
    >
      <div className="faultVisualHeader">
        <div>
          <span>{copy.kicker}</span>
          <h2 id={`fault-visual-title-${scene.id}`}>{scene.title[language]}</h2>
        </div>
        <p>{scene.caption[language]}</p>
      </div>

      <div className="faultVisualVehicleStage">
        <div className="faultVisualStageLabel">
          <span>{copy.location}</span>
          <b>{scene.title[language]}</b>
        </div>
        <GenericVehicleSilhouette region={scene.region} tone={scene.tone} />
      </div>

      <FaultFlowDiagram scene={scene} language={language} />

      <p className="faultVisualNeutralNote">{copy.note}</p>
    </section>
  );
}
