import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, BarChart3, Camera, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Screen } from "@/components/qrip/Screen";
import { formatMoney, levelFor } from "@/lib/qrip";

export const Route = createFileRoute("/_authenticated/accueil")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ma trésorerie — qrip" },
      { name: "description", content: "Solde, ventes, achats et dernières factures de votre activité." },
      { property: "og:title", content: "Ma trésorerie — qrip" },
      { property: "og:description", content: "Solde, ventes, achats et dernières factures de votre activité." },
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
  const level = levelFor(invoices.length);

  return (
    <Screen
      className="space-y-5"
      footer={
        <Link
          to="/capture"
          className="press flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-flame px-6 py-5 text-lg font-extrabold text-primary-foreground card-pop active:press-active"
        >
          <Camera className="size-6" /> Nouvelle facture
        </Link>
      }
    >
      <header className="flex items-center justify-between pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-sm font-bold text-muted-foreground">Ma trésorerie</p>
          <h1 className="text-3xl font-extrabold">qrip</h1>
        </div>
        <button
          aria-label="Se déconnecter"
          onClick={() => supabase.auth.signOut()}
          className="press flex size-11 items-center justify-center rounded-2xl bg-card text-muted-foreground soft-shadow active:press-active"
        >
          <LogOut className="size-5" />
        </button>
      </header>

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

      <section className="rounded-3xl bg-gradient-sun p-5 card-pop">
        <div className="flex items-center justify-between">
          <p className="text-lg font-extrabold text-sun-foreground">
            {level.current.emoji} Niveau {level.current.name}
          </p>
          <p className="text-sm font-bold text-sun-foreground/80">{invoices.length} factures</p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-card/70">
          <div
            className="h-full rounded-full bg-gradient-flame transition-all duration-500"
            style={{ width: `${level.progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-sun-foreground/80">
          {level.next
            ? `Encore ${level.remaining} facture(s) pour devenir ${level.next.name} ${level.next.emoji}`
            : "Niveau maximum atteint, bravo !"}
        </p>
      </section>

      <Link
        to="/rapport"
        className="press flex items-center justify-between rounded-3xl bg-card px-5 py-4 soft-shadow active:press-active"
      >
        <span className="flex items-center gap-3 font-extrabold">
          <BarChart3 className="size-5 text-primary" /> Mon rapport pour la banque
        </span>
        <span className="text-muted-foreground">›</span>
      </Link>

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
