import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Challenge list for mobile: live (daily + standard) and recently closed,
// each flagged with whether the current user has entered.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

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

  const map = (c: (typeof challenges)[number]) => ({
    id: c.id,
    title: c.title,
    exercise: c.exercise.name,
    challengeType: c.challengeType,
    scoringType: c.scoringType,
    isDaily: c.isDaily,
    season: c.season?.name ?? null,
    backgroundImagePath: c.backgroundImagePath,
    submissions: c._count.submissions,
    entered: c.submissions.length > 0,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    status: c.status,
  });

  const live = challenges.filter((c) => c.status === "published" && now >= c.startsAt && now <= c.endsAt);
  const closed = challenges.filter((c) => c.status === "closed" || now > c.endsAt);

  return NextResponse.json({
    daily: live.filter((c) => c.isDaily).map(map),
    live: live.filter((c) => !c.isDaily).map(map),
    closed: closed.slice(0, 10).map(map),
    season: live[0]?.season?.name ?? null,
  });
}
