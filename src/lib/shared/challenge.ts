// Competitive-challenge scoring. Pure functions, unit-tested.
// DOTS (in ./dots) provides the bodyweight-fair relative coefficient.

import { dotsCoefficient, type DotsSex } from "./dots";

export type ChallengeType = "max_weight" | "max_reps" | "tonnage" | "for_time" | "amrap";
export type ScoringType = "absolute" | "relative_dots";

export const CHALLENGE_TYPES: ChallengeType[] = ["max_weight", "max_reps", "tonnage", "for_time", "amrap"];

/** for_time is the only type where a smaller raw value is a better result. */
export function lowerIsBetter(type: ChallengeType): boolean {
  return type === "for_time";
}

/** Whether a challenge type is weight-based (so DOTS / unit conversion apply). */
export function isWeightBased(type: ChallengeType): boolean {
  return type === "max_weight" || type === "tonnage";
}

/**
 * Challenge Points curve: the top-50 finishers in a weight class score by placing —
 * 1st → 50, 2nd → 49, … 50th → 1, 51st and below → 0.
 * `placement` is 1-indexed. Values outside 1..50 award nothing.
 */
export const CHALLENGE_POINTS_DEPTH = 50;
export function challengePointsForPlacement(placement: number): number {
  if (!Number.isInteger(placement) || placement < 1 || placement > CHALLENGE_POINTS_DEPTH) return 0;
  return CHALLENGE_POINTS_DEPTH + 1 - placement;
}

/** Ordinal label for a placement: 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th". */
export function ordinal(n: number): string {
  const abs = Math.abs(n);
  const suffix =
    abs % 100 >= 11 && abs % 100 <= 13 ? "th" : abs % 10 === 1 ? "st" : abs % 10 === 2 ? "nd" : abs % 10 === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}

/**
 * Absolute comparable score — normalised so HIGHER is always better.
 * for_time is negated so a faster time ranks above a slower one.
 */
export function absoluteComparable(rawValue: number, type: ChallengeType): number {
  return lowerIsBetter(type) ? -rawValue : rawValue;
}

/**
 * Relative (bodyweight-adjusted) comparable score, higher = better.
 * Uses the DOTS coefficient for weight-based challenges; for other types,
 * or when bodyweight/sex is unknown, it falls back to the absolute score.
 */
export function relativeComparable(
  rawValue: number,
  type: ChallengeType,
  bodyweightKg: number | null | undefined,
  sex: DotsSex | null | undefined
): number {
  if (isWeightBased(type) && bodyweightKg && sex) {
    return rawValue * dotsCoefficient(bodyweightKg, sex);
  }
  return absoluteComparable(rawValue, type);
}

/** The score stored on a submission, per the challenge's scoring mode. */
export function primaryScore(
  rawValue: number,
  challengeType: ChallengeType,
  scoringType: ScoringType,
  bodyweightKg: number | null | undefined,
  sex: DotsSex | null | undefined
): number {
  return scoringType === "relative_dots"
    ? relativeComparable(rawValue, challengeType, bodyweightKg, sex)
    : absoluteComparable(rawValue, challengeType);
}

export interface WeightCategoryLike {
  id: string;
  gender: string;
  minKg: number;
  maxKg: number;
}

/** Resolve which weight category a lifter falls into (by gender + bodyweight). */
export function resolveWeightCategory<T extends WeightCategoryLike>(
  categories: T[],
  gender: string,
  bodyweightKg: number | null | undefined
): T | null {
  if (bodyweightKg == null) return null;
  return (
    categories.find(
      (c) => c.gender === gender && bodyweightKg >= c.minKg && bodyweightKg <= c.maxKg
    ) ?? null
  );
}

/** Human-readable raw value (handles for_time as mm:ss). */
export function formatRawValue(rawValue: number, type: ChallengeType, unitLabel: string): string {
  if (type === "for_time") {
    const total = Math.round(rawValue);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const rounded = Math.round(rawValue * 100) / 100;
  return `${rounded} ${unitLabel}`;
}
