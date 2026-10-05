import { describe, expect, it } from "vitest";
import { XRAY_BOOST_BASE64_LENGTH, XRAY_BOOST_SRC } from "./xrayBoost";

describe("photoreal boost xray asset", () => {
  it("assembles the complete WebP payload without truncation", () => {
    expect(XRAY_BOOST_BASE64_LENGTH).toBe(38952);
    expect(XRAY_BOOST_SRC.startsWith("data:image/webp;base64,UklG")).toBe(true);
  });
});
