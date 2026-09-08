"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}

export type WipeCounts = {
  workoutAttempts: number;
  submissions: number;
  challengePoints: number;
  badges: number;
  personalRecords: number;
  streaks: number;
  profilesReset: number;
};

/**
 * Everything that contributes to a score. Accounts, profiles, workouts and
 * challenges are never touched — only the results a user has accumulated.
 * `where` is an empty object for a global reset, or { userId } for one athlete.
 */
async function wipeScores(where: { userId?: string }): Promise<WipeCounts> {
  const scope = where.userId ? { userId: where.userId } : {};
  const profileScope = where.userId ? { userId: where.userId } : {};

  return prisma.$transaction(
    async (tx) => {
      // WorkoutAttempt cascades to its set results and result parts.
      const workoutAttempts = (await tx.workoutAttempt.deleteMany({ where: scope })).count;
      const submissions = (await tx.submission.deleteMany({ where: scope })).count;
      const challengePoints = (await tx.challengePointsLog.deleteMany({ where: scope })).count;
      const badges = (await tx.userBadge.deleteMany({ where: scope })).count;
      const personalRecords = (await tx.personalRecord.deleteMany({ where: scope })).count;
      const streaks = (await tx.streak.deleteMany({ where: scope })).count;

      const profilesReset = (
        await tx.profile.updateMany({
          where: profileScope,
          data: { xp: 0, level: 1, challengePointsTotal: 0 },
        })
      ).count;

      return { workoutAttempts, submissions, challengePoints, badges, personalRecords, streaks, profilesReset };
    },
    { timeout: 30_000, maxWait: 15_000 }
  );
}

function revalidateBoards() {
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/challenges");
  revalidatePath("/admin/scores");
}

/** Wipe one athlete's scores — e.g. after a rules breach. Their account remains. */
export async function resetUserScoresAction(userId: string) {
  await requireAdmin();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profile: { select: { username: true } } },
  });
  if (!target) return { ok: false as const, error: "User not found" };

  const counts = await wipeScores({ userId });
  revalidateBoards();
  return { ok: true as const, username: target.profile?.username ?? "user", counts };
}

/**
 * Wipe every athlete's scores and reset the leaderboard. Irreversible, so the
 * caller must pass the literal confirmation phrase.
 */
export async function resetAllScoresAction(confirmation: string) {
  await requireAdmin();
  if (confirmation !== "RESET") {
    return { ok: false as const, error: 'Type RESET exactly to confirm.' };
  }
  const counts = await wipeScores({});
  revalidateBoards();
  return { ok: true as const, counts };
}
