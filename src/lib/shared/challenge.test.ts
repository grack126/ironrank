import { describe, it, expect } from "vitest";
import {
  lowerIsBetter,
  absoluteComparable,
  relativeComparable,
  primaryScore,
  resolveWeightCategory,
  formatRawValue,
  challengePointsForPlacement,
  ordinal,
} from "./challenge";

describe("ordinal", () => {
  it("uses st/nd/rd for 1/2/3 and th otherwise", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(21)).toBe("21st");
    expect(ordinal(23)).toBe("23rd");
  });
  it("uses th for the 11-13 exceptions", () => {
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(113)).toBe("113th");
  });
});

describe("challenge points curve", () => {
  it("awards 50 down to 1 for the top 50 placings", () => {
    expect(challengePointsForPlacement(1)).toBe(50);
    expect(challengePointsForPlacement(2)).toBe(49);
    expect(challengePointsForPlacement(50)).toBe(1);
  });
  it("awards nothing to 51st and below, or invalid placements", () => {
    expect(challengePointsForPlacement(51)).toBe(0);
    expect(challengePointsForPlacement(0)).toBe(0);
    expect(challengePointsForPlacement(-3)).toBe(0);
    expect(challengePointsForPlacement(1.5)).toBe(0);
  });
});

describe("challenge scoring direction", () => {
  it("only for_time is lower-is-better", () => {
    expect(lowerIsBetter("for_time")).toBe(true);
    expect(lowerIsBetter("max_weight")).toBe(false);
  });
  it("absoluteComparable negates time so faster ranks higher", () => {
    expect(absoluteComparable(120, "for_time")).toBeLessThan(absoluteComparable(90, "for_time"));
    expect(absoluteComparable(100, "max_weight")).toBeGreaterThan(absoluteComparable(90, "max_weight"));
  });
});

describe("relativeComparable (DOTS)", () => {
  it("applies the DOTS coefficient for weight-based challenges", () => {
    // Lighter lifter with the same absolute lift should score higher relatively.
    const heavy = relativeComparable(150, "max_weight", 110, "male");
    const light = relativeComparable(150, "max_weight", 70, "male");
    expect(light).toBeGreaterThan(heavy);
  });
  it("falls back to absolute for rep-based challenges", () => {
    expect(relativeComparable(20, "max_reps", 80, "male")).toBe(20);
  });
  it("falls back when bodyweight is unknown", () => {
    expect(relativeComparable(150, "max_weight", null, "male")).toBe(150);
  });
});

describe("primaryScore", () => {
  it("stores DOTS-adjusted score under relative_dots", () => {
    const s = primaryScore(150, "max_weight", "relative_dots", 70, "male");
    expect(s).not.toBe(150);
    expect(s).toBeGreaterThan(0);
  });
  it("stores raw under absolute", () => {
    expect(primaryScore(150, "max_weight", "absolute", 70, "male")).toBe(150);
  });
});

describe("resolveWeightCategory", () => {
  const cats = [
    { id: "m83", gender: "male", minKg: 0, maxKg: 83 },
    { id: "m93", gender: "male", minKg: 83.01, maxKg: 93 },
    { id: "f63", gender: "female", minKg: 0, maxKg: 63 },
  ];
  it("matches by gender and bodyweight", () => {
    expect(resolveWeightCategory(cats, "male", 85)?.id).toBe("m93");
    expect(resolveWeightCategory(cats, "male", 80)?.id).toBe("m83");
    expect(resolveWeightCategory(cats, "female", 60)?.id).toBe("f63");
  });
  it("returns null with no bodyweight or no match", () => {
    expect(resolveWeightCategory(cats, "male", null)).toBeNull();
    expect(resolveWeightCategory(cats, "female", 200)).toBeNull();
  });
});

describe("formatRawValue", () => {
  it("formats time as mm:ss", () => {
    expect(formatRawValue(95, "for_time", "seconds")).toBe("1:35");
  });
  it("formats other values with the unit label", () => {
    expect(formatRawValue(142.5, "max_weight", "kg")).toBe("142.5 kg");
    expect(formatRawValue(21, "max_reps", "reps")).toBe("21 reps");
  });
});
