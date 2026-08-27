"use client";
import { setChallengeVisibility } from "@/app/admin/challenge-actions";
import { VisibilityToggle } from "./VisibilityToggle";

/**
 * Show/hide a challenge on the Challenges tab, which lists "published" and
 * "closed". Hiding archives it; showing restores the right status for its dates.
 */
export function ChallengeVisibilityToggle({ id, status }: { id: string; status: string }) {
  return (
    <VisibilityToggle
      visible={status === "published" || status === "closed"}
      onToggle={(next) => setChallengeVisibility(id, next)}
    />
  );
}
