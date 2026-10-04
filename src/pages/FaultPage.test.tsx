import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FaultPage } from "./FaultPage";

function renderFault(path = "/fehlercodes/P0299") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/fehlercodes/:code" element={<FaultPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("FaultPage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("de-DE");
  });

  it("uses the phone/browser language and exposes no public vehicle selector", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("tr-TR");
    renderFault();

    expect(screen.getByRole("heading", { level: 2, name: /Turbo basıncı kontrolü/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "DE" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "EN" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("renders the v2 fault workspace", () => {
    renderFault();
    expect(document.querySelector('[data-fault-layout="6006-v2"]')).toBeTruthy();
    expect(document.querySelector('[data-fault-workspace="true"]')).toBeTruthy();
  });

  it("renders localized P0299 details without a model-specific car drawing", () => {
    localStorage.setItem("6006_language", "tr");
    localStorage.setItem("6006_language_manual", "1");
    localStorage.setItem(
      "6006_vehicle",
      JSON.stringify({ brand: "BMW", model: "3er", body: "G20/G21", year: 2021, engine: "320d B47" }),
    );

    renderFault();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/P0299/i);
    expect(screen.getByRole("heading", { level: 2, name: /Turbo basıncı kontrolü/i })).toBeInTheDocument();
    expect(document.querySelector("[data-vehicle-profile]")).toBeFalsy();
    expect(document.querySelector('[data-fault-workspace="true"]')).toBeTruthy();
  });

  it("renders safety-oriented diagnostic sections without claiming one failed part", () => {
    renderFault("/fehlercodes/OIL");

    expect(screen.getAllByText(/Bedeutung/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Mögliche Ursachen/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Diagnose$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lösung|Lösungen/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/beweist nicht|nicht.*sicher defekt/i).length).toBeGreaterThan(0);
  });

  it("handles an unknown code without inventing a technical diagnosis", () => {
    renderFault("/fehlercodes/ZZ999");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ZZ999");
    expect(screen.getByText(/nicht in der 6006 Fehlerbibliothek|not in the 6006 fault library|6006 arıza kütüphanesinde/i)).toBeInTheDocument();
  });
});
