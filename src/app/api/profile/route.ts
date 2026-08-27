import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { xpIntoLevel } from "@/lib/shared/progression";
import { toKg, type Unit } from "@/lib/shared/units";
import { formatRawValue, type ChallengeType } from "@/lib/shared/challenge";

// Full progression payload for the mobile profile screen: stats, streak, badges,
// PRs, workout ranks, avatars (with unlock levels) and the editable-profile options.
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const p = user.profile;
  if (!p) return NextResponse.json({ error: "No profile" }, { status: 404 });

  const [classProfile, weightClasses, experienceClasses, avatars, badges, streak, prs, attempts] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: user.id }, include: { weightClass: true, experienceClass: true, avatar: true } }),
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, gender: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
    prisma.avatar.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.userBadge.findMany({ where: { userId: user.id }, include: { badge: true }, orderBy: { awardedAt: "desc" } }),
    prisma.streak.findUnique({ where: { userId: user.id } }),
    prisma.personalRecord.findMany({ where: { userId: user.id }, orderBy: { achievedAt: "desc" }, take: 8 }),
    prisma.workoutAttempt.findMany({
      where: { userId: user.id, status: "completed" },
      select: {
        id: true,
        workoutId: true,
        totalPoints: true,
        workout: { select: { title: true } },
        achievedRankTier: { select: { name: true, displayOrder: true } },
      },
      orderBy: [{ totalPoints: "desc" }],
    }),
  ]);

  const bestByWorkout = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!bestByWorkout.has(a.workoutId)) bestByWorkout.set(a.workoutId, a);
  const { into, span } = xpIntoLevel(p.xp);

  return NextResponse.json({
    user: { id: user.id, email: user.email, isAdmin: user.isAdmin },
    profile: {
      username: p.username,
      displayName: p.displayName,
      gender: p.gender,
      level: p.level,
      xp: p.xp,
      xpInto: into,
      xpSpan: span,
      challengePoints: p.challengePointsTotal,
      preferredUnits: p.preferredUnits,
      bodyweightKg: p.bodyweightKg,
      heightCm: p.heightCm,
      experienceYears: p.experienceYears,
      weightClass: classProfile?.weightClass?.name ?? null,
      experienceClass: classProfile?.experienceClass?.name ?? null,
      weightClassId: classProfile?.weightClassId ?? null,
      experienceClassId: classProfile?.experienceClassId ?? null,
      avatar: classProfile?.avatar?.assetRef ?? "🧍",
      avatarId: classProfile?.avatarId ?? null,
    },
    streak: {
      current: streak?.currentStreak ?? 0,
      longest: streak?.longestStreak ?? 0,
      freezes: streak?.freezeTokens ?? 0,
    },
    badges: badges.map((ub) => ({ id: ub.id, name: ub.badge.name, icon: ub.badge.icon, detail: ub.detail || ub.badge.description })),
    prs: prs.map((pr) => ({
      id: pr.id,
      movement: pr.movement.split(" · ")[0],
      sub: pr.movement.split(" · ")[1] ?? "",
      achievedAt: pr.achievedAt.toISOString(),
      value: formatRawValue(pr.bestValue, pr.challengeType as ChallengeType, pr.unitLabel),
    })),
    ranks: [...bestByWorkout.values()].map((a) => ({
      id: a.id,
      title: a.workout.title,
      points: a.totalPoints,
      rank: a.achievedRankTier?.name ?? null,
      rankOrder: a.achievedRankTier?.displayOrder ?? 0,
    })),
    avatars: avatars.map((a) => ({ id: a.id, name: a.name, assetRef: a.assetRef, unlockLevel: a.unlockLevel })),
    weightClasses,
    experienceClasses,
  });
}

// Save profile edits (bodyweight arrives in the user's unit; converted to kg).
const saveSchema = z.object({
  displayName: z.string().min(1).max(40),
  gender: z.enum(["male", "female", "unspecified"]),
  heightCm: z.number().min(0).max(260).nullable(),
  bodyweight: z.number().min(0).max(500).nullable(),
  experienceYears: z.number().min(0).max(80).nullable(),
  weightClassId: z.string().min(1),
  experienceClassId: z.string().min(1),
  preferredUnits: z.enum(["kg", "lb"]),
});

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const bodyweightKg = d.bodyweight != null ? toKg(d.bodyweight, d.preferredUnits as Unit) : null;

  const data = {
    displayName: d.displayName,
    gender: d.gender,
    heightCm: d.heightCm,
    bodyweightKg,
    experienceYears: d.experienceYears,
    weightClassId: d.weightClassId,
    experienceClassId: d.experienceClassId,
    preferredUnits: d.preferredUnits,
  };
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, username: user.profile?.username ?? `lifter_${user.id.slice(0, 6)}`, ...data },
  });
  return NextResponse.json({ ok: true });
}
