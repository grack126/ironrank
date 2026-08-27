import { describe, it, expect } from "vitest";
import { kgToLb, lbToKg, fromKg, toKg } from "./units";

describe("unit conversion", () => {
  it("converts kg <-> lb", () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 2);
  });
  it("round-trips through the user's unit", () => {
    expect(toKg(fromKg(82.5, "lb"), "lb")).toBeCloseTo(82.5, 6);
    expect(fromKg(60, "kg")).toBe(60);
  });
});
