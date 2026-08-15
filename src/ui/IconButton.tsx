import { cn } from "@/src/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export function IconButton({ className, label, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-lg text-[#A3A3A3] transition-colors hover:bg-np-surface-hover hover:text-[#F5F5F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-np-accent",
        className,
      )}
      {...props}
    />
  );
}
