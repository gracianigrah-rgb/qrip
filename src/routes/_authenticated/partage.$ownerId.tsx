import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Screen } from "@/components/qrip/Screen";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/qrip";
import { isOpenCredit } from "@/lib/credit";

export const Route = createFileRoute("/_authenticated/partage/$ownerId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trésorerie partagée — qrip" },
      { name: "description", content: "Consultation en lecture seule d'une trésorerie partagée." },
      { property: "og:title", content: "Trésorerie partagée — qrip" },
      { property: "og:description", content: "Consultation en lecture seule d'une trésorerie partagée." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedTreasury,
});

const PERIODS = [["all", "Tout"], ["7", "7 jours"], ["30", "30 jours"], ["365", "1 an"]] as const;

function SharedTreasury() {
  const { ownerId } = Route.useParams();
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("30");
  const { data, isLoading } = useQuery({
    queryKey: ["shared-treasury", ownerId],
    queryFn: async () => {
      const [{ data: prof }, { data: inv, error }] = await Promise.all([
        supabase.from("profiles").select("business_name, owner_name, phone, city, currency").eq("id", ownerId).maybeSingle(),
        supabase.from("invoices").select("id, kind, amount, merchant, note, category, invoice_date, on_credit, settled_at").eq("user_id", ownerId).order("invoice_date", { ascending: false }),
      ]);
      if (error) throw error;
      return { prof, inv: inv ?? [] };
    },
  });
  if (isLoading) return <Screen title="Trésorerie" back="/partage"><p className="font-bold">Chargement…</p></Screen>;
  if (!data?.prof) return <Screen title="Trésorerie" back="/partage"><p className="rounded-3xl bg-card p-5 font-bold soft-shadow">Accès retiré ou introuvable.</p></Screen>;
  const cur = data.prof.currency;
  const since = period === "all" ? "" : new Date(Date.now() - Number(period) * 86_400_000).toISOString().slice(0, 10);
  const rows = data.inv.filter((i) => i.invoice_date >= since);
  const sum = (k: string) => rows.filter((i) => i.kind === k).reduce((s, i) => s + Number(i.amount), 0);
  const balance = data.inv.filter((i) => !isOpenCredit(i)).reduce((s, i) => s + (i.kind === "vente" ? 1 : -1) * Number(i.amount), 0);

  return (
    <Screen title={data.prof.business_name || "Trésorerie"} back="/partage" className="space-y-4">
      <div className="rounded-4xl bg-gradient-teal p-5 text-teal-foreground card-pop">
        <p className="text-sm font-bold opacity-80">Solde · lecture seule</p>
        <p className="text-4xl font-extrabold">{formatMoney(balance, cur)}</p>
        <p className="text-xs font-bold opacity-80">{data.prof.owner_name ?? ""} · {data.prof.phone} {data.prof.city ? `· ${data.prof.city}` : ""}</p>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-3xl bg-card p-1.5 soft-shadow">
        {PERIODS.map(([k, l]) => <button key={k} onClick={() => setPeriod(k)} className={`rounded-2xl py-2 text-xs font-extrabold ${period === k ? "bg-gradient-sun text-sun-foreground" : "text-muted-foreground"}`}>{l}</button>)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-3xl bg-card p-3 soft-shadow"><p className="text-xs font-bold text-muted-foreground">Ventes</p><p className="text-sm font-extrabold text-teal-deep">{formatMoney(sum("vente"), cur)}</p></div>
        <div className="rounded-3xl bg-card p-3 soft-shadow"><p className="text-xs font-bold text-muted-foreground">Achats</p><p className="text-sm font-extrabold text-primary">{formatMoney(sum("achat"), cur)}</p></div>
        <div className="rounded-3xl bg-card p-3 soft-shadow"><p className="text-xs font-bold text-muted-foreground">Bénéfice</p><p className="text-sm font-extrabold">{formatMoney(sum("vente") - sum("achat"), cur)}</p></div>
      </div>
      <section className="space-y-2 rounded-3xl bg-card p-4 soft-shadow">
        <h2 className="font-extrabold">Opérations ({rows.length})</h2>
        {rows.slice(0, 200).map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold">{i.merchant || i.note || i.category || (i.kind === "vente" ? "Vente" : "Achat")}{isOpenCredit(i) ? " · crédit" : ""}</p>
              <p className="text-xs font-bold text-muted-foreground">{new Date(i.invoice_date).toLocaleDateString("fr-FR")}</p>
            </div>
            <p className={`text-sm font-extrabold ${i.kind === "vente" ? "text-teal-deep" : "text-primary"}`}>{i.kind === "vente" ? "+" : "−"}{formatMoney(Number(i.amount), cur)}</p>
          </div>
        ))}
      </section>
    </Screen>
  );
}
