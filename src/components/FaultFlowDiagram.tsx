import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { FaultScene } from "../domain/fault-scenes";
import type { Language } from "../i18n/language";
import "./FaultFlowDiagram.css";

export function FaultFlowDiagram({ scene, language }: { scene: FaultScene; language: Language }) {
  const [focusedId, setFocusedId] = useState(scene.focusNodeId);

  useEffect(() => {
    setFocusedId(scene.focusNodeId);
  }, [scene.id, scene.focusNodeId]);

  const orderedNodes = useMemo(
    () => scene.flow.map((id) => scene.nodes.find((node) => node.id === id)).filter((node): node is FaultScene["nodes"][number] => Boolean(node)),
    [scene],
  );
  const focusedNode = orderedNodes.find((node) => node.id === focusedId) ?? orderedNodes[0];
  const flowStyle = { "--flow-count": orderedNodes.length } as CSSProperties;
  const compactBoostMobile = scene.id === "boost";

  return (
    <div className="faultFlowDiagram" data-flow-scene={scene.id}>
      <div
        className="faultFlowTrack"
        role="list"
        aria-label={scene.title[language]}
        style={flowStyle}
        data-mobile-layout={compactBoostMobile ? "2x2" : undefined}
      >
        {orderedNodes.map((node, index) => {
          const focused = node.id === focusedNode?.id;
          const mobileSecondary = compactBoostMobile && node.id === "engine";
          return (
            <div
              className="faultFlowStep"
              role="listitem"
              key={node.id}
              data-flow-step={node.id}
              data-mobile-secondary={mobileSecondary ? "true" : undefined}
            >
              <button
                type="button"
                className={`faultFlowNode${focused ? " isFocused" : ""}`}
                data-flow-node={node.id}
                data-flow-focus={focused ? "true" : undefined}
                aria-label={node.label[language]}
                aria-pressed={focused}
                onClick={() => setFocusedId(node.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{node.label[language]}</strong>
              </button>
              {index < orderedNodes.length - 1 && <span className="faultFlowConnector" aria-hidden="true"><i /></span>}
            </div>
          );
        })}
      </div>
      {focusedNode && (
        <div className="faultFlowDetail" aria-live="polite">
          <span>{focusedNode.label[language]}</span>
          <p>{focusedNode.description[language]}</p>
        </div>
      )}
    </div>
  );
}
