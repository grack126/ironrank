import Link from "next/link";

export function TopBar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link href="/workouts" className="brand">
        Iron<span>Rank</span>
      </Link>
      {right}
    </header>
  );
}
