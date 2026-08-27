"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toKg, type Unit } from "@/lib/shared/units";
import { calcWorkingWeightKg, resolveRankTier } from "@/lib/shared/workout";
import { addXp, recordActivity } from "@/lib/server-progression";

/** Save / update the user's reference-lift numbers (entered in their unit). */
export async function saveReferenceLiftsAction(formData: FormData) {
  const user = await requireUser();
  const unit = (user.profile?.preferredUnits as Unit) || "kg";
  const workoutId = String(formData.get("workoutId") ?? "");

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("ref_")) continue;
    const v = parseFloat(String(value));
    if (isNaN(v) || v <= 0) continue;
    const referenceLiftId = key.slice(4);
    const weightKg = toKg(v, unit);
    await prisma.userReferenceLift.upsert({
      where: { userId_referenceLiftId: { userId: user.id, referenceLiftId } },
      update: { weightKg, recordedAt: new Date() },
      create: { userId: user.id, referenceLiftId, weightKg },
    });
  }

  if (workoutId) revalidatePath(`/workouts/${workoutId}`);
}

const pickSchema = z.array(
  z.object({
    setId: z.string(),
    difficulty: z.enum(["easy", "hard", "brutal"]),
    outcome: z.enum(["success", "fail"]),
  })
);

export type SubmitResult =
  | {
      ok: true;
      attemptId: string;
      totalPoints: number;
      rankName: string | null;
      rankIcon: string | null;
      isBest: boolean;
    }
  | { ok: false; error: string };

/**
 * Submit a completed workout. The server recomputes every working weight and
 * point award from stored data — the client's numbers are never trusted.
 * Difficulty is chosen per set and applies to all of that set's parts.
 * Per-part weights and the awarded points are snapshotted for immutable history.
 */
export async function submitWorkoutAttempt(
  workoutId: string,
  picksRaw: unknown
): Promise<SubmitResult> {
  const user = await requireUser();
  const parsed = pickSchema.safeParse(picksRaw);
  if (!parsed.success) return { ok: false, error: "Invalid submission" };
  const picks = parsed.data;

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: {
      rankTiers: true,
      sets: {
        include: { points: true, parts: { include: { percentages: true } } },
      },
    },
  });
  if (!workout || workout.status !== "published") {
    return { ok: false, error: "Workout not available" };
  }

  const setIndex = new Map(workout.sets.map((s) => [s.id, s]));

  const userRefs = await prisma.userReferenceLift.findMany({ where: { userId: user.id } });
  const refWeight = new Map(userRefs.map((r) => [r.referenceLiftId, r.weightKg]));

  let totalPoints = 0;
  const resultRows: {
    workoutSetId: string;
    chosenDifficulty: string;
    outcome: string;
    pointsAwarded: number;
    parts: { create: { workoutSetPartId: string; calculatedWeightKg: number }[] };
  }[] = [];

  for (const pick of picks) {
    const set = setIndex.get(pick.setId);
    if (!set) continue;

    const setPts = set.points.find((p) => p.difficulty === pick.difficulty)?.points ?? 0;
    const points = pick.outcome === "success" ? setPts : 0;
    totalPoints += points;

    const partRows = set.parts.map((part) => {
      const pct = part.percentages.find((p) => p.difficulty === pick.difficulty)?.percentage ?? 0;
      const reference = refWeight.get(part.referenceLiftId) ?? 0;
      return {
        workoutSetPartId: part.id,
        calculatedWeightKg: calcWorkingWeightKg(reference, pct, workout.roundingIncrementKg),
      };
    });

    resultRows.push({
      workoutSetId: set.id,
      chosenDifficulty: pick.difficulty,
      outcome: pick.outcome,
      pointsAwarded: points,
      parts: { create: partRows },
    });
  }

  const tier = resolveRankTier(
    totalPoints,
    workout.rankTiers.map((t) => ({ id: t.id, name: t.name, icon: t.icon, minPoints: t.minPoints }))
  );

  const attempt = await prisma.workoutAttempt.create({
    data: {
      userId: user.id,
      workoutId,
      completedAt: new Date(),
      status: "completed",
      totalPoints,
      achievedRankTierId: tier?.id ?? null,
      results: { create: resultRows },
    },
  });

  const prevBest = await prisma.workoutAttempt.findFirst({
    where: { userId: user.id, workoutId, status: "completed", id: { not: attempt.id } },
    orderBy: { totalPoints: "desc" },
  });
  const isBest = !prevBest || totalPoints > prevBest.totalPoints;

  // Progression: XP (with level-milestone badges) + streak activity.
  await addXp(user.id, totalPoints);
  await recordActivity(user.id);

  revalidatePath("/profile");
  revalidatePath("/workouts");
  revalidatePath("/leaderboard");

  return {
    ok: true,
    attemptId: attempt.id,
    totalPoints,
    rankName: tier?.name ?? null,
    rankIcon: tier?.icon ?? null,
    isBest,
  };
}
