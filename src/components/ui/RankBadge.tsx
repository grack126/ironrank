import { metalForTier, rankMetals, type RankTierKey } from "@/theme/tokens";

function metalStyle(key: RankTierKey): React.CSSProperties {
  const m = rankMetals[key];
  return {
    background: `linear-gradient(135deg, ${m.light} 0%, ${m.base} 46%, ${m.shadow} 100%)`,
    color: m.ink,
    border: `1px solid ${m.edge}`,
  };
}

/**
 * Metallic rank badge. `name` is the admin-defined tier name (free text);
 * it's mapped to a metal by keyword, falling back to `index` (0 = lowest).
 */
export function RankBadge({
  name,
  index = 0,
  size = "md",
}: {
  name: string;
  index?: number;
  size?: "sm" | "md" | "lg";
}) {
  const key = metalForTier(name, index);
  const dims =
    size === "lg"
      ? { padding: "8px 16px 8px 8px", fontSize: 16, gap: 8 }
      : size === "sm"
        ? { padding: "3px 9px 3px 4px", fontSize: 11, gap: 5 }
        : { padding: "5px 12px 5px 5px", fontSize: 13, gap: 6 };
  const dot = size === "lg" ? 22 : size === "sm" ? 13 : 16;

  return (
    <span className="rank-chip" style={{ ...metalStyle(key), ...dims }}>
      <span className="rank-dot" style={{ width: dot, height: dot, background: rankMetals[key].base }}>
        <span className="sheen" />
      </span>
      <span style={{ position: "relative", zIndex: 2 }}>{name}</span>
      <span className="sheen" />
    </span>
  );
}

export { metalStyle };
