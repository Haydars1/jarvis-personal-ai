import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { FaultVisualCard } from "./FaultVisualCard";

describe("FaultVisualCard mobile boost panel", () => {
  it("renders the simplified P0299 mobile panel without step cards", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);
    const panel = container.querySelector('[data-mobile-diagnostic-panel="boost"]') as HTMLElement;

    expect(panel).toBeInTheDocument();
    expect(panel.querySelectorAll('[data-mobile-diagnostic-step]')).toHaveLength(0);
    expect(panel.querySelectorAll("button")).toHaveLength(0);
    expect(within(panel).getByText("P0299 · Turbo basıncı düşük")).toBeInTheDocument();
    expect(within(panel).getByText("İstenen turbo basıncına ulaşılamıyor.")).toBeInTheDocument();
  });
});
