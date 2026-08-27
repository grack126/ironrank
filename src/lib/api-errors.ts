// Shared guards for API mutation routes.

/** True when a thrown Prisma error means "record not found" (P2025). */
export function isPrismaNotFound(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2025";
}
