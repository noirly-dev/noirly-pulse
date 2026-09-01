import { cn } from "@noirly-dev/ui";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

type Props = {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-11 text-sm",
};

export function Avatar({ name, src, size = "md", className }: Props) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-[var(--surface-2)] font-medium text-[var(--foreground)]",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
