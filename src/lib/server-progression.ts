import "server-only";
import { prisma } from "@/lib/db";
import {
  levelForXp,
  nextStreak,
  isPersonalRecord,
  milestonesCrossed,
  LEVEL_MILESTONES,
  STREAK_MILESTONES,
  type StreakState,
} from "@/lib/shared/progression";
import { buildBoard, type BoardSubmission } from "@/lib/leaderboard";
import { challengePointsForPlacement, CHALLENGE_POINTS_DEPTH, type ChallengeType } from "@/lib/shared/challenge";

// Badge codes are a static catalogue — cache code→id so looped grants
// (milestones, finalization podiums) don't re-query the same badge.
const badgeIdByCode = new Map<string, string | null>();
async function badgeIdFor(code: string): Promise<string | null> {
  if (badgeIdByCode.has(code)) return badgeIdByCode.get(code)!;
  const badge = await prisma.badge.findUnique({ where: { code }, select: { id: true } });
  badgeIdByCode.set(code, badge?.id ?? null);
  return badge?.id ?? null;
}

/** Grant a badge by code (idempotent on userId+badge+challenge+detail). Returns true if newly granted. */
export async function grantBadge(
  userId: string,
  code: string,
  opts: { detail?: string; challengeId?: string | null } = {}
): Promise<boolean> {
  const detail = opts.detail ?? "";
  const challengeId = opts.challengeId ?? null;
  const badgeId = await badgeIdFor(code);
  if (!badgeId) return false;
  const existing = await prisma.userBadge.findFirst({
    where: { userId, badgeId, challengeId, detail },
  });
  if (existing) return false;
  await prisma.userBadge.create({ data: { userId, badgeId, challengeId, detail } });
  return true;
}

/** Add XP, recompute level, and award any level-milestone badges crossed. */
export async function addXp(userId: string, amount: number): Promise<{ leveledUp: boolean; newLevel: number }> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return { leveledUp: false, newLevel: 1 };
  const oldLevel = profile.level;
  const newXp = Math.max(0, profile.xp + amount);
  const newLevel = levelForXp(newXp);
  await prisma.profile.update({ where: { userId }, data: { xp: newXp, level: newLevel } });
  for (const m of milestonesCrossed(LEVEL_MILESTONES, oldLevel, newLevel)) {
    await grantBadge(userId, `level_${m}`, { detail: `Reached level ${m}` });
  }
  return { leveledUp: newLevel > oldLevel, newLevel };
}

/** Record activity for today; advance the streak (freeze tokens bridge gaps). */
export async function recordActivity(userId: string): Promise<{ currentStreak: number; event: string }> {
  const existing = await prisma.streak.findUnique({ where: { userId } });
  const state: StreakState = existing
    ? { currentStreak: existing.currentStreak, longestStreak: existing.longestStreak, freezeTokens: existing.freezeTokens, lastActiveDate: existing.lastActiveDate }
    : { currentStreak: 0, longestStreak: 0, freezeTokens: 3, lastActiveDate: null };

  const r = nextStreak(state, new Date());
  if (r.event === "same-day" && existing) return { currentStreak: r.currentStreak, event: r.event };

  await prisma.streak.upsert({
    where: { userId },
    update: { currentStreak: r.currentStreak, longestStreak: r.longestStreak, freezeTokens: r.freezeTokens, lastActiveDate: r.lastActiveDate },
    create: { userId, currentStreak: r.currentStreak, longestStreak: r.longestStreak, freezeTokens: r.freezeTokens, lastActiveDate: r.lastActiveDate },
  });

  // Streak milestones: badge + a bonus freeze token + a little XP.
  const crossed = milestonesCrossed(STREAK_MILESTONES, state.currentStreak, r.currentStreak);
  for (const m of crossed) {
    const fresh = await grantBadge(userId, `streak_${m}`, { detail: `${m}-day streak` });
    if (fresh) {
      await prisma.streak.update({ where: { userId }, data: { freezeTokens: { increment: 1 } } });
      await addXp(userId, 10);
    }
  }
  return { currentStreak: r.currentStreak, event: r.event };
}

