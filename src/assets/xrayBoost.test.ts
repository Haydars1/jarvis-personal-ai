import { describe, expect, it } from "vitest";
import { XRAY_BOOST_SRC } from "./xrayBoost";

describe("photoreal boost xray asset", () => {
  it("uses the verified static WebP file instead of the broken JPEG", () => {
    expect(XRAY_BOOST_SRC).toBe("/assets/6006/p0299-xray.webp");
    expect(XRAY_BOOST_SRC.startsWith("data:")).toBe(false);
  });
});
