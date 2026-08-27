// DOTS relative-strength coefficient (gender-fair) for the competitive side.
// Included now so the shared scoring layer exists from the workout milestone on;
// challenges (Phase 3) will consume it. Unit-tested against reference points.

const MALE = [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093];
const FEMALE = [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];

export type DotsSex = "male" | "female";

/** DOTS coefficient for a given bodyweight (kg). Bodyweight is clamped to the fitted range. */
export function dotsCoefficient(bodyweightKg: number, sex: DotsSex): number {
  const c = sex === "female" ? FEMALE : MALE;
  const bw = Math.min(Math.max(bodyweightKg, 40), sex === "female" ? 150 : 210);
  const denom =
    c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4;
  return 500 / denom;
}

/** DOTS score = lifted total (kg) × coefficient. */
export function dotsScore(
  liftedKg: number,
  bodyweightKg: number,
  sex: DotsSex
): number {
  return liftedKg * dotsCoefficient(bodyweightKg, sex);
}
