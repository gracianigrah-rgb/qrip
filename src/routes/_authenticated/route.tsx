import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/qrip/Screen";
import { BottomNav } from "@/components/qrip/BottomNav";
import { useSession } from "@/lib/qrip";
import qripLogoAsset from "@/assets/qrip-logo.png.asset.json";

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
      <header className="fixed inset-x-0 top-0 z-50 mx-auto flex h-[calc(3.75rem+env(safe-area-inset-top))] max-w-lg items-end border-b border-border bg-card/95 px-5 pb-3 backdrop-blur-xl">
        <img src={qripLogoAsset.url} alt="qrip" className="h-8 w-auto" />
      </header>
      <div className="pt-[calc(3.75rem+env(safe-area-inset-top))]">
        <Outlet />
      </div>
       <BottomNav />
    </div>
  );
}
