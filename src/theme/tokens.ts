// Ignite & Ice — single source of truth for design tokens.
// Near-black base, ignition-orange primary accent, electric-cyan secondary.
// CSS variables in globals.css mirror these; components read either, never hardcode.

export const colors = {
  bg: "#0F0F11", // rgb(15,15,17)   global app background
  surface: "#202024", // rgb(32,32,36)  cards, containers, nav bars
  surface2: "#26262B", // derived: nested boxes / inputs, one step lighter
  border: "rgba(255,255,255,0.08)",
  pressed: "#2E2E34", // derived: hover / pressed
  text: "#FAFAFA", // rgb(250,250,250) headings, titles, numbers
  textMuted: "#9CA3AF", // rgb(156,163,175) descriptions, timestamps
  textFaint: "#868E9B", // derived: de-emphasised meta, still AA on both surfaces
  accent: "#FF4500", // rgb(255,69,0)   IGNITE — primary CTAs, active states
  accentPress: "#E03D00",
  onAccent: "#0F0F11", // ink on orange/cyan fills (5.6:1 on orange, 8.9:1 on cyan)
  success: "#38BDF8", // rgb(56,189,248) ICE — progress, success, toggles, charts
  // Rose rather than red: the old #F0473C sat too close to the orange accent to
  // read as a distinct "failed" state.
  danger: "#FF5C7A",
  warning: "#FF4500",
  icon: "#FAFAFA", // functional/inline Lucide icons
  iconAccent: "#38BDF8", // decorative Lucide icons — ICE, keeping IGNITE for actions
} as const;

export type RankTierKey = "bronze" | "silver" | "gold" | "platinum" | "diamond";

// Each tier rendered as material: a metallic gradient (light → base → shadow),
// a sheen highlight, plus a readable on-metal text colour from the same family.
export const rankMetals: Record<
  RankTierKey,
  { base: string; light: string; shadow: string; edge: string; ink: string; order: number }
> = {
  bronze: { base: "#B0703A", light: "#D89A5E", shadow: "#7E4F28", edge: "#8A5A2E", ink: "#3A2412", order: 1 },
  silver: { base: "#C7CBD1", light: "#EDEFF2", shadow: "#9AA0A8", edge: "#A9AFB7", ink: "#33373D", order: 2 },
  gold: { base: "#E8B23A", light: "#F6D783", shadow: "#B07F1C", edge: "#A9781A", ink: "#3A2606", order: 3 },
  platinum: { base: "#9FE0E8", light: "#CFF3F7", shadow: "#6FB9C2", edge: "#5FA7B0", ink: "#163A3F", order: 4 },
  diamond: { base: "#8AD8FF", light: "#C9ECFF", shadow: "#5AA6D8", edge: "#4F97C8", ink: "#0E3A52", order: 5 },
};

/** Map a tier name (admin-defined, free text) to a metal by keyword, else by index. */
export function metalForTier(name: string, indexFromTop = 0): RankTierKey {
  const n = name.toLowerCase();
  if (n.includes("diamond")) return "diamond";
  if (n.includes("platinum") || n.includes("plat")) return "platinum";
  if (n.includes("gold") || n.includes("elite") || n.includes("champion")) return "gold";
  if (n.includes("silver")) return "silver";
  if (n.includes("bronze")) return "bronze";
  const order: RankTierKey[] = ["bronze", "silver", "gold", "platinum", "diamond"];
  return order[Math.min(indexFromTop, order.length - 1)];
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { chip: 12, input: 14, button: 16, card: 22, cardLg: 28, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 20, xl: 28, xxl: 40, xxxl: 56 } as const;
