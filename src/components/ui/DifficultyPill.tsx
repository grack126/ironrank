"use client";
import type { Difficulty } from "@/lib/shared/workout";

export function DifficultyPill({
  difficulty,
  percentage,
  points,
  weightLabel,
  selected,
  onSelect,
}: {
  difficulty: Difficulty;
  percentage: number;
  points: number;
  weightLabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`diff-btn ${difficulty} ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="d-name">{difficulty}</div>
      <div className="d-meta">
        {percentage}% · {points}pt
      </div>
      <div className="d-meta">{weightLabel}</div>
    </button>
  );
}
