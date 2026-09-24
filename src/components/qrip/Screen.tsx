import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import qripLogoAsset from "@/assets/qrip-logo.png.asset.json";

export function Screen({
  title,
  subtitle,
  back,
  children,
  footer,
  className,
}: {
  title?: string;
  subtitle?: string;
  back?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {(title || back) && (
        <header className="flex items-center gap-3 px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
          {back && (
            <Link
              to={back}
              className="press flex size-11 items-center justify-center rounded-2xl bg-card text-foreground soft-shadow active:press-active"
              aria-label="Retour"
            >
              <ChevronLeft className="size-6" />
            </Link>
          )}
          <div className="min-w-0">
            {title && <h1 className="truncate text-2xl font-extrabold">{title}</h1>}
            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </header>
      )}
      <main className={cn("flex-1 px-5 pb-24 pt-2", className)}>{children}</main>
      {footer && (
        <footer className="px-5 pb-24 pt-2">{footer}</footer>
      )}
    </div>
  );
}

export function BigButton({
  tone = "flame",
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "flame" | "teal" | "sun" | "ghost";
}) {
  const tones: Record<string, string> = {
    flame: "bg-gradient-flame text-primary-foreground card-pop",
    teal: "bg-gradient-teal text-teal-foreground card-pop",
    sun: "bg-gradient-sun text-sun-foreground card-pop",
    ghost: "bg-card text-foreground soft-shadow border border-border",
  };
  return (
    <button
      {...props}
      className={cn(
        "press w-full rounded-3xl px-6 py-4 text-lg font-extrabold active:press-active disabled:opacity-50",
        tones[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Logo({ size = 96 }: { size?: number }) {
  return (
    <img
      src={qripLogoAsset.url}
      alt="Logo qrip"
      width={size}
      className="h-auto drop-shadow-xl"
      style={{ width: size }}
    />
  );
}
