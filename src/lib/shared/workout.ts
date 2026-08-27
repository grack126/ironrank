// Workout calculators — the core mechanic. Pure functions, unit-tested.
// Snapshot the outputs onto results so history stays immutable.

export type Difficulty = "easy" | "hard" | "brutal";
export const DIFFICULTIES: Difficulty[] = ["easy", "hard", "brutal"];

/** Round a weight to the nearest loadable increment (e.g. 2.5 kg). */
export function roundToIncrement(weightKg: number, incrementKg: number): number {
  if (incrementKg <= 0) return weightKg;
  return Math.round(weightKg / incrementKg) * incrementKg;
}

/**
 * Working weight for a set:  reference × percentage, rounded to the increment.
 * percentage is expressed as a number like 70 (== 70%).
 */
export function calcWorkingWeightKg(
  referenceWeightKg: number,
  percentage: number,
  incrementKg: number
): number {
  const raw = referenceWeightKg * (percentage / 100);
  return roundToIncrement(raw, incrementKg);
}

export interface RankTier {
  id: string;
  name: string;
  icon?: string;
  minPoints: number;
}

/**
 * Resolve a total point score to the highest rank tier whose threshold it meets.
 * Returns null if the score is below every tier.
 */
export function resolveRankTier<T extends RankTier>(
  totalPoints: number,
  tiers: T[]
): T | null {
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);
  let achieved: T | null = null;
  for (const tier of sorted) {
    if (totalPoints >= tier.minPoints) achieved = tier;
    else break;
  }
  return achieved;
}

export interface SetDifficultyOption {
  difficulty: Difficulty;
  percentage: number;
  points: number;
}

/** Maximum possible points = sum of the highest-points difficulty on each set. */
export function maxPossiblePoints(sets: SetDifficultyOption[][]): number {
  return sets.reduce((total, set) => {
    const best = set.reduce((m, d) => Math.max(m, d.points), 0);
    return total + best;
  }, 0);
}

/** Best (max) points available on a single set across its difficulties. */
export function setMaxPoints(points: { difficulty: Difficulty; points: number }[]): number {
  return points.reduce((m, p) => Math.max(m, p.points), 0);
}

/** Max possible points for a workout = sum of each set's best difficulty (set-level points). */
export function maxWorkoutPoints(
  setsPoints: { difficulty: Difficulty; points: number }[][]
): number {
  return setsPoints.reduce((sum, sp) => sum + setMaxPoints(sp), 0);
}

export interface RankTierValidationIssue {
  type: "gap" | "overlap" | "above_max" | "no_floor";
  message: string;
}

/**
 * Validate rank tiers against the maximum achievable score.
 * Flags overlaps, a missing entry tier (no tier reachable at 0), and
 * thresholds that exceed what is achievable.
 */
export function validateRankTiers(
  tiers: RankTier[],
  maxPoints: number
): RankTierValidationIssue[] {
  const issues: RankTierValidationIssue[] = [];
  const sorted = [...tiers].sort((a, b) => a.minPoints - b.minPoints);

  const minThreshold = sorted.length ? sorted[0].minPoints : Infinity;
  if (minThreshold > 0) {
    issues.push({
      type: "no_floor",
      message: "No rank is reachable at 0 points — add an entry tier with minPoints 0.",
    });
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPoints === sorted[i - 1].minPoints) {
      issues.push({
        type: "overlap",
        message: `"${sorted[i].name}" and "${sorted[i - 1].name}" share the same threshold (${sorted[i].minPoints}).`,
      });
    }
  }

  for (const tier of sorted) {
    if (tier.minPoints > maxPoints) {
      issues.push({
        type: "above_max",
        message: `"${tier.name}" needs ${tier.minPoints} points but only ${maxPoints} are achievable.`,
      });
    }
  }

  return issues;
}
