import { describe, expect, it } from "vitest";
import { XRAY_BOOST_SRC } from "./xrayBoost";

describe("photoreal boost xray asset", () => {
  it("uses the real static WebP file instead of an embedded data URI", () => {
    expect(XRAY_BOOST_SRC).toBe("/assets/6006/p0299-xray.webp");
    expect(XRAY_BOOST_SRC.startsWith("data:")).toBe(false);
  });
});
