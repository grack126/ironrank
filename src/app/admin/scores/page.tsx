import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { ScoreResetPanel, type ScoreRow } from "@/components/ScoreResetPanel";

export default async function AdminScoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const profiles = await prisma.profile.findMany({
    orderBy: [{ xp: "desc" }, { username: "asc" }],
    select: {
      userId: true,
      username: true,
      displayName: true,
      xp: true,
      level: true,
      challengePointsTotal: true,
      user: { select: { _count: { select: { attempts: true, submissions: true } } } },
    },
  });

  const rows: ScoreRow[] = profiles.map((p) => ({
    userId: p.userId,
    username: p.username,
    displayName: p.displayName,
    xp: p.xp,
    level: p.level,
    challengePoints: p.challengePointsTotal,
    attempts: p.user._count.attempts,
    submissions: p.user._count.submissions,
  }));

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Scores</h1>
      <p className="muted small">
        Wipe an athlete&apos;s results after a rules breach, or clear every score to reset the leaderboard
        after testing. Accounts, workouts and challenges are never deleted.
      </p>

      <ScoreResetPanel rows={rows} />
    </>
  );
}
