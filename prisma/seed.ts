import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { primaryScore, resolveWeightCategory, type ChallengeType, type ScoringType } from "../src/lib/shared/challenge";

const prisma = new PrismaClient();

type Triple = { easy: number; hard: number; brutal: number };
const DIFFS = ["easy", "hard", "brutal"] as const;
const pointsRows = (t: Triple) => DIFFS.map((d) => ({ difficulty: d, points: t[d] }));
const pctRows = (t: Triple) => DIFFS.map((d) => ({ difficulty: d, percentage: t[d] }));
const sexOf = (g: string) => (g === "male" || g === "female" ? (g as "male" | "female") : null);

async function ensureUser(email: string, isAdmin: boolean, profile: any) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash("password123", 10), isAdmin, profile: { create: profile } },
  });
}

async function main() {
  const admin = await ensureUser("admin@ironrank.test", true, {
    username: "admin",
    displayName: "Admin",
    experienceTier: "elite",
    preferredUnits: "kg",
  });
  const lifter = await ensureUser("lifter@ironrank.test", false, {
    username: "ironmike",
    displayName: "Iron Mike",
    gender: "male",
    heightCm: 180,
    bodyweightKg: 85,
    experienceYears: 4,
    experienceTier: "advanced",
    preferredUnits: "kg",
  });
  console.log(`Admin: ${admin.email} / password123`);
  console.log(`Lifter: ${lifter.email} / password123`);

  // ---- Section A: base content (exercises, reference lifts, workout) ----
  if ((await prisma.exerciseLibrary.count()) === 0) {
    await seedBaseContent(lifter.id);
    console.log("Seeded exercise library, reference lifts and a multi-part workout.");
  } else {
    console.log("Base content already present — skipping.");
  }

  // ---- Section B: competitive challenges ----
  if ((await prisma.weightCategory.count()) === 0) {
    await seedChallenges(lifter.id);
    console.log("Seeded weight categories, a season, challenges and demo submissions.");
  } else {
    console.log("Challenges already present — skipping.");
  }

  // ---- Section C: friend groups ----
  if ((await prisma.group.count()) === 0) {
    await seedGroups();
    console.log("Seeded demo groups and an invite.");
  } else {
    console.log("Groups already present — skipping.");
  }

  // ---- Section D: progression (avatars, badges) ----
  if ((await prisma.avatar.count()) === 0) {
    await seedProgression();
    console.log("Seeded avatars, badges and demo progression.");
  } else {
    console.log("Progression already present — skipping.");
  }
}

