import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { WorkoutVisibilityToggle } from "@/components/WorkoutVisibilityToggle";

export default async function AdminWorkoutsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const workouts = await prisma.workout.findMany({
    include: { _count: { select: { sets: true, attempts: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <div className="row between">
        <h1>Workouts</h1>
        <Link href="/admin/workouts/new" className="btn sm auto">+ New</Link>
      </div>

      {workouts.length === 0 ? (
        <p className="muted">No workouts yet. Build one.</p>
      ) : (
        <div className="card">
          {workouts.map((w) => (
            <Link key={w.id} href={`/admin/workouts/${w.id}`} className="list-item">
              <div className="grow">
                <h3 style={{ margin: 0 }}>{w.title}</h3>
                <span className="ti-meta">
                  {w._count.sets} sets · {w._count.attempts} attempts
                </span>
              </div>
              <WorkoutVisibilityToggle id={w.id} status={w.status} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
