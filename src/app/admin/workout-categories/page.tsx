import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { WorkoutCategoryManager } from "@/components/WorkoutCategoryManager";

export default async function WorkoutCategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const categories = await prisma.workoutCategory.findMany({
    orderBy: { displayOrder: "asc" },
    include: { _count: { select: { workouts: true } } },
  });

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Workout categories</h1>
      <p className="muted small">
        Plans athletes browse on the Workouts tab (e.g. Push / Pull / Legs, Full body).
        Each workout belongs to one. Categories in use are archived, not deleted.
      </p>
      <WorkoutCategoryManager
        categories={categories.map((c) => ({ id: c.id, name: c.name, description: c.description, imageRef: c.imageRef, isActive: c.isActive, usage: c._count.workouts }))}
      />
    </>
  );
}
