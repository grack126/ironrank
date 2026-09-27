-- Workout feedback — Row-Level Security (defense-in-depth).
--
-- IMPORTANT, same caveat as rls-challenge-points.sql: the app reaches this table
-- through Prisma as the database owner (the `postgres.<ref>` pooler user), which
-- BYPASSES RLS. These statements only constrain DIRECT access via the Supabase
-- anon/authenticated keys (PostgREST).
--
-- This app does NOT use Supabase Auth — sessions are its own bcrypt + `Session`
-- table — so `auth.uid()` is always NULL here and any policy written against it
-- could never match a real athlete. Writing "users read their own rows" as a
-- PostgREST policy would therefore be decoration. Instead this table is
-- deny-by-default to every client key, and the actual authorization lives in the
-- server actions, which is where every real request goes:
--
--   * insert own only    — submitWorkoutFeedback() in src/app/feedback-actions.ts
--                          stamps userId from the session and verifies that a
--                          supplied workoutAttemptId belongs to that user and
--                          that workout. One row per attempt (unique index),
--                          plus an explicit guard for attempt-less feedback.
--   * read own only      — the workout page looks up feedback with
--                          { userId: <session user> } and only to decide whether
--                          to show the form or the "Feedback submitted" receipt.
--   * admin read all     — /admin/feedback redirects non-admins before querying.
--   * admin update isRead — setFeedbackRead() / markAllFeedbackRead() in
--                          src/app/admin/feedback-actions.ts both call
--                          requireAdmin() first, and isRead is the only column
--                          they write.
--
-- Apply out-of-band from `prisma db push`:
--   npx prisma db execute --file prisma/rls-workout-feedback.sql --schema prisma/schema.prisma

-- ============================ FORWARD ============================

ALTER TABLE "WorkoutFeedback" ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → PostgREST can neither read nor write it.
-- Revoke the table grants as well, so a future policy cannot silently open it up.
REVOKE ALL ON "WorkoutFeedback" FROM anon, authenticated;

-- service_role and the table owner bypass RLS entirely — that is how the app writes.

-- ============================ REVERSE ============================
-- To roll back:
--
--   GRANT ALL ON "WorkoutFeedback" TO anon, authenticated;
--   ALTER TABLE "WorkoutFeedback" DISABLE ROW LEVEL SECURITY;
--
-- To roll back the schema: remove `model WorkoutFeedback` and the three
-- back-relations (User.workoutFeedback, Workout.feedback,
-- WorkoutAttempt.feedback) from prisma/schema.prisma, then `npx prisma db push`.
-- Feedback is user-authored and NOT recomputable, so export it first if it
-- matters:
--   npx prisma db execute --stdin --schema prisma/schema.prisma <<< 'SELECT * FROM "WorkoutFeedback";'
