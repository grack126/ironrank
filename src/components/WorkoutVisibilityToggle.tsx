"use client";
import { setWorkoutStatus } from "@/app/admin/admin-actions";
import { VisibilityToggle } from "./VisibilityToggle";

/** Show/hide a workout on the Workouts tab. "published" = visible, "draft" = hidden. */
export function WorkoutVisibilityToggle({ id, status }: { id: string; status: string }) {
  return (
    <VisibilityToggle
      visible={status === "published"}
      onToggle={(next) => setWorkoutStatus(id, next ? "published" : "draft")}
    />
  );
}
