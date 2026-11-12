import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Spojí CSS třídy a vyřeší konflikty Tailwindu. */
export function cn(...tridy: ClassValue[]): string {
  return twMerge(clsx(tridy));
}
