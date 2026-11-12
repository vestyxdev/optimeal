import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Textový vstup systému – jednotný vzhled, focus prstenec značky. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg",
          "placeholder:text-muted",
          "focus:outline-2 focus:outline-offset-0 focus:outline-primary",
          "disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-fg">
      {children}
    </label>
  );
}
