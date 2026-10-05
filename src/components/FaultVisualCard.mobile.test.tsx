import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { FaultVisualCard } from "./FaultVisualCard";

describe("FaultVisualCard mobile compact boost panel", () => {
  it("renders a dedicated compact P0299 panel with four readable steps", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);

    const panel = container.querySelector('[data-mobile-diagnostic-panel="boost"]') as HTMLElement;
    expect(panel).toBeInTheDocument();
    expect(panel.querySelectorAll('[data-mobile-diagnostic-step]')).toHaveLength(4);
    expect(panel.querySelector('[data-mobile-diagnostic-step="turbo"]')).toHaveAttribute("data-active", "true");
    expect(within(panel).getByText("Emiş havasını sıkıştırır.")).toBeInTheDocument();
  });

  it("lets a compact step change the short explanation", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);
    const panel = container.querySelector('[data-mobile-diagnostic-panel="boost"]') as HTMLElement;

    fireEvent.click(within(panel).getByRole("listitem", { name: "Basınç sensörü" }));
    expect(within(panel).getByText("Gerçek basıncı bildirir.")).toBeInTheDocument();
  });
});
