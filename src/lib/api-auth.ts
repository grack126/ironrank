import { randomBytes } from "crypto";
import { prisma } from "./db";

// Token (Bearer) auth for the mobile/API clients. Reuses the same Session table
// the web cookie sessions use — an API session is just a token row.
const SESSION_DAYS = 60;

export async function createApiSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function destroyApiSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

/** Resolve the user from an `Authorization: Bearer <token>` header, or null. */
export async function getApiUser(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const session = await prisma.session.findUnique({
    where: { token: match[1] },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** Like getApiUser but requires isAdmin. Returns the user or null (caller 401/403s). */
export async function getApiAdmin(req: Request) {
  const user = await getApiUser(req);
  if (!user || !user.isAdmin) return null;
  return user;
}
