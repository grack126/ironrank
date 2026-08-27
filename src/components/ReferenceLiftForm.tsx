"use client";
import { saveReferenceLiftsAction } from "@/app/workout-actions";
import { SubmitButton } from "./SubmitButton";
import { fromKg, type Unit } from "@/lib/shared/units";

export function ReferenceLiftForm({
  workoutId,
  unit,
  lifts,
}: {
  workoutId: string;
  unit: Unit;
  lifts: { id: string; name: string; description: string; currentKg: number | null }[];
}) {
  return (
    <form action={saveReferenceLiftsAction} className="stack">
      <input type="hidden" name="workoutId" value={workoutId} />
      {lifts.map((l) => (
        <div key={l.id}>
          <label>
            {l.name} ({unit})
            {l.description ? <span className="muted"> — {l.description}</span> : null}
          </label>
          <input
            name={`ref_${l.id}`}
            type="number"
            step="0.5"
            min="0"
            defaultValue={l.currentKg != null ? Math.round(fromKg(l.currentKg, unit) * 10) / 10 : ""}
            placeholder={`Your ${l.name}`}
            required
          />
        </div>
      ))}
      <SubmitButton pendingLabel="Saving…">Save & continue</SubmitButton>
    </form>
  );
}
