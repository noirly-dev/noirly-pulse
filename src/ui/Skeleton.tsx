import { cn } from "@/src/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse bg-surface", className)} />
  );
}
