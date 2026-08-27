import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger-ghost";

function cls(variant: Variant, pill?: boolean, sm?: boolean, auto?: boolean, extra?: string) {
  return [
    "btn",
    variant !== "primary" ? variant : "",
    pill ? "round" : "",
    sm ? "sm" : "",
    auto ? "auto" : "",
    extra ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  variant = "primary",
  pill,
  sm,
  auto,
  className,
  ...rest
}: {
  children: React.ReactNode;
  variant?: Variant;
  pill?: boolean;
  sm?: boolean;
  auto?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cls(variant, pill, sm, auto, className)} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  pill,
  sm,
  auto,
  className,
}: {
  children: React.ReactNode;
  href: string;
  variant?: Variant;
  pill?: boolean;
  sm?: boolean;
  auto?: boolean;
  className?: string;
}) {
  return (
    <Link href={href} className={cls(variant, pill, sm, auto, className)}>
      {children}
    </Link>
  );
}
