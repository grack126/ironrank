"use client";
import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { markAllFeedbackRead, setFeedbackRead } from "@/app/admin/feedback-actions";
import { IconRead, IconUnread } from "@/components/ui/icons";
import {
  DIFFICULTY_RATINGS,
  FEEDBACK_TYPES,
  RATING_LABEL,
  RATING_TOKEN,
  TYPE_LABEL,
  type DifficultyRating,
  type FeedbackType,
} from "@/lib/shared/feedback";

export interface FeedbackRow {
  id: string;
  workoutId: string;
  workoutTitle: string;
  username: string;
  displayName: string;
  difficultyRating: string;
  feedbackType: string;
  comment: string | null;
  isRead: boolean;
  createdAt: string;
}

const COMMENT_PREVIEW = 180;

export function FeedbackTriage({
  rows,
  workouts,
  unreadInView,
}: {
  rows: FeedbackRow[];
  workouts: { id: string; title: string }[];
  /** Unread count within the current filter — drives the bulk-mark button. */
  unreadInView: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const get = (k: string) => params.get(k) ?? "";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  function toggleRead(row: FeedbackRow) {
    setBusyId(row.id);
    startTransition(async () => {
      await setFeedbackRead(row.id, !row.isRead);
      setBusyId(null);
      router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      await markAllFeedbackRead({
        workoutId: get("workout") || undefined,
        difficultyRating: get("rating") || undefined,
        feedbackType: get("type") || undefined,
        readState: get("read") || undefined,
      });
      router.refresh();
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="card">
        <div className="fb-filters">
          <div>
            <label htmlFor="f-workout">Workout</label>
            <select id="f-workout" value={get("workout")} onChange={(e) => setFilter("workout", e.target.value)}>
              <option value="">All workouts</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>{w.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-read">Status</label>
            <select id="f-read" value={get("read")} onChange={(e) => setFilter("read", e.target.value)}>
              <option value="">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-rating">Difficulty</label>
            <select id="f-rating" value={get("rating")} onChange={(e) => setFilter("rating", e.target.value)}>
              <option value="">Any rating</option>
              {DIFFICULTY_RATINGS.map((r) => (
                <option key={r} value={r}>{RATING_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-type">Type</label>
            <select id="f-type" value={get("type")} onChange={(e) => setFilter("type", e.target.value)}>
              <option value="">Any type</option>
              {FEEDBACK_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="row between" style={{ marginTop: 10, alignItems: "center" }}>
          <span className="small muted">
            {rows.length} item{rows.length === 1 ? "" : "s"}
            {unreadInView > 0 ? ` · ${unreadInView} unread` : ""}
          </span>
          <button
            className="btn secondary sm auto"
            disabled={pending || unreadInView === 0}
            onClick={markAll}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No feedback matches these filters.</p>
        ) : (
          rows.map((r) => {
            const rating = r.difficultyRating as DifficultyRating;
            const type = r.feedbackType as FeedbackType;
            const long = (r.comment?.length ?? 0) > COMMENT_PREVIEW;
            const open = expanded.has(r.id);
            return (
              <div key={r.id} className={`fb-row${r.isRead ? "" : " unread"}`}>
                <span className="fb-dot" aria-hidden />
                <div className="fb-body">
                  <div className="fb-head">
                    <strong>{r.workoutTitle}</strong>
                    <span className="fb-rating">
                      <span className="swatch" style={{ background: RATING_TOKEN[rating] ?? "var(--text-faint)" }} />
                      {RATING_LABEL[rating] ?? r.difficultyRating}
                    </span>
                    <span className={`pill${type === "bug_report" ? " danger" : ""}`}>
                      {TYPE_LABEL[type] ?? r.feedbackType}
                    </span>
                    {!r.isRead && <span className="pill accent">new</span>}
                  </div>
                  <div className="fb-meta">
                    @{r.username} · {r.createdAt}
                  </div>
                  {r.comment && (
                    <p className="fb-comment">
                      {long && !open ? `${r.comment.slice(0, COMMENT_PREVIEW)}…` : r.comment}
                      {long && (
                        <>
                          {" "}
                          <button className="link-btn" onClick={() => toggleExpand(r.id)}>
                            {open ? "less" : "more"}
                          </button>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <button
                  className="btn ghost sm auto"
                  disabled={pending && busyId === r.id}
                  onClick={() => toggleRead(r)}
                  title={r.isRead ? "Mark unread" : "Mark read"}
                >
                  {r.isRead ? (
                    <IconUnread size={15} strokeWidth={2.25} aria-hidden />
                  ) : (
                    <IconRead size={15} strokeWidth={2.25} aria-hidden />
                  )}
                  {r.isRead ? "Unread" : "Read"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
