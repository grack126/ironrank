import { NextResponse } from "next/server";
import { getApiAdmin } from "@/lib/api-auth";
import { finalizeChallenge } from "@/lib/server-progression";

// Admin: finalize a challenge now — computes final verified rankings, awards
// placement badges + Challenge Points, and marks it closed. Idempotent (skips if
// already finalized). Lets mobile admins close a challenge without waiting for the
// scheduled due-challenge job.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;
  const r = await finalizeChallenge(id);
  return NextResponse.json({ ok: true, finalized: r.finalized });
}
