import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FAULT_SCENES } from "../domain/fault-scenes";
import { MobileBoostDiagnosticPanel } from "./MobileBoostDiagnosticPanel";

describe("MobileBoostDiagnosticPanel real turbo visual", () => {
  it("shows a real turbo image with rotor and airflow animation while keeping the four-node flow simple", () => {
    const { container } = render(<MobileBoostDiagnosticPanel scene={FAULT_SCENES.boost} language="tr" />);

    const image = container.querySelector('[data-real-turbo="true"]') as HTMLImageElement;
    expect(image).toBeInTheDocument();
    expect(image.src).toContain("upload.wikimedia.org");
    expect(image.src).toContain("M271_turbo.JPG");
    expect(container.querySelector('[data-mobile-turbo-rotor="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-airflow="intake"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-airflow="boost"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-mobile-boost-node]')).toHaveLength(4);
    expect(container.querySelector('[data-mobile-boost-node="turbo"]')).toHaveAttribute("data-active", "true");
    expect(screen.getByText("P0299 · Turbo basıncı düşük")).toBeInTheDocument();
    expect(screen.getByText("İstenen turbo basıncına ulaşılamıyor.")).toBeInTheDocument();
    expect(container.querySelector(".mobileBoostShell")).not.toBeInTheDocument();
  });
});
