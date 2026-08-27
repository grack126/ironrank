import { describe, it, expect } from "vitest";
import {
  levelForXp,
  avatarUnlocked,
  isPersonalRecord,
  nextStreak,
  milestonesCrossed,
  type StreakState,
} from "./progression";

const d = (s: string) => new Date(s + "T12:00:00");

describe("levels & avatars", () => {
  it("levels every 100 xp", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(250)).toBe(3);
  });
  it("avatar unlocks at level", () => {
    expect(avatarUnlocked(5, 4)).toBe(false);
    expect(avatarUnlocked(5, 5)).toBe(true);
  });
});

describe("isPersonalRecord", () => {
  it("first attempt is always a PR", () => {
    expect(isPersonalRecord(100, null, "max_weight")).toBe(true);
  });
  it("higher is better for weight/reps", () => {
    expect(isPersonalRecord(110, 100, "max_weight")).toBe(true);
    expect(isPersonalRecord(90, 100, "max_weight")).toBe(false);
  });
  it("lower is better for time", () => {
    expect(isPersonalRecord(85, 90, "for_time")).toBe(true);
    expect(isPersonalRecord(95, 90, "for_time")).toBe(false);
  });
});

describe("nextStreak", () => {
  const base: StreakState = { currentStreak: 3, longestStreak: 5, freezeTokens: 2, lastActiveDate: d("2026-06-10") };

  it("starts at 1 with no history", () => {
    const r = nextStreak({ currentStreak: 0, longestStreak: 0, freezeTokens: 3, lastActiveDate: null }, d("2026-06-10"));
    expect(r.currentStreak).toBe(1);
    expect(r.event).toBe("first");
  });
  it("no change on same day", () => {
    const r = nextStreak(base, d("2026-06-10"));
    expect(r.event).toBe("same-day");
    expect(r.currentStreak).toBe(3);
  });
  it("extends on the next day", () => {
    const r = nextStreak(base, d("2026-06-11"));
    expect(r.event).toBe("extended");
    expect(r.currentStreak).toBe(4);
  });
  it("spends freeze tokens to bridge a gap", () => {
    const r = nextStreak(base, d("2026-06-12")); // one missed day
    expect(r.event).toBe("frozen");
    expect(r.currentStreak).toBe(4);
    expect(r.freezeTokens).toBe(1);
    expect(r.freezesUsed).toBe(1);
  });
  it("resets when the gap exceeds tokens", () => {
    const r = nextStreak(base, d("2026-06-20"));
    expect(r.event).toBe("reset");
    expect(r.currentStreak).toBe(1);
  });
  it("tracks the longest streak", () => {
    const s: StreakState = { currentStreak: 5, longestStreak: 5, freezeTokens: 2, lastActiveDate: d("2026-06-10") };
    expect(nextStreak(s, d("2026-06-11")).longestStreak).toBe(6);
  });
});

describe("milestonesCrossed", () => {
  it("returns milestones newly reached", () => {
    expect(milestonesCrossed([5, 10, 20], 3, 11)).toEqual([5, 10]);
    expect(milestonesCrossed([5, 10, 20], 10, 10)).toEqual([]);
  });
});
