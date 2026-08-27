import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getApiAdmin } from "@/lib/api-auth";
import { isPrismaNotFound } from "@/lib/api-errors";

// Guarded delete of a weight/experience class: hard-delete if unused, else archive.
export async function DELETE(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const admin = await getApiAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const { kind, id } = await params;

  try {
    if (kind === "weight") {
      const used =
        (await prisma.profile.count({ where: { weightClassId: id } })) +
        (await prisma.submission.count({ where: { weightClassId: id } }));
      if (used > 0) {
        await prisma.weightCategory.update({ where: { id }, data: { isActive: false } });
        return NextResponse.json({ ok: true, archived: true });
      }
      await prisma.weightCategory.delete({ where: { id } });
      return NextResponse.json({ ok: true, archived: false });
    }
    if (kind === "experience") {
      const used =
        (await prisma.profile.count({ where: { experienceClassId: id } })) +
        (await prisma.submission.count({ where: { experienceClassId: id } }));
      if (used > 0) {
        await prisma.experienceClass.update({ where: { id }, data: { isActive: false } });
        return NextResponse.json({ ok: true, archived: true });
      }
      await prisma.experienceClass.delete({ where: { id } });
      return NextResponse.json({ ok: true, archived: false });
    }
  } catch (e) {
    if (isPrismaNotFound(e)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
  return NextResponse.json({ error: "Unknown class kind" }, { status: 400 });
}
