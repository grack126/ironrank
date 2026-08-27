// Web Vibration API haptics. No-op on desktop / unsupported browsers.
type Kind = "tick" | "success" | "warning" | "reveal";

const PATTERNS: Record<Kind, number | number[]> = {
  tick: 10,
  success: [12, 40, 18],
  warning: [40, 30, 40],
  reveal: [18, 60, 24, 60, 40],
};

export function haptic(kind: Kind) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* ignore */
  }
}
