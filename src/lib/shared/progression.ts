// Progression maths — pure and unit-tested. DB orchestration lives in
// src/lib/server-progression.ts.

export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

export function xpIntoLevel(xp: number): { into: number; span: number } {
  return { into: Math.max(0, xp) % 100, span: 100 };
}

export function avatarUnlocked(unlockLevel: number, level: number): boolean {
  return level >= unlockLevel;
}

/** A higher value is a PR for most formats; for_time, a lower value wins. */
export function isPersonalRecord(
  value: number,
  prevBest: number | null | undefined,
  challengeType: string
): boolean {
  if (prevBest == null) return true;
  return challengeType === "for_time" ? value < prevBest : value > prevBest;
}

function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function dayDiff(a: Date, b: Date): number {
  return Math.round((midnight(a) - midnight(b)) / 86_400_000);
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  freezeTokens: number;
  lastActiveDate: Date | null;
}
export type StreakEvent = "first" | "same-day" | "extended" | "frozen" | "reset";
export interface StreakResult extends StreakState {
  lastActiveDate: Date;
  event: StreakEvent;
  freezesUsed: number;
}

/**
 * Advance a streak for activity on `today`. A one-day gap continues the streak;
 * larger gaps are bridged by spending freeze tokens (one per missed day) so a
 * deliberate rest day doesn't break the streak. Beyond available tokens, reset.
 */
export function nextStreak(s: StreakState, today: Date): StreakResult {
  if (!s.lastActiveDate) {
    return { currentStreak: 1, longestStreak: Math.max(s.longestStreak, 1), freezeTokens: s.freezeTokens, lastActiveDate: today, event: "first", freezesUsed: 0 };
  }
  const diff = dayDiff(today, s.lastActiveDate);
  if (diff <= 0) {
    return { ...s, lastActiveDate: s.lastActiveDate, event: "same-day", freezesUsed: 0 };
  }
  if (diff === 1) {
    const current = s.currentStreak + 1;
    return { currentStreak: current, longestStreak: Math.max(s.longestStreak, current), freezeTokens: s.freezeTokens, lastActiveDate: today, event: "extended", freezesUsed: 0 };
  }
  const gap = diff - 1;
  if (gap <= s.freezeTokens) {
    const current = s.currentStreak + 1;
    return { currentStreak: current, longestStreak: Math.max(s.longestStreak, current), freezeTokens: s.freezeTokens - gap, lastActiveDate: today, event: "frozen", freezesUsed: gap };
  }
  return { currentStreak: 1, longestStreak: Math.max(s.longestStreak, 1), freezeTokens: s.freezeTokens, lastActiveDate: today, event: "reset", freezesUsed: 0 };
}

/** Level milestones that grant a badge when crossed. */
export const LEVEL_MILESTONES = [5, 10, 20, 35, 50];
export const STREAK_MILESTONES = [7, 30, 100];

export function milestonesCrossed(milestones: number[], from: number, to: number): number[] {
  return milestones.filter((m) => from < m && to >= m);
}
