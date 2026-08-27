import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getApiUser } from "@/lib/api-auth";
import { addXp } from "@/lib/server-progression";

const XP_VERIFIED = 25;

// Verify or reject a submission. XP is granted immediately on verification and
// clawed back on a later rejection; placement badges wait for finalization.
const schema = z.object({
  action: z.enum(["verify", "reject"]),
  notes: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiUser(req);
  if (!admin) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!admin.isAdmin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

  if (parsed.data.action === "verify") {
    await prisma.submission.update({
      where: { id },
      data: { verificationStatus: "verified", verifiedById: admin.id, verificationNotes: null },
    });
    if (sub.verificationStatus !== "verified") await addXp(sub.userId, XP_VERIFIED);
  } else {
    if (sub.verificationStatus === "verified") await addXp(sub.userId, -XP_VERIFIED);
    await prisma.submission.update({
      where: { id },
      data: { verificationStatus: "rejected", verifiedById: admin.id, verificationNotes: parsed.data.notes || null },
    });
  }

  return NextResponse.json({ ok: true });
}
