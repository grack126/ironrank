import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ReferenceLiftManager } from "@/components/ReferenceLiftManager";

export default async function ReferenceLiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const lifts = await prisma.referenceLift.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { workoutLinks: true, setParts: true, userValues: true } } },
  });

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Reference lifts</h1>
      <p className="muted small">
        The benchmark maxes users enter (e.g. &quot;Bench Press 10RM&quot;). Workouts compute
        working weights as a percentage of these. Lifts in use are archived, not deleted.
      </p>
      <ReferenceLiftManager
        lifts={lifts.map((l) => ({
          id: l.id,
          name: l.name,
          description: l.description,
          unit: l.unit,
          status: l.status,
          usage: l._count.workoutLinks + l._count.setParts + l._count.userValues,
        }))}
      />
    </>
  );
}
