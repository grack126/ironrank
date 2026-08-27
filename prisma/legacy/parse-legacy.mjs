import fs from "fs";
const DIR = "C:/Users/workl/AppData/Local/Temp/ss";
const INDEX = "C:/Users/workl/AppData/Local/Temp/ss_index.html";
const strip = (s) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const rx = (s, f) => new RegExp(s, f);

// ---- 1. authoritative catalogue from index.html ----
function parseIndex() {
  const html = fs.readFileSync(INDEX, "utf8");
  const cats = [];
  const groupRe = /<h3>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3>|<\/main|<footer|$)/g;
  let g;
  while ((g = groupRe.exec(html))) {
    const category = strip(g[1]);
    const items = [];
    const cardRe = /<a href="([^"]+\.html)"([^>]*)>([\s\S]*?)<\/a>/g;
    let c;
    while ((c = cardRe.exec(g[2]))) {
      const file = c[1].replace(/\.html$/, "");
      const attrs = c[2] || "";
      const body = c[3];
      items.push({
        file,
        name: strip(body.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] || ""),
        xp: Number(strip(body.match(/<span class="badge">([\s\S]*?)<\/span>/)?.[1] || "").replace(/[^0-9]/g, "")) || null,
        note: strip(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] || ""),
        locked: /locked/.test(attrs),
      });
    }
    if (items.length) cats.push({ category, items });
  }
  return cats;
}

// ---- 2. per-workout detail ----
function parseWorkout(file) {
  const html = fs.readFileSync(DIR + "/" + file + ".html", "utf8");
  const js = fs.readFileSync(DIR + "/" + file + ".js", "utf8");

  const h1 = strip(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || "");
  const guide = [...html.matchAll(/<div class="dropdown-content"[\s\S]*?>([\s\S]*?)<\/div>/g)]
    .map((m) => strip(m[1])).filter(Boolean).join(" ");

  const refs = [];
  const refRe = /<label>([^<]*)<\/label>\s*<input[^>]*id="(ref[A-Za-z]+)"/g;
  let m;
  while ((m = refRe.exec(html))) refs.push({ id: m[2], label: strip(m[1]) });

  // exercise sections -> their sets (only detail-boxes carrying a difficultySet id)
  const sections = [];
  const secRe = /<div class="training-details">([\s\S]*?)(?=<div class="training-details">|<div class="result|<footer|$)/g;
  while ((m = secRe.exec(html))) {
    const block = m[1];
    const name = strip(block.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] || "");
    if (!name || /REFERENCE WEIGHTS/i.test(name) || /discord/i.test(name)) continue;
    const lis = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((x) => strip(x[1])).filter(Boolean);
    const video = block.match(/href="(https:\/\/[^"]*(?:youtu|youtube)[^"]*)"/)?.[1] || null;
    const boxes = [...block.matchAll(/<div class="detail-box">([\s\S]*?)(?=<div class="detail-box">|$)/g)].map((b) => b[1]);
    const sets = [];
    for (const b of boxes) {
      const setNo = b.match(/id="difficultySet(\d+)"/)?.[1];
      if (!setNo) continue;
      const labels = [...b.matchAll(/<td class="label">([^<]*)<\/td>/g)]
        .map((x) => strip(x[1]))
        .filter((t) => t && !/^Volume$/i.test(t) && !/^Res\./i.test(t));
      sets.push({ setNo: Number(setNo), partLabels: labels });
    }
    sections.push({ exercise: name, notes: lis.filter((d) => !/Video Reference/i.test(d)), video, sets });
  }

  // JS numbers
  const points = {
    easy: Number(js.match(/difficulty === "easy"\) return (\d+)/)?.[1] ?? 5),
    hard: Number(js.match(/difficulty === "hard"\) return (\d+)/)?.[1] ?? 10),
    brutal: Number(js.match(/difficulty === "brutal"\) return (\d+)/)?.[1] ?? 15),
  };
  const benchmark = Number(js.match(/successBenchmark\s*=\s*(\d+)/)?.[1] ?? 0);

  const jsSets = {};
  const fnRe = /const Set(\d+)\s*=\s*\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\n\s*\};/g;
  while ((m = fnRe.exec(js))) {
    const n = Number(m[1]);
    const body = m[3];
    const diffs = {};
    for (const d of ["easy", "hard", "brutal"]) {
      const seg = body.match(rx('difficultySet' + n + ' === "' + d + '"\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}'))?.[1] || "";
      const parts = [];
      for (const p of [1, 2]) {
        const volM = seg.match(rx('Set' + n + 'Vol' + p + '\\.innerHTML\\s*=\\s*["\'`]([^"\'`]*)'));
        const resM = seg.match(rx('Set' + n + 'Res' + p + '\\.innerHTML\\s*=\\s*([^;]+);'));
        if (!volM && !resM) continue;
        let ref = null, pct = null, literal = null;
        if (resM) {
          const line = resM[1];
          const mm = line.match(/(ref[A-Za-z]+)\s*\*\s*([0-9.]+)/);
          if (mm) { ref = mm[1]; pct = Math.round(Number(mm[2]) * 1000) / 10; }
          else {
            const direct = line.match(/^\s*(?:Math\.round\(\s*)?(ref[A-Za-z]+)\s*\)?\s*$/);
            if (direct) { ref = direct[1]; pct = 100; }
            else literal = strip(line).replace(/^["'`]|["'`]$/g, "");
          }
        }
        parts.push({ part: p, reps: volM ? strip(volM[1]) : null, ref, pct, literal });
      }
      diffs[d] = parts;
    }
    jsSets[n] = diffs;
  }

  // merge: attach js numbers to each html set
  for (const sec of sections) {
    for (const s of sec.sets) s.difficulties = jsSets[s.setNo] ?? null;
  }
  const usedSetNos = new Set(sections.flatMap((s) => s.sets.map((x) => x.setNo)));
  const orphanJsSets = Object.keys(jsSets).map(Number).filter((n) => !usedSetNos.has(n));

  return { file, h1, guide, refs, sections, points, benchmark, orphanJsSets, totalSets: usedSetNos.size };
}

const catalogue = parseIndex();
const result = { catalogue, workouts: {} };
const BODYWEIGHT = new Set(["bodyweight", "bodyweight2"]);
for (const c of catalogue) {
  for (const it of c.items) {
    if (BODYWEIGHT.has(it.file)) { result.workouts[it.file] = { file: it.file, format: "battle-game", skipped: true }; continue; }
    result.workouts[it.file] = { category: c.category, ...it, ...parseWorkout(it.file) };
  }
}
fs.mkdirSync(DIR + "/out", { recursive: true });
fs.writeFileSync(DIR + "/out/workouts.json", JSON.stringify(result, null, 2));

for (const c of catalogue) {
  console.log("\n## " + c.category);
  for (const it of c.items) {
    const w = result.workouts[it.file];
    if (w.skipped) { console.log("  - " + it.name + "  [" + it.file + "]  ** battle-game format, not parsed **"); continue; }
    console.log("  - " + it.name + "  [" + it.file + "]  xp=" + it.xp + "  " + it.note +
      "\n      refs=" + w.refs.length + " (" + w.refs.map((r) => r.label).join(", ") + ")" +
      "\n      exercises=" + w.sections.length + " sets=" + w.totalSets + " benchmark=" + w.benchmark +
      (w.orphanJsSets.length ? "  [unused js sets: " + w.orphanJsSets.join(",") + "]" : ""));
  }
}
