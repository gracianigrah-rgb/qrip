import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/qrip/Screen";
import { useSession } from "@/lib/qrip";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "qrip — vos factures deviennent votre trésorerie" },
      {
        name: "description",
        content:
          "qrip transforme vos photos de factures en trésorerie claire : achats, ventes, résultat et rapport à partager avec votre banque.",
      },
      { property: "og:title", content: "qrip — vos factures deviennent votre trésorerie" },
      {
        property: "og:description",
        content: "Photographiez une facture, choisissez Achat ou Vente, suivez votre activité.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      navigate({ to: session ? "/accueil" : "/auth", replace: true });
    }, 1400);
    return () => clearTimeout(timer);
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-sun px-6">
      <div className="animate-pop-in flex flex-col items-center gap-6">
        <div className="animate-float">
          <Logo size={128} />
        </div>
        <h1 className="text-6xl font-extrabold tracking-tight text-sun-foreground">qrip</h1>
        <p className="text-center text-base font-semibold text-sun-foreground/80">
          Vos factures, votre trésorerie.
        </p>
      </div>
    </div>
  );
}
