import { MediaCardSkeleton } from "@/components/ui/MediaCard";
import { SectionTitle, IconWorkout } from "@/components/ui/icons";

export default function Loading() {
  return (
    <>
      <SectionTitle as="h1" icon={IconWorkout}>Workouts</SectionTitle>
      <MediaCardSkeleton />
      <MediaCardSkeleton />
    </>
  );
}
