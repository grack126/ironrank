/**
 * Renders a profile avatar from `Avatar.assetRef`, which may be either an image
 * path (e.g. "/avatars/titan.svg") or a legacy emoji glyph. Falls back to a
 * Lucide person icon when the user has no avatar set.
 */
import { IconProfile } from "./icons";

/** True when an assetRef points at an image rather than being an emoji glyph. */
export function isAvatarImage(assetRef?: string | null): boolean {
  return !!assetRef && (assetRef.startsWith("/") || assetRef.startsWith("http://") || assetRef.startsWith("https://"));
}

export function Avatar({
  assetRef,
  size = 32,
  className = "avatar-sm",
  alt = "",
}: {
  assetRef?: string | null;
  size?: number;
  /** Wrapper class; pass "" to drop the default circular chip styling. */
  className?: string;
  alt?: string;
}) {
  const inner = isAvatarImage(assetRef) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={assetRef!} alt={alt} width={size} height={size} style={{ display: "block", borderRadius: "50%" }} />
  ) : assetRef ? (
    <span style={{ fontSize: Math.round(size * 0.58), lineHeight: 1 }}>{assetRef}</span>
  ) : (
    <IconProfile size={Math.round(size * 0.58)} strokeWidth={2} />
  );

  return (
    <span
      className={className}
      style={className === "avatar-sm" ? { width: size, height: size } : undefined}
      aria-hidden={alt ? undefined : true}
    >
      {inner}
    </span>
  );
}
