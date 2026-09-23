import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Building2, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/qrip/Screen";
import { formatMoney } from "@/lib/qrip";
import { isProfileComplete, useProfile } from "@/lib/profile";


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

  const ventes = invoices.filter((i) => i.kind === "vente").reduce((s, i) => s + Number(i.amount), 0);
  const achats = invoices.filter((i) => i.kind === "achat").reduce((s, i) => s + Number(i.amount), 0);
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
        <p className="text-sm font-bold text-teal-foreground/80">Solde de l'activité</p>
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
        <h2 className="text-lg font-extrabold">Dernières factures</h2>
        {isLoading && <p className="text-muted-foreground">Chargement…</p>}
        {!isLoading && invoices.length === 0 && (
          <p className="rounded-3xl bg-card p-5 text-center text-muted-foreground soft-shadow">
            Aucune facture pour l'instant. Prenez votre première photo !
          </p>
        )}
        {invoices.slice(0, 12).map((inv) => (
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
              <p className="truncate font-extrabold">{inv.merchant || (inv.kind === "vente" ? "Vente" : "Achat")}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {new Date(inv.invoice_date).toLocaleDateString("fr-FR")}
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
