import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Home, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/accueil" as const, label: "Accueil", icon: Home },
  { to: "/capture" as const, label: "Ajouter", icon: Plus },
  { to: "/rapport" as const, label: "Rapport", icon: BarChart3 },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg border-t border-border bg-card/95 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
    >
      <div className="grid grid-cols-3">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to === "/capture" && pathname === "/classer");
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "press flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-xs font-extrabold text-muted-foreground active:press-active",
                active && "bg-muted text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 3 : 2.25} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}