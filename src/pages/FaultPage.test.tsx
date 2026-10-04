import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
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
  beforeEach(() => localStorage.clear());

  it("renders the localized fault details and system animation for P0299", () => {
    localStorage.setItem("6006_language", "tr");
    localStorage.setItem(
      "6006_vehicle",
      JSON.stringify({ brand: "BMW", model: "3er", body: "G20/G21", year: 2021, engine: "320d B47" }),
    );

    renderFault();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/P0299/i);
    expect(screen.getByText(/Turbo.*basınç|şarj basıncı|boost/i)).toBeInTheDocument();
    expect(document.querySelector('[data-scene="boost"]')).toBeTruthy();
    expect(document.querySelector('[data-vehicle-profile="bmw-g20-g21-320d-b47"]')).toBeTruthy();
  });

  it("renders safety-oriented diagnostic sections without claiming one failed part", () => {
    renderFault("/fehlercodes/OIL");

    expect(screen.getByText(/Bedeutung/i)).toBeInTheDocument();
    expect(screen.getByText(/Mögliche Ursachen/i)).toBeInTheDocument();
    expect(screen.getByText(/Diagnose/i)).toBeInTheDocument();
    expect(screen.getByText(/Lösung|Lösungen/i)).toBeInTheDocument();
    expect(screen.getByText(/beweist nicht|nicht.*sicher defekt/i)).toBeInTheDocument();
  });

  it("handles an unknown code without inventing a technical diagnosis", () => {
    renderFault("/fehlercodes/ZZ999");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ZZ999");
    expect(screen.getByText(/nicht in der 6006 Fehlerbibliothek|not in the 6006 fault library|6006 arıza kütüphanesinde/i)).toBeInTheDocument();
  });
});
