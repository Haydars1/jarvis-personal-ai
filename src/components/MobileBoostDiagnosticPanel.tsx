import type { FaultScene } from "../domain/fault-scenes";
import type { Language } from "../i18n/language";
import "./MobileBoostDiagnosticPanel.css";

const REAL_TURBO_SRC = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/M271_turbo.JPG/960px-M271_turbo.JPG";

const COPY: Record<Language, { fault: string; explanation: string; alt: string }> = {
  de: {
    fault: "Ladedruck zu niedrig",
    explanation: "Der angeforderte Ladedruck wird nicht erreicht.",
    alt: "Echter Turbolader",
  },
  tr: {
    fault: "Turbo basıncı düşük",
    explanation: "İstenen turbo basıncına ulaşılamıyor.",
    alt: "Gerçek turboşarj",
  },
  en: {
    fault: "Boost pressure too low",
    explanation: "Requested boost pressure is not reached.",
    alt: "Real turbocharger",
  },
};

export function MobileBoostDiagnosticPanel({ scene, language }: { scene: FaultScene; language: Language }) {
  const nodes = scene.flow
    .slice(0, 4)
    .map((id) => scene.nodes.find((node) => node.id === id))
    .filter((node): node is FaultScene["nodes"][number] => Boolean(node));
  const copy = COPY[language];

  return (
    <div className="mobileBoostPanel" data-mobile-diagnostic-panel="boost">
      <div className="mobileBoostSchematic" data-mobile-boost-schematic="true">
        <div className="mobileBoostTurboStage">
          <img
            className="mobileBoostTurboPhoto"
            src={REAL_TURBO_SRC}
            alt={copy.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            data-real-turbo="true"
          />
          <span className="mobileBoostPhotoShade" aria-hidden="true" />
          <span className="mobileBoostRotor" data-mobile-turbo-rotor="true" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
          </span>
          <span className="mobileBoostAir mobileBoostAirIntake" data-mobile-airflow="intake" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="mobileBoostAir mobileBoostAirBoost" data-mobile-airflow="boost" aria-hidden="true">
            <i /><i /><i />
          </span>
          <div className="mobileBoostFault">P0299 · {copy.fault}</div>
        </div>

        <div className="mobileBoostPath" aria-label={scene.title[language]}>
          {nodes.map((node, index) => {
            const active = node.id === scene.focusNodeId;
            return (
              <div
                key={node.id}
                className={`mobileBoostNode${active ? " isActive" : ""}`}
                data-mobile-boost-node={node.id}
                data-active={active ? "true" : undefined}
              >
                {index > 0 && <span className="mobileBoostConnector" aria-hidden="true">→</span>}
                <span className="mobileBoostDot" aria-hidden="true" />
                <strong>{node.label[language]}</strong>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mobileBoostSummary">{copy.explanation}</p>
    </div>
  );
}
