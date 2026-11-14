import { cn } from "@/lib/cn";

/** Kostra načítaného obsahu – jemný puls, stejné zaoblení jako systém. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-surface-2", className)}
    />
  );
}

/** Skeleton textového odstavce. */
export function SkeletonText({ radky = 3, className }: { radky?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: radky }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === radky - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
