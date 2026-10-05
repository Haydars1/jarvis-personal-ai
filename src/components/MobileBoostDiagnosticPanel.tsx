import { useMemo, useState } from "react";
import { XRAY_BOOST_SRC } from "../assets/xrayBoost";
import type { FaultScene } from "../domain/fault-scenes";
import type { Language } from "../i18n/language";
import "./MobileBoostDiagnosticPanel.css";

const LABELS: Record<Language, { code: string; area: string }> = {
  de: { code: "Fehlercode", area: "Markierter Bereich" },
  tr: { code: "Arıza kodu", area: "Vurgulanan bölge" },
  en: { code: "Fault code", area: "Highlighted area" },
};

export function MobileBoostDiagnosticPanel({ scene, language }: { scene: FaultScene; language: Language }) {
  const nodes = useMemo(
    () => scene.flow.slice(0, 4).map((id) => scene.nodes.find((node) => node.id === id)).filter((node): node is FaultScene["nodes"][number] => Boolean(node)),
    [scene],
  );
  const initialId = nodes.some((node) => node.id === scene.focusNodeId) ? scene.focusNodeId : nodes[0]?.id;
  const [activeId, setActiveId] = useState(initialId);
  const activeNode = nodes.find((node) => node.id === activeId) ?? nodes[0];
  const labels = LABELS[language];

  return (
    <div className="mobileBoostPanel" data-mobile-diagnostic-panel="boost">
      <div className="mobileBoostVisual">
        <img src={XRAY_BOOST_SRC} alt="" draggable={false} />
        <span className="mobileBoostCode"><small>{labels.code}</small>P0299</span>
        <span className="mobileBoostHotspot" aria-hidden="true"><i /></span>
        <span className="mobileBoostArea"><small>{labels.area}</small>{scene.title[language]}</span>
      </div>

      <div className="mobileBoostSteps" role="list" aria-label={scene.title[language]}>
        {nodes.map((node, index) => {
          const active = node.id === activeNode?.id;
          return (
            <button
              key={node.id}
              type="button"
              role="listitem"
              className={`mobileBoostStep${active ? " isActive" : ""}`}
              data-mobile-diagnostic-step={node.id}
              data-active={active ? "true" : undefined}
              aria-label={node.label[language]}
              onClick={() => setActiveId(node.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{node.label[language]}</strong>
            </button>
          );
        })}
      </div>

      {activeNode && (
        <div className="mobileBoostDetail" aria-live="polite">
          <b>{activeNode.label[language]}</b>
          <p>{activeNode.description[language]}</p>
        </div>
      )}
    </div>
  );
}
