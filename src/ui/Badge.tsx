import { cn } from "@/src/lib/cn";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-np-accent px-1.5 py-0.5 text-[10px] font-semibold text-np-accent-fg",
        className,
      )}
      {...props}
    />
  );
}
