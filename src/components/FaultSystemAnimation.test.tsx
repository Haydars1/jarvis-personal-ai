import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FaultSystemAnimation } from "./FaultSystemAnimation";

const bmw = {
  brand: "BMW",
  model: "3er",
  body: "G20/G21",
  year: 2021,
  engine: "320d B47",
};

const passatCrlb = {
  brand: "Volkswagen",
  model: "Passat",
  body: "B8",
  year: 2017,
  engine: "2.0 TDI CRLB",
};

describe("FaultSystemAnimation", () => {
  it("maps turbo, DPF pressure and ABS faults to their system scenes", () => {
    const { rerender } = render(<FaultSystemAnimation code="P0299" language="de" vehicle={bmw} />);
    expect(document.querySelector('[data-scene="boost"]')).toBeTruthy();
    expect(document.querySelector('[data-focus="boost-path"]')).toBeTruthy();

    rerender(<FaultSystemAnimation code="P2453" language="de" vehicle={bmw} />);
    expect(document.querySelector('[data-scene="dpf"]')).toBeTruthy();
    expect(document.querySelector('[data-focus="pressure-sensor"]')).toBeTruthy();

    rerender(<FaultSystemAnimation code="ABS" language="de" vehicle={bmw} />);
    expect(document.querySelector('[data-scene="brakes"]')).toBeTruthy();
    expect(document.querySelector('[data-focus="abs-module"]')).toBeTruthy();
  });

  it("maps P0171 lean-mixture faults to the intake path instead of a generic data bus", () => {
    render(<FaultSystemAnimation code="P0171" language="tr" vehicle={bmw} />);

    expect(document.querySelector('[data-scene="boost"]')).toBeTruthy();
    expect(document.querySelector('[data-focus="intake-path"]')).toBeTruthy();
    expect(document.querySelector('[data-scene="generic"]')).toBeFalsy();
  });

  it("applies an exact supported vehicle profile and exposes its confidence", () => {
    render(<FaultSystemAnimation code="P0299" language="de" vehicle={bmw} />);

    const root = document.querySelector('[data-vehicle-profile="bmw-g20-g21-320d-b47"]');
    expect(root).toBeTruthy();
    expect(root).toHaveAttribute("data-vehicle-confidence", "exact");
    expect(screen.getByText(/BMW 3er G20\/G21 · 320d B47/i)).toBeInTheDocument();
  });

  it("renders the selected vehicle body schematic behind the system nodes", () => {
    render(<FaultSystemAnimation code="P0299" language="de" vehicle={bmw} />);

    expect(document.querySelector('[data-vehicle-body="sedan-rwd-longnose"]')).toBeTruthy();
    expect(document.querySelector(".vehicleBodyShell")).toBeTruthy();
    expect(document.querySelector(".vehicleBodyLamp")).toBeTruthy();
    expect(document.querySelector(".vehicleBodyRim")).toBeTruthy();
  });

  it("shows a generic vehicle note when no verified profile exists", () => {
    render(
      <FaultSystemAnimation
        code="P0299"
        language="en"
        vehicle={{ brand: "Other", model: "Mystery", body: "X", year: 2022, engine: "Unknown" }}
      />,
    );

    expect(document.querySelector('[data-vehicle-confidence="generic"]')).toBeTruthy();
    expect(screen.getByText(/generic system representation/i)).toBeInTheDocument();
  });

  it("never pretends Passat B8 CRLB has a verified SCR/AdBlue layout", () => {
    render(<FaultSystemAnimation code="ADBLUE" language="tr" vehicle={passatCrlb} />);

    expect(document.querySelector('[data-scene="scr"]')).toBeTruthy();
    expect(document.querySelector('[data-vehicle-profile="vw-passat-b8-crlb"]')).toBeTruthy();
    expect(screen.getAllByText(/doğrulanmış.*SCR|genel SCR/i).length).toBeGreaterThan(0);
  });

  it("lets the user inspect individual components without claiming certainty", () => {
    render(<FaultSystemAnimation code="P0299" language="en" vehicle={bmw} />);

    fireEvent.click(screen.getByRole("button", { name: /Turbocharger/i }));
    expect(screen.getByText(/Selected component/i)).toBeInTheDocument();
    expect(screen.getByText(/does not prove/i)).toBeInTheDocument();
  });
});