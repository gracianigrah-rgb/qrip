import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Camera, Flag, LogOut, MapPin, Phone, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessLogoUrl, isProfileComplete, useProfile } from "@/lib/profile";

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
  const [businessPhone, setBusinessPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useProfile();
  const incomplete = !isLoading && !isProfileComplete(profile);

  useEffect(() => {
    if (profile?.business_name) setBusinessName(profile.business_name);
    if (profile?.currency) setCurrency(profile.currency);
    if (profile?.business_phone) setBusinessPhone(profile.business_phone);
    if (profile?.city) setCity(profile.city);
    if (profile?.country) setCountry(profile.country);
    if (profile?.neighborhood) setNeighborhood(profile.neighborhood);
    if (profile?.logo_path) {
      getBusinessLogoUrl(profile.logo_path).then(setLogoPreview).catch(() => setLogoPreview(null));
    }
  }, [profile]);

  function chooseLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error("Choisissez une image de moins de 5 Mo.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function saveProfile() {
    const name = businessName.trim();
    if (name.length < 2) {
      toast.error("Entrez le nom de votre entreprise.");
      return;
    }
    if (!businessPhone.trim() || !city.trim() || !country.trim() || !neighborhood.trim()) {
      toast.error("Complétez toutes les coordonnées de l’entreprise.");
      return;
    }
    if (!logoFile && !profile?.logo_path) {
      toast.error("Ajoutez le logo de votre entreprise.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error("Session introuvable");
      let logoPath = profile?.logo_path ?? null;
      if (logoFile) {
        const extension = logoFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
        logoPath = `${userData.user.id}/logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("logos-entreprise")
          .upload(logoPath, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) throw uploadError;
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          business_name: name,
          business_phone: businessPhone.trim(),
          city: city.trim(),
          country: country.trim(),
          neighborhood: neighborhood.trim(),
          currency,
          logo_path: logoPath,
        })
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

      {incomplete && (
        <p className="rounded-3xl bg-gradient-sun p-5 text-sm font-bold text-sun-foreground">
          Complétez l’identité de votre entreprise pour créer des rapports professionnels. Vous pourrez la modifier à tout moment.
        </p>
      )}


      <section className="space-y-4 rounded-3xl bg-card p-5 soft-shadow">
        <div>
          <span className="text-sm font-bold text-muted-foreground">Logo de l’entreprise</span>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
              {logoPreview ? <img src={logoPreview} alt="Aperçu du logo" className="size-full object-contain" /> : <Building2 className="size-8 text-muted-foreground" />}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => chooseLogo(event.target.files?.[0])}
            />
            <Button type="button" variant="outline" className="h-12 flex-1 rounded-2xl font-bold" onClick={() => fileInputRef.current?.click()}>
              <Camera className="size-5" /> {logoPreview ? "Changer" : "Ajouter un logo"}
            </Button>
          </div>
        </div>

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

        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Téléphone professionnel</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <Phone className="size-5 shrink-0 text-muted-foreground" />
            <input type="tel" value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} maxLength={30} placeholder="Téléphone de l’entreprise" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-bold text-muted-foreground">Ville</span>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-muted px-3 py-3">
              <MapPin className="size-5 shrink-0 text-muted-foreground" />
              <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={60} placeholder="Ville" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-muted-foreground">Pays</span>
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-muted px-3 py-3">
              <Flag className="size-5 shrink-0 text-muted-foreground" />
              <input value={country} onChange={(event) => setCountry(event.target.value)} maxLength={60} placeholder="Pays" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
            </div>
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Quartier</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <MapPin className="size-5 shrink-0 text-muted-foreground" />
            <input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} maxLength={80} placeholder="Quartier" className="min-w-0 flex-1 bg-transparent font-bold outline-none" />
          </div>
        </label>

        <div>
          <p className="text-sm font-bold text-muted-foreground">Numéro du compte</p>
          <p className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3 font-bold">
            <Phone className="size-5 text-muted-foreground" />
            {isLoading ? "Chargement…" : profile?.phone || "Non renseigné"}
          </p>
        </div>

        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Devise</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
            <WalletCards className="size-5 shrink-0 text-muted-foreground" />
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="min-w-0 flex-1 bg-transparent font-bold outline-none"
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </label>


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