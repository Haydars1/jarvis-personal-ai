import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { MobileBoostDiagnosticPanel } from "./MobileBoostDiagnosticPanel";

describe("MobileBoostDiagnosticPanel simplified mobile visual", () => {
  it("replaces the x-ray photo with a minimal four-node boost schematic", () => {
    const { container } = render(<MobileBoostDiagnosticPanel scene={FAULT_SCENES.boost} language="tr" />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.querySelector('[data-mobile-boost-schematic="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-mobile-boost-node]')).toHaveLength(4);
    expect(container.querySelector('[data-mobile-boost-node="turbo"]')).toHaveAttribute("data-active", "true");
    expect(screen.getByText("P0299 · Turbo basıncı düşük")).toBeInTheDocument();
    expect(screen.getByText("Emiş havası")).toBeInTheDocument();
    expect(screen.getByText("Turbo")).toBeInTheDocument();
    expect(screen.getByText("Aktüatör / kontrol")).toBeInTheDocument();
    expect(screen.getByText("Basınç sensörü")).toBeInTheDocument();
    expect(screen.getByText("İstenen turbo basıncına ulaşılamıyor.")).toBeInTheDocument();
  });
});
