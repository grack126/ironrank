"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAvatarAction } from "@/app/profile-actions";
import { haptic } from "@/lib/haptics";
import { IconLock } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";

export interface AvatarOption { id: string; name: string; assetRef: string; unlockLevel: number }

export function AvatarPicker({
  avatars,
  selectedId,
  level,
}: {
  avatars: AvatarOption[];
  selectedId: string | null;
  level: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(a: AvatarOption) {
    if (level < a.unlockLevel || busy) return;
    setBusy(true);
    haptic("tick");
    await setAvatarAction(a.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="avatar-grid">
      {avatars.map((a) => {
        const locked = level < a.unlockLevel;
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            className={`avatar-cell${selected ? " selected" : ""}${locked ? " locked" : ""}`}
            onClick={() => pick(a)}
            disabled={locked || busy}
            aria-label={`${a.name}${locked ? ` (unlocks at level ${a.unlockLevel})` : ""}`}
          >
            <span className="glyph" aria-hidden>
              {locked ? <IconLock className="i-muted" size={26} strokeWidth={2} /> : <Avatar assetRef={a.assetRef} size={40} className="" />}
            </span>
            <span className="nm">{a.name}</span>
            <span className="lv">{locked ? `Lv ${a.unlockLevel}` : selected ? "Selected" : "Tap to use"}</span>
          </button>
        );
      })}
    </div>
  );
}
