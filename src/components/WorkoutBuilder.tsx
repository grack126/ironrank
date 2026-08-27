"use client";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveWorkoutAction,
  createReferenceLift,
  type BuilderPayload,
} from "@/app/admin/admin-actions";
import { uploadWorkoutImageAction } from "@/app/admin/upload-actions";
import { maxWorkoutPoints, validateRankTiers, type Difficulty } from "@/lib/shared/workout";
import { IconX, IconWarn } from "@/components/ui/icons";

type Triple = { easy: string; hard: string; brutal: string };
type PartRow = { exerciseId: string; label: string; referenceLiftId: string; reps: string; description: string; pct: Triple; repsByDiff: Triple };
type SetRow = { label: string; instructions: string; points: Triple; parts: PartRow[] };
type TierRow = { name: string; icon: string; minPoints: string };

const DIFFS: Difficulty[] = ["easy", "hard", "brutal"];
const emptyTriple = (): Triple => ({ easy: "", hard: "", brutal: "" });
const numTriple = (t: Triple) => ({
  easy: Number(t.easy) || 0,
  hard: Number(t.hard) || 0,
  brutal: Number(t.brutal) || 0,
});
const tripleFilled = (t: Triple) => DIFFS.every((d) => t[d] !== "" && !isNaN(Number(t[d])));

export interface BuilderOptions {
  exercises: { id: string; name: string }[];
  referenceLifts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}
export interface BuilderInitial {
  id: string;
  title: string;
  instructions: string;
  roundingIncrementKg: number;
  status: string;
  categoryId: string | null;
  backgroundImagePath: string | null;
  referenceLiftIds: string[];
  rankTiers: { name: string; icon: string; minPoints: number }[];
  sets: {
    label: string | null;
    instructions: string | null;
    points: { difficulty: string; points: number }[];
    parts: {
      exerciseId: string;
      label: string | null;
      referenceLiftId: string;
      reps: string | null;
      description: string;
      percentages: { difficulty: string; percentage: number; reps: string | null }[];
    }[];
  }[];
}

function rowsToTriple(rows: { difficulty: string; value: number }[]): Triple {
  const t = emptyTriple();
  for (const r of rows) (t as Record<string, string>)[r.difficulty] = String(r.value);
  return t;
}
/** Same as rowsToTriple but for free-text values (per-difficulty reps). */
function strTriple(rows: { difficulty: string; value: string }[]): Triple {
  const t = emptyTriple();
  for (const r of rows) (t as Record<string, string>)[r.difficulty] = r.value;
  return t;
}

