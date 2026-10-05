import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { FaultVisualCard } from "./FaultVisualCard";

describe("FaultVisualCard mobile compact boost panel", () => {
  it("renders a dedicated compact P0299 panel with four readable steps", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);

    const panel = container.querySelector('[data-mobile-diagnostic-panel="boost"]');
    expect(panel).toBeInTheDocument();
    expect(panel?.querySelectorAll('[data-mobile-diagnostic-step]')).toHaveLength(4);
    expect(panel?.querySelector('[data-mobile-diagnostic-step="turbo"]')).toHaveAttribute("data-active", "true");
    expect(screen.getByText("Emiş havasını sıkıştırır.")).toBeInTheDocument();
  });

  it("lets a compact step change the short explanation", () => {
    render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);

    fireEvent.click(screen.getByRole("button", { name: "Basınç sensörü" }));
    expect(screen.getByText("Gerçek basıncı bildirir.")).toBeInTheDocument();
  });
});
