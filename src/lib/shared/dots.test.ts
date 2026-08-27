import { describe, it, expect } from "vitest";
import { dotsCoefficient, dotsScore } from "./dots";

describe("DOTS", () => {
  it("gives a coefficient near the known range for an 80kg male", () => {
    // Reference: ~0.66 for an 80kg male.
    expect(dotsCoefficient(80, "male")).toBeCloseTo(0.66, 1);
  });
  it("female coefficient is higher at equal bodyweight", () => {
    expect(dotsCoefficient(60, "female")).toBeGreaterThan(
      dotsCoefficient(60, "male")
    );
  });
  it("scales score linearly with weight lifted", () => {
    const a = dotsScore(200, 80, "male");
    const b = dotsScore(400, 80, "male");
    expect(b).toBeCloseTo(a * 2, 6);
  });
});
