import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { Keypad, PinDots } from "@/components/qrip/Keypad";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone, phoneToEmail, pinToPassword } from "@/lib/qrip";

const searchSchema = z.object({ phone: z.string().catch("") });

export const Route = createFileRoute("/code")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Votre code à 4 chiffres — qrip" },
      { name: "description", content: "Saisissez votre code secret qrip sur le clavier de l'application." },
      { property: "og:title", content: "Votre code à 4 chiffres — qrip" },
      { property: "og:description", content: "Saisissez votre code secret qrip sur le clavier de l'application." },
    ],
  }),
  component: CodePage,
});

type Step = "enter" | "confirm";

function CodePage() {
  const navigate = useNavigate();
  const { phone } = Route.useSearch();
  const [pin, setPin] = useState("");
  const [firstPin, setFirstPin] = useState("");
  const [step, setStep] = useState<Step>("enter");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!phone) navigate({ to: "/auth", replace: true });
  }, [phone, navigate]);

  const clean = normalizePhone(phone);
  const email = phoneToEmail(clean);

  async function finishSignUp(code: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pinToPassword(clean, code),
    });
    if (error) {
      setPin("");
      setFirstPin("");
      setStep("enter");
      toast.error(
        error.message.toLowerCase().includes("already")
          ? "Ce numéro a déjà un code. Entrez le bon code."
          : "Impossible de créer le compte. Réessayez.",
      );
      return;
    }
    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").upsert({ id: userId, phone: clean }, { onConflict: "id" });
    }
    toast.success("Compte créé, bienvenue sur qrip 🎉");
    navigate({ to: "/accueil", replace: true });
  }

  async function submit(code: string) {
    setBusy(true);
    try {
      if (step === "confirm") {
        if (code !== firstPin) {
          setPin("");
          toast.error("Les deux codes sont différents.");
          return;
        }
        await finishSignUp(code);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: pinToPassword(clean, code),
      });
      if (!error) {
        toast.success("Content de vous revoir 👋");
        navigate({ to: "/accueil", replace: true });
        return;
      }
      // No account with this code yet → treat as a new registration.
      setFirstPin(code);
      setPin("");
      setStep("confirm");
    } finally {
      setBusy(false);
    }
  }

  function onDigit(d: string) {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) setTimeout(() => submit(next), 180);
  }

  return (
    <Screen
      back="/auth"
      title={step === "enter" ? "Votre code" : "Confirmez le code"}
      subtitle={clean}
      className="flex flex-col justify-between gap-8"
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 pt-6">
        <p className="text-center font-semibold text-muted-foreground">
          {step === "enter"
            ? "Tapez votre code à 4 chiffres. S'il n'existe pas encore, nous le créerons."
            : "Retapez le même code pour le confirmer."}
        </p>
        <PinDots length={4} filled={pin.length} />
        {busy && <p className="text-sm font-bold text-muted-foreground">Un instant…</p>}
      </div>

      <div className="mx-auto w-full max-w-sm pb-4">
        <Keypad onDigit={onDigit} onDelete={() => setPin((p) => p.slice(0, -1))} />
        {step === "confirm" && (
          <BigButton
            tone="ghost"
            className="mt-4"
            onClick={() => {
              setStep("enter");
              setFirstPin("");
              setPin("");
            }}
          >
            Changer de code
          </BigButton>
        )}
      </div>
    </Screen>
  );
}
