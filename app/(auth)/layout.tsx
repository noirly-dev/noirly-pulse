import { ThemeControls } from "@/src/components/ThemeControls";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeControls size="sm" />
      </div>
      {children}
    </div>
  );
}
