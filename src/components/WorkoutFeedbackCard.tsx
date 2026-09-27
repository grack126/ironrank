"use client";
import { useState, useTransition } from "react";
import { submitWorkoutFeedback } from "@/app/feedback-actions";
import { haptic } from "@/lib/haptics";
import { IconFeedback, IconSuccess } from "@/components/ui/icons";
import {
  COMMENT_MAX,
  DIFFICULTY_RATINGS,
  FEEDBACK_TYPES,
  RATING_LABEL,
  TYPE_LABEL,
  type DifficultyRating,
  type FeedbackType,
} from "@/lib/shared/feedback";

/**
 * Lightweight feedback card shown at the bottom of a workout. Inline, not a
 * modal — one submission per attempt, after which it collapses to a receipt.
 */
export function WorkoutFeedbackCard({
  workoutId,
  workoutAttemptId = null,
  alreadySubmitted = false,
}: {
  workoutId: string;
  /** Links the feedback to a specific completed attempt when there is one. */
  workoutAttemptId?: string | null;
  /** Server-known state: this attempt (or this workout) already has feedback. */
  alreadySubmitted?: boolean;
}) {
  const [rating, setRating] = useState<DifficultyRating | null>(null);
  const [type, setType] = useState<FeedbackType>("general");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(alreadySubmitted);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    if (!rating) return setError("Pick a difficulty rating first.");
    setError(null);
    startTransition(async () => {
      const res = await submitWorkoutFeedback({
        workoutId,
        workoutAttemptId,
        difficultyRating: rating,
        feedbackType: type,
        comment: comment.trim() || null,
      });
      if (!res.ok) return setError(res.error);
      haptic("success");
      setDone(true);
      setThanks(true);
    });
  }

  if (done) {
    return (
      <div className="card fb-card">
        <p className="fb-done">
          <IconSuccess className="i-success" size={18} strokeWidth={2.25} aria-hidden />
          <span>{thanks ? "Thanks for your feedback" : "Feedback submitted"}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="card fb-card">
      <h2 className="sec-title fb-title">
        <IconFeedback className="sec-ico" size={20} strokeWidth={2.25} aria-hidden />
        <span>How was this workout?</span>
      </h2>

      <div className="set-field-label">Difficulty rating</div>
      <div className="diff-grid">
        {DIFFICULTY_RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className={`diff-btn fb-rate${rating === r ? " selected" : ""}`}
            aria-pressed={rating === r}
            onClick={() => {
              setRating(r);
              setError(null);
              haptic("tick");
            }}
          >
            <div className="d-name">{RATING_LABEL[r]}</div>
          </button>
        ))}
      </div>

      <div className="set-field-label">Feedback type</div>
      <div className="fb-types">
        {FEEDBACK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`pill fb-type${type === t ? " accent" : ""}`}
            aria-pressed={type === t}
            onClick={() => setType(t)}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="set-field-label">
        <label htmlFor="fb-comment">Comment</label>
      </div>
      <textarea
        id="fb-comment"
        rows={3}
        maxLength={COMMENT_MAX}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Tell us what you think — too easy, too hard, or something broken?"
      />

      {error && <p className="error">{error}</p>}

      <button className="btn" style={{ marginTop: 10 }} disabled={pending || !rating} onClick={send}>
        {pending ? "Sending…" : "Submit feedback"}
      </button>
    </div>
  );
}
