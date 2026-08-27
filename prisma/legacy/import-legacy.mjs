// Imports the legacy Strength Syndicate workouts (parsed from the old static site)
// into the current schema. Idempotent-ish: re-running replaces the imported
// workouts, and reuses existing exercises / reference lifts by name.
//
//   node -r dotenv/config prisma/legacy/import-legacy.mjs [--publish]
//
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DATA = JSON.parse(fs.readFileSync("prisma/legacy/strength-syndicate.json", "utf8"));
const PUBLISH = process.argv.includes("--publish");

const DIFFS = ["easy", "hard", "brutal"];
const SKIP_FILES = new Set(["bodyweight", "bodyweight2"]); // battle-game format — dropped per request
const SKIP_REF_LABELS = [/^dont ?fill/i];                  // "DONT FILL!" placeholder ref

// Confirmed source typos: set 9 of the same exercise uses 90%, sets 10 & 11 slipped
// to 0.1 / 0.11. (Other non-monotonic percentages are intentional — higher reps at
// lower load — and are imported untouched.)
const PCT_FIXES = [
  { file: "bicepsblitz", setNo: 10, difficulty: "brutal", to: 90 },
  { file: "bicepsblitz", setNo: 11, difficulty: "brutal", to: 90 },
];

const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const normKey = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const ytId = (url) => {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
};

const CATEGORY_META = {
  "Bro Split Workouts": { imageRef: "💪", description: "Isolation-focused split sessions.", order: 0 },
  "Push-Pull-Legs": { imageRef: "🔁", description: "Rotating push, pull and leg sessions.", order: 1 },
};

