import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("om-karta p-5", className)} {...props} />;
}

export function CardNadpis({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn("text-base font-semibold mb-3", className)}>{children}</h3>;
}
