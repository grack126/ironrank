import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TabBar } from "@/components/TabBar";
import { TopBar } from "@/components/TopBar";
import { RankBadge } from "@/components/ui/RankBadge";
import { EmptyState } from "@/components/ui/primitives";
import { MediaCard, isImageSrc } from "@/components/ui/MediaCard";
import { SectionTitle, IconWorkout, IconAllWorkouts } from "@/components/ui/icons";

export default async function WorkoutsPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.profile) redirect("/onboarding");

  // ---- Category browse (default view) ----
  if (!cat) {
    const categories = await prisma.workoutCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { workouts: { where: { status: "published" } } } },
        // A category has no image of its own, so borrow one of its workouts'.
        workouts: {
          where: { status: "published", backgroundImagePath: { not: null } },
          select: { backgroundImagePath: true },
          take: 1,
        },
      },
    });
    const total = await prisma.workout.count({ where: { status: "published" } });
    const anyImage = await prisma.workout.findFirst({
      where: { status: "published", backgroundImagePath: { not: null } },
      select: { backgroundImagePath: true },
    });

    return (
      <>
        <TopBar />
        <SectionTitle as="h1" icon={IconWorkout}>Workouts</SectionTitle>
        <p className="muted small">Pick a plan to see its workouts.</p>

        <MediaCard
          href="/workouts?cat=all"
          title="All workouts"
          subtitle={`${total} total`}
          image={anyImage?.backgroundImagePath}
          icon={IconAllWorkouts}
        />
        {categories
          .filter((c) => c._count.workouts > 0)
          .map((c) => (
            <MediaCard
              key={c.id}
              href={`/workouts?cat=${c.id}`}
              title={c.name}
              subtitle={`${c._count.workouts} workout${c._count.workouts === 1 ? "" : "s"}`}
              image={isImageSrc(c.imageRef) ? c.imageRef : c.workouts[0]?.backgroundImagePath}
              glyph={isImageSrc(c.imageRef) ? undefined : c.imageRef || undefined}
              icon={IconWorkout}
            />
          ))}

        <TabBar isAdmin={user.isAdmin} />
      </>
    );
  }

  // ---- Workouts within a category (or all) ----
  const category = cat === "all" ? null : await prisma.workoutCategory.findUnique({ where: { id: cat } });
  const workouts = await prisma.workout.findMany({
    where: { status: "published", ...(cat === "all" ? {} : { categoryId: cat }) },
    include: { _count: { select: { sets: true } } },
    orderBy: { createdAt: "desc" },
  });

  const myBest = await prisma.workoutAttempt.findMany({
    where: { userId: user.id, status: "completed" },
    include: { achievedRankTier: true },
    orderBy: { totalPoints: "desc" },
  });
  const bestByWorkout = new Map<string, (typeof myBest)[number]>();
  for (const a of myBest) if (!bestByWorkout.has(a.workoutId)) bestByWorkout.set(a.workoutId, a);

  return (
    <>
      <TopBar right={<Link href="/workouts" className="pill">← Plans</Link>} />
      <h1>{cat === "all" ? "All workouts" : `${category?.imageRef ? category.imageRef + " " : ""}${category?.name ?? "Workouts"}`}</h1>
      {category?.description && <p className="muted small">{category.description}</p>}

      {workouts.length === 0 ? (
        <EmptyState icon={IconWorkout} title="No workouts here yet">
          {user.isAdmin && <Link href="/admin/workouts/new" className="btn auto">Build one</Link>}
        </EmptyState>
      ) : (
        <>
          {workouts.map((w) => {
            const best = bestByWorkout.get(w.id);
            return (
              <MediaCard
                key={w.id}
                href={`/workouts/${w.id}`}
                title={w.title}
                subtitle={`${w._count.sets} sets${best ? ` · best ${best.totalPoints} pts` : ""}`}
                image={w.backgroundImagePath}
                badge={
                  best?.achievedRankTier ? (
                    <RankBadge name={best.achievedRankTier.name} index={best.achievedRankTier.displayOrder} size="sm" />
                  ) : undefined
                }
              />
            );
          })}
        </>
      )}

      <TabBar isAdmin={user.isAdmin} />
    </>
  );
}