/** Detect & store a personal record for a movement. Returns true if it's a new PR. */
export async function detectPR(opts: {
  userId: string;
  movement: string;
  value: number;
  unitLabel: string;
  challengeType: string;
  submissionId?: string;
}): Promise<boolean> {
  const prev = await prisma.personalRecord.findUnique({
    where: { userId_movement: { userId: opts.userId, movement: opts.movement } },
  });
  if (!isPersonalRecord(opts.value, prev?.bestValue ?? null, opts.challengeType)) return false;

  await prisma.personalRecord.upsert({
    where: { userId_movement: { userId: opts.userId, movement: opts.movement } },
    update: { bestValue: opts.value, unitLabel: opts.unitLabel, challengeType: opts.challengeType, achievedAt: new Date(), submissionId: opts.submissionId ?? null },
    create: { userId: opts.userId, movement: opts.movement, bestValue: opts.value, unitLabel: opts.unitLabel, challengeType: opts.challengeType, submissionId: opts.submissionId ?? null },
  });
  await grantBadge(opts.userId, "pr", { detail: opts.movement });
  return true;
}

/**
 * Finalize a single challenge: compute FINAL rankings from VERIFIED submissions
 * only (so the top-3 video-proof rule is honoured — unverified entries are
 * ineligible and the next verified entrant takes the slot), award placement
 * badges (overall podium + per weight/experience-class wins), notify recipients,
 * and mark the challenge closed. Idempotent — skips already-finalized challenges.
 */
export async function finalizeChallenge(challengeId: string): Promise<{ finalized: boolean }> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { submissions: { include: { user: { select: { id: true, profile: true } } } } },
  });
  if (!challenge || challenge.finalizedAt) return { finalized: false };

  const subs: BoardSubmission[] = challenge.submissions.map((s) => ({
    userId: s.userId,
    rawValue: s.rawValue,
    bodyweightAtAttemptKg: s.bodyweightAtAttemptKg,
    verificationStatus: s.verificationStatus,
    videoUrl: s.videoUrl,
    displayName: s.user.profile?.displayName ?? "",
    username: s.user.profile?.username ?? "",
    gender: s.user.profile?.gender ?? "unspecified",
    profileBodyweightKg: s.user.profile?.bodyweightKg ?? null,
    weightClassId: s.weightClassId,
    experienceClassId: s.experienceClassId,
  }));
  const view = challenge.scoringType === "relative_dots" ? "relative" : "absolute";
  const type = challenge.challengeType as ChallengeType;

  const notify = (userId: string, body: string) =>
    prisma.notification.create({ data: { userId, type: "placement", body, link: `/challenges/${challengeId}` } });

  // Overall podium (verified only).
  const overall = buildBoard(subs, { view, challengeType: type, verifiedOnly: true });
  const codes = ["podium_gold", "podium_silver", "podium_bronze"];
  for (let i = 0; i < Math.min(3, overall.length); i++) {
    const fresh = await grantBadge(overall[i].userId, codes[i], { challengeId, detail: challenge.title });
    if (fresh) await notify(overall[i].userId, `You placed #${i + 1} in "${challenge.title}".`);
  }

  // Weight-class winners.
  const weightIds = [...new Set(subs.filter((s) => s.verificationStatus === "verified" && s.weightClassId).map((s) => s.weightClassId!))];
  for (const wcId of weightIds) {
    const rows = buildBoard(subs, { view, challengeType: type, verifiedOnly: true, weightClassId: wcId });
    if (!rows.length) continue;
    const wc = await prisma.weightCategory.findUnique({ where: { id: wcId } });
    const fresh = await grantBadge(rows[0].userId, "class_winner", { challengeId, detail: `${challenge.title} · ${wc?.name ?? "class"}` });
    if (fresh) await notify(rows[0].userId, `You won the ${wc?.name ?? "weight"} class in "${challenge.title}".`);
  }

  // Experience-class winners.
  const expIds = [...new Set(subs.filter((s) => s.verificationStatus === "verified" && s.experienceClassId).map((s) => s.experienceClassId!))];
  for (const ecId of expIds) {
    const rows = buildBoard(subs, { view, challengeType: type, verifiedOnly: true, experienceClassId: ecId });
    if (!rows.length) continue;
    const ec = await prisma.experienceClass.findUnique({ where: { id: ecId } });
    const fresh = await grantBadge(rows[0].userId, "class_winner", { challengeId, detail: `${challenge.title} · ${ec?.name ?? "division"}` });
    if (fresh) await notify(rows[0].userId, `You won the ${ec?.name ?? "experience"} division in "${challenge.title}".`);
  }

  // Challenge Points: top-50 per weight class (idempotent, recomputes totals).
  await awardChallengePoints(challengeId);

  await prisma.challenge.update({ where: { id: challengeId }, data: { finalizedAt: new Date(), status: "closed" } });
  return { finalized: true };
}

