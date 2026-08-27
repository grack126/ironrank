"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconEye, IconEyeOff } from "@/components/ui/icons";

/**
 * Inline show/hide control used on the admin workout and challenge lists.
 * The caller supplies the server action, so each entity keeps its own status rules.
 */
export function VisibilityToggle({
  visible,
  onToggle,
  hiddenHint = "Hidden from athletes — click to show",
  visibleHint = "Visible to athletes — click to hide",
}: {
  visible: boolean;
  onToggle: (next: boolean) => Promise<{ ok: boolean }>;
  hiddenHint?: string;
  visibleHint?: string;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(visible);
  const [pending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    // rows are links to the editor — don't navigate when hitting the toggle
    e.preventDefault();
    e.stopPropagation();
    const next = !current;
    setCurrent(next); // optimistic
    startTransition(async () => {
      const res = await onToggle(next);
      if (!res.ok) setCurrent(!next);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className={`btn sm auto ${current ? "secondary" : "ghost"}`}
      onClick={toggle}
      disabled={pending}
      aria-pressed={current}
      title={current ? visibleHint : hiddenHint}
    >
      {current ? <IconEye size={16} strokeWidth={2.25} aria-hidden /> : <IconEyeOff size={16} strokeWidth={2.25} aria-hidden />}
      {pending ? "…" : current ? "Visible" : "Hidden"}
    </button>
  );
}
