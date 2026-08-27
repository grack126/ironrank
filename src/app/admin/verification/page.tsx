import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TopBar } from "@/components/TopBar";
import { VerificationQueue } from "@/components/VerificationQueue";
import { formatRawValue, type ChallengeType } from "@/lib/shared/challenge";
import { displayWeight } from "@/lib/shared/units";

export default async function VerificationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/workouts");

  const pending = await prisma.submission.findMany({
    where: { verificationStatus: "pending" },
    include: {
      challenge: { select: { title: true, challengeType: true, unitLabel: true } },
      user: { select: { profile: { select: { displayName: true, username: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <TopBar right={<Link href="/admin" className="pill">← Admin</Link>} />
      <h1>Verification queue</h1>
      <p className="muted small">
        Review video proof against the movement standard. Verified entries count toward
        official boards and award XP.
      </p>
      <VerificationQueue
        items={pending.map((s) => ({
          id: s.id,
          challengeTitle: s.challenge.title,
          athlete: s.user.profile?.displayName ?? "Unknown",
          rawLabel: formatRawValue(s.rawValue, s.challenge.challengeType as ChallengeType, s.challenge.unitLabel),
          bodyweight: s.bodyweightAtAttemptKg != null ? `BW ${displayWeight(s.bodyweightAtAttemptKg, "kg")}` : "BW —",
          videoUrl: s.videoUrl,
          submittedAt: s.createdAt.toLocaleDateString(),
        }))}
      />
    </>
  );
}