/**
 * Award Challenge Points for a challenge: the top-50 verified finishers in each
 * WEIGHT CLASS score by placing (1st → 50 … 50th → 1; see challengePointsForPlacement).
 * Points are per weight class only — not overall, not experience class. A user belongs
 * to exactly one weight class, so they earn from at most one class per challenge.
 * Idempotent via the ChallengePointsLog unique constraint (safe to rerun / backfill).
 * Recomputes challengePointsTotal for every affected user from the log (source of truth).
 */
export async function awardChallengePoints(challengeId: string): Promise<{ awarded: number }> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: { submissions: { include: { user: { select: { id: true, profile: true } } } } },
  });
  if (!challenge) return { awarded: 0 };

  const subs: BoardSubmission[] = challenge.submissions.map((s) => ({
    userId: s.userId,
    rawValue: s.rawValue,
    bodyweightAtAttemptKg: s.bodyweightAtAttemptKg,
    verificationStatus: s.verificationStatus,
    videoUrl: s.videoUrl,
    displayName: s.user.profile?.displayName ?? "",
    username: s.user.profile?.username ?? "",
    gender: s.user.profile?.gender ?? "unspecified",
    profileBodyweightKg: s.user.profile?.bodyweightKg ?? null,
    weightClassId: s.weightClassId,
    experienceClassId: s.experienceClassId,
  }));
  const view = challenge.scoringType === "relative_dots" ? "relative" : "absolute";
  const type = challenge.challengeType as ChallengeType;

  // Each weight class that has at least one verified finisher.
  const weightIds = [...new Set(subs.filter((s) => s.verificationStatus === "verified" && s.weightClassId).map((s) => s.weightClassId!))];

  const affected = new Set<string>();
  let awarded = 0;
  for (const wcId of weightIds) {
    const rows = buildBoard(subs, { view, challengeType: type, verifiedOnly: true, weightClassId: wcId });
    const top = rows.slice(0, CHALLENGE_POINTS_DEPTH);
    for (let i = 0; i < top.length; i++) {
      const placement = i + 1;
      const points = challengePointsForPlacement(placement);
      if (points <= 0) break;
      // Idempotent: the unique (userId, challengeId, weightClassId) makes this a no-op on rerun.
      const existing = await prisma.challengePointsLog.findUnique({
        where: { userId_challengeId_weightClassId: { userId: top[i].userId, challengeId, weightClassId: wcId } },
      });
      if (existing) continue;
      await prisma.challengePointsLog.create({
        data: { userId: top[i].userId, challengeId, weightClassId: wcId, placement, pointsAwarded: points },
      });
      affected.add(top[i].userId);
      awarded++;
    }
  }

  // Recompute denormalized totals from the log for everyone who gained points.
  for (const userId of affected) {
    const agg = await prisma.challengePointsLog.aggregate({ where: { userId }, _sum: { pointsAwarded: true } });
    await prisma.profile.updateMany({ where: { userId }, data: { challengePointsTotal: agg._sum.pointsAwarded ?? 0 } });
  }
  return { awarded };
}

/** Finalize every challenge whose window has closed but isn't finalized yet. */
export async function finalizeDueChallenges(): Promise<number> {
  const due = await prisma.challenge.findMany({
    where: { status: "published", finalizedAt: null, endsAt: { lte: new Date() } },
    select: { id: true },
  });
  let n = 0;
  for (const c of due) {
    const r = await finalizeChallenge(c.id);
    if (r.finalized) n++;
  }
  return n;
}
