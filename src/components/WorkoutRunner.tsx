"use client";
import { useEffect, useMemo, useState } from "react";
import {
  calcWorkingWeightKg,
  resolveRankTier,
  maxWorkoutPoints,
  type Difficulty,
} from "@/lib/shared/workout";
import { fromKg, toKg, type Unit } from "@/lib/shared/units";
import { submitWorkoutAttempt, saveReferenceLiftsAction, type SubmitResult } from "@/app/workout-actions";
import { VideoEmbed } from "./ui/VideoEmbed";
import { RankReveal } from "./RankReveal";
import { RankBadge } from "./ui/RankBadge";
import { haptic } from "@/lib/haptics";
import { IconCheck, IconX, IconTune, IconPlay, IconChevron, IconChevronUp } from "@/components/ui/icons";

type Triple = { easy: number; hard: number; brutal: number };

interface RunnerPart {
  id: string;
  exerciseId: string;
  exerciseName: string;
  /** Optional per-part name (e.g. "Pull-up" in a superset); falls back to the exercise name. */
  partLabel?: string | null;
  exerciseInstructions: string;
  youtubeVideoId: string | null;
  referenceLiftId: string;
  referenceLiftName: string;
  reps: string | null;
  description: string;
  percentages: Triple;
  /** Reps per difficulty; a null entry falls back to `reps`. */
  repsByDifficulty?: { easy: string | null; hard: string | null; brutal: string | null };
}
interface RunnerSet {
  id: string;
  label: string | null;
  instructions: string | null;
  points: Triple;
  parts: RunnerPart[];
}
export interface RunnerData {
  workoutId: string;
  title: string;
  instructions: string;
  unit: Unit;
  incrementKg: number;
  rankTiers: { name: string; icon: string; minPoints: number }[];
  referenceLifts: { id: string; name: string; description: string; currentKg: number | null }[];
  sets: RunnerSet[];
}

type Pick = { difficulty: Difficulty; outcome: "success" | "fail" };
const round1 = (v: number) => Math.round(v * 10) / 10;
const DIFFS: Difficulty[] = ["easy", "hard", "brutal"];

/** Reps for the selected difficulty, falling back to the part's base reps. */
function repsFor(part: RunnerPart, diff: Difficulty): string | null {
  return part.repsByDifficulty?.[diff] ?? part.reps;
}

/** Identity of a set by the exercises it uses, so repeats of the same exercise group. */
const exerciseSignature = (s: RunnerSet) => s.parts.map((p) => p.exerciseId).join("|");

type ExerciseGroup = { key: string; sets: { set: RunnerSet; index: number }[] };

/** Title, description and demo videos shown once at the top of an exercise box. */
function describeGroup(group: ExerciseGroup) {
  const firstSet = group.sets[0].set;
  const parts = firstSet.parts;
  // Parts often repeat the same exercise (drop sets); collapse to the distinct ones.
  const distinct = parts.filter((p, i, arr) => arr.findIndex((x) => x.exerciseId === p.exerciseId) === i);
  const combined = distinct.length > 1;

  const title = combined
    ? firstSet.label ?? distinct.map((p) => p.exerciseName).join(" + ")
    : distinct[0].exerciseName;
  const description = combined
    ? distinct
        .map((p) => (p.exerciseInstructions ? `${p.exerciseName}: ${p.exerciseInstructions}` : p.exerciseName))
        .join("\n")
    : distinct[0].exerciseInstructions;
  const demos = distinct.filter((p): p is RunnerPart & { youtubeVideoId: string } => !!p.youtubeVideoId);

  return { title, description, demos };
}

/** Loose text match, so a set note that just repeats the exercise note is hidden. */
const sameText = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.replace(/[\s·]+/g, " ").trim().toLowerCase() === b.replace(/[\s·]+/g, " ").trim().toLowerCase();

/** Group consecutive sets that train the same exercise(s) into one block. */
function groupSets(sets: RunnerSet[]): ExerciseGroup[] {
  const out: ExerciseGroup[] = [];
  sets.forEach((set, index) => {
    const key = exerciseSignature(set);
    const last = out[out.length - 1];
    if (last && last.key === key) last.sets.push({ set, index });
    else out.push({ key, sets: [{ set, index }] });
  });
  return out;
}

