/** Shared vocabulary for workout feedback — used by the form, the action and the admin list. */

export const DIFFICULTY_RATINGS = ["too_easy", "just_right", "too_hard"] as const;
export type DifficultyRating = (typeof DIFFICULTY_RATINGS)[number];

export const FEEDBACK_TYPES = ["general", "bug_report"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const RATING_LABEL: Record<DifficultyRating, string> = {
  too_easy: "Too Easy",
  just_right: "Just Right",
  too_hard: "Too Hard",
};

/** Token used for the rating's colour indicator (yellow / green / red). */
export const RATING_TOKEN: Record<DifficultyRating, string> = {
  too_easy: "var(--rank-gold)",
  just_right: "var(--success)",
  too_hard: "var(--danger)",
};

export const TYPE_LABEL: Record<FeedbackType, string> = {
  general: "General",
  bug_report: "Bug Report",
};

export const COMMENT_MAX = 2000;

export type FeedbackFilter = {
  workoutId?: string;
  difficultyRating?: string;
  feedbackType?: string;
  /** "unread" | "read" | undefined (all) */
  readState?: string;
};

export type FeedbackWhere = {
  workoutId?: string;
  difficultyRating?: string;
  feedbackType?: string;
  isRead?: boolean;
};

/** Translate the UI filter into a Prisma where clause, ignoring unknown values. */
export function feedbackWhere(f: FeedbackFilter): FeedbackWhere {
  const where: FeedbackWhere = {};
  if (f.workoutId) where.workoutId = f.workoutId;
  if (f.difficultyRating && (DIFFICULTY_RATINGS as readonly string[]).includes(f.difficultyRating)) {
    where.difficultyRating = f.difficultyRating;
  }
  if (f.feedbackType && (FEEDBACK_TYPES as readonly string[]).includes(f.feedbackType)) {
    where.feedbackType = f.feedbackType;
  }
  if (f.readState === "unread") where.isRead = false;
  if (f.readState === "read") where.isRead = true;
  return where;
}
