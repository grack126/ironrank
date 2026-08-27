import { describe, it, expect } from "vitest";
import {
  roundToIncrement,
  calcWorkingWeightKg,
  resolveRankTier,
  maxPossiblePoints,
  maxWorkoutPoints,
  setMaxPoints,
  validateRankTiers,
} from "./workout";

describe("roundToIncrement", () => {
  it("rounds to the nearest 2.5 kg", () => {
    expect(roundToIncrement(73.4, 2.5)).toBe(72.5);
    expect(roundToIncrement(74, 2.5)).toBe(75);
  });
  it("rounds to 5 lb-style increments", () => {
    expect(roundToIncrement(102, 5)).toBe(100);
    expect(roundToIncrement(103, 5)).toBe(105);
  });
  it("returns value unchanged for non-positive increment", () => {
    expect(roundToIncrement(73.4, 0)).toBe(73.4);
  });
});

describe("calcWorkingWeightKg", () => {
  it("computes reference × % then rounds", () => {
    // 100kg @ 70% = 70 -> 70
    expect(calcWorkingWeightKg(100, 70, 2.5)).toBe(70);
    // 105kg @ 70% = 73.5 -> 72.5
    expect(calcWorkingWeightKg(105, 70, 2.5)).toBe(72.5);
    // 80kg @ 92.5% = 74 -> 75
    expect(calcWorkingWeightKg(80, 92.5, 2.5)).toBe(75);
  });
});

describe("resolveRankTier", () => {
  const tiers = [
    { id: "b", name: "Bronze", minPoints: 0 },
    { id: "s", name: "Silver", minPoints: 50 },
    { id: "g", name: "Gold", minPoints: 100 },
  ];
  it("picks the highest tier met", () => {
    expect(resolveRankTier(0, tiers)?.name).toBe("Bronze");
    expect(resolveRankTier(49, tiers)?.name).toBe("Bronze");
    expect(resolveRankTier(50, tiers)?.name).toBe("Silver");
    expect(resolveRankTier(150, tiers)?.name).toBe("Gold");
  });
  it("returns null below the lowest threshold", () => {
    expect(resolveRankTier(-1, [{ id: "x", name: "X", minPoints: 10 }])).toBeNull();
  });
});

describe("maxPossiblePoints", () => {
  it("sums the best difficulty per set", () => {
    const sets = [
      [
        { difficulty: "easy" as const, percentage: 60, points: 1 },
        { difficulty: "hard" as const, percentage: 75, points: 3 },
        { difficulty: "brutal" as const, percentage: 90, points: 5 },
      ],
      [
        { difficulty: "easy" as const, percentage: 60, points: 1 },
        { difficulty: "brutal" as const, percentage: 90, points: 4 },
      ],
    ];
    expect(maxPossiblePoints(sets)).toBe(9);
  });
});

describe("set-level points (multi-part model)", () => {
  it("setMaxPoints returns the best difficulty's points", () => {
    expect(
      setMaxPoints([
        { difficulty: "easy", points: 2 },
        { difficulty: "hard", points: 4 },
        { difficulty: "brutal", points: 6 },
      ])
    ).toBe(6);
  });
  it("maxWorkoutPoints sums each set's best", () => {
    expect(
      maxWorkoutPoints([
        [
          { difficulty: "easy", points: 2 },
          { difficulty: "brutal", points: 6 },
        ],
        [
          { difficulty: "easy", points: 1 },
          { difficulty: "hard", points: 3 },
        ],
      ])
    ).toBe(9);
  });
});

describe("validateRankTiers", () => {
  it("accepts a clean ladder", () => {
    const issues = validateRankTiers(
      [
        { id: "1", name: "Bronze", minPoints: 0 },
        { id: "2", name: "Silver", minPoints: 20 },
        { id: "3", name: "Gold", minPoints: 40 },
      ],
      50
    );
    expect(issues).toHaveLength(0);
  });
  it("flags a missing entry tier", () => {
    const issues = validateRankTiers([{ id: "1", name: "Gold", minPoints: 10 }], 50);
    expect(issues.some((i) => i.type === "no_floor")).toBe(true);
  });
  it("flags overlaps and unreachable thresholds", () => {
    const issues = validateRankTiers(
      [
        { id: "1", name: "Bronze", minPoints: 0 },
        { id: "2", name: "Silver", minPoints: 0 },
        { id: "3", name: "Gold", minPoints: 999 },
      ],
      50
    );
    expect(issues.some((i) => i.type === "overlap")).toBe(true);
    expect(issues.some((i) => i.type === "above_max")).toBe(true);
  });
});
