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
        "inline-flex size-10 items-center justify-center text-muted transition-colors hover:bg-ink hover:text-canvas",
        className,
      )}
      {...props}
    />
  );
}
