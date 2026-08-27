import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const [categories, workouts, attempts] = await Promise.all([
    prisma.workoutCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { workouts: { where: { status: "published" } } } } },
    }),
    prisma.workout.findMany({
      where: { status: "published" },
      include: { _count: { select: { sets: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.workoutAttempt.findMany({
      where: { userId: user.id, status: "completed" },
      select: {
        workoutId: true,
        totalPoints: true,
        achievedRankTier: { select: { name: true, displayOrder: true } },
      },
      orderBy: { totalPoints: "desc" },
    }),
  ]);

  const best = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!best.has(a.workoutId)) best.set(a.workoutId, a);

  return NextResponse.json({
    categories: categories
      .filter((c) => c._count.workouts > 0)
      .map((c) => ({ id: c.id, name: c.name, imageRef: c.imageRef, count: c._count.workouts })),
    total: workouts.length,
    workouts: workouts.map((w) => {
      const b = best.get(w.id);
      return {
        id: w.id,
        title: w.title,
        categoryId: w.categoryId,
        backgroundImagePath: w.backgroundImagePath,
        sets: w._count.sets,
        best: b ? { points: b.totalPoints, rank: b.achievedRankTier?.name ?? null, rankOrder: b.achievedRankTier?.displayOrder ?? 0 } : null,
      };
    }),
  });
}
