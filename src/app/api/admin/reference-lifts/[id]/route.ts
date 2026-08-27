import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";

// Guarded delete: hard-delete only if unused, otherwise soft-archive.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { id } = await params;

  const [links, parts, userValues] = await Promise.all([
    prisma.workoutReferenceLift.count({ where: { referenceLiftId: id } }),
    prisma.workoutSetPart.count({ where: { referenceLiftId: id } }),
    prisma.userReferenceLift.count({ where: { referenceLiftId: id } }),
  ]);
  try {
    if (links + parts + userValues > 0) {
      await prisma.referenceLift.update({ where: { id }, data: { status: "archived" } });
      return NextResponse.json({ ok: true, archived: true });
    }
    await prisma.referenceLift.delete({ where: { id } });
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ ok: true, archived: false });
}
