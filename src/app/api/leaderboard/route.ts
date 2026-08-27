import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";

// Overall standings — top 25 plus the caller's own rank. Two modes:
//   ?mode=xp     (default) → ordered by xp desc
//   ?mode=points          → ordered by challengePointsTotal desc
// Both orderings are indexed; ties broken by join date.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const mode = new URL(req.url).searchParams.get("mode") === "points" ? "points" : "xp";
  const orderBy =
    mode === "points"
      ? [{ challengePointsTotal: "desc" as const }, { createdAt: "asc" as const }]
      : [{ xp: "desc" as const }, { createdAt: "asc" as const }];

  const profiles = await prisma.profile.findMany({
    orderBy,
    select: {
      userId: true,
      username: true,
      displayName: true,
      xp: true,
      level: true,
      challengePointsTotal: true,
      avatar: { select: { assetRef: true } },
    },
  });

  const ranked = profiles.map((p, i) => ({ ...p, rank: i + 1 }));
  const meRow = ranked.find((r) => r.userId === user.id) ?? null;
  const score = (r: (typeof ranked)[number]) => (mode === "points" ? r.challengePointsTotal : r.xp);

  return NextResponse.json({
    mode,
    total: ranked.length,
    me: meRow ? { rank: meRow.rank, score: score(meRow), level: meRow.level } : null,
    top: ranked.slice(0, 25).map((r) => ({
      rank: r.rank,
      userId: r.userId,
      displayName: r.displayName,
      username: r.username,
      level: r.level,
      score: score(r),
      avatar: r.avatar?.assetRef ?? "🧍",
    })),
  });
}
