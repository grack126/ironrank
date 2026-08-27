// Unit conversion — canonical storage is always kg; convert at the edges.

export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

export type Unit = "kg" | "lb";

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/** Convert a canonical kg value into the user's preferred unit. */
export function fromKg(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kgToLb(kg);
}

/** Convert a value entered in the user's unit back to canonical kg. */
export function toKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : lbToKg(value);
}

/** Display helper: convert from kg and round for presentation. */
export function displayWeight(kg: number, unit: Unit, decimals = 1): string {
  const v = fromKg(kg, unit);
  return `${round(v, decimals)} ${unit}`;
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
