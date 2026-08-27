import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { EmptyState } from "@/components/ui/primitives";
import { MediaCard } from "@/components/ui/MediaCard";
import { SectionTitle, IconChallenge, IconDaily } from "@/components/ui/icons";

function timeLabel(now: Date, start: Date, end: Date): string {
  if (now < start) return `Opens ${start.toLocaleDateString()}`;
  if (now > end) return "Closed";
  const ms = end.getTime() - now.getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  return `${hours}h left`;
}

export default async function ChallengesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  const now = new Date();
  const challenges = await prisma.challenge.findMany({
    where: { status: { in: ["published", "closed"] } },
    include: {
      exercise: { select: { name: true } },
      season: { select: { name: true } },
      _count: { select: { submissions: true } },
      submissions: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { endsAt: "asc" },
  });

  const live = challenges.filter((c) => c.status === "published" && now >= c.startsAt && now <= c.endsAt);
  const daily = live.filter((c) => c.isDaily);
  const standard = live.filter((c) => !c.isDaily);
  const closed = challenges.filter((c) => c.status === "closed" || now > c.endsAt);

  function Card({ c }: { c: (typeof challenges)[number] }) {
    const entered = c.submissions.length > 0;
    return (
      <MediaCard
        href={`/challenges/${c.id}`}
        title={c.title}
        subtitle={timeLabel(now, c.startsAt, c.endsAt)}
        image={c.backgroundImagePath}
        icon={IconChallenge}
        badge={entered ? <span className="pill success">entered</span> : undefined}
      />
    );
  }

  return (
    <>
      <TopBar right={live[0]?.season ? <span className="pill">{live[0].season!.name}</span> : undefined} />
      <SectionTitle as="h1" icon={IconChallenge}>Challenges</SectionTitle>

      {daily.length > 0 && (
        <>
          <SectionTitle icon={IconDaily}>Daily challenge</SectionTitle>
          {daily.map((c) => <Card key={c.id} c={c} />)}
        </>
      )}

      <h2>Live now</h2>
      {standard.length === 0 ? (
        <p className="muted small">No open challenges right now.</p>
      ) : (
        standard.map((c) => <Card key={c.id} c={c} />)
      )}

      {closed.length > 0 && (
        <>
          <h2>Recently closed</h2>
          {closed.slice(0, 5).map((c) => <Card key={c.id} c={c} />)}
        </>
      )}

      {challenges.length === 0 && (
        <EmptyState icon={IconChallenge} title="No challenges yet">
          <p className="muted small">Check back soon — the first competition is on its way.</p>
        </EmptyState>
      )}

      <TabBar isAdmin={user.isAdmin} />
    </>
  );
}
