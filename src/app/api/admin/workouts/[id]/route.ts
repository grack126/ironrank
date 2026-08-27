import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";

// GET: a workout in builder shape (initial) plus option sources. Reference lifts
// and category include any this workout uses even if since archived.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const workout = await prisma.workout.findUnique({
    where: { id },
    include: {
      referenceLifts: { orderBy: { displayOrder: "asc" } },
      rankTiers: { orderBy: { displayOrder: "asc" } },
      sets: {
        orderBy: { setOrder: "asc" },
        include: { points: true, parts: { orderBy: { partOrder: "asc" }, include: { percentages: true } } },
      },
    },
  });
  if (!workout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [exercises, referenceLifts, categories] = await Promise.all([
    prisma.exerciseLibrary.findMany({ where: { status: { not: "archived" } }, orderBy: { name: "asc" }, select: { id: true, name: true, youtubeVideoId: true } }),
    prisma.referenceLift.findMany({ where: { OR: [{ status: "active" }, { workoutLinks: { some: { workoutId: id } } }] }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.workoutCategory.findMany({ where: { OR: [{ isActive: true }, { id: workout.categoryId ?? "__none__" }] }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return NextResponse.json({
    initial: {
      id: workout.id,
      title: workout.title,
      instructions: workout.instructions,
      roundingIncrementKg: workout.roundingIncrementKg,
      status: workout.status,
      categoryId: workout.categoryId,
      backgroundImagePath: workout.backgroundImagePath,
      referenceLiftIds: workout.referenceLifts.map((r) => r.referenceLiftId),
      rankTiers: workout.rankTiers.map((t) => ({ name: t.name, icon: t.icon, minPoints: t.minPoints })),
      sets: workout.sets.map((s) => ({
        label: s.label,
        instructions: s.instructions,
        points: s.points.map((p) => ({ difficulty: p.difficulty, points: p.points })),
        parts: s.parts.map((part) => ({
          exerciseId: part.exerciseId,
          referenceLiftId: part.referenceLiftId,
          reps: part.reps,
          description: part.description,
          percentages: part.percentages.map((x) => ({ difficulty: x.difficulty, percentage: x.percentage })),
        })),
      })),
    },
    options: { exercises, referenceLifts, categories },
  });
}

// DELETE: remove a workout (cascades sets/parts/points/attempts per schema).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.workout.delete({ where: { id } });
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
