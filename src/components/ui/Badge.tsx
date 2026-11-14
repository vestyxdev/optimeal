import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tono = "neutral" | "primary" | "accent" | "ok" | "warning" | "danger";

const TONY: Record<Tono, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary",
  accent: "bg-accent text-accent-ink",
  ok: "bg-ok-soft text-ok",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

/** Malá označkovací tableta (status, sleva, kategorie…). */
export function Badge({
  tono = "neutral",
  className,
  children,
}: HTMLAttributes<HTMLSpanElement> & { tono?: Tono; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold",
        TONY[tono],
        className,
      )}
    >
      {children}
    </span>
  );
}
