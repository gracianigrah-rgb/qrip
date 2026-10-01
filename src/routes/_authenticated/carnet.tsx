import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/qrip/Screen";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/qrip";
import { useProfile } from "@/lib/profile";
import { isOpenCredit, reminderText, whatsappUrl, type CreditRow } from "@/lib/credit";
import { cn } from "@/lib/utils";
import { useInvoices } from "./accueil";

export const Route = createFileRoute("/_authenticated/carnet")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Carnet de crédit — qrip" },
      { name: "description", content: "Suivez qui vous doit de l'argent, ce que vous devez, relancez et soldez." },
      { property: "og:title", content: "Carnet de crédit — qrip" },
      { property: "og:description", content: "Suivez qui vous doit de l'argent, ce que vous devez, relancez et soldez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Carnet,
});

function Carnet() {
  const queryClient = useQueryClient();
  const { data: invoices = [] } = useInvoices();
  const { data: profile } = useProfile();
  const business = profile?.business_name?.trim() || "Mon entreprise";
  const currency = profile?.currency ?? undefined;
  const [tab, setTab] = useState<"vente" | "achat" | "solde">("vente");
  const credits = invoices.filter((i) => i.on_credit) as CreditRow[];
  const owedToMe = credits.filter((i) => i.kind === "vente" && isOpenCredit(i));
  const iOwe = credits.filter((i) => i.kind === "achat" && isOpenCredit(i));
  const settled = credits.filter((i) => i.settled_at);
  const list = tab === "vente" ? owedToMe : tab === "achat" ? iOwe : settled;
  const sum = (rows: CreditRow[]) => rows.reduce((s, i) => s + Number(i.amount), 0);

  async function settle(row: CreditRow) {
    if (!confirm(`Marquer ${formatMoney(Number(row.amount), currency)} comme soldé ?`)) return;
    const { error } = await supabase.from("invoices").update({ settled_at: new Date().toISOString() }).eq("id", row.id);
    if (error) {
      toast.error("Impossible de solder pour le moment.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["invoices"] });
    toast.success("Crédit soldé, trésorerie mise à jour");
  }

  return (
    <Screen title="Carnet de crédit" back="/accueil" className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-gradient-teal p-4 card-pop">
          <p className="text-xs font-bold text-teal-foreground/80">On me doit</p>
          <p className="text-2xl font-extrabold text-teal-foreground">{formatMoney(sum(owedToMe), currency)}</p>
        </div>
        <div className="rounded-3xl bg-gradient-flame p-4 card-pop">
          <p className="text-xs font-bold text-primary-foreground/80">Je dois</p>
          <p className="text-2xl font-extrabold text-primary-foreground">{formatMoney(sum(iOwe), currency)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([["vente", `Clients (${owedToMe.length})`], ["achat", `Fournisseurs (${iOwe.length})`], ["solde", "Soldés"]] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn("press flex-1 rounded-full px-2 py-2 text-sm font-extrabold", tab === id ? "bg-gradient-sun text-sun-foreground" : "bg-muted text-muted-foreground")}>{label}</button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="rounded-3xl bg-card p-5 text-center font-semibold text-muted-foreground soft-shadow">
          {tab === "solde" ? "Aucun crédit soldé pour l'instant." : "Rien en attente ici. Choisissez « À crédit » lors d'un achat ou d'une vente."}
        </p>
      )}

      {list.map((row) => (
        <div key={row.id} className="space-y-3 rounded-3xl bg-card p-4 soft-shadow">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-extrabold">{row.merchant || row.note || (row.kind === "vente" ? "Client" : "Fournisseur")}</p>
              <p className="text-xs font-semibold text-muted-foreground">
                {row.kind === "vente" ? "Vente" : "Achat"} du {new Date(`${row.invoice_date}T12:00:00`).toLocaleDateString("fr-FR")}
                {row.contact_phone ? ` · ${row.contact_phone}` : ""}
              </p>
              {row.settled_at && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-extrabold text-teal-deep">
                  <CheckCircle2 className="size-3" /> Soldé le {new Date(row.settled_at).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
            <p className={cn("shrink-0 font-extrabold", row.kind === "vente" ? "text-teal-deep" : "text-primary")}>{formatMoney(Number(row.amount), currency)}</p>
          </div>
          {!row.settled_at && (
            <div className="grid grid-cols-3 gap-2">
              <a href={whatsappUrl(reminderText(row, business, currency), row.contact_phone)} target="_blank" rel="noreferrer" className="press flex items-center justify-center gap-1 rounded-2xl bg-gradient-teal py-2.5 text-sm font-extrabold text-teal-foreground">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
              {row.contact_phone ? (
                <a href={`sms:${row.contact_phone}?body=${encodeURIComponent(reminderText(row, business, currency))}`} className="press flex items-center justify-center gap-1 rounded-2xl bg-muted py-2.5 text-sm font-extrabold">
                  <Phone className="size-4" /> SMS
                </a>
              ) : (
                <span className="flex items-center justify-center rounded-2xl bg-muted py-2.5 text-xs font-bold text-muted-foreground">Sans contact</span>
              )}
              <button type="button" onClick={() => settle(row)} className="press flex items-center justify-center gap-1 rounded-2xl bg-gradient-sun py-2.5 text-sm font-extrabold text-sun-foreground">
                <CheckCircle2 className="size-4" /> Soldé
              </button>
            </div>
          )}
        </div>
      ))}
    </Screen>
  );
}
