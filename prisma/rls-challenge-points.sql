-- Challenge Points — Row-Level Security (defense-in-depth).
--
-- IMPORTANT: the app accesses these tables via Prisma as the database owner
-- (the `postgres.<ref>` pooler user), which BYPASSES RLS. These policies only
-- constrain DIRECT access through the Supabase anon/authenticated keys
-- (PostgREST). The real write-guard is that only the server-side finalization
-- function (awardChallengePoints) ever writes points.
--
-- Apply out-of-band from `prisma db push`:
--   npx prisma db execute --file prisma/rls-challenge-points.sql --schema prisma/schema.prisma

-- ============================ FORWARD ============================

-- 1. ChallengePointsLog: public leaderboard data — readable by all, no client writes.
ALTER TABLE "ChallengePointsLog" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenge_points_log_public_read" ON "ChallengePointsLog";
CREATE POLICY "challenge_points_log_public_read"
  ON "ChallengePointsLog" FOR SELECT
  TO anon, authenticated
  USING (true);
-- No INSERT/UPDATE/DELETE policies → anon/authenticated cannot write.
-- service_role and the table owner bypass RLS entirely (that's how finalization writes).

-- 2. Profile.challengePointsTotal: users must not edit their own points.
--    RLS is row-level, so a single-column write guard is done with GRANTs.
REVOKE UPDATE ("challengePointsTotal") ON "Profile" FROM anon, authenticated;

-- ============================ REVERSE ============================
-- To roll back the RLS above, run these statements:
--
--   DROP POLICY IF EXISTS "challenge_points_log_public_read" ON "ChallengePointsLog";
--   ALTER TABLE "ChallengePointsLog" DISABLE ROW LEVEL SECURITY;
--   GRANT UPDATE ("challengePointsTotal") ON "Profile" TO anon, authenticated;
--
-- To roll back the SCHEMA reshape (ChallengePointsLog columns): revert the model
-- in prisma/schema.prisma to the previous categoryType/categoryId shape and run
-- `npx prisma db push` again. The log is fully recomputable from finalized
-- challenges via the admin backfill endpoint, so no data is lost either way.
