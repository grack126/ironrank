// Single source of truth for iconography — Lucide, referenced by semantic name so
// screens never import lucide-react directly (swap an icon here, it changes app-wide).
// Lucide strokes inherit `currentColor`, so colour is controlled purely by CSS.
import {
  Trophy,
  Dumbbell,
  ChartColumn,
  Users,
  User,
  Wrench,
  Flame,
  Snowflake,
  Medal,
  Zap,
  Bell,
  Check,
  X,
  TriangleAlert,
  BadgeCheck,
  Lock,
  Star,
  SlidersHorizontal,
  LayoutGrid,
  CircleCheck,
  Hand,
  Play,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export type { LucideIcon };

// ---- Navigation / sections ----
export const IconChallenge = Trophy;
export const IconWorkout = Dumbbell;
export const IconBoard = ChartColumn;
export const IconGroups = Users;
export const IconProfile = User;
export const IconAdmin = Wrench;
export const IconAllWorkouts = LayoutGrid;
export const IconRank = Medal;
export const IconStreak = Flame;
export const IconFreeze = Snowflake;
export const IconDaily = Zap;
export const IconBell = Bell;
export const IconWelcome = Hand;

// ---- State / actions ----
export const IconCheck = Check;
export const IconX = X;
export const IconWarn = TriangleAlert;
export const IconVerified = BadgeCheck;
export const IconSuccess = CircleCheck;
export const IconLock = Lock;
export const IconStar = Star;
export const IconTune = SlidersHorizontal;
export const IconPlay = Play;
export const IconChevron = ChevronDown;
export const IconChevronUp = ChevronUp;
export const IconEye = Eye;
export const IconEyeOff = EyeOff;
export const IconDelete = Trash2;

/**
 * Section heading with a themed accent icon (lime), used for every h1/h2 that
 * previously carried an emoji.
 */
export function SectionTitle({
  icon: Icon,
  children,
  as = "h2",
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  as?: "h1" | "h2";
}) {
  const Tag = as;
  return (
    <Tag className="sec-title">
      <Icon className="sec-ico" size={as === "h1" ? 26 : 20} strokeWidth={2.25} aria-hidden />
      <span>{children}</span>
    </Tag>
  );
}
