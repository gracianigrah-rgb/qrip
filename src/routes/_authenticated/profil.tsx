import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, Phone, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { isProfileComplete, useProfile } from "@/lib/profile";

const CURRENCIES = ["XOF", "EUR", "USD"];

export const Route = createFileRoute("/_authenticated/profil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Profil entreprise — qrip" },
      { name: "description", content: "Gérez les informations de votre entreprise et votre compte qrip." },
      { property: "og:title", content: "Profil entreprise — qrip" },
      { property: "og:description", content: "Gérez les informations de votre entreprise et votre compte qrip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Profil,
});

function Profil() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [saving, setSaving] = useState(false);

  const { data: profile, isLoading } = useProfile();
  const incomplete = !isLoading && !isProfileComplete(profile);

  useEffect(() => {
    if (profile?.business_name) setBusinessName(profile.business_name);
    if (profile?.currency) setCurrency(profile.currency);
  }, [profile?.business_name, profile?.currency]);

  async function saveProfile() {
    const name = businessName.trim();
    if (name.length < 2) {
      toast.error("Entrez le nom de votre entreprise.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Session introuvable");
      const { error } = await supabase
        .from("profiles")
        .update({ business_name: name, currency })
        .eq("id", userData.user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profil entreprise enregistré.");
      if (incomplete) navigate({ to: "/accueil" });
    } catch {
      toast.error("Le profil n’a pas pu être enregistré.");
    } finally {
      setSaving(false);
    }
  }


  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Screen title="Profil entreprise" className="space-y-5">
      <section className="rounded-3xl bg-gradient-teal p-6 card-pop">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-card/80 text-teal-foreground">
          <Building2 className="size-7" />
        </div>
        <p className="mt-4 text-sm font-bold text-teal-foreground/80">Votre activité</p>
        <p className="text-2xl font-extrabold text-teal-foreground">
          {businessName.trim() || "Mon entreprise"}
        </p>
      </section>

      <section className="space-y-4 rounded-3xl bg-card p-5 soft-shadow">
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Nom de l’entreprise</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <Building2 className="size-5 shrink-0 text-muted-foreground" />
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              maxLength={80}
              placeholder="Nom de votre activité"
              className="min-w-0 flex-1 bg-transparent font-bold outline-none"
            />
          </div>
        </label>

        <div>
          <p className="text-sm font-bold text-muted-foreground">Numéro du compte</p>
          <p className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 font-bold">
            <Phone className="size-5 text-muted-foreground" />
            {isLoading ? "Chargement…" : profile?.phone || "Non renseigné"}
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-muted-foreground">Devise</p>
          <p className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 font-bold">
            <WalletCards className="size-5 text-muted-foreground" />
            {profile?.currency || "XOF"}
          </p>
        </div>

        <BigButton tone="teal" disabled={saving || isLoading} onClick={saveProfile}>
          {saving ? "Enregistrement…" : "Enregistrer mon profil"}
        </BigButton>
      </section>

      <Button variant="destructive" size="lg" onClick={signOut} className="h-14 w-full rounded-2xl text-base font-extrabold">
        <LogOut className="size-5" /> Se déconnecter
      </Button>
    </Screen>
  );
}