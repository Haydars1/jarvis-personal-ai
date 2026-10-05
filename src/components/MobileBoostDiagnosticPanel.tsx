import { XRAY_BOOST_SRC } from "../assets/xrayBoost";
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
      <div className="mobileBoostVisual">
        <img src={XRAY_BOOST_SRC} alt="" draggable={false} />
        <span className="mobileBoostCode">P0299 · {copy.fault}</span>
        <span className="mobileBoostHotspot" aria-hidden="true" />
      </div>

      <div className="mobileBoostFlow" data-mobile-boost-flow="true" aria-label={scene.title[language]}>
        {nodes.map((node, index) => (
          <span key={node.id} className={node.id === scene.focusNodeId ? "isActive" : undefined}>
            {index > 0 && <i aria-hidden="true"> → </i>}
            {node.label[language]}
          </span>
        ))}
      </div>

      <p className="mobileBoostSummary">{copy.explanation}</p>
    </div>
  );
}
