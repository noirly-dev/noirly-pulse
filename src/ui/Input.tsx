import { cn } from "@/src/lib/cn";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-np-border bg-np-bg px-3 text-sm text-[#F5F5F5] outline-none placeholder:text-[#737373] focus:border-np-accent",
        className,
      )}
      {...props}
    />
  );
}