async function main() {
  const stats = { categories: 0, refLifts: 0, exercises: 0, workouts: 0, sets: 0, parts: 0, pctFixes: 0 };

  // ---------- 1. categories ----------
  const categoryByName = new Map();
  for (const group of DATA.catalogue) {
    const items = group.items.filter((i) => !SKIP_FILES.has(i.file));
    if (!items.length) continue; // drops the now-empty "Bodyweight Challenges"
    const meta = CATEGORY_META[group.category] ?? { imageRef: "🏋️", description: "", order: 9 };
    let cat = await prisma.workoutCategory.findFirst({ where: { name: group.category } });
    if (!cat) {
      cat = await prisma.workoutCategory.create({
        data: { name: group.category, imageRef: meta.imageRef, description: meta.description, displayOrder: meta.order },
      });
      stats.categories++;
    }
    categoryByName.set(group.category, cat);
  }

  // ---------- 2. reference lifts (deduped by normalised label) ----------
  const refCache = new Map(); // normKey -> ReferenceLift
  const ensureRefLift = async (label) => {
    const key = normKey(label);
    if (refCache.has(key)) return refCache.get(key);
    let lift = (await prisma.referenceLift.findMany()).find((l) => normKey(l.name) === key);
    if (!lift) {
      lift = await prisma.referenceLift.create({
        data: { name: clean(label), description: "Imported from Strength Syndicate", unit: "kg" },
      });
      stats.refLifts++;
    }
    refCache.set(key, lift);
    return lift;
  };
  // shared lift for bodyweight-only parts (schema requires a reference lift per part)
  const bodyweightLift = await ensureRefLift("Bodyweight");

  // ---------- 3. exercises (deduped by normalised name) ----------
  const exCache = new Map();
  const ensureExercise = async (name, notes, video) => {
    const key = normKey(name);
    if (exCache.has(key)) return exCache.get(key);
    let ex = (await prisma.exerciseLibrary.findMany()).find((e) => normKey(e.name) === key);
    if (!ex) {
      ex = await prisma.exerciseLibrary.create({
        data: {
          name: clean(name),
          instructions: (notes ?? []).map(clean).filter(Boolean).join("\n"),
          youtubeVideoId: ytId(video),
          status: "published",
        },
      });
      stats.exercises++;
    }
    exCache.set(key, ex);
    return ex;
  };

  // ---------- 4. workouts ----------
  for (const group of DATA.catalogue) {
    const cat = categoryByName.get(group.category);
    if (!cat) continue;

    for (const item of group.items) {
      if (SKIP_FILES.has(item.file)) continue;
      const w = DATA.workouts[item.file];
      if (!w || w.skipped) continue;

      // replace any previous import of this workout
      const existing = await prisma.workout.findFirst({ where: { title: item.name } });
      if (existing) await prisma.workout.delete({ where: { id: existing.id } });

      const refs = w.refs.filter((r) => !SKIP_REF_LABELS.some((re) => re.test(r.label)));
      const refLiftByOldId = new Map();
      for (const r of refs) refLiftByOldId.set(r.id, await ensureRefLift(r.label));

      const workout = await prisma.workout.create({
        data: {
          title: item.name,
          instructions: clean(w.guide).slice(0, 2000),
          roundingIncrementKg: 2.5,
          status: PUBLISH ? "published" : "draft",
          categoryId: cat.id,
          referenceLifts: {
            create: refs.map((r, i) => ({ referenceLiftId: refLiftByOldId.get(r.id).id, displayOrder: i })),
          },
          rankTiers: {
            // benchmark from the old app = the "challenge completed" threshold -> Gold
            create: [
              { name: "Bronze", icon: "🥉", minPoints: 0, displayOrder: 0 },
              { name: "Silver", icon: "🥈", minPoints: Math.round(w.benchmark * 0.6), displayOrder: 1 },
              { name: "Gold", icon: "🥇", minPoints: w.benchmark, displayOrder: 2 },
              { name: "Elite", icon: "👑", minPoints: Math.round(w.benchmark * 1.25), displayOrder: 3 },
            ],
          },
        },
      });
      stats.workouts++;

      // ---------- 5. sets + parts ----------
      let setOrder = 0;
      for (const sec of w.sections) {
        const exercise = await ensureExercise(sec.exercise, sec.notes, sec.video);

        for (const s of sec.sets) {
          if (!s.difficulties) continue;
          const partCount = Math.max(...DIFFS.map((d) => (s.difficulties[d] || []).length));
          if (!partCount) continue;

          const set = await prisma.workoutSet.create({
            data: {
              workoutId: workout.id,
              setOrder: setOrder++,
              label: clean(sec.exercise) || null,
              instructions: (sec.notes ?? []).map(clean).filter(Boolean).join(" · ") || null,
              points: { create: DIFFS.map((d) => ({ difficulty: d, points: w.points[d] })) },
            },
          });
          stats.sets++;

          for (let i = 0; i < partCount; i++) {
            const byDiff = Object.fromEntries(DIFFS.map((d) => [d, (s.difficulties[d] || [])[i] ?? null]));
            const anyPart = byDiff.hard ?? byDiff.easy ?? byDiff.brutal;
            if (!anyPart) continue;

            // bodyweight / literal-load parts have no reference lift -> Bodyweight @ 0%
            const isLiteral = anyPart.pct == null;
            const oldRef = DIFFS.map((d) => byDiff[d]?.ref).find(Boolean);
            const lift = isLiteral || !oldRef ? bodyweightLift : refLiftByOldId.get(oldRef) ?? bodyweightLift;

            const literalNote = DIFFS.map((d) => byDiff[d]?.literal).find(Boolean);
            const partLabel = clean(s.partLabels?.[i] ?? "");
            const description = [partLabel && partLabel !== "Start" ? partLabel : "", literalNote ? clean(literalNote) : ""]
              .filter(Boolean)
              .join(" · ");

            const part = await prisma.workoutSetPart.create({
              data: {
                workoutSetId: set.id,
                partOrder: i,
                exerciseId: exercise.id,
                referenceLiftId: lift.id,
                reps: clean(byDiff.hard?.reps ?? anyPart.reps ?? "") || null,
                description,
              },
            });
            stats.parts++;

            for (const d of DIFFS) {
              const p = byDiff[d];
              if (!p) continue;
              let pct = p.pct ?? 0;
              const fix = PCT_FIXES.find((f) => f.file === item.file && f.setNo === s.setNo && f.difficulty === d);
              if (fix) { pct = fix.to; stats.pctFixes++; }
              await prisma.workoutSetPartPercentage.create({
                data: { workoutSetPartId: part.id, difficulty: d, percentage: pct, reps: clean(p.reps ?? "") || null },
              });
            }
          }
        }
      }
      console.log(`  ✓ ${item.name}  (${w.sections.length} exercises, ${w.totalSets} sets)`);
    }
  }

  console.log("\nImported:", JSON.stringify(stats, null, 1));
  console.log(`Workouts created as ${PUBLISH ? "PUBLISHED" : "DRAFT"}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
