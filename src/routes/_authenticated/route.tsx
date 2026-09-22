import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/qrip/Screen";
import { BottomNav } from "@/components/qrip/BottomNav";
import { useSession } from "@/lib/qrip";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="animate-float">
          <Logo size={72} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg bg-background pb-20">
      <Outlet />
      <BottomNav />
    </div>
  );
}
