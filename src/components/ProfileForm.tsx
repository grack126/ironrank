"use client";
import { useState } from "react";
import { useActionState } from "react";
import { saveProfileAction, type ProfileState } from "@/app/profile-actions";
import { SubmitButton } from "./SubmitButton";
import { fromKg } from "@/lib/shared/units";

type Unit = "kg" | "lb";

export function ProfileForm({
  initial,
  weightClasses,
  experienceClasses,
  redirectTo,
}: {
  initial: {
    displayName: string;
    gender: string;
    heightCm: number | null;
    bodyweightKg: number | null;
    experienceYears: number | null;
    weightClassId: string | null;
    experienceClassId: string | null;
    preferredUnits: string;
  };
  weightClasses: { id: string; name: string; gender: string | null }[];
  experienceClasses: { id: string; name: string }[];
  redirectTo?: string;
}) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, undefined);
  const [unit, setUnit] = useState<Unit>((initial.preferredUnits as Unit) || "kg");

  const bw = initial.bodyweightKg != null ? Math.round(fromKg(initial.bodyweightKg, unit) * 10) / 10 : "";

  if (state?.ok && redirectTo && typeof window !== "undefined") {
    window.location.href = redirectTo;
  }

  return (
    <form action={action} className="stack">
      <div>
        <label>Display name</label>
        <input name="displayName" defaultValue={initial.displayName} required />
      </div>

      <div>
        <label>Preferred units</label>
        <div className="grid2">
          <button type="button" className={`btn ${unit === "kg" ? "" : "secondary"}`} onClick={() => setUnit("kg")}>kg</button>
          <button type="button" className={`btn ${unit === "lb" ? "" : "secondary"}`} onClick={() => setUnit("lb")}>lb</button>
        </div>
        <input type="hidden" name="preferredUnits" value={unit} />
      </div>

      <div className="grid2">
        <div>
          <label>Gender</label>
          <select name="gender" defaultValue={initial.gender}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="unspecified">Prefer not to say</option>
          </select>
        </div>
        <div>
          <label>Height (cm)</label>
          <input name="heightCm" type="number" step="0.1" defaultValue={initial.heightCm ?? ""} />
        </div>
      </div>

      <div className="grid2">
        <div>
          <label>Bodyweight ({unit})</label>
          <input name="bodyweight" className="input-num" type="number" step="0.1" defaultValue={bw} />
        </div>
        <div>
          <label>Training years</label>
          <input name="experienceYears" className="input-num" type="number" step="0.5" defaultValue={initial.experienceYears ?? ""} />
        </div>
      </div>

      <div>
        <label>Weight class</label>
        <select name="weightClassId" defaultValue={initial.weightClassId ?? ""} required>
          <option value="" disabled>Choose your weight class…</option>
          {weightClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.gender ? ` (${c.gender})` : ""}</option>
          ))}
        </select>
      </div>

      <div>
        <label>Experience class</label>
        <select name="experienceClassId" defaultValue={initial.experienceClassId ?? ""} required>
          <option value="" disabled>Choose your experience class…</option>
          {experienceClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {state?.error && <p className="error">{state.error}</p>}
      {state?.ok && !redirectTo && <p className="ok">Saved.</p>}
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}
