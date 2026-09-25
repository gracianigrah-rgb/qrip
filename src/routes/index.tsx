import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Logo } from "@/components/qrip/Screen";
import { useSession } from "@/lib/qrip";
import openingLogoAsset from "@/assets/qrip-opening-logo.jpg.asset.json";
import { KNOWN_PHONE_KEY } from "@/lib/pending-invoice";

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
      const knownPhone = localStorage.getItem(KNOWN_PHONE_KEY);
      if (session) navigate({ to: "/accueil", replace: true });
      else if (knownPhone) navigate({ to: "/code", search: { phone: knownPhone }, replace: true });
      else navigate({ to: "/auth", replace: true });
    }, 1400);
    return () => clearTimeout(timer);
  }, [loading, session, navigate]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-card px-8">
      <img src={openingLogoAsset.url} alt="qrip" className="animate-pop-in w-full max-w-sm object-contain" />
    </div>
  );
}
