"use client";
import { useState } from "react";
import { saveExerciseAction } from "@/app/admin/admin-actions";
import { SubmitButton } from "./SubmitButton";

export function ExerciseForm({
  initial,
}: {
  initial?: {
    id: string;
    name: string;
    instructions: string;
    youtubeVideoId: string | null;
    muscleGroup: string | null;
    equipment: string | null;
    movementStandard: string | null;
    tips: string | null;
    status: string;
  };
}) {
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData) {
    setError(null);
    const res = await saveExerciseAction(formData);
    if (res?.error) setError(res.error);
  }

  return (
    <form action={action} className="stack">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label>Name *</label>
        <input name="name" defaultValue={initial?.name ?? ""} required />
      </div>
      <div>
        <label>Instructions</label>
        <textarea name="instructions" defaultValue={initial?.instructions ?? ""} rows={3} />
      </div>
      <div>
        <label>YouTube URL (we extract the video ID)</label>
        <input
          name="youtubeUrl"
          defaultValue={initial?.youtubeVideoId ? `https://youtu.be/${initial.youtubeVideoId}` : ""}
          placeholder="https://youtube.com/watch?v=…"
        />
      </div>
      <div className="grid2">
        <div>
          <label>Muscle group</label>
          <input name="muscleGroup" defaultValue={initial?.muscleGroup ?? ""} />
        </div>
        <div>
          <label>Equipment</label>
          <input name="equipment" defaultValue={initial?.equipment ?? ""} />
        </div>
      </div>
      <div>
        <label>Movement standard (tempo / ROM / pause)</label>
        <input name="movementStandard" defaultValue={initial?.movementStandard ?? ""} />
      </div>
      <div>
        <label>Common form faults / tips</label>
        <textarea name="tips" defaultValue={initial?.tips ?? ""} rows={2} />
      </div>
      <div>
        <label>Status</label>
        <select name="status" defaultValue={initial?.status ?? "published"}>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      <SubmitButton pendingLabel="Saving…">Save exercise</SubmitButton>
    </form>
  );
}
