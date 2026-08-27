"use client";
import { useState } from "react";
import { saveChallengeAction } from "@/app/admin/challenge-actions";
import { uploadWorkoutImageAction } from "@/app/admin/upload-actions";
import { SubmitButton } from "./SubmitButton";
import type { ChallengeType } from "@/lib/shared/challenge";

// Shown under every background-image upload (workouts + challenges).
export const IMAGE_GUIDANCE =
  "Recommended: 800 × 450 px (16:9 ratio), JPEG or WebP, under 500 KB. Displayed as a background fill inside a rounded card (~360 px wide on mobile); a 16:9 landscape at 800 × 450 gives sharp 2× coverage. Crop the subject toward the center — edges may be clipped.";

const DEFAULT_UNIT: Record<ChallengeType, string> = {
  max_weight: "kg",
  tonnage: "kg total",
  max_reps: "reps",
  amrap: "reps",
  for_time: "seconds",
};

export interface ChallengeInitial {
  id: string;
  exerciseId: string;
  title: string;
  description: string;
  movementStandard: string | null;
  demoYoutubeVideoId: string | null;
  unitLabel: string;
  challengeType: string;
  scoringType: string;
  startsAt: string; // datetime-local value
  endsAt: string;
  isDaily: boolean;
  status: string;
  seasonId: string | null;
  backgroundImagePath: string | null;
}

type ExerciseOption = { id: string; name: string; youtubeVideoId: string | null };

const urlOf = (videoId: string | null | undefined) => (videoId ? `https://youtu.be/${videoId}` : "");

export function ChallengeForm({
  exercises,
  seasons,
  initial,
}: {
  exercises: ExerciseOption[];
  seasons: { id: string; name: string }[];
  initial?: ChallengeInitial;
}) {
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ChallengeType>((initial?.challengeType as ChallengeType) ?? "max_weight");
  const [unit, setUnit] = useState(initial?.unitLabel ?? DEFAULT_UNIT.max_weight);

  const initialExerciseId = initial?.exerciseId ?? exercises[0]?.id ?? "";
  const videoIdOf = (exId: string) => exercises.find((e) => e.id === exId)?.youtubeVideoId ?? null;

  const [exerciseId, setExerciseId] = useState(initialExerciseId);
  // If the challenge has its own demo, the field is "touched" (explicit); otherwise it mirrors the exercise.
  const [videoTouched, setVideoTouched] = useState(!!initial?.demoYoutubeVideoId);
  const [demoVideoUrl, setDemoVideoUrl] = useState(
    initial?.demoYoutubeVideoId ? urlOf(initial.demoYoutubeVideoId) : urlOf(videoIdOf(initialExerciseId))
  );

  const inheritedVideoId = videoIdOf(exerciseId);

  const [bgImage, setBgImage] = useState<string | null>(initial?.backgroundImagePath ?? null);
  const [uploading, setUploading] = useState(false);

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

  async function action(formData: FormData) {
    setError(null);
    const res = await saveChallengeAction(formData);
    if (res?.error) setError(res.error);
  }

  function onType(v: ChallengeType) {
    setType(v);
    setUnit(DEFAULT_UNIT[v]);
  }

  function onExercise(exId: string) {
    setExerciseId(exId);
    if (!videoTouched) setDemoVideoUrl(urlOf(videoIdOf(exId)));
  }

  return (
    <form action={action} className="stack">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label>Exercise (from the library)</label>
        <select name="exerciseId" value={exerciseId} onChange={(e) => onExercise(e.target.value)}>
          {exercises.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Title</label>
        <input name="title" defaultValue={initial?.title ?? ""} placeholder="Bench Press 1RM Showdown" required />
      </div>
      <div>
        <label>Description</label>
        <textarea name="description" defaultValue={initial?.description ?? ""} rows={2} />
      </div>

      <div>
        <label>Card background image (optional)</label>
        <input type="hidden" name="backgroundImagePath" value={bgImage ?? ""} />
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
        <p className="tiny faint" style={{ marginTop: 4 }}>{uploading ? "Uploading…" : IMAGE_GUIDANCE}</p>
      </div>

      <div>
        <label>Demo video (YouTube) — overrides the exercise&apos;s demo</label>
        <input
          name="demoVideoUrl"
          value={demoVideoUrl}
          onChange={(e) => { setDemoVideoUrl(e.target.value); setVideoTouched(true); }}
          placeholder="https://youtube.com/watch?v=…"
        />
        <p className="tiny faint" style={{ marginTop: 4 }}>
          {inheritedVideoId
            ? "Prefilled from the linked exercise. Edit to override, or clear to fall back to the exercise's demo."
            : "The linked exercise has no demo — paste one here if you want a Watch demo button."}
          {videoTouched && inheritedVideoId && (
            <>
              {" "}
              <button
                type="button"
                className="btn ghost sm auto"
                style={{ marginLeft: 6 }}
                onClick={() => { setVideoTouched(false); setDemoVideoUrl(urlOf(inheritedVideoId)); }}
              >
                Use exercise&apos;s video
              </button>
            </>
          )}
        </p>
      </div>

      <div className="grid2">
        <div>
          <label>Format</label>
          <select name="challengeType" value={type} onChange={(e) => onType(e.target.value as ChallengeType)}>
            <option value="max_weight">Max weight</option>
            <option value="max_reps">Max reps</option>
            <option value="tonnage">Tonnage</option>
            <option value="for_time">For time</option>
            <option value="amrap">AMRAP</option>
          </select>
        </div>
        <div>
          <label>Scoring</label>
          <select name="scoringType" defaultValue={initial?.scoringType ?? "absolute"}>
            <option value="absolute">Absolute</option>
            <option value="relative_dots">Relative (DOTS)</option>
          </select>
        </div>
      </div>

      <div>
        <label>Value unit label (how the raw value is expressed)</label>
        <input name="unitLabel" value={unit} onChange={(e) => setUnit(e.target.value)} />
      </div>

      <div className="grid2">
        <div>
          <label>Opens</label>
          <input type="datetime-local" name="startsAt" defaultValue={initial?.startsAt ?? ""} required />
        </div>
        <div>
          <label>Closes</label>
          <input type="datetime-local" name="endsAt" defaultValue={initial?.endsAt ?? ""} required />
        </div>
      </div>

      <div className="grid2">
        <div>
          <label>Season</label>
          <select name="seasonId" defaultValue={initial?.seasonId ?? ""}>
            <option value="">None</option>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Status</label>
          <select name="status" defaultValue={initial?.status ?? "draft"}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <div>
        <label>Movement standard (optional override of the exercise default)</label>
        <input name="movementStandard" defaultValue={initial?.movementStandard ?? ""} placeholder="e.g. paused, full ROM" />
      </div>

      <label className="row" style={{ gap: 8 }}>
        <input type="checkbox" name="isDaily" defaultChecked={initial?.isDaily ?? false} style={{ width: "auto" }} />
        <span>Daily challenge (featured for one day)</span>
      </label>

      {error && <p className="error">{error}</p>}
      <SubmitButton pendingLabel="Saving…">Save challenge</SubmitButton>
    </form>
  );
}
