"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptics";
import {
  IconChallenge,
  IconWorkout,
  IconBoard,
  IconGroups,
  IconProfile,
  IconAdmin,
} from "@/components/ui/icons";

const tabs = [
  { href: "/challenges", label: "Challenges", icon: IconChallenge },
  { href: "/workouts", label: "Workouts", icon: IconWorkout },
  { href: "/leaderboard", label: "Board", icon: IconBoard },
  { href: "/groups", label: "Groups", icon: IconGroups },
  { href: "/profile", label: "Profile", icon: IconProfile },
];

export function TabBar({ isAdmin }: { isAdmin?: boolean }) {
  const path = usePathname();
  const items = isAdmin ? [...tabs, { href: "/admin", label: "Admin", icon: IconAdmin }] : tabs;
  return (
    <nav className="tabbar" aria-label="Primary">
      {items.map((t) => {
        const active = path === t.href || path.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`tab ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => haptic("tick")}
          >
            <Icon className="ico" size={20} strokeWidth={active ? 2.5 : 2} aria-hidden />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