export function WorkoutRunner({ data }: { data: RunnerData }) {
  const storageKey = `ironrank-progress-${data.workoutId}`;

  const [refMap, setRefMap] = useState<Record<string, number | null>>(
    Object.fromEntries(data.referenceLifts.map((r) => [r.id, r.currentKg]))
  );
  const missingRefs = data.referenceLifts.filter((r) => refMap[r.id] == null);
  const [panelOpen, setPanelOpen] = useState(missingRefs.length > 0);
  const [refDraft, setRefDraft] = useState<Record<string, string>>(
    Object.fromEntries(
      data.referenceLifts.map((r) => [r.id, r.currentKg != null ? String(round1(fromKg(r.currentKg, data.unit))) : ""])
    )
  );
  const [savingRefs, setSavingRefs] = useState(false);

  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [selected, setSelected] = useState<Record<string, Difficulty>>({});
  const [lastDiff, setLastDiff] = useState<Difficulty>("hard");
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        setPicks(s.picks ?? {});
        setSelected(s.selected ?? {});
        setLastDiff(s.lastDiff ?? "hard");
      }
    } catch {}
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify({ picks, selected, lastDiff }));
  }, [picks, selected, lastDiff, loaded, storageKey]);

  const earned = useMemo(() => {
    let t = 0;
    for (const s of data.sets) {
      const p = picks[s.id];
      if (p?.outcome === "success") t += s.points[p.difficulty];
    }
    return t;
  }, [picks, data.sets]);

  const maxPts = useMemo(
    () => maxWorkoutPoints(data.sets.map((s) => DIFFS.map((d) => ({ difficulty: d, points: s.points[d] })))),
    [data.sets]
  );

  const allLogged = data.sets.every((s) => picks[s.id]);
  const remaining = data.sets.length - Object.keys(picks).filter((k) => data.sets.some((s) => s.id === k)).length;

  function reset() {
    setPicks({});
    setSelected({});
    setResult(null);
    localStorage.removeItem(storageKey);
  }

  function diffFor(setId: string): Difficulty {
    return selected[setId] ?? picks[setId]?.difficulty ?? lastDiff ?? "hard";
  }
  function chooseDiff(setId: string, d: Difficulty) {
    setSelected((p) => ({ ...p, [setId]: d }));
    setLastDiff(d);
  }
  function record(setId: string, outcome: "success" | "fail") {
    haptic(outcome === "success" ? "success" : "warning");
    setPicks((p) => ({ ...p, [setId]: { difficulty: diffFor(setId), outcome } }));
  }
  function partWeight(part: RunnerPart, setId: string): number | null {
    const ref = refMap[part.referenceLiftId];
    if (ref == null) return null;
    return calcWorkingWeightKg(ref, part.percentages[diffFor(setId)], data.incrementKg);
  }

  async function saveRefs() {
    setSavingRefs(true);
    const fd = new FormData();
    fd.set("workoutId", data.workoutId);
    const next: Record<string, number | null> = { ...refMap };
    for (const r of data.referenceLifts) {
      const v = parseFloat(refDraft[r.id]);
      if (!isNaN(v) && v > 0) {
        fd.set(`ref_${r.id}`, String(v));
        next[r.id] = toKg(v, data.unit);
      }
    }
    await saveReferenceLiftsAction(fd);
    setRefMap(next); // live recompute across the page
    setSavingRefs(false);
    if (data.referenceLifts.every((r) => next[r.id] != null)) setPanelOpen(false);
    haptic("success");
  }

  async function finish() {
    setSubmitting(true);
    const payload = Object.entries(picks).map(([setId, p]) => ({ setId, difficulty: p.difficulty, outcome: p.outcome }));
    const res = await submitWorkoutAttempt(data.workoutId, payload);
    setSubmitting(false);
    setResult(res);
    if (res.ok) localStorage.removeItem(storageKey);
  }

  if (!loaded) return null;

  if (result) {
    if (!result.ok) {
      return (
        <div className="card">
          <p className="error">{result.error}</p>
          <button className="btn secondary" onClick={() => setResult(null)}>Back</button>
        </div>
      );
    }
    const rankIndex = result.rankName ? Math.max(0, data.rankTiers.findIndex((t) => t.name === result.rankName)) : 0;
    return (
      <RankReveal
        rankName={result.rankName}
        rankIndex={rankIndex}
        totalPoints={result.totalPoints}
        maxPoints={maxPts}
        isBest={result.isBest}
        onRetry={reset}
      />
    );
  }

  const groups = groupSets(data.sets);
  const projForBar = resolveRankTier(earned, data.rankTiers.map((t, i) => ({ ...t, id: String(i) })));
  const nextTier = [...data.rankTiers].sort((a, b) => a.minPoints - b.minPoints).find((t) => t.minPoints > earned);

  return (
    <div style={{ paddingBottom: 96 }}>
      <h1>{data.title}</h1>
      {data.instructions && <p className="muted small">{data.instructions}</p>}

      {/* Sticky navigation */}
      <div className="runner-nav">
        <button className="btn secondary sm auto grow" onClick={() => setPanelOpen((o) => !o)}>
          <IconTune size={16} strokeWidth={2.25} aria-hidden />
          Reference weights{missingRefs.length > 0 ? ` (${missingRefs.length} needed)` : ""}
        </button>
        {data.sets.length > 1 && (
          <select
            aria-label="Jump to"
            className="nav-jump"
            value=""
            onChange={(e) => {
              const el = document.getElementById(e.target.value);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <option value="">Jump…</option>
            {data.sets.map((s, i) => (
              <option key={s.id} value={`set-${i}`}>
                {i + 1}. {s.parts.length === 1 ? s.parts[0].exerciseName : s.label ?? "Advanced set"}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Reference-weights panel (re-openable any time) */}
      {panelOpen && (
        <div className="card" style={{ borderColor: "var(--accent)" }}>
          <h2 style={{ marginTop: 0 }}>Your reference weights</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Edit any time — saving recomputes every working weight below.
          </p>
          <div className="stack-2">
            {data.referenceLifts.map((r) => (
              <div key={r.id}>
                <label>{r.name} ({data.unit}){r.description ? <span className="faint"> — {r.description}</span> : null}</label>
                <input
                  className="input-num"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  value={refDraft[r.id] ?? ""}
                  onChange={(e) => setRefDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder={`Your ${r.name}`}
                />
              </div>
            ))}
            <button className="btn" onClick={saveRefs} disabled={savingRefs}>
              {savingRefs ? "Saving…" : "Save & recompute"}
            </button>
          </div>
        </div>
      )}

      {/* One box per exercise; its sets sit inside it */}
      {groups.map((g, gi) => (
        <ExerciseBox
          key={g.key + gi}
          id={`set-${g.sets[0].index}`}
          group={g}
          logged={g.sets.filter(({ set }) => picks[set.id]).length}
        >
          {g.sets.map(({ set, index }) => {
            const single = set.parts.length === 1;
            // The exercise note is already shown on the box — don't repeat it per set.
            const hideInstr = sameText(set.instructions, describeGroup(g).description);
            return (
              <SetCard
                key={set.id}
                id={`set-${index}`}
                n={index + 1}
                set={set}
                single={single}
                hideInstr={hideInstr}
                diff={diffFor(set.id)}
                pick={picks[set.id]}
                unit={data.unit}
                weight={single ? partWeight(set.parts[0], set.id) : null}
                partWeights={!single ? set.parts.map((p) => partWeight(p, set.id)) : undefined}
                onDiff={(d) => chooseDiff(set.id, d)}
                onRecord={(o) => record(set.id, o)}
              />
            );
          })}
        </ExerciseBox>
      ))}

      {/* Finish */}
      <div className="card center">
        {allLogged ? (
          <>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Projected rank
            </p>
            <div style={{ marginBottom: 12 }}>
              {(() => {
                const proj = resolveRankTier(earned, data.rankTiers.map((t, i) => ({ ...t, id: String(i) })));
                const idx = proj ? data.rankTiers.findIndex((t) => t.name === proj.name) : -1;
                return proj ? <RankBadge name={proj.name} index={Math.max(0, idx)} size="lg" /> : <span className="pill">Unranked</span>;
              })()}
            </div>
            <button className="btn round" onClick={finish} disabled={submitting}>
              {submitting ? "Saving…" : "Finish & reveal rank"}
            </button>
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>
            {remaining} set{remaining === 1 ? "" : "s"} left — log success or fail on each to finish.
          </p>
        )}
      </div>

      {/* Bottom XP / points bar */}
      <div className="xp-bar">
        <div className="xp-bar-inner">
          <div className="xp-fill" style={{ width: `${maxPts > 0 ? Math.min(100, (earned / maxPts) * 100) : 0}%` }} />
          <div className="xp-row">
            <span className="pts">{earned} / {maxPts} pts</span>
            <span className="nxt">
              {nextTier
                ? `${nextTier.minPoints - earned} to ${nextTier.icon} ${nextTier.name}`
                : projForBar
                  ? `${projForBar.icon} ${projForBar.name}`
                  : "Top tier"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// A weight/reps value box (the card centerpiece).
function WeightRepsBoxes({ weight, reps, unit }: { weight: number | null; reps: string | null; unit: Unit }) {
  return (
    <div className="wr-grid">
      <div className="wr-box">
        <div className="wr-label">Weight to Use</div>
        {weight != null ? (
          <div className="wr-value">
            {round1(fromKg(weight, unit))}
            <span className="wr-unit">{unit}</span>
          </div>
        ) : (
          <div className="wr-empty">Set your reference weight above</div>
        )}
      </div>
      <div className="wr-box">
        <div className="wr-label">Reps to Complete</div>
        <div className="wr-value">{reps ?? "—"}</div>
      </div>
    </div>
  );
}

/**
 * The exercise block: name, description and demo once at the top, with every set
 * for that exercise nested inside. Replaces repeating the header on each set.
 */
function ExerciseBox({
  id,
  group,
  logged,
  children,
}: {
  id: string;
  group: ExerciseGroup;
  /** How many of this exercise's sets already have an outcome logged. */
  logged: number;
  children: React.ReactNode;
}) {
  const { title, description, demos } = describeGroup(group);
  const total = group.sets.length;
  const complete = logged === total;

  return (
    <section id={id} className="ex-box">
      <div className="ex-head">
        <h2 className="ex-name">{title}</h2>
        {description && <p className="ex-desc">{description}</p>}
        {demos.map((d) => (
          <details key={d.exerciseId} className="ex-demo">
            <summary className="demo-btn">
              <IconPlay size={20} strokeWidth={2.5} aria-hidden />
              Watch demo{demos.length > 1 ? ` · ${d.exerciseName}` : ""}
            </summary>
            <div style={{ marginTop: 10 }}>
              <VideoEmbed videoId={d.youtubeVideoId} title={d.exerciseName} />
            </div>
          </details>
        ))}
      </div>
      {/* Sets collapse into a dropdown so a long workout stays scannable. */}
      <details className="ex-sets-wrap">
        <summary className="sets-toggle">
          <span className="sets-count">
            {total} set{total === 1 ? "" : "s"}
          </span>
          <span className="sets-right">
            <span className={`sets-progress${complete ? " done" : ""}`}>
              {complete ? "all logged" : `${logged}/${total} logged`}
            </span>
            {/* Swap the glyph rather than rotating it — CSS transform proved unreliable here. */}
            <span className="chev chev-closed" aria-hidden>
              <IconChevron size={18} strokeWidth={2.5} />
            </span>
            <span className="chev chev-open" aria-hidden>
              <IconChevronUp size={18} strokeWidth={2.5} />
            </span>
          </span>
        </summary>
        <div className="ex-sets">{children}</div>
      </details>
    </section>
  );
}

function SetCard({
  id, n, set, single, hideInstr, diff, pick, unit, weight, partWeights, onDiff, onRecord,
}: {
  id: string;
  n: number;
  set: RunnerSet;
  single: boolean;
  hideInstr?: boolean;
  diff: Difficulty;
  pick?: Pick;
  unit: Unit;
  weight?: number | null;
  partWeights?: (number | null)[];
  onDiff: (d: Difficulty) => void;
  onRecord: (o: "success" | "fail") => void;
}) {
  const done = !!pick;
  // A completed set is bordered by the difficulty it was earned at:
  // easy → orange, hard → silver, brutal → gold. Failed sets stay in the danger colour.
  const stateCls = done
    ? pick!.outcome === "success"
      ? ` done-ok done-${pick!.difficulty}`
      : " done-fail"
    : "";
  const part = set.parts[0];
  // Instructions bar = the set/part description (falls back to nothing).
  const instr = set.instructions ?? (single ? part.description : null);

  return (
    <div id={id} className={`set-card${stateCls}`}>
      {/* 1. Set header — the exercise name/description/demo live on the ExerciseBox */}
      <div className="set-card-head">
        <span className="set-tag">Set {n}</span>
        {done && (
          <span className={`pill ${pick!.outcome === "success" ? "success" : "danger"}`}>
            {pick!.outcome === "success" ? "done" : "failed"}
          </span>
        )}
      </div>

      {/* 2. Instructions bar */}
      {instr && !hideInstr && <div className="set-instr">{instr}</div>}

      {/* 3. Difficulty settings — 3-pill segmented, active = lime */}
      <div className="set-field-label">Difficulty Settings{single ? "" : " · applies to every part"}</div>
      <div className="diff-grid">
        {DIFFS.map((d) => (
          <button key={d} type="button" className={`diff-btn${diff === d ? " selected" : ""}`} onClick={() => onDiff(d)}>
            <div className="d-name">{d}</div>
            <div className="d-meta">{set.points[d]} pts</div>
          </button>
        ))}
      </div>

      {/* 4. Weight to Use | Reps to Complete */}
      {single ? (
        <WeightRepsBoxes weight={weight ?? null} reps={repsFor(part, diff)} unit={unit} />
      ) : (
        set.parts.map((p, i) => (
          <div key={p.id} className="set-part">
            <p className="set-part-name">{p.partLabel || p.exerciseName}</p>
            <WeightRepsBoxes weight={partWeights?.[i] ?? null} reps={repsFor(p, diff)} unit={unit} />
            {p.description && <p className="set-ex-instr">{p.description}</p>}
          </div>
        ))
      )}

      {/* 5. Mark Completed — one button, expands to Success / Fail */}
      <MarkCompleted pick={pick} onRecord={onRecord} />
    </div>
  );
}

function MarkCompleted({ pick, onRecord }: { pick?: Pick; onRecord: (o: "success" | "fail") => void }) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="mark-wrap mark-choices">
        <button type="button" className="btn success" onClick={() => { onRecord("success"); setExpanded(false); }}>
          <IconCheck size={18} strokeWidth={2.5} aria-hidden />
          Success
        </button>
        <button type="button" className="btn danger-ghost" onClick={() => { onRecord("fail"); setExpanded(false); }}>
          <IconX size={18} strokeWidth={2.5} aria-hidden />
          Fail
        </button>
      </div>
    );
  }

  if (pick) {
    const ok = pick.outcome === "success";
    return (
      <div className="mark-wrap">
        <button type="button" className={`mark-done ${ok ? "ok" : "fail"}`} onClick={() => setExpanded(true)}>
          {ok ? <IconCheck size={18} strokeWidth={2.5} aria-hidden /> : <IconX size={18} strokeWidth={2.5} aria-hidden />}
          {ok ? "Completed" : "Failed"} · tap to change
        </button>
      </div>
    );
  }

  return (
    <div className="mark-wrap">
      <button type="button" className="btn mark-cta" onClick={() => setExpanded(true)}>Mark Completed</button>
    </div>
  );
}
