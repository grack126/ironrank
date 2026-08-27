import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { WorkoutBuilder } from "@/components/WorkoutBuilder";

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [workout, exercises, referenceLifts] = await Promise.all([
    prisma.workout.findUnique({
      where: { id },
      include: {
        referenceLifts: { orderBy: { displayOrder: "asc" } },
        rankTiers: { orderBy: { displayOrder: "asc" } },
        sets: {
          orderBy: { setOrder: "asc" },
          include: {
            points: true,
            parts: { orderBy: { partOrder: "asc" }, include: { percentages: true } },
          },
        },
      },
    }),
    prisma.exerciseLibrary.findMany({
      where: { status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Active lifts, plus any this workout already requires (even if since archived).
    prisma.referenceLift.findMany({
      where: { OR: [{ status: "active" }, { workoutLinks: { some: { workoutId: id } } }] },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!workout) notFound();

  // Active categories plus this workout's current one (even if archived).
  const categories = await prisma.workoutCategory.findMany({
    where: { OR: [{ isActive: true }, { id: workout.categoryId ?? "__none__" }] },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <>
      <TopBar right={<Link href="/admin/workouts" className="pill">← Workouts</Link>} />
      <h1>Edit workout</h1>
      <WorkoutBuilder
        options={{ exercises, referenceLifts, categories }}
        initial={{
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
              label: part.label,
              referenceLiftId: part.referenceLiftId,
              reps: part.reps,
              description: part.description,
              percentages: part.percentages.map((x) => ({ difficulty: x.difficulty, percentage: x.percentage, reps: x.reps })),
            })),
          })),
        }}
      />
    </>
  );
}
