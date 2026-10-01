import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Building2, ChevronRight, Moon } from "lucide-react";
import { DailySummary, useEveningTrigger } from "@/components/qrip/DailySummary";
import { isOpenCredit } from "@/lib/credit";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/qrip/Screen";
import { formatMoney } from "@/lib/qrip";
import { isProfileComplete, useProfile } from "@/lib/profile";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/voice";

const PERIODS = [
  { id: "all", label: "Tout" },
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 jours" },
  { id: "month", label: "Ce mois" },
  { id: "year", label: "Cette année" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

function periodStart(id: PeriodId): string | null {
  const d = new Date();
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  if (id === "today") return iso(d);
  if (id === "7d") return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6));
  if (id === "month") return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  if (id === "year") return `${d.getFullYear()}-01-01`;
  return null;
}



export const Route = createFileRoute("/_authenticated/accueil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ma trésorerie — qrip" },
      { name: "description", content: "Solde, ventes, achats et dernières factures de votre activité." },
      { property: "og:title", content: "Ma trésorerie — qrip" },
      { property: "og:description", content: "Solde, ventes, achats et dernières factures de votre activité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Accueil,
});

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("invoice_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Accueil() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: profile } = useProfile();
  const needsProfile = !isProfileComplete(profile);
  const businessName = profile?.business_name?.trim() || "Mon entreprise";
  const [period, setPeriod] = useState<PeriodId>("all");
  const [kindFilter, setKindFilter] = useState<"all" | "achat" | "vente">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const since = periodStart(period);
  const filtered = invoices.filter(
    (i) =>
      (!since || i.invoice_date >= since) &&
      (kindFilter === "all" || i.kind === kindFilter) &&
      (categoryFilter === "all" || (i.category ?? "Autre") === categoryFilter),
  );
  const filteredTotal = filtered.reduce((s, i) => s + (i.kind === "vente" ? 1 : -1) * Number(i.amount), 0);



  const paid = invoices.filter((i) => !isOpenCredit(i));
  const ventes = paid.filter((i) => i.kind === "vente").reduce((s, i) => s + Number(i.amount), 0);
  const achats = paid.filter((i) => i.kind === "achat").reduce((s, i) => s + Number(i.amount), 0);
  const owedToMe = invoices.filter((i) => i.kind === "vente" && isOpenCredit(i)).reduce((s, i) => s + Number(i.amount), 0);
  const iOwe = invoices.filter((i) => i.kind === "achat" && isOpenCredit(i)).reduce((s, i) => s + Number(i.amount), 0);
  const todayKey = periodStart("today")!;
  const [bilanOpen, setBilanOpen] = useEveningTrigger(invoices.some((i) => i.invoice_date === todayKey));
  const currency = profile?.currency ?? undefined;
  const solde = ventes - achats;
  const now = new Date();
  const chartData = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const rows = invoices.filter((invoice) => invoice.invoice_date.startsWith(key));
    return {
      month: month.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
      ventes: rows.filter((invoice) => invoice.kind === "vente").reduce((sum, invoice) => sum + Number(invoice.amount), 0),
      achats: rows.filter((invoice) => invoice.kind === "achat").reduce((sum, invoice) => sum + Number(invoice.amount), 0),
    };
  });

  return (
    <Screen
      className="space-y-5"
    >
      {needsProfile && (
        <Link
          to="/profil"
          className="press flex items-center gap-4 rounded-3xl bg-gradient-sun p-5 text-sun-foreground card-pop active:press-active"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card/80">
            <Building2 className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold">Complétez votre profil entreprise</p>
            <p className="text-sm font-semibold text-sun-foreground/80">
              Ajoutez votre identité et vos coordonnées pour personnaliser vos rapports.
            </p>
          </div>
          <ChevronRight className="size-6 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4">

        <Link
          to="/capture"
          search={{ kind: "achat" }}
          className="press flex h-36 flex-col items-center justify-center gap-2 rounded-4xl bg-gradient-flame text-primary-foreground card-pop active:press-active"
        >
          <ArrowDownLeft className="size-10" />
          <span className="text-2xl font-extrabold uppercase">Achat</span>
        </Link>
        <Link
          to="/capture"
          search={{ kind: "vente" }}
          className="press flex h-36 flex-col items-center justify-center gap-2 rounded-4xl bg-gradient-teal text-teal-foreground card-pop active:press-active"
        >
          <ArrowUpRight className="size-10" />
          <span className="text-2xl font-extrabold uppercase">Vente</span>
        </Link>
      </div>

      <section className="rounded-4xl bg-gradient-teal p-6 card-pop">
        <div className="flex items-start justify-between gap-4">
          <p className="shrink-0 text-sm font-bold text-teal-foreground/80">Solde de l'activité</p>
          <p className="min-w-0 max-w-[55%] break-words text-right text-sm font-extrabold leading-tight text-teal-foreground">
            {businessName}
          </p>
        </div>
        <p className="mt-1 text-5xl font-extrabold text-teal-foreground">
          {isLoading ? "…" : formatMoney(solde)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card/80 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <ArrowUpRight className="size-4" /> Ventes
            </p>
            <p className="text-lg font-extrabold">{formatMoney(ventes)}</p>
          </div>
          <div className="rounded-2xl bg-card/80 px-4 py-3">
            <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <ArrowDownLeft className="size-4" /> Achats
            </p>
            <p className="text-lg font-extrabold">{formatMoney(achats)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/carnet" className="press rounded-3xl bg-card p-4 soft-shadow active:press-active">
          <p className="flex items-center gap-1 text-sm font-extrabold"><BookOpen className="size-4 text-primary" /> Carnet de crédit</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">On me doit</p>
          <p className="font-extrabold text-teal-deep">{formatMoney(owedToMe, currency)}</p>
          <p className="text-xs font-bold text-muted-foreground">Je dois</p>
          <p className="font-extrabold text-primary">{formatMoney(iOwe, currency)}</p>
        </Link>
        <button type="button" onClick={() => setBilanOpen(true)} className="press flex flex-col items-start justify-between rounded-3xl bg-gradient-sun p-4 text-left text-sun-foreground card-pop active:press-active">
          <Moon className="size-7" />
          <span><span className="block text-lg font-extrabold leading-tight">Bilan du soir</span><span className="text-xs font-bold opacity-80">Ma caisse du jour en PDF ou WhatsApp</span></span>
        </button>
      </div>
      <DailySummary invoices={invoices} business={businessName} currency={currency} open={bilanOpen} onOpenChange={setBilanOpen} />

      <section className="rounded-3xl bg-card p-5 soft-shadow">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Activité sur 6 mois</h2>
            <p className="text-xs font-bold text-muted-foreground">Ventes et achats</p>
          </div>
          <div className="flex gap-3 text-xs font-bold text-muted-foreground">
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-teal" />Ventes</span>
            <span className="flex items-center gap-1"><i className="size-2 rounded-full bg-primary" />Achats</span>
          </div>
        </div>
        <div className="h-52 w-full" aria-label="Graphique des ventes et achats des six derniers mois">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={3}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
              <YAxis hide />
              <Tooltip formatter={(value) => formatMoney(Number(value))} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="ventes" fill="var(--teal-deep)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="achats" fill="var(--primary)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Opérations</h2>
        <div className="space-y-2 rounded-3xl bg-card p-4 soft-shadow">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPeriod(p.id)} className={cn("press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold", period === p.id ? "bg-gradient-sun text-sun-foreground" : "bg-muted text-muted-foreground")}>{p.label}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {([["all", "Tout"], ["vente", "Ventes"], ["achat", "Achats"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setKindFilter(id)} className={cn("press flex-1 rounded-full px-3 py-2 text-sm font-extrabold", kindFilter === id ? (id === "achat" ? "bg-gradient-flame text-primary-foreground" : "bg-gradient-teal text-teal-foreground") : "bg-muted text-muted-foreground")}>{label}</button>
            ))}
          </div>
          <select aria-label="Catégorie" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full rounded-2xl bg-muted px-4 py-2.5 text-sm font-bold outline-none">
            <option value="all">Toutes les catégories</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <p className="text-xs font-bold text-muted-foreground">{filtered.length} opération(s) · {formatMoney(filteredTotal)}</p>
        </div>
        {isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="rounded-3xl bg-card p-5 text-center text-muted-foreground soft-shadow">
            {invoices.length === 0 ? "Aucune opération pour l'instant. Ajoutez votre premier achat ou votre première vente." : "Aucune opération pour ces filtres."}
          </p>
        )}
        {filtered.slice(0, 50).map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 rounded-3xl bg-card p-4 soft-shadow">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                inv.kind === "vente" ? "bg-gradient-teal" : "bg-gradient-flame"
              }`}
            >
              {inv.kind === "vente" ? (
                <ArrowUpRight className="size-5 text-teal-foreground" />
              ) : (
                <ArrowDownLeft className="size-5 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">{inv.merchant || inv.note || (inv.kind === "vente" ? "Vente" : "Achat")}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {new Date(inv.invoice_date).toLocaleDateString("fr-FR")}{inv.category ? ` · ${inv.category}` : ""}{inv.on_credit ? (inv.settled_at ? " · Crédit soldé" : " · À crédit") : ""}
              </p>
            </div>
            <p className={`font-extrabold ${inv.kind === "vente" ? "text-teal-deep" : "text-primary"}`}>
              {inv.kind === "vente" ? "+" : "−"}
              {formatMoney(Number(inv.amount))}
            </p>
          </div>
        ))}
      </section>
    </Screen>
  );
}
