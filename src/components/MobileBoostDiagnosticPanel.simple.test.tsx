import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { MobileBoostDiagnosticPanel } from "./MobileBoostDiagnosticPanel";

describe("MobileBoostDiagnosticPanel simplified mobile visual", () => {
  it("shows one x-ray visual, one fault label, a single inline flow, and one short explanation", () => {
    const { container } = render(<MobileBoostDiagnosticPanel scene={FAULT_SCENES.boost} language="tr" />);
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.getByText("P0299 · Turbo basıncı düşük")).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-boost-flow="true"]')).toHaveTextContent("Emiş havası → Turbo → Aktüatör / kontrol → Basınç sensörü");
    expect(screen.getByText("İstenen turbo basıncına ulaşılamıyor.")).toBeInTheDocument();
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(screen.queryByText(/Vurgulanan bölge/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^01$/)).not.toBeInTheDocument();
  });
});
