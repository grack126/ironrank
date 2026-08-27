import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { calcWorkingWeightKg, resolveRankTier } from "@/lib/shared/workout";
import { addXp, recordActivity } from "@/lib/server-progression";

// Submit a completed workout. The server recomputes every working weight and
// point award from stored data — the client's numbers are never trusted.
const pickSchema = z.object({
  picks: z.array(
    z.object({
      setId: z.string(),
      difficulty: z.enum(["easy", "hard", "brutal"]),
      outcome: z.enum(["success", "fail"]),
    })
  ),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id: workoutId } = await params;

  const parsed = pickSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  const picks = parsed.data.picks;

  const workout = await prisma.workout.findUnique({
    where: { id: workoutId },
    include: { rankTiers: true, sets: { include: { points: true, parts: { include: { percentages: true } } } } },
  });
  if (!workout || workout.status !== "published") {
    return NextResponse.json({ error: "Workout not available" }, { status: 404 });
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

  await addXp(user.id, totalPoints);
  await recordActivity(user.id);

  return NextResponse.json({
    ok: true,
    attemptId: attempt.id,
    totalPoints,
    rankName: tier?.name ?? null,
    rankIcon: tier?.icon ?? null,
    isBest,
  });
}
