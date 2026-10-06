import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Copy, KeyRound, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/partage")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partage de trésorerie — qrip" },
      { name: "description", content: "Donnez accès à votre trésorerie par un code, ou consultez celle d'un autre commerce." },
      { property: "og:title", content: "Partage de trésorerie — qrip" },
      { property: "og:description", content: "Accès à la trésorerie par code de partage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PartagePage,
});

type Share = { id: string; owner_id: string; viewer_id: string | null; code: string; label: string | null; created_at: string; accepted_at: string | null };
const input = "w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none";

function newCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(b, (x) => a[x % a.length]).join("");
}

function PartagePage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const { data } = useQuery({
    queryKey: ["shares"],
    queryFn: async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user.id ?? "";
      const { data, error } = await supabase.from("treasury_shares").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data as Share[];
      const accessIds = rows.filter((r) => r.viewer_id === uid).map((r) => r.owner_id);
      const { data: profs } = accessIds.length
        ? await supabase.from("profiles").select("id, business_name, owner_name, phone").in("id", accessIds)
        : { data: [] };
      return { mine: rows.filter((r) => r.owner_id === uid), access: rows.filter((r) => r.viewer_id === uid), profs: profs ?? [] };
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["shares"] });

  async function create() {
    const c = newCode();
    const { error } = await supabase.from("treasury_shares").insert({ code: c, label: label.trim() || null });
    if (error) { toast.error("Création impossible."); return; }
    setLabel("");
    navigator.clipboard?.writeText(c).catch(() => {});
    toast.success(`Code ${c} créé et copié.`);
    refresh();
  }
  async function redeem() {
    if (code.trim().length < 6) { toast.error("Entrez le code reçu."); return; }
    const { error } = await supabase.rpc("redeem_share_code", { _code: code });
    if (error) { toast.error(error.message.includes("propre") ? "C'est votre propre code." : error.message.includes("utilise") ? "Ce code a déjà été utilisé." : "Code invalide."); return; }
    setCode("");
    toast.success("Accès accordé !");
    refresh();
  }
  async function remove(s: Share) {
    const { error } = await supabase.from("treasury_shares").delete().eq("id", s.id);
    if (error) { toast.error("Suppression impossible."); return; }
    toast.success("Accès retiré.");
    refresh();
  }

  return (
    <Screen title="Partage de trésorerie" back="/profil" className="space-y-4">
      <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="size-5 text-primary" /> Trésoreries partagées avec moi</h2>
        {(data?.access ?? []).length === 0 && <p className="text-sm font-bold text-muted-foreground">Aucune pour le moment.</p>}
        {(data?.access ?? []).map((s) => {
          const p = data?.profs.find((x) => x.id === s.owner_id);
          return (
            <div key={s.id} className="flex items-center gap-2">
              <Link to="/partage/$ownerId" params={{ ownerId: s.owner_id }} className="press flex flex-1 items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="min-w-0"><span className="block truncate font-extrabold">{p?.business_name || "Entreprise"}</span><span className="block truncate text-xs font-bold text-muted-foreground">{p?.owner_name ?? ""} · {p?.phone ?? ""}</span></span>
                <ChevronRight className="size-5" />
              </Link>
              <button type="button" onClick={() => remove(s)} aria-label="Quitter" className="press rounded-2xl p-3"><Trash2 className="size-4 text-destructive" /></button>
            </div>
          );
        })}
        <p className="pt-2 text-sm font-extrabold">J'ai reçu un code</p>
        <input className={`${input} uppercase tracking-widest`} placeholder="Ex. K7P2QX9M" maxLength={12} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <BigButton tone="teal" onClick={redeem}><span className="inline-flex items-center gap-2"><KeyRound className="size-5" /> Accéder</span></BigButton>
      </section>

      <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
        <h2 className="text-lg font-extrabold">Donner accès à ma trésorerie</h2>
        <p className="text-sm font-bold text-muted-foreground">Créez un code et donnez-le à la personne (associé, comptable, gérant). Chaque code sert une seule fois. L'accès est en lecture seule et vous pouvez le retirer à tout moment.</p>
        <input className={input} placeholder="Pour qui ? (ex. Mon comptable)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <BigButton tone="flame" onClick={create}>Créer un code</BigButton>
        {(data?.mine ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl bg-muted px-4 py-3">
            <div className="min-w-0">
              <p className="font-extrabold tracking-widest">{s.code}</p>
              <p className="truncate text-xs font-bold text-muted-foreground">{s.label || "Sans nom"} · {s.viewer_id ? `Utilisé le ${new Date(s.accepted_at!).toLocaleDateString("fr-FR")}` : "Pas encore utilisé"}</p>
            </div>
            <div className="flex">
              {!s.viewer_id && <button type="button" aria-label="Copier" onClick={() => { navigator.clipboard.writeText(s.code); toast.success("Code copié."); }} className="press p-2"><Copy className="size-4 text-primary" /></button>}
              <button type="button" aria-label="Retirer" onClick={() => remove(s)} className="press p-2"><Trash2 className="size-4 text-destructive" /></button>
            </div>
          </div>
        ))}
      </section>
    </Screen>
  );
}
