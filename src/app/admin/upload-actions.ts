"use server";

import { randomBytes } from "crypto";
import { requireUser } from "@/lib/auth";

// Uploads workout background images to the Supabase Storage "workout-images"
// bucket (admin-only writes via the service role; public read).
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const BUCKET = "workout-images";

export async function uploadWorkoutImageAction(
  formData: FormData
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!user.isAdmin) return { ok: false, error: "Admins only" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file selected" };
  if (file.size > MAX_BYTES) return { ok: false, error: "Image must be under 2 MB" };
  const ext = ALLOWED[file.type];
  if (!ext) return { ok: false, error: "Use a JPEG, PNG or WebP image" };

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return { ok: false, error: "Storage is not configured" };

  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const res = await fetch(`${base}/storage/v1/object/${BUCKET}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": file.type,
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!res.ok) {
    return { ok: false, error: `Upload failed (${res.status})` };
  }

  return { ok: true, path: `${base}/storage/v1/object/public/${BUCKET}/${name}` };
}
