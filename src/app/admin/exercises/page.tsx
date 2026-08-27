import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";

export default async function ExercisesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const exercises = await prisma.exerciseLibrary.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <div className="row between">
        <h1>Exercise Library</h1>
        <Link href="/admin/exercises/new" className="btn sm auto">+ New</Link>
      </div>
      <p className="muted small">Shared by challenges and workouts.</p>

      {exercises.length === 0 ? (
        <p className="muted">No exercises yet.</p>
      ) : (
        <div className="card">
          {exercises.map((e) => (
            <Link key={e.id} href={`/admin/exercises/${e.id}`} className="list-item">
              <div>
                <h3 style={{ margin: 0 }}>{e.name}</h3>
                <span className="small muted">
                  {[e.muscleGroup, e.equipment].filter(Boolean).join(" · ") || "—"}
                </span>
              </div>
              <span className={`pill ${e.status === "published" ? "success" : ""}`}>{e.status}</span>
            </Link>
          ))}
        </div>
      )}

      <TabBar isAdmin />
    </>
  );
}
