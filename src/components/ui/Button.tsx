import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Varianta = "primary" | "outline" | "ghost" | "danger" | "accent";
type Velikost = "sm" | "md" | "lg" | "icon";

const VARIANTY: Record<Varianta, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-strong",
  accent: "bg-accent text-accent-ink hover:brightness-95",
  outline: "border border-border bg-transparent text-fg hover:bg-surface-2",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:brightness-110",
};

const VELIKOSTI: Record<Velikost, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-9 w-9 p-0 justify-center",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  varianta?: Varianta;
  velikost?: Velikost;
  children?: ReactNode;
}

/** Základní tlačítko systému – plné, outline, ghost, danger, accent. */
export function Button({
  varianta = "primary",
  velikost = "md",
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-semibold",
        "transition-[background-color,filter] duration-150 select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.98]",
        VARIANTY[varianta],
        VELIKOSTI[velikost],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
