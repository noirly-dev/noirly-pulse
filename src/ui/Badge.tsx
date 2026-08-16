import { cn } from "@/src/lib/cn";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center bg-ink px-1.5 py-0.5 font-mono text-[10px] font-semibold text-canvas",
        className,
      )}
      {...props}
    />
  );
}
