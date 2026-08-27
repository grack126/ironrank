import {
  absoluteComparable,
  relativeComparable,
  type ChallengeType,
} from "@/lib/shared/challenge";
import type { DotsSex } from "@/lib/shared/dots";

export interface BoardSubmission {
  userId: string;
  rawValue: number;
  bodyweightAtAttemptKg: number | null;
  verificationStatus: string;
  videoUrl: string | null;
  displayName: string;
  username: string;
  gender: string;
  profileBodyweightKg: number | null;
  weightClassId: string | null;
  experienceClassId: string | null;
  avatar?: string; // avatar glyph; optional so non-board callers needn't populate it
}

export interface BoardRow {
  rank: number;
  userId: string;
  displayName: string;
  username: string;
  bodyweightKg: number | null;
  rawValue: number;
  comparable: number;
  verificationStatus: string;
  videoUrl: string | null;
  avatar: string;
}

export type BoardView = "absolute" | "relative";

/**
 * Build a ranked board: keep each athlete's best submission for the chosen view,
 * drop rejected ones, optionally restrict to verified, then rank (higher = better).
 */
export function buildBoard(
  subs: BoardSubmission[],
  opts: {
    view: BoardView;
    challengeType: ChallengeType;
    verifiedOnly: boolean;
    weightClassId?: string | null;
    experienceClassId?: string | null;
  }
): BoardRow[] {
  const best = new Map<string, BoardRow>();

  for (const s of subs) {
    if (s.verificationStatus === "rejected") continue;
    if (opts.verifiedOnly && s.verificationStatus !== "verified") continue;
    if (opts.weightClassId && s.weightClassId !== opts.weightClassId) continue;
    if (opts.experienceClassId && s.experienceClassId !== opts.experienceClassId) continue;

    const bw = s.bodyweightAtAttemptKg ?? s.profileBodyweightKg;
    const sex = (s.gender === "male" || s.gender === "female" ? s.gender : null) as DotsSex | null;
    const comparable =
      opts.view === "relative"
        ? relativeComparable(s.rawValue, opts.challengeType, bw, sex)
        : absoluteComparable(s.rawValue, opts.challengeType);

    const existing = best.get(s.userId);
    if (!existing || comparable > existing.comparable) {
      best.set(s.userId, {
        rank: 0,
        userId: s.userId,
        displayName: s.displayName,
        username: s.username,
        bodyweightKg: bw,
        rawValue: s.rawValue,
        comparable,
        verificationStatus: s.verificationStatus,
        videoUrl: s.videoUrl,
        avatar: s.avatar ?? "🧍",
      });
    }
  }

  const rows = [...best.values()].sort((a, b) => b.comparable - a.comparable);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
