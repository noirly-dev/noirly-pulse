"use client";

import { ThemePicker } from "@/src/components/ThemePicker";
import { ThemeToggle } from "@/src/components/ThemeToggle";
import { cn } from "@noirly-dev/ui";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

/** Palette picker + light/dark toggle — drop into any page header. */
export function ThemeControls({ className, size = "md" }: Props) {
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <ThemePicker size={size} />
      <ThemeToggle size={size} />
    </div>
  );
}
