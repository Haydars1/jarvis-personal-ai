import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenericVehicleSilhouette } from "./GenericVehicleSilhouette";

describe("GenericVehicleSilhouette", () => {
  it("renders the photoreal diagnostic xray asset for boost/front-engine faults", () => {
    const { container } = render(<GenericVehicleSilhouette region="front-engine" tone="amber" />);
    const root = container.querySelector('[data-generic-vehicle="true"]');
    expect(root).toBeTruthy();
    expect(root).toHaveAttribute("data-photoreal-xray", "true");
    const image = root?.querySelector("img");
    expect(image).toBeTruthy();
    expect(image?.getAttribute("src")).toMatch(/^data:image\/webp;base64,/);
    expect(root?.querySelector('[data-scan-layer="true"]')).toBeTruthy();
    expect(root?.querySelector('[data-active-region="true"]')).toBeTruthy();
    expect(root).not.toHaveAttribute("data-brand");
    expect(root).not.toHaveAttribute("data-model");
  });

  it("keeps the generic schematic fallback for non-boost system scenes", () => {
    const { container } = render(<GenericVehicleSilhouette region="rear-underbody" tone="amber" />);
    const root = container.querySelector('[data-generic-vehicle="true"]');
    expect(root).toBeTruthy();
    expect(root).not.toHaveAttribute("data-photoreal-xray");
    expect(root?.querySelector('[data-xray-layer="true"]')).toBeTruthy();
    expect(root?.querySelector('[data-system="engine"]')).toBeTruthy();
    expect(root?.querySelector('[data-system="exhaust"]')).toBeTruthy();
    expect(root?.querySelector('[data-active-region="true"]')).toBeTruthy();
  });

  it("does not accept brand or model identity as public props", () => {
    // @ts-expect-error brand/model identity is intentionally unsupported by this component API
    render(<GenericVehicleSilhouette region="front-engine" tone="amber" brand="BMW" model="3er" />);
  });
});
