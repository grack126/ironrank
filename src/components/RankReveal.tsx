"use client";
import { useEffect } from "react";
import Link from "next/link";
import { metalForTier, rankMetals } from "@/theme/tokens";
import { haptic } from "@/lib/haptics";
import { IconStar } from "@/components/ui/icons";

export function RankReveal({
  rankName,
  rankIndex = 0,
  totalPoints,
  maxPoints,
  isBest,
  onRetry,
}: {
  rankName: string | null;
  rankIndex?: number;
  totalPoints: number;
  maxPoints?: number;
  isBest: boolean;
  onRetry: () => void;
}) {
  const key = rankName ? metalForTier(rankName, rankIndex) : null;
  const m = key ? rankMetals[key] : null;

  useEffect(() => {
    haptic(isBest ? "reveal" : "success");
  }, [isBest]);

  const stageStyle: React.CSSProperties = m
    ? { background: `radial-gradient(120% 80% at 50% 0%, ${m.base}33 0%, transparent 62%), var(--surface)`, border: "1px solid var(--border)" }
    : { background: "var(--surface)", border: "1px solid var(--border)" };

  const medalStyle: React.CSSProperties = m
    ? { background: `linear-gradient(135deg, ${m.light} 0%, ${m.base} 48%, ${m.shadow} 100%)`, boxShadow: `0 0 40px ${m.base}55` }
    : { background: "linear-gradient(135deg, var(--surface-2), var(--border))" };

  return (
    <div className="reveal-stage animate-pop" style={stageStyle} role="status" aria-live="polite">
      <p className="eyebrow" style={{ marginBottom: 16 }}>
        {rankName ? "Rank achieved" : "Workout complete"}
      </p>

      <div className="reveal-medal animate-pop" style={medalStyle}>
        <span className="sheen-sweep animate-sweep" aria-hidden />
        <span className="label" style={{ color: m ? m.ink : "var(--text)" }}>
          {rankName ?? "Done"}
        </span>
      </div>

      <div className="stagger">
        <p className="reveal-pts" style={{ margin: "0 0 6px" }}>
          {totalPoints.toLocaleString()}
          <span style={{ fontSize: "var(--fs-20)", color: "var(--text-muted)" }}>
            {maxPoints != null ? ` / ${maxPoints} pts` : " pts"}
          </span>
        </p>
        {isBest && (
          <p style={{ marginBottom: 16 }}>
            <span className="pill accent">
              <IconStar size={13} strokeWidth={2.5} aria-hidden />
              New personal best
            </span>
          </p>
        )}
        <hr className="divider" />
        <div className="stack">
          <Link href="/profile" className="btn round">
            See it on your profile
          </Link>
          <button className="btn secondary" onClick={onRetry}>
            Run it again
          </button>
        </div>
      </div>
    </div>
  );
}
