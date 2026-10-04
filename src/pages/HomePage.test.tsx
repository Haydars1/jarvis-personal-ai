import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("de-DE");
  });

  it("uses the phone/browser language automatically on first load", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("tr-TR");
    renderPage();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Hizmetler" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Arıza Kodları" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "TR" })).toHaveAttribute("aria-pressed", "true");
  });

  it("switches the public navigation and fault-library copy between DE TR EN", () => {
    renderPage();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Leistungen" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Fehlercodes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "TR" }));
    expect(within(nav).getByRole("link", { name: "Hizmetler" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Arıza Kodları" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(within(nav).getByRole("link", { name: "Services" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Fault Codes" })).toBeInTheDocument();
  });

  it("renders the v2 diagnostic console and removes the old drift-showcase UI", () => {
    renderPage();

    expect(document.querySelector('[data-ui-version="6006-v2"]')).toBeTruthy();
    expect(document.querySelector('[data-diagnostic-console="true"]')).toBeTruthy();
    expect(document.querySelector('[data-drift-track="true"]')).toBeFalsy();
  });

  it("finds P0299 from the standalone fault library", () => {
    renderPage();
    const search = screen.getByRole("searchbox", { name: /fehlercode suchen/i });
    fireEvent.change(search, { target: { value: "P0299" } });

    expect(screen.getByText("P0299")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /P0299/i })).toHaveAttribute("href", "/fehlercodes/P0299");
  });

  it("cascades make model body year and engine", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("MARKE"), { target: { value: "BMW" } });
    fireEvent.change(screen.getByLabelText("MODELL"), { target: { value: "3er" } });
    fireEvent.change(screen.getByLabelText("BAUREIHE / GENERATION"), { target: { value: "G20/G21" } });
    fireEvent.change(screen.getByLabelText("BAUJAHR"), { target: { value: "2021" } });

    expect(screen.getByLabelText("MOTORISIERUNG")).toHaveDisplayValue("Motor wählen");
    expect(screen.getByRole("option", { name: "320d B47" })).toBeInTheDocument();
  });

  it("recovers from corrupt stored language and vehicle state", () => {
    localStorage.setItem("6006_language", "xx-INVALID");
    localStorage.setItem("6006_vehicle", "{broken-json");

    expect(() => renderPage()).not.toThrow();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Leistungen" })).toBeInTheDocument();
  });
});
