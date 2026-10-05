import type { FaultScene } from "../domain/fault-scenes";
import type { Language } from "../i18n/language";
import "./MobileBoostDiagnosticPanel.css";

const COPY: Record<Language, { fault: string; explanation: string }> = {
  de: { fault: "Ladedruck zu niedrig", explanation: "Der angeforderte Ladedruck wird nicht erreicht." },
  tr: { fault: "Turbo basıncı düşük", explanation: "İstenen turbo basıncına ulaşılamıyor." },
  en: { fault: "Boost pressure too low", explanation: "Requested boost pressure is not reached." },
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
        <svg className="mobileBoostShell" viewBox="0 0 640 220" aria-hidden="true">
          <path d="M58 152 C82 126 118 116 170 111 L224 66 C244 49 269 40 307 40 L400 40 C438 41 469 55 495 79 L539 115 C563 120 582 132 591 152" />
          <path d="M112 152 H530" />
          <circle cx="158" cy="154" r="28" />
          <circle cx="492" cy="154" r="28" />
        </svg>

        <div className="mobileBoostFault">P0299 · {copy.fault}</div>

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
