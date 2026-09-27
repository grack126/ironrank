"use server";

import { randomUUID } from "crypto";
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

  // One upsert per lift, each on its own row — send them together. Keyed by lift
  // so a repeated field can't race two inserts for the same row (last value wins,
  // as it did when these ran one after another).
  const weights = new Map<string, number>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("ref_")) continue;
    const v = parseFloat(String(value));
    if (isNaN(v) || v <= 0) continue;
    weights.set(key.slice(4), toKg(v, unit));
  }
  await Promise.all(
    [...weights].map(([referenceLiftId, weightKg]) =>
      prisma.userReferenceLift.upsert({
        where: { userId_referenceLiftId: { userId: user.id, referenceLiftId } },
        update: { weightKg, recordedAt: new Date() },
        create: { userId: user.id, referenceLiftId, weightKg },
      })
    )
  );

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

  // Independent reads in one round-trip. prevBest is read before this attempt is
  // written, which is exactly "best attempt other than this one".
  const [workout, userRefs, prevBest] = await Promise.all([
    prisma.workout.findUnique({
      where: { id: workoutId },
      include: {
        rankTiers: true,
        sets: {
          include: { points: true, parts: { include: { percentages: true } } },
        },
      },
    }),
    prisma.userReferenceLift.findMany({ where: { userId: user.id } }),
    prisma.workoutAttempt.findFirst({
      where: { userId: user.id, workoutId, status: "completed" },
      orderBy: { totalPoints: "desc" },
      select: { totalPoints: true },
    }),
  ]);
  if (!workout || workout.status !== "published") {
    return { ok: false, error: "Workout not available" };
  }

  const setIndex = new Map(workout.sets.map((s) => [s.id, s]));
  const refWeight = new Map(userRefs.map((r) => [r.referenceLiftId, r.weightKg]));

  let totalPoints = 0;
  // Ids are assigned here so parts can reference their result row and both
  // tables can be written with a single createMany each (a nested create issues
  // one INSERT per row — ~50 round-trips for a large workout).
  const resultRows: {
    id: string;
    workoutSetId: string;
    chosenDifficulty: string;
    outcome: string;
    pointsAwarded: number;
  }[] = [];
  const partRows: { id: string; workoutSetResultId: string; workoutSetPartId: string; calculatedWeightKg: number }[] = [];

  for (const pick of picks) {
    const set = setIndex.get(pick.setId);
    if (!set) continue;

    const setPts = set.points.find((p) => p.difficulty === pick.difficulty)?.points ?? 0;
    const points = pick.outcome === "success" ? setPts : 0;
    totalPoints += points;

    const resultId = randomUUID();
    resultRows.push({
      id: resultId,
      workoutSetId: set.id,
      chosenDifficulty: pick.difficulty,
      outcome: pick.outcome,
      pointsAwarded: points,
    });

    for (const part of set.parts) {
      const pct = part.percentages.find((p) => p.difficulty === pick.difficulty)?.percentage ?? 0;
      const reference = refWeight.get(part.referenceLiftId) ?? 0;
      partRows.push({
        id: randomUUID(),
        workoutSetResultId: resultId,
        workoutSetPartId: part.id,
        calculatedWeightKg: calcWorkingWeightKg(reference, pct, workout.roundingIncrementKg),
      });
    }
  }

  const tier = resolveRankTier(
    totalPoints,
    workout.rankTiers.map((t) => ({ id: t.id, name: t.name, icon: t.icon, minPoints: t.minPoints }))
  );

  // All-or-nothing, like the nested create it replaces: the attempt, its set
  // results and their per-part snapshots land together or not at all.
  const attempt = await prisma.$transaction(
    async (tx) => {
      const created = await tx.workoutAttempt.create({
        data: {
          userId: user.id,
          workoutId,
          completedAt: new Date(),
          status: "completed",
          totalPoints,
          achievedRankTierId: tier?.id ?? null,
        },
        select: { id: true },
      });
      if (resultRows.length) {
        await tx.workoutSetResult.createMany({
          data: resultRows.map((r) => ({ ...r, workoutAttemptId: created.id })),
        });
      }
      if (partRows.length) await tx.workoutSetResultPart.createMany({ data: partRows });
      return created;
    },
    { timeout: 30_000, maxWait: 15_000 }
  );

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
