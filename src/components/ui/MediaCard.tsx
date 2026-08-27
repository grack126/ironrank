import Link from "next/link";
import { IconWorkout, type LucideIcon } from "./icons";

/**
 * The single card used for challenges, workouts and workout categories.
 * Layout (see globals.css `.mcard`): a rounded info bar on top carrying all the
 * text, and a dominant rounded image area below it. Because the text lives in the
 * bar rather than over the image, the image needs no scrim.
 *
 * Long titles/subtitles truncate with an ellipsis instead of breaking the layout,
 * and a missing image renders a styled placeholder — never a broken image.
 */
export function MediaCard({
  href,
  title,
  subtitle,
  image,
  icon: Icon = IconWorkout,
  glyph,
  badge,
}: {
  href: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Image URL for the media area; falls back to the placeholder when absent. */
  image?: string | null;
  /** Lucide icon for the placeholder (UI chrome). */
  icon?: LucideIcon;
  /** Admin-authored emoji (e.g. a workout category's imageRef); wins over `icon`. */
  glyph?: string | null;
  /** Optional trailing element in the info bar (rank badge, "entered" pill…). */
  badge?: React.ReactNode;
}) {
  return (
    <Link href={href} className="mcard">
      <div className="mcard-info">
        <div className="mcard-info-text">
          <div className="mcard-title">{title}</div>
          {subtitle != null && <div className="mcard-sub">{subtitle}</div>}
        </div>
        {badge}
      </div>
      <div className="mcard-media">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" loading="lazy" />
        ) : (
          <div className="mcard-ph">
            <span className="glyph" aria-hidden>
              {glyph ? glyph : <Icon size={56} strokeWidth={1.5} />}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

/** Shimmer placeholder with the same footprint as MediaCard, for route loading states. */
export function MediaCardSkeleton() {
  return (
    <div className="mcard is-loading" aria-hidden>
      <div className="mcard-info">
        <div className="mcard-info-text">
          <div className="mcard-skel line" />
          <div className="mcard-skel line short" />
        </div>
      </div>
      <div className="mcard-skel block" />
    </div>
  );
}

/** True when a stored value is usable as an image src (URL or root-relative path). */
export function isImageSrc(value?: string | null): boolean {
  return !!value && (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/"));
}
