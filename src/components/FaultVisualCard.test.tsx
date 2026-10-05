import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { FaultVisualCard } from "./FaultVisualCard";

describe("FaultVisualCard", () => {
  it("renders the generic vehicle and a focused four-to-six node flow", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="de" />);

    expect(container.querySelector('[data-fault-visual="true"]')).toBeTruthy();
    expect(container.querySelector('[data-generic-vehicle="true"]')).toBeTruthy();
    const nodes = container.querySelectorAll("[data-flow-node]");
    expect(nodes.length).toBeGreaterThanOrEqual(4);
    expect(nodes.length).toBeLessThanOrEqual(6);
    expect(container.querySelectorAll('[data-flow-focus="true"]')).toHaveLength(1);
    expect(screen.getByText(/schematische.*marken.*modellneutrale/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("localizes the visual heading and neutral schematic note", () => {
    const { rerender } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="tr" />);
    expect(screen.getByRole("heading", { name: "Turbo basınç sistemi" })).toBeInTheDocument();
    expect(screen.getByText(/şematik.*marka.*modelden bağımsız/i)).toBeInTheDocument();

    rerender(<FaultVisualCard scene={FAULT_SCENES.boost} language="en" />);
    expect(screen.getByRole("heading", { name: "Boost pressure system" })).toBeInTheDocument();
    expect(screen.getByText(/schematic.*brand.*model-neutral/i)).toBeInTheDocument();
  });

  it("lets one flow node take focus without making the diagram noisy", () => {
    const { container } = render(<FaultVisualCard scene={FAULT_SCENES.boost} language="en" />);

    fireEvent.click(screen.getByRole("button", { name: "Boost sensor" }));
    expect(container.querySelectorAll('[data-flow-focus="true"]')).toHaveLength(1);
    expect(screen.getByText("Reports actual boost pressure.")).toBeInTheDocument();
  });
});
