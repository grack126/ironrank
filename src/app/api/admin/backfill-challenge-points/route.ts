import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { awardChallengePoints } from "@/lib/server-progression";

// Maintenance / historical back-fill: recompute Challenge Points for every
// already-finalized challenge under the current rules (top-50 per weight class).
// Wipes the log + resets all profile totals to 0 first, so a rules change can't
// leave stale rows behind, then recomputes cleanly. Idempotent — safe to rerun.
export async function POST(req: Request) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  // Clean slate: the log is fully derivable from finalized challenges' submissions.
  await prisma.challengePointsLog.deleteMany({});
  await prisma.profile.updateMany({ data: { challengePointsTotal: 0 } });

  const finalized = await prisma.challenge.findMany({ where: { finalizedAt: { not: null } }, select: { id: true } });
  let awarded = 0;
  for (const c of finalized) {
    const r = await awardChallengePoints(c.id);
    awarded += r.awarded;
  }
  return NextResponse.json({ ok: true, challenges: finalized.length, awarded });
}
