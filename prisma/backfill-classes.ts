import { PrismaClient } from "@prisma/client";
import { resolveWeightCategory } from "../src/lib/shared/challenge";

const prisma = new PrismaClient();

const TIERS = ["Novice", "Intermediate", "Advanced", "Elite"];

async function main() {
  // 1. Experience classes from the old hardcoded tiers.
  if ((await prisma.experienceClass.count()) === 0) {
    await prisma.experienceClass.createMany({
      data: TIERS.map((name, i) => ({ name, displayOrder: i, isActive: true })),
    });
    console.log("Created experience classes:", TIERS.join(", "));
  }
  const expClasses = await prisma.experienceClass.findMany();
  const expByName = new Map(expClasses.map((e) => [e.name.toLowerCase(), e.id]));

  // 2. Weight-category ordering / activation back-fill.
  const cats = await prisma.weightCategory.findMany({ orderBy: { name: "asc" } });
  for (let i = 0; i < cats.length; i++) {
    await prisma.weightCategory.update({ where: { id: cats[i].id }, data: { displayOrder: i, isActive: true } });
  }
  const rangeCats = cats.map((c) => ({ id: c.id, gender: c.gender ?? "", minKg: c.minKg ?? 0, maxKg: c.maxKg ?? 0 }));

  // 3. Profiles: map tier -> experienceClassId; resolve weight class from stats.
  const profiles = await prisma.profile.findMany();
  for (const p of profiles) {
    const experienceClassId = p.experienceClassId ?? expByName.get((p.experienceTier ?? "novice").toLowerCase()) ?? null;
    const weightClassId = p.weightClassId ?? resolveWeightCategory(rangeCats, p.gender, p.bodyweightKg)?.id ?? null;
    await prisma.profile.update({ where: { id: p.id }, data: { experienceClassId, weightClassId } });
  }
  console.log(`Back-filled ${profiles.length} profiles.`);

  // 4. Submissions: snapshot class IDs from the submitter's profile + bodyweight.
  const subs = await prisma.submission.findMany({ include: { user: { select: { profile: true } } } });
  let n = 0;
  for (const s of subs) {
    if (s.weightClassId || s.experienceClassId) continue;
    const prof = s.user.profile;
    const wc = resolveWeightCategory(rangeCats, prof?.gender ?? "", s.bodyweightAtAttemptKg ?? prof?.bodyweightKg ?? null)?.id ?? null;
    await prisma.submission.update({
      where: { id: s.id },
      data: { weightClassId: wc, experienceClassId: prof?.experienceClassId ?? null },
    });
    n++;
  }
  console.log(`Back-filled ${n} submissions.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
