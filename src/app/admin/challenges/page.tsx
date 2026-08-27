import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { FinalizeButton } from "@/components/FinalizeButton";
import { IconDaily } from "@/components/ui/icons";
import { ChallengeVisibilityToggle } from "@/components/ChallengeVisibilityToggle";

export default async function AdminChallengesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const now = new Date();
  const [challenges, dueCount] = await Promise.all([
    prisma.challenge.findMany({
      include: { exercise: { select: { name: true } }, _count: { select: { submissions: true } } },
      orderBy: { startsAt: "desc" },
    }),
    prisma.challenge.count({ where: { status: "published", finalizedAt: null, endsAt: { lte: now } } }),
  ]);

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <div className="row between">
        <h1>Challenges</h1>
        <Link href="/admin/challenges/new" className="btn sm auto">+ New</Link>
      </div>

      <FinalizeButton dueCount={dueCount} />

      {challenges.length === 0 ? (
        <p className="muted">No challenges yet. Create one.</p>
      ) : (
        <div className="card">
          {challenges.map((c) => {
            const live = c.status === "published" && now >= c.startsAt && now <= c.endsAt;
            return (
              <Link key={c.id} href={`/admin/challenges/${c.id}`} className="list-item">
                <div className="grow">
                  <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    {c.isDaily && <IconDaily className="i-accent" size={15} strokeWidth={2.5} aria-label="Daily" />}
                    <span>{c.title}</span>
                  </h3>
                  <span className="ti-meta">
                    {c.exercise.name} · {c.challengeType.replace("_", " ")} · {c._count.submissions} entries
                  </span>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span className={`pill ${live ? "success" : ""}`}>{live ? "live" : c.status}</span>
                  <ChallengeVisibilityToggle id={c.id} status={c.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
