"use client";
import { useRouter } from "next/navigation";

// Extensible ranking dropdown for the leaderboard. Add a new ranking type by
// appending to RANKINGS here + handling its mode in leaderboard/page.tsx — the
// UI needs no other changes.
export interface RankingOption {
  value: string;
  label: string;
}

export function RankingSelect({ options, value }: { options: RankingOption[]; value: string }) {
  const router = useRouter();
  return (
    <select
      aria-label="Ranking type"
      className="nav-jump"
      value={value}
      onChange={(e) => router.push(`/leaderboard?mode=${e.target.value}`)}
      style={{ width: "auto" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