export function WorkoutBuilder({ options, initial }: { options: BuilderOptions; initial?: BuilderInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [increment, setIncrement] = useState(String(initial?.roundingIncrementKg ?? 2.5));
  const [refOptions, setRefOptions] = useState(options.referenceLifts);
  const [refIds, setRefIds] = useState<string[]>(initial?.referenceLiftIds ?? []);
  const [sets, setSets] = useState<SetRow[]>(
    initial?.sets.map((s) => ({
      label: s.label ?? "",
      instructions: s.instructions ?? "",
      points: rowsToTriple(s.points.map((p) => ({ difficulty: p.difficulty, value: p.points }))),
      parts: s.parts.map((p) => ({
        exerciseId: p.exerciseId,
        label: p.label ?? "",
        referenceLiftId: p.referenceLiftId,
        reps: p.reps ?? "",
        description: p.description,
        pct: rowsToTriple(p.percentages.map((x) => ({ difficulty: x.difficulty, value: x.percentage }))),
        repsByDiff: strTriple(p.percentages.map((x) => ({ difficulty: x.difficulty, value: x.reps ?? "" }))),
      })),
    })) ?? []
  );
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? options.categories[0]?.id ?? "");
  const [bgImage, setBgImage] = useState<string | null>(initial?.backgroundImagePath ?? null);
  const [uploading, setUploading] = useState(false);
  const [tiers, setTiers] = useState<TierRow[]>(
    initial?.rankTiers.map((t) => ({ name: t.name, icon: t.icon, minPoints: String(t.minPoints) })) ?? [
      { name: "Bronze", icon: "🥉", minPoints: "0" },
    ]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // inline reference-lift create
  const [newRef, setNewRef] = useState({ name: "", unit: "kg", description: "" });
  const [refBusy, setRefBusy] = useState(false);
  const [addExisting, setAddExisting] = useState("");

  const refName = (id: string) => refOptions.find((r) => r.id === id)?.name ?? "—";
  const exName = (id: string) => options.exercises.find((e) => e.id === id)?.name ?? "—";
  const firstPart = (): PartRow => ({
    exerciseId: "",
    label: "",
    referenceLiftId: refIds[0] ?? "",
    reps: "",
    description: "",
    pct: emptyTriple(),
    repsByDiff: emptyTriple(),
  });

  async function onUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadWorkoutImageAction(fd);
    setUploading(false);
    if (!res.ok) return setError(res.error);
    setBgImage(res.path);
  }

  // ---- live calc / validation ----
  const maxPts = useMemo(
    () => maxWorkoutPoints(sets.map((s) => DIFFS.map((d) => ({ difficulty: d, points: Number(s.points[d]) || 0 })))),
    [sets]
  );
  const tierIssues = useMemo(
    () => validateRankTiers(tiers.map((t, i) => ({ id: String(i), name: t.name, minPoints: Number(t.minPoints) || 0 })), maxPts),
    [tiers, maxPts]
  );
  const warnings = useMemo(() => {
    const w: string[] = [];
    if (refIds.length === 0) w.push("Add at least one required reference lift.");
    sets.forEach((s, si) => {
      if (s.parts.length === 0) w.push(`Set ${si + 1}: add at least one part.`);
      if (!tripleFilled(s.points)) w.push(`Set ${si + 1}: fill points for easy, hard and brutal.`);
      s.parts.forEach((p, pi) => {
        if (!p.exerciseId) w.push(`Set ${si + 1}, part ${pi + 1}: pick an exercise.`);
        if (!p.referenceLiftId || !refIds.includes(p.referenceLiftId))
          w.push(`Set ${si + 1}, part ${pi + 1}: pick a reference lift from this workout's list.`);
        if (!tripleFilled(p.pct)) w.push(`Set ${si + 1}, part ${pi + 1}: fill percentages for all three difficulties.`);
      });
    });
    return w;
  }, [sets, refIds]);

  // ---- reference-lift list mutators ----
  function addExistingRef(id: string) {
    if (id && !refIds.includes(id)) setRefIds((c) => [...c, id]);
    setAddExisting("");
  }
  function removeRef(id: string) {
    setRefIds((c) => c.filter((x) => x !== id));
    setSets((cur) => cur.map((s) => ({ ...s, parts: s.parts.map((p) => (p.referenceLiftId === id ? { ...p, referenceLiftId: "" } : p)) })));
  }
  function moveRef(i: number, dir: -1 | 1) {
    setRefIds((c) => {
      const next = [...c];
      const j = i + dir;
      if (j < 0 || j >= next.length) return c;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  async function createInlineRef() {
    if (!newRef.name.trim()) return;
    setRefBusy(true);
    const res = await createReferenceLift(newRef);
    setRefBusy(false);
    if (!res.ok) return setError(res.error);
    setRefOptions((c) => [...c, { id: res.lift.id, name: res.lift.name }]);
    setRefIds((c) => [...c, res.lift.id]);
    setNewRef({ name: "", unit: "kg", description: "" });
  }

  // ---- set / part mutators ----
  const updateSet = (i: number, patch: Partial<SetRow>) => setSets((c) => c.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  // Consecutive sets that use the same exercise(s) render as ONE exercise box in the
  // player (name/description/demo shown once, sets nested). Keep them adjacent here.
  const signature = (s: SetRow) => s.parts.map((p) => p.exerciseId).join("|");
  const groupStartsAt = (i: number) => i === 0 || signature(sets[i]) !== signature(sets[i - 1]);
  const groupEndIndex = (start: number) => {
    let end = start;
    while (end + 1 < sets.length && signature(sets[end + 1]) === signature(sets[start])) end++;
    return end;
  };
  /** Point every part of this exercise box at one exercise (drives description + demo). */
  const setGroupExercise = (start: number, exerciseId: string) => {
    const end = groupEndIndex(start);
    setSets((c) =>
      c.map((s, i) => (i >= start && i <= end ? { ...s, parts: s.parts.map((p) => ({ ...p, exerciseId })) } : s))
    );
  };
  const groupExerciseNames = (i: number) =>
    sets[i].parts
      .map((p) => options.exercises.find((e) => e.id === p.exerciseId)?.name ?? "—")
      .filter((n, idx, arr) => arr.indexOf(n) === idx)
      .join(" + ");

  const addSet = () => setSets((c) => [...c, { label: "", instructions: "", points: emptyTriple(), parts: [firstPart()] }]);
  const removeSet = (i: number) => setSets((c) => c.filter((_, idx) => idx !== i));
  const duplicateSet = (i: number, copies = 1) =>
    setSets((c) => {
      const clone = JSON.parse(JSON.stringify(c[i])) as SetRow;
      const next = [...c];
      next.splice(i + 1, 0, ...Array.from({ length: copies }, () => JSON.parse(JSON.stringify(clone))));
      return next;
    });
  const moveSet = (i: number, dir: -1 | 1) =>
    setSets((c) => {
      const next = [...c];
      const j = i + dir;
      if (j < 0 || j >= next.length) return c;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const setPoints = (i: number, d: Difficulty, v: string) =>
    setSets((c) => c.map((s, idx) => (idx === i ? { ...s, points: { ...s.points, [d]: v } } : s)));

  const updatePart = (si: number, pi: number, patch: Partial<PartRow>) =>
    setSets((c) => c.map((s, idx) => (idx === si ? { ...s, parts: s.parts.map((p, j) => (j === pi ? { ...p, ...patch } : p)) } : s)));
  // A new part inherits the set's exercise, so the set stays in its exercise box.
  const addPart = (si: number) =>
    setSets((c) =>
      c.map((s, idx) =>
        idx === si ? { ...s, parts: [...s.parts, { ...firstPart(), exerciseId: s.parts[0]?.exerciseId ?? "" }] } : s
      )
    );
  const removePart = (si: number, pi: number) =>
    setSets((c) => c.map((s, idx) => (idx === si ? { ...s, parts: s.parts.filter((_, j) => j !== pi) } : s)));
  const duplicatePart = (si: number, pi: number) =>
    setSets((c) =>
      c.map((s, idx) => {
        if (idx !== si) return s;
        const parts = [...s.parts];
        parts.splice(pi + 1, 0, JSON.parse(JSON.stringify(parts[pi])));
        return { ...s, parts };
      })
    );
  const movePart = (si: number, pi: number, dir: -1 | 1) =>
    setSets((c) =>
      c.map((s, idx) => {
        if (idx !== si) return s;
        const parts = [...s.parts];
        const j = pi + dir;
        if (j < 0 || j >= parts.length) return s;
        [parts[pi], parts[j]] = [parts[j], parts[pi]];
        return { ...s, parts };
      })
    );
  const updatePartPct = (si: number, pi: number, d: Difficulty, v: string) =>
    setSets((c) => c.map((s, idx) => (idx === si ? { ...s, parts: s.parts.map((p, j) => (j === pi ? { ...p, pct: { ...p.pct, [d]: v } } : p)) } : s)));
  /** Per-difficulty reps — free text, blank falls back to the part's default reps. */
  const updatePartReps = (si: number, pi: number, d: Difficulty, v: string) =>
    setSets((c) =>
      c.map((s, idx) =>
        idx === si ? { ...s, parts: s.parts.map((p, j) => (j === pi ? { ...p, repsByDiff: { ...p.repsByDiff, [d]: v } } : p)) } : s
      )
    );

  // ---- tiers ----
  const addTier = () => setTiers((c) => [...c, { name: "", icon: "🏅", minPoints: "" }]);
  const updateTier = (i: number, patch: Partial<TierRow>) => setTiers((c) => c.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeTier = (i: number) => setTiers((c) => c.filter((_, idx) => idx !== i));

  function buildPayload(status: "draft" | "published"): BuilderPayload {
    return {
      id: initial?.id,
      title,
      instructions,
      roundingIncrementKg: Number(increment) || 2.5,
      status,
      categoryId,
      backgroundImagePath: bgImage,
      referenceLiftIds: refIds,
      rankTiers: tiers.filter((t) => t.name.trim() !== "").map((t) => ({ name: t.name, icon: t.icon || "🏅", minPoints: Number(t.minPoints) || 0 })),
      sets: sets.map((s) => ({
        label: s.label,
        instructions: s.instructions,
        points: numTriple(s.points),
        parts: s.parts.map((p) => ({
          exerciseId: p.exerciseId,
          label: p.label,
          referenceLiftId: p.referenceLiftId,
          reps: p.reps,
          description: p.description,
          percentages: numTriple(p.pct),
          repsByDifficulty: p.repsByDiff,
        })),
      })),
    };
  }

  async function save(status: "draft" | "published") {
    setError(null);
    if (!title.trim()) return setError("Title is required");
    if (!categoryId) return setError("Pick a category");
    setSaving(true);
    const res = await saveWorkoutAction(buildPayload(status));
    setSaving(false);
    if (!res.ok) return setError(res.error);
    router.push("/admin/workouts");
  }

  const unusedRefs = refOptions.filter((r) => !refIds.includes(r.id));

  return (
    <div className="stack">
      {/* 1. Details */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>1. Workout details</h2>
        <div className="stack">
          <div>
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Push day gauntlet" />
          </div>
          <div>
            <label>Category</label>
            {options.categories.length === 0 ? (
              <p className="muted small">No categories yet — create one under Admin → Workout categories.</p>
            ) : (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="" disabled>Choose a category…</option>
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label>Instructions</label>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} />
          </div>
          <div>
            <label>Weight rounding increment (kg)</label>
            <input type="number" step="0.5" value={increment} onChange={(e) => setIncrement(e.target.value)} />
          </div>
          <div>
            <label>Card background image (optional)</label>
            {bgImage && (
              <div className="card-bg-preview" style={{ backgroundImage: `url(${bgImage})` }}>
                <span className="card-bg-scrim" />
                <span style={{ position: "relative", zIndex: 2 }}>Preview</span>
              </div>
            )}
            <div className="row" style={{ gap: 6, marginTop: bgImage ? 8 : 0 }}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} disabled={uploading} />
              {bgImage && <button type="button" className="btn ghost sm auto" onClick={() => setBgImage(null)}>Remove</button>}
            </div>
            <p className="tiny faint" style={{ marginTop: 4 }}>{uploading ? "Uploading…" : "Recommended: 800 × 450 px (16:9), JPEG or WebP, under 500 KB. Displayed as a rounded card background (~360 px wide on mobile); crop the subject toward the center — edges may be clipped."}</p>
          </div>
        </div>
      </div>

      {/* 2. Required reference lifts */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>2. Required reference lifts</h2>
        <p className="muted small">Users enter these before starting. Reorder, remove, or add — any number.</p>
        {refIds.length === 0 && <p className="muted small">None yet — add one below.</p>}
        <div className="stack-2">
          {refIds.map((id, i) => (
            <div key={id} className="row" style={{ gap: 6 }}>
              <span className="pill mono" style={{ minWidth: 22, justifyContent: "center" }}>{i + 1}</span>
              <span className="grow">{refName(id)}</span>
              <button className="btn ghost sm auto" onClick={() => moveRef(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button className="btn ghost sm auto" onClick={() => moveRef(i, 1)} disabled={i === refIds.length - 1} aria-label="Move down">↓</button>
              <button className="btn ghost sm auto" onClick={() => removeRef(id)} aria-label="Remove"><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
            </div>
          ))}
        </div>

        <div className="divider" />
        {unusedRefs.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label>Add from catalogue</label>
            <select value={addExisting} onChange={(e) => addExistingRef(e.target.value)}>
              <option value="">Choose a reference lift…</option>
              {unusedRefs.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="card-2">
          <h3>Create a new reference lift</h3>
          <div className="stack-2">
            <input placeholder="Name, e.g. Overhead Press 8RM" value={newRef.name} onChange={(e) => setNewRef({ ...newRef, name: e.target.value })} />
            <div className="row" style={{ gap: 6 }}>
              <select style={{ width: 90 }} value={newRef.unit} onChange={(e) => setNewRef({ ...newRef, unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
              <input className="grow" placeholder="Short description (optional)" value={newRef.description} onChange={(e) => setNewRef({ ...newRef, description: e.target.value })} />
            </div>
            <button className="btn secondary sm auto" onClick={createInlineRef} disabled={refBusy || !newRef.name.trim()}>
              {refBusy ? "Adding…" : "+ Create & add to workout"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sets & parts */}
      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>3. Sets & parts</h2>
          <button className="btn sm auto" onClick={addSet} disabled={options.exercises.length === 0}>+ Exercise</button>
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>
          {options.exercises.length === 0 ? "Add exercises to the library first — " : "Missing an exercise? "}
          <a href="/admin/exercises" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
            manage the exercise library →
          </a>
        </p>

        <p className="muted small" style={{ marginTop: 8 }}>
          Consecutive sets using the same exercise are shown to athletes as one exercise
          box — name, description and demo video once at the top, with those sets inside.
        </p>

        {sets.map((s, si) => (
          <Fragment key={si}>
            {groupStartsAt(si) && (
              <div className="ex-group-head">
                <div className="grow">
                  <label style={{ marginBottom: 4 }}>Exercise — supplies the description &amp; demo video for this box</label>
                  <select
                    value={sets[si].parts[0]?.exerciseId ?? ""}
                    onChange={(e) => setGroupExercise(si, e.target.value)}
                  >
                    <option value="">Choose an exercise…</option>
                    {options.exercises.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <span className="ti-meta">
                    {groupEndIndex(si) - si + 1} set{groupEndIndex(si) - si === 0 ? "" : "s"} in this box
                  </span>
                </div>
                <button
                  className="btn ghost sm auto"
                  onClick={() => duplicateSet(groupEndIndex(si))}
                  title="Adds another set of this same exercise to this box"
                >
                  + Set
                </button>
              </div>
            )}
          <div className="card-2 ex-group-set" style={{ marginTop: 8 }}>
            <div className="row between">
              <strong>Set {si + 1}</strong>
              <div className="row" style={{ gap: 4 }}>
                <button className="btn ghost sm auto" onClick={() => moveSet(si, -1)} disabled={si === 0}>↑</button>
                <button className="btn ghost sm auto" onClick={() => moveSet(si, 1)} disabled={si === sets.length - 1}>↓</button>
                <button className="btn ghost sm auto" onClick={() => duplicateSet(si)}>Duplicate</button>
                <button className="btn ghost sm auto" aria-label="Remove set" onClick={() => removeSet(si)}><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
              </div>
            </div>

            <div className="grid2" style={{ marginTop: 8 }}>
              <div>
                <label>Label (optional)</label>
                <input value={s.label} placeholder="e.g. Drop set" onChange={(e) => updateSet(si, { label: e.target.value })} />
              </div>
              <div>
                <label>Set note (optional)</label>
                <input value={s.instructions} placeholder="e.g. rest 2 min" onChange={(e) => updateSet(si, { instructions: e.target.value })} />
              </div>
            </div>

            {/* parts */}
            {s.parts.map((p, pi) => (
              <div key={pi} className="card" style={{ marginTop: 10, marginBottom: 0 }}>
                <div className="row between">
                  <span className="tag">Part {pi + 1}</span>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn ghost sm auto" onClick={() => movePart(si, pi, -1)} disabled={pi === 0}>↑</button>
                    <button className="btn ghost sm auto" onClick={() => movePart(si, pi, 1)} disabled={pi === s.parts.length - 1}>↓</button>
                    <button className="btn ghost sm auto" onClick={() => duplicatePart(si, pi)}>Dup</button>
                    <button className="btn ghost sm auto" aria-label="Remove part" onClick={() => removePart(si, pi)} disabled={s.parts.length === 1}><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
                  </div>
                </div>
                <div className="stack-2" style={{ marginTop: 8 }}>
                  <div className="grid2">
                    <div>
                      <label>Part name (optional)</label>
                      <input
                        value={p.label}
                        placeholder={exName(p.exerciseId)}
                        onChange={(e) => updatePart(si, pi, { label: e.target.value })}
                      />
                    </div>
                    <div>
                      <label>Reference lift</label>
                      <select value={p.referenceLiftId} onChange={(e) => updatePart(si, pi, { referenceLiftId: e.target.value })}>
                        <option value="">Choose…</option>
                        {refIds.map((id) => (
                          <option key={id} value={id}>{refName(id)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid2">
                    <div>
                      <label>Default reps</label>
                      <input value={p.reps} placeholder="e.g. 8, 8–10, AMRAP, 30s" onChange={(e) => updatePart(si, pi, { reps: e.target.value })} />
                    </div>
                    <div>
                      <label>Notes (tempo / cues)</label>
                      <input value={p.description} placeholder="e.g. 3s eccentric, pause" onChange={(e) => updatePart(si, pi, { description: e.target.value })} />
                    </div>
                  </div>
                  <table className="grid-edit">
                    <thead><tr><th></th><th>Easy</th><th>Hard</th><th>Brutal</th></tr></thead>
                    <tbody>
                      <tr>
                        <td className="muted">% of ref</td>
                        {DIFFS.map((d) => (
                          <td key={d}>
                            <input type="number" value={p.pct[d]} placeholder="%" onChange={(e) => updatePartPct(si, pi, d, e.target.value)} />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="muted">Reps</td>
                        {DIFFS.map((d) => (
                          <td key={d}>
                            <input
                              value={p.repsByDiff[d]}
                              placeholder={p.reps || "same"}
                              onChange={(e) => updatePartReps(si, pi, d, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  <p className="tiny faint" style={{ margin: "6px 0 0" }}>
                    Reps accept any text (e.g. <em>12 reps</em>, <em>AMRAP</em>, <em>2x2 w/ 5s rest</em>). Leave a
                    difficulty blank to use the default reps.
                  </p>
                </div>
              </div>
            ))}

            <button className="btn secondary sm auto" style={{ marginTop: 10 }} onClick={() => addPart(si)}>+ Part</button>

            {/* set-level points */}
            <div style={{ marginTop: 12 }}>
              <label>Points on success (per difficulty)</label>
              <table className="grid-edit">
                <thead><tr><th>Easy</th><th>Hard</th><th>Brutal</th></tr></thead>
                <tbody>
                  <tr>
                    {DIFFS.map((d) => (
                      <td key={d}>
                        <input type="number" value={s.points[d]} placeholder="pts" onChange={(e) => setPoints(si, d, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </Fragment>
        ))}
      </div>

      {/* 4. Rank tiers */}
      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>4. Rank tiers</h2>
          <button className="btn sm auto" onClick={addTier}>+ Tier</button>
        </div>
        <p className="muted small">Max achievable points: <strong className="mono">{maxPts}</strong></p>
        {tiers.map((t, i) => (
          <div key={i} className="row" style={{ gap: 6, marginBottom: 8 }}>
            <input style={{ width: 56 }} value={t.icon} onChange={(e) => updateTier(i, { icon: e.target.value })} />
            <input className="grow" value={t.name} placeholder="Tier name" onChange={(e) => updateTier(i, { name: e.target.value })} />
            <input style={{ width: 90 }} type="number" value={t.minPoints} placeholder="min pts" onChange={(e) => updateTier(i, { minPoints: e.target.value })} />
            <button className="btn ghost sm auto" aria-label="Remove tier" onClick={() => removeTier(i)}><IconX size={16} strokeWidth={2.5} aria-hidden /></button>
          </div>
        ))}
        {tierIssues.length > 0 && (
          <div className="banner" style={{ marginTop: 8 }}>
            {tierIssues.map((issue, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <IconWarn size={15} strokeWidth={2.25} aria-hidden />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="banner">
          {warnings.slice(0, 8).map((m, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <IconWarn size={15} strokeWidth={2.25} aria-hidden />
              <span>{m}</span>
            </div>
          ))}
          {warnings.length > 8 && <div>…and {warnings.length - 8} more</div>}
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="grid2">
        <button className="btn secondary" disabled={saving} onClick={() => save("draft")}>Save draft</button>
        <button
          className="btn"
          disabled={saving || tierIssues.length > 0 || warnings.length > 0 || sets.length === 0}
          onClick={() => save("published")}
        >
          {saving ? "Saving…" : "Publish"}
        </button>
      </div>
    </div>
  );
}
