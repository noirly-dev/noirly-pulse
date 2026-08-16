import { cn } from "@/src/lib/cn";

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full border-t border-dashed border-hairline", className)} />;
}
