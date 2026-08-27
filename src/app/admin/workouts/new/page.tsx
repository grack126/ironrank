import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { WorkoutBuilder } from "@/components/WorkoutBuilder";

export default async function NewWorkoutPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [exercises, referenceLifts, categories] = await Promise.all([
    prisma.exerciseLibrary.findMany({
      where: { status: { not: "archived" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.referenceLift.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workoutCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <TopBar right={<Link href="/admin/workouts" className="pill">← Workouts</Link>} />
      <h1>New workout</h1>
      <WorkoutBuilder options={{ exercises, referenceLifts, categories }} />
    </>
  );
}
