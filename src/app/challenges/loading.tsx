import { MediaCardSkeleton } from "@/components/ui/MediaCard";
import { SectionTitle, IconChallenge } from "@/components/ui/icons";

export default function Loading() {
  return (
    <>
      <SectionTitle as="h1" icon={IconChallenge}>Challenges</SectionTitle>
      <MediaCardSkeleton />
      <MediaCardSkeleton />
    </>
  );
}
