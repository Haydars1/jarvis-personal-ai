import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./xrayBoost.css", import.meta.url), "utf8");

describe("P0299 photoreal Safari compositor guard", () => {
  it("forces the photoreal scene off nested GPU filter/transform layers", () => {
    expect(css).toContain(".genericVehicle.genericVehiclePhotoreal");
    expect(css).toMatch(/filter:\s*none\s*!important/);
    expect(css).toMatch(/transform:\s*none\s*!important/);
    expect(css).toMatch(/isolation:\s*auto\s*!important/);
    expect(css).toMatch(/aspect-ratio:\s*16\s*\/\s*9\s*!important/);
  });

  it("keeps the source image uncropped without animated transforms", () => {
    expect(css).toMatch(/object-fit:\s*contain\s*!important/);
    expect(css).toMatch(/object-position:\s*center\s*!important/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
  });
});