async function seedProgression() {
  await prisma.avatar.createMany({
    data: [
      { name: "Rookie", assetRef: "/avatars/rookie.svg", unlockLevel: 1, displayOrder: 0 },
      { name: "Lifter", assetRef: "/avatars/lifter.svg", unlockLevel: 2, displayOrder: 1 },
      { name: "Beast", assetRef: "/avatars/beast.svg", unlockLevel: 5, displayOrder: 2 },
      { name: "Champion", assetRef: "/avatars/champion.svg", unlockLevel: 10, displayOrder: 3 },
      { name: "Titan", assetRef: "/avatars/titan.svg", unlockLevel: 20, displayOrder: 4 },
      { name: "Legend", assetRef: "/avatars/legend.svg", unlockLevel: 35, displayOrder: 5 },
    ],
  });

  await prisma.badge.createMany({
    data: [
      { code: "podium_gold", name: "Gold podium", description: "Finished 1st on a challenge", icon: "🥇", tier: "gold", category: "podium" },
      { code: "podium_silver", name: "Silver podium", description: "Finished 2nd on a challenge", icon: "🥈", tier: "silver", category: "podium" },
      { code: "podium_bronze", name: "Bronze podium", description: "Finished 3rd on a challenge", icon: "🥉", tier: "bronze", category: "podium" },
      { code: "level_5", name: "Level 5", description: "Reached level 5", icon: "⭐", tier: "bronze", category: "level" },
      { code: "level_10", name: "Level 10", description: "Reached level 10", icon: "⭐", tier: "silver", category: "level" },
      { code: "level_20", name: "Level 20", description: "Reached level 20", icon: "🌟", tier: "gold", category: "level" },
      { code: "level_35", name: "Level 35", description: "Reached level 35", icon: "🌟", tier: "platinum", category: "level" },
      { code: "level_50", name: "Level 50", description: "Reached level 50", icon: "💫", tier: "platinum", category: "level" },
      { code: "streak_7", name: "Week warrior", description: "7-day streak", icon: "🔥", tier: "bronze", category: "streak" },
      { code: "streak_30", name: "Month of iron", description: "30-day streak", icon: "🔥", tier: "gold", category: "streak" },
      { code: "streak_100", name: "Unbreakable", description: "100-day streak", icon: "🔥", tier: "platinum", category: "streak" },
      { code: "pr", name: "Personal best", description: "Set a personal record", icon: "📈", tier: "special", category: "pr" },
      { code: "class_winner", name: "Class winner", description: "Won your weight or experience class on a challenge", icon: "🏅", tier: "gold", category: "class" },
    ],
  });

  // Default everyone to the Rookie avatar.
  const rookie = await prisma.avatar.findFirst({ where: { name: "Rookie" } });
  if (rookie) await prisma.profile.updateMany({ where: { avatarId: null }, data: { avatarId: rookie.id } });

  // Demo progression for the lifter so the profile is lively.
  const lifter = await prisma.user.findUnique({ where: { email: "lifter@ironrank.test" } });
  if (!lifter) return;
  await prisma.streak.upsert({
    where: { userId: lifter.id },
    update: {},
    create: { userId: lifter.id, currentStreak: 5, longestStreak: 8, freezeTokens: 3, lastActiveDate: new Date() },
  });
  await prisma.personalRecord.upsert({
    where: { userId_movement: { userId: lifter.id, movement: "Barbell Bench Press · max_weight" } },
    update: {},
    create: { userId: lifter.id, movement: "Barbell Bench Press · max_weight", bestValue: 132.5, unitLabel: "kg", challengeType: "max_weight" },
  });
  // PR is an event-based badge (immediate). Placement/podium badges are NOT seeded
  // here — they're only awarded when a challenge is finalized.
  const prBadge = await prisma.badge.findUnique({ where: { code: "pr" } });
  if (prBadge) {
    const detail = "Barbell Bench Press · max_weight";
    const exists = await prisma.userBadge.findFirst({ where: { userId: lifter.id, badgeId: prBadge.id, detail } });
    if (!exists) await prisma.userBadge.create({ data: { userId: lifter.id, badgeId: prBadge.id, detail } });
  }
}

async function seedGroups() {
  const lifter = await prisma.user.findUnique({ where: { email: "lifter@ironrank.test" }, include: { profile: true } });
  const dimitri = await prisma.user.findUnique({ where: { email: "dimitri@ironrank.test" }, include: { profile: true } });
  const sara = await prisma.user.findUnique({ where: { email: "sara@ironrank.test" } });
  if (!lifter || !dimitri || !sara) return;

  // A group the demo lifter owns, with Sara as a member.
  await prisma.group.create({
    data: {
      name: "Garage Crew",
      ownerId: lifter.id,
      inviteCode: "CREW01",
      members: { create: [{ userId: lifter.id, role: "owner" }, { userId: sara.id, role: "member" }] },
    },
  });

  // A group owned by Dimitri with a pending invite to the demo lifter.
  await prisma.group.create({
    data: {
      name: "Dimitri's Squad",
      ownerId: dimitri.id,
      inviteCode: "SQUAD1",
      members: { create: { userId: dimitri.id, role: "owner" } },
      invites: { create: { invitedById: dimitri.id, inviteeRef: lifter.profile?.username ?? "ironmike", token: "demo-invite-token" } },
    },
  });
}

