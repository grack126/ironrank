import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/ProfileForm";
import { SectionTitle, IconWelcome } from "@/components/ui/icons";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [weightClasses, experienceClasses] = await Promise.all([
    prisma.weightCategory.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true, gender: true } }),
    prisma.experienceClass.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div style={{ paddingTop: 24 }}>
      <SectionTitle as="h1" icon={IconWelcome}>Welcome</SectionTitle>
      <p className="muted small">
        Tell us a bit about yourself so we can rank you fairly and calculate your working weights.
      </p>

      <div className="banner">
        <strong>Verified vs unverified:</strong> challenge attempts start unverified. Attach a video link
        to get verified and count toward official boards. Workouts earn you a personal <strong>rank</strong>.
      </div>

      <div className="card">
        <ProfileForm
          redirectTo="/workouts"
          weightClasses={weightClasses}
          experienceClasses={experienceClasses}
          initial={{
            displayName: user.profile?.displayName ?? "",
            gender: user.profile?.gender ?? "unspecified",
            heightCm: user.profile?.heightCm ?? null,
            bodyweightKg: user.profile?.bodyweightKg ?? null,
            experienceYears: user.profile?.experienceYears ?? null,
            weightClassId: user.profile?.weightClassId ?? null,
            experienceClassId: user.profile?.experienceClassId ?? null,
            preferredUnits: user.profile?.preferredUnits ?? "kg",
          }}
        />
      </div>
    </div>
  );
}
