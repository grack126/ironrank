import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import type { Difficulty } from "@/lib/shared/workout";

type Row = { difficulty: string; value: number };
function triple(rows: Row[]) {
  const t = { easy: 0, hard: 0, brutal: 0 };
  for (const r of rows) (t as Record<Difficulty, number>)[r.difficulty as Difficulty] = r.value;
  return t;
}

// Full workout payload for the mobile player (mirrors RunnerData on the web).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const { id } = await params;

  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      referenceLifts: { include: { referenceLift: true }, orderBy: { displayOrder: "asc" } },
      rankTiers: { orderBy: { minPoints: "asc" } },
      sets: {
        orderBy: { setOrder: "asc" },
        include: {
          points: true,
          parts: {
            orderBy: { partOrder: "asc" },
            include: { exercise: true, referenceLift: true, percentages: true },
          },
        },
      },
    },
  });
  if (!workout || workout.status !== "published") {
    return NextResponse.json({ error: "Workout not available" }, { status: 404 });
  }

  const userRefs = await prisma.userReferenceLift.findMany({ where: { userId: user.id } });
  const refMap = new Map(userRefs.map((r) => [r.referenceLiftId, r.weightKg]));
  const unit = user.profile?.preferredUnits === "lb" ? "lb" : "kg";

  return NextResponse.json({
    workoutId: workout.id,
    title: workout.title,
    instructions: workout.instructions,
    unit,
    incrementKg: workout.roundingIncrementKg,
    rankTiers: workout.rankTiers.map((t) => ({ name: t.name, icon: t.icon, minPoints: t.minPoints })),
    referenceLifts: workout.referenceLifts.map((wr) => ({
      id: wr.referenceLift.id,
      name: wr.referenceLift.name,
      description: wr.referenceLift.description,
      currentKg: refMap.get(wr.referenceLift.id) ?? null,
    })),
    sets: workout.sets.map((s) => ({
      id: s.id,
      label: s.label,
      instructions: s.instructions,
      points: triple(s.points.map((p) => ({ difficulty: p.difficulty, value: p.points }))),
      parts: s.parts.map((part) => ({
        id: part.id,
        exerciseId: part.exerciseId,
        exerciseName: part.exercise.name,
        exerciseInstructions: part.exercise.instructions,
        youtubeVideoId: part.exercise.youtubeVideoId ?? null,
        referenceLiftId: part.referenceLiftId,
        referenceLiftName: part.referenceLift.name,
        reps: part.reps,
        description: part.description,
        percentages: triple(part.percentages.map((p) => ({ difficulty: p.difficulty, value: p.percentage }))),
      })),
    })),
  });
}
