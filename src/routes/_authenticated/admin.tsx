import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { formatMoney } from "@/lib/qrip";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administration — qrip" },
      { name: "description", content: "Gestion des utilisateurs, opérations et notifications qrip." },
      { property: "og:title", content: "Administration — qrip" },
      { property: "og:description", content: "Gestion des utilisateurs, opérations et notifications qrip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

type Tab = "users" | "ops" | "notif";
const input = "w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none";

function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();
  const [tab, setTab] = useState<Tab>("users");

  if (isLoading) return <Screen title="Administration"><p>Chargement…</p></Screen>;
  if (!isAdmin)
    return (
      <Screen title="Administration" back="/profil">
        <p className="rounded-3xl bg-card p-6 font-bold soft-shadow">Accès réservé à l’administrateur.</p>
        <Link to="/accueil" className="mt-4 block text-primary font-bold">Retour à l’accueil</Link>
      </Screen>
    );

  return (
    <Screen title="Administration" back="/profil" className="space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-3xl bg-card p-1.5 soft-shadow">
        {([["users", "Utilisateurs"], ["ops", "Opérations"], ["notif", "Notifier"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-2xl py-2.5 text-sm font-extrabold ${tab === k ? "bg-gradient-sun text-sun-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {tab === "users" && <UsersTab />}
      {tab === "ops" && <OpsTab />}
      {tab === "notif" && <NotifyTab />}
    </Screen>
  );
}

type AdminProfile = { id: string; phone: string; business_name: string | null; owner_name: string | null; city: string | null; country: string | null; currency: string; created_at: string };

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminProfile | null>(null);
  const { data } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, phone, business_name, owner_name, city, country, currency, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as AdminProfile[];
    },
  });
  const list = (data ?? []).filter((p) => `${p.phone} ${p.business_name ?? ""} ${p.owner_name ?? ""} ${p.city ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  async function save() {
    if (!editing) return;
    const { error } = await supabase.from("profiles").update({ business_name: editing.business_name, owner_name: editing.owner_name, city: editing.city, country: editing.country, currency: editing.currency }).eq("id", editing.id);
    if (error) { toast.error("Modification impossible."); return; }
    toast.success("Utilisateur mis à jour.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  }

  async function remove(p: AdminProfile) {
    if (!confirm(`Supprimer le profil et toutes les opérations de ${p.business_name || p.phone} ?`)) return;
    await supabase.from("invoices").delete().eq("user_id", p.id);
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) { toast.error("Suppression impossible."); return; }
    toast.success("Profil supprimé.");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  }

  return (
    <section className="space-y-3">
      <input className={input} placeholder="Rechercher (numéro, entreprise, ville…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      <p className="text-sm font-bold text-muted-foreground">{list.length} utilisateur(s)</p>
      {list.map((p) => (
        <div key={p.id} className="rounded-3xl bg-card p-4 soft-shadow">
          {editing?.id === p.id ? (
            <div className="space-y-2">
              <input className={input} placeholder="Entreprise" value={editing.business_name ?? ""} onChange={(e) => setEditing({ ...editing, business_name: e.target.value })} />
              <input className={input} placeholder="Propriétaire" value={editing.owner_name ?? ""} onChange={(e) => setEditing({ ...editing, owner_name: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={input} placeholder="Ville" value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} />
                <input className={input} placeholder="Pays" value={editing.country ?? ""} onChange={(e) => setEditing({ ...editing, country: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 rounded-2xl" onClick={save}>Enregistrer</Button>
                <Button variant="outline" className="flex-1 rounded-2xl" onClick={() => setEditing(null)}>Annuler</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-extrabold">{p.business_name || "Sans nom"}</p>
                <p className="truncate text-sm text-muted-foreground">{p.owner_name || "Propriétaire non renseigné"} · {p.phone}</p>
                <p className="text-xs text-muted-foreground">{[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.currency}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => setEditing(p)}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => remove(p)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

type AdminInvoice = { id: string; user_id: string; kind: "achat" | "vente"; amount: number; currency: string; merchant: string | null; note: string | null; invoice_date: string; category: string | null };

function OpsTab() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"all" | "achat" | "vente">("all");
  const { data } = useQuery({
    queryKey: ["admin-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices").select("id, user_id, kind, amount, currency, merchant, note, invoice_date, category").order("invoice_date", { ascending: false }).limit(300);
      if (error) throw error;
      return data as AdminInvoice[];
    },
  });
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, phone, business_name, owner_name, city, country, currency, created_at")).data as AdminProfile[],
  });
  const names = new Map((profiles ?? []).map((p) => [p.id, p.business_name || p.phone]));
  const list = (data ?? []).filter((i) => kind === "all" || i.kind === kind);

  async function editAmount(i: AdminInvoice) {
    const v = prompt("Nouveau montant", String(i.amount));
    if (v === null) return;
    const amount = Number(v.replace(/\s/g, ""));
    if (!Number.isFinite(amount) || amount < 0) { toast.error("Montant invalide."); return; }
    const { error } = await supabase.from("invoices").update({ amount }).eq("id", i.id);
    if (error) { toast.error("Modification impossible."); return; }
    qc.invalidateQueries({ queryKey: ["admin-invoices"] });
  }
  async function remove(i: AdminInvoice) {
    if (!confirm("Supprimer cette opération ?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", i.id);
    if (error) { toast.error("Suppression impossible."); return; }
    qc.invalidateQueries({ queryKey: ["admin-invoices"] });
  }

  return (
    <section className="space-y-3">
      <select className={input} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="all">Toutes les opérations</option>
        <option value="vente">Ventes</option>
        <option value="achat">Achats</option>
      </select>
      <p className="text-sm font-bold text-muted-foreground">{list.length} opération(s)</p>
      {list.map((i) => (
        <div key={i.id} className="flex items-center justify-between gap-2 rounded-3xl bg-card p-4 soft-shadow">
          <div className="min-w-0">
            <p className="truncate font-extrabold">{formatMoney(Number(i.amount), i.currency)} · {i.kind === "vente" ? "Vente" : "Achat"}</p>
            <p className="truncate text-sm text-muted-foreground">{names.get(i.user_id) ?? "—"} · {i.merchant || i.note || i.category || ""}</p>
            <p className="text-xs text-muted-foreground">{new Date(i.invoice_date).toLocaleDateString("fr-FR")}</p>
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" aria-label="Modifier le montant" onClick={() => editAmount(i)}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Supprimer" onClick={() => remove(i)}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        </div>
      ))}
    </section>
  );
}

function NotifyTab() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState("");
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  const [sending, setSending] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) { toast.error("Ajoutez un titre et un message."); return; }
    setSending(true);
    const { data, error } = await supabase.rpc("send_notification", { _title: title, _body: body, _country: country, _city: city, _currency: currency, _incomplete_only: incompleteOnly });
    setSending(false);
    if (error) { toast.error("Envoi impossible."); return; }
    toast.success(`Notification envoyée à ${data} utilisateur(s).`);
    setTitle("");
    setBody("");
  }

  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
      <input className={input} placeholder="Titre" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${input} min-h-28`} placeholder="Message" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="pt-2 text-sm font-extrabold text-muted-foreground">Filtres (laisser vide = tous)</p>
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Pays" value={country} onChange={(e) => setCountry(e.target.value)} />
        <input className={input} placeholder="Ville" value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
        <option value="">Toutes les devises</option>
        <option value="XOF">XOF</option>
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
      </select>
      <label className="flex items-center gap-3 font-bold">
        <input type="checkbox" className="size-5 accent-primary" checked={incompleteOnly} onChange={(e) => setIncompleteOnly(e.target.checked)} />
        Seulement les profils incomplets
      </label>
      <BigButton tone="flame" disabled={sending} onClick={send}>
        <span className="inline-flex items-center gap-2"><Send className="size-5" /> {sending ? "Envoi…" : "Envoyer"}</span>
      </BigButton>
    </section>
  );
}
