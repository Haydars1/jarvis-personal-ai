import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GenericVehicleSilhouette } from "./GenericVehicleSilhouette";

describe("GenericVehicleSilhouette", () => {
  it("renders a decorative brand-neutral vehicle shell", () => {
    const { container } = render(<GenericVehicleSilhouette region="front-engine" tone="amber" />);
    const root = container.querySelector('[data-generic-vehicle="true"]');
    expect(root).toBeTruthy();
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.querySelectorAll('[data-active-region="true"]')).toHaveLength(1);
    expect(root?.textContent).toBe("");
    expect(root).not.toHaveAttribute("data-brand");
    expect(root).not.toHaveAttribute("data-model");
  });

  it("moves the single highlight to the requested generic region", () => {
    const { container, rerender } = render(<GenericVehicleSilhouette region="front-engine" tone="amber" />);
    expect(container.querySelector('[data-region="front-engine"][data-active-region="true"]')).toBeTruthy();

    rerender(<GenericVehicleSilhouette region="wheels" tone="red" />);
    expect(container.querySelectorAll('[data-active-region="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-region="wheels"][data-active-region="true"]')).toBeTruthy();
  });

  it("does not accept brand or model identity as public props", () => {
    // @ts-expect-error brand/model identity is intentionally unsupported by this component API
    render(<GenericVehicleSilhouette region="front-engine" tone="amber" brand="BMW" model="3er" />);
  });
});
