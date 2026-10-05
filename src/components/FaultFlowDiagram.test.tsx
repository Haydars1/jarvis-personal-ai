import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { FaultFlowDiagram } from "./FaultFlowDiagram";

describe("FaultFlowDiagram", () => {
  it("marks the P0299 boost flow for a four-step mobile grid while keeping the engine as desktop-only context", () => {
    const { container } = render(<FaultFlowDiagram scene={FAULT_SCENES.boost} language="tr" />);

    const track = container.querySelector(".faultFlowTrack");
    expect(track).toHaveAttribute("data-mobile-layout", "2x2");

    const nodes = Array.from(container.querySelectorAll("[data-flow-node]"));
    expect(nodes).toHaveLength(5);
    expect(nodes.map((node) => node.getAttribute("data-flow-node"))).toEqual([
      "intake",
      "turbo",
      "control",
      "sensor",
      "engine",
    ]);

    const engineStep = container.querySelector('[data-flow-step="engine"]');
    expect(engineStep).toHaveAttribute("data-mobile-secondary", "true");
  });
});
