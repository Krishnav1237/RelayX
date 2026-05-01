import { cn } from "@/lib/utils";

type AppBackgroundProps = {
  variant?: "landing" | "dashboard" | "logs";
};

const variantGradient: Record<NonNullable<AppBackgroundProps["variant"]>, string> = {
  landing: "from-emerald-950/10 via-background to-background dark:from-emerald-950/30",
  dashboard: "from-emerald-950/10 via-background to-background dark:from-emerald-950/25",
  logs: "from-cyan-950/10 via-background to-background dark:from-cyan-950/25",
};

export function AppBackground({ variant = "dashboard" }: AppBackgroundProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className={cn(
          "absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]",
          variantGradient[variant]
        )}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(113,113,122,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,113,122,0.14)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.68)_48%,transparent_100%)]" />
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background via-background/80 to-transparent" />
    </div>
  );
}