async function seedBaseContent(lifterId: string) {
  const bench = await prisma.exerciseLibrary.create({
    data: { name: "Barbell Bench Press", instructions: "Lower to mid-chest, pause, press to lockout.", youtubeVideoId: "rT7DgCr-3pg", muscleGroup: "Chest", equipment: "Barbell", movementStandard: "Pause on chest, full lockout", status: "published" },
  });
  const squat = await prisma.exerciseLibrary.create({
    data: { name: "Back Squat", instructions: "Descend below parallel, drive up through mid-foot.", youtubeVideoId: "ultWZbUMPL8", muscleGroup: "Legs", equipment: "Barbell", movementStandard: "Hip crease below knee", status: "published" },
  });
  const row = await prisma.exerciseLibrary.create({
    data: { name: "Bent-over Barbell Row", instructions: "Hinge to ~45°, row to lower ribs, control the negative.", youtubeVideoId: "9efgcAjQe7E", muscleGroup: "Back", equipment: "Barbell", movementStandard: "Torso steady, no jerking", status: "published" },
  });

  const benchRef = await prisma.referenceLift.create({ data: { name: "Bench Press 10RM", description: "10-rep max barbell bench", unit: "kg" } });
  const squatRef = await prisma.referenceLift.create({ data: { name: "Back Squat 10RM", description: "10-rep max back squat", unit: "kg" } });
  const rowRef = await prisma.referenceLift.create({ data: { name: "Bent-over Row 10RM", description: "10-rep max barbell row", unit: "kg" } });

  await prisma.userReferenceLift.createMany({
    data: [
      { userId: lifterId, referenceLiftId: benchRef.id, weightKg: 80 },
      { userId: lifterId, referenceLiftId: squatRef.id, weightKg: 110 },
      { userId: lifterId, referenceLiftId: rowRef.id, weightKg: 70 },
    ],
  });

  const pplCat = await prisma.workoutCategory.create({
    data: { name: "Push / Pull / Legs", imageRef: "🔁", description: "Rotating push, pull and leg sessions.", displayOrder: 0 },
  });
  await prisma.workoutCategory.create({
    data: { name: "Full Body", imageRef: "🧍", description: "One session, everything trained.", displayOrder: 1 },
  });

  const workout = await prisma.workout.create({
    data: {
      title: "Push / Pull / Legs Gauntlet",
      instructions: "Compound work, then a drop set and a superset finisher. Pick a difficulty per set.",
      roundingIncrementKg: 2.5,
      status: "published",
      categoryId: pplCat.id,
      referenceLifts: {
        create: [
          { referenceLiftId: benchRef.id, displayOrder: 0 },
          { referenceLiftId: rowRef.id, displayOrder: 1 },
          { referenceLiftId: squatRef.id, displayOrder: 2 },
        ],
      },
      rankTiers: {
        create: [
          { name: "Bronze", icon: "🥉", minPoints: 0, displayOrder: 0 },
          { name: "Silver", icon: "🥈", minPoints: 18, displayOrder: 1 },
          { name: "Gold", icon: "🥇", minPoints: 32, displayOrder: 2 },
          { name: "Elite", icon: "👑", minPoints: 44, displayOrder: 3 },
        ],
      },
    },
  });

  let order = 0;
  const addSet = (opts: { label?: string; instructions?: string; points: Triple; parts: { exerciseId: string; referenceLiftId: string; reps?: string; description: string; pct: Triple }[] }) =>
    prisma.workoutSet.create({
      data: {
        workoutId: workout.id,
        setOrder: order++,
        label: opts.label ?? null,
        instructions: opts.instructions ?? null,
        points: { create: pointsRows(opts.points) },
        parts: { create: opts.parts.map((p, i) => ({ partOrder: i, exerciseId: p.exerciseId, referenceLiftId: p.referenceLiftId, reps: p.reps ?? null, description: p.description, percentages: { create: pctRows(p.pct) } })) },
      },
    });

  for (let i = 0; i < 2; i++) await addSet({ points: { easy: 2, hard: 4, brutal: 6 }, parts: [{ exerciseId: bench.id, referenceLiftId: benchRef.id, reps: "8", description: "Controlled tempo", pct: { easy: 60, hard: 75, brutal: 90 } }] });
  for (let i = 0; i < 2; i++) await addSet({ points: { easy: 2, hard: 4, brutal: 6 }, parts: [{ exerciseId: row.id, referenceLiftId: rowRef.id, reps: "10", description: "Strict form", pct: { easy: 60, hard: 75, brutal: 90 } }] });
  for (let i = 0; i < 2; i++) await addSet({ points: { easy: 2, hard: 4, brutal: 6 }, parts: [{ exerciseId: squat.id, referenceLiftId: squatRef.id, reps: "8", description: "Below parallel", pct: { easy: 65, hard: 80, brutal: 92.5 } }] });
  await addSet({ label: "Drop set", instructions: "No rest between the two drops.", points: { easy: 3, hard: 5, brutal: 8 }, parts: [{ exerciseId: bench.id, referenceLiftId: benchRef.id, reps: "6", description: "Top weight to failure", pct: { easy: 75, hard: 82.5, brutal: 90 } }, { exerciseId: bench.id, referenceLiftId: benchRef.id, reps: "AMRAP", description: "Immediate drop — max reps", pct: { easy: 55, hard: 60, brutal: 65 } }] });
  await addSet({ label: "Superset finisher", instructions: "Row then bench, back to back.", points: { easy: 3, hard: 5, brutal: 8 }, parts: [{ exerciseId: row.id, referenceLiftId: rowRef.id, reps: "12", description: "", pct: { easy: 50, hard: 60, brutal: 70 } }, { exerciseId: bench.id, referenceLiftId: benchRef.id, reps: "12", description: "", pct: { easy: 50, hard: 60, brutal: 70 } }] });
}

