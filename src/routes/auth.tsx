import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { BigButton, Logo, Screen } from "@/components/qrip/Screen";
import { normalizePhone, phoneDigits } from "@/lib/qrip";
import { KNOWN_PHONE_KEY } from "@/lib/pending-invoice";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrer avec mon numéro — qrip" },
      { name: "description", content: "Créez votre compte qrip avec votre numéro de téléphone." },
      { property: "og:title", content: "Entrer avec mon numéro — qrip" },
      { property: "og:description", content: "Créez votre compte qrip avec votre numéro de téléphone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const digits = phoneDigits(phone);
  const valid = digits.length >= 8;

  useEffect(() => {
    const knownPhone = localStorage.getItem(KNOWN_PHONE_KEY);
    if (knownPhone) navigate({ to: "/code", search: { phone: knownPhone }, replace: true });
  }, [navigate]);

  return (
    <Screen
      className="flex flex-col justify-center"
      footer={
        <BigButton
          disabled={!valid}
          onClick={() => navigate({ to: "/code", search: { phone: normalizePhone(phone) } })}
        >
          Continuer
        </BigButton>
      }
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-8">
        <Logo size={88} />
        <div className="text-center">
          <h1 className="text-3xl font-extrabold">Bienvenue sur qrip</h1>
          <p className="mt-2 text-muted-foreground">
            Entrez votre numéro de téléphone. Vous choisirez ensuite un code à 4 chiffres.
          </p>
        </div>

        <div className="w-full rounded-3xl bg-card p-5 card-pop">
          <label htmlFor="phone" className="text-sm font-bold text-muted-foreground">
            Numéro de téléphone
          </label>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <Phone className="size-5 text-muted-foreground" />
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07 12 34 56 78"
              value={phone}
              maxLength={20}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-transparent text-xl font-extrabold outline-none placeholder:font-semibold placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Déjà inscrit ? Utilisez le même numéro, votre code vous ouvrira votre trésorerie.
          </p>
        </div>
      </div>
    </Screen>
  );
}
