import { cn } from "@/src/lib/cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full border border-dashed border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted focus:border-ink",
        className,
      )}
      {...props}
    />
  );
}
