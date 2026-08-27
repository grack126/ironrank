import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ClassManager } from "@/components/ClassManager";

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const [weight, experience] = await Promise.all([
    prisma.weightCategory.findMany({
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { profiles: true, submissions: true } } },
    }),
    prisma.experienceClass.findMany({
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { profiles: true, submissions: true } } },
    }),
  ]);

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Classes</h1>
      <p className="muted small">
        Weight and experience classes athletes pick on their profile. Leaderboards segment by these.
        Classes in use are archived, not deleted.
      </p>
      <ClassManager
        weight={weight.map((c) => ({ id: c.id, name: c.name, gender: c.gender, minKg: c.minKg, maxKg: c.maxKg, isActive: c.isActive, usage: c._count.profiles + c._count.submissions }))}
        experience={experience.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive, usage: c._count.profiles + c._count.submissions }))}
      />
    </>
  );
}