async function seedChallenges(lifterId: string) {
  // Weight categories (simplified).
  await prisma.weightCategory.createMany({
    data: [
      { name: "M ≤83 kg", gender: "male", minKg: 0, maxKg: 83, displayOrder: 0 },
      { name: "M ≤93 kg", gender: "male", minKg: 83.01, maxKg: 93, displayOrder: 1 },
      { name: "M ≤105 kg", gender: "male", minKg: 93.01, maxKg: 105, displayOrder: 2 },
      { name: "M 105+ kg", gender: "male", minKg: 105.01, maxKg: 400, displayOrder: 3 },
      { name: "F ≤63 kg", gender: "female", minKg: 0, maxKg: 63, displayOrder: 4 },
      { name: "F ≤72 kg", gender: "female", minKg: 63.01, maxKg: 72, displayOrder: 5 },
      { name: "F 72+ kg", gender: "female", minKg: 72.01, maxKg: 400, displayOrder: 6 },
    ],
  });

  // Experience classes (replace the old hardcoded tiers).
  await prisma.experienceClass.createMany({
    data: ["Novice", "Intermediate", "Advanced", "Elite"].map((name, i) => ({ name, displayOrder: i })),
  });
  const expClasses = await prisma.experienceClass.findMany();
  const expByName = new Map(expClasses.map((e) => [e.name.toLowerCase(), e.id]));
  const allCats = await prisma.weightCategory.findMany();
  const rangeCats = allCats.map((c) => ({ id: c.id, gender: c.gender ?? "", minKg: c.minKg ?? 0, maxKg: c.maxKg ?? 0 }));

  const season = await prisma.season.create({
    data: { name: "Summer 2026", startsAt: new Date("2026-06-01"), endsAt: new Date("2026-08-31"), isActive: true },
  });

  const bench = await prisma.exerciseLibrary.findFirst({ where: { name: "Barbell Bench Press" } });
  const squat = await prisma.exerciseLibrary.findFirst({ where: { name: "Back Squat" } });
  if (!bench || !squat) return;

  const benchChallenge = await prisma.challenge.create({
    data: {
      exerciseId: bench.id,
      title: "Bench Press 1RM Showdown",
      description: "Heaviest single, paused on the chest. Bodyweight-fair (DOTS) board decides the champion.",
      challengeType: "max_weight",
      scoringType: "relative_dots",
      unitLabel: "kg",
      startsAt: new Date("2026-06-22"),
      endsAt: new Date("2026-06-29"),
      isDaily: false,
      status: "published",
      seasonId: season.id,
    },
  });

  const squatChallenge = await prisma.challenge.create({
    data: {
      exerciseId: squat.id,
      title: "Daily Squat Rep-Out",
      description: "Most reps at bodyweight on the bar in one set. Today only.",
      challengeType: "max_reps",
      scoringType: "absolute",
      unitLabel: "reps",
      startsAt: new Date("2026-06-23"),
      endsAt: new Date("2026-06-24"),
      isDaily: true,
      status: "published",
      seasonId: season.id,
    },
  });

  // Demo opponents so the leaderboards are populated.
  const dimitri = await ensureUser("dimitri@ironrank.test", false, {
    username: "dimitri", displayName: "Dimitri V.", gender: "male", bodyweightKg: 105, experienceTier: "advanced", preferredUnits: "kg",
  });
  const sara = await ensureUser("sara@ironrank.test", false, {
    username: "sara", displayName: "Sara K.", gender: "female", bodyweightKg: 62, experienceTier: "intermediate", preferredUnits: "kg",
  });

  // Assign classes to every profile (now that demo users exist).
  for (const p of await prisma.profile.findMany()) {
    await prisma.profile.update({
      where: { id: p.id },
      data: {
        experienceClassId: expByName.get((p.experienceTier ?? "novice").toLowerCase()) ?? null,
        weightClassId: resolveWeightCategory(rangeCats, p.gender, p.bodyweightKg)?.id ?? null,
      },
    });
  }

  const profiles = new Map(
    (await prisma.profile.findMany({ where: { userId: { in: [lifterId, dimitri.id, sara.id] } } })).map((p) => [p.userId, p])
  );

  async function submit(challengeId: string, type: ChallengeType, scoring: ScoringType, userId: string, raw: number, status: string, video?: string) {
    const p = profiles.get(userId);
    const bw = p?.bodyweightKg ?? null;
    const sex = sexOf(p?.gender ?? "");
    await prisma.submission.create({
      data: {
        challengeId,
        userId,
        rawValue: raw,
        bodyweightAtAttemptKg: bw,
        computedScore: primaryScore(raw, type, scoring, bw, sex),
        videoUrl: video ?? null,
        verificationStatus: status,
        weightClassId: resolveWeightCategory(rangeCats, p?.gender ?? "", bw)?.id ?? null,
        experienceClassId: p?.experienceClassId ?? null,
        createdAt: new Date("2026-06-23T10:00:00"),
      },
    });
  }

  // Bench (relative DOTS): Sara is lighter, so she should top the relative board.
  await submit(benchChallenge.id, "max_weight", "relative_dots", lifterId, 132.5, "verified", "https://youtu.be/dQw4w9WgXcQ");
  await submit(benchChallenge.id, "max_weight", "relative_dots", dimitri.id, 150, "verified", "https://youtu.be/dQw4w9WgXcQ");
  await submit(benchChallenge.id, "max_weight", "relative_dots", sara.id, 92.5, "verified", "https://youtu.be/dQw4w9WgXcQ");

  // Daily squat reps (absolute): a pending one to show the review queue.
  await submit(squatChallenge.id, "max_reps", "absolute", lifterId, 24, "verified", "https://youtu.be/dQw4w9WgXcQ");
  await submit(squatChallenge.id, "max_reps", "absolute", sara.id, 28, "verified", "https://youtu.be/dQw4w9WgXcQ");
  await submit(squatChallenge.id, "max_reps", "absolute", dimitri.id, 20, "pending", "https://youtu.be/dQw4w9WgXcQ");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
