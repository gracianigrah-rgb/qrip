import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Landmark } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useInvoices } from "@/routes/_authenticated/accueil";
import { formatMoney } from "@/lib/qrip";
import { getBusinessLogoUrl, useProfile } from "@/lib/profile";
import { computeScore, certNumber, LOAN_STATUS } from "@/lib/finance-score";
import { isOpenCredit } from "@/lib/credit";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financement")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Obtenir un micro-crédit — qrip" },
      { name: "description", content: "Votre score de santé financière et votre dossier bancaire pour demander un micro-crédit." },
      { property: "og:title", content: "Obtenir un micro-crédit — qrip" },
      { property: "og:description", content: "Votre score de santé financière et votre dossier bancaire pour demander un micro-crédit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Financement,
});

const AMOUNTS = [100000, 250000, 500000, 1000000, 2000000, 3000000];
const PURPOSES = ["Achat de stock", "Équipement", "Rénovation boutique", "Autre"];
const DURATIONS = [3, 6, 12];

type Loan = { id: string; amount: number; purpose: string; duration_months: number; status: string; score: number; created_at: string };

function Financement() {
  const qc = useQueryClient();
  const { data: invoices = [] } = useInvoices();
  const { data: profile } = useProfile();
  const currency = profile?.currency;
  const s = computeScore(invoices as any);
  const [amount, setAmount] = useState(250000);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  const [duration, setDuration] = useState(6);
  const [sending, setSending] = useState(false);

  const { data: loans = [] } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_requests").select("id, amount, purpose, duration_months, status, score, created_at").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Loan[];
    },
  });

  const tone = s.score >= 70 ? "text-teal-deep" : s.score >= 40 ? "text-primary" : "text-destructive";

  async function submit() {
    if (!navigator.onLine) { toast.error("Connectez-vous à internet pour envoyer la demande."); return; }
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("loan_requests").insert({
      user_id: u.user!.id, amount, purpose, duration_months: duration, score: s.score, monthly_revenue: Math.round(s.monthlyRevenue),
    });
    setSending(false);
    if (error) { toast.error("Envoi impossible, réessayez."); return; }
    toast.success("Demande envoyée ! Nous revenons vers vous rapidement.");
    qc.invalidateQueries({ queryKey: ["loans"] });
  }

  async function downloadDossier() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const t = (v: string) => v.replace(/[\u00a0\u202f]/g, " ");
    const name = profile?.business_name?.trim() || "Mon entreprise";
    const loc = [profile?.neighborhood, profile?.city, profile?.country].filter(Boolean).join(", ") || "Non renseignée";
    const ref = loans[0] ? certNumber(loans[0].id) : `QRIP-${Date.now().toString(36).toUpperCase()}`;
    try {
      if (profile?.logo_path) {
        const url = await getBusinessLogoUrl(profile.logo_path);
        if (url) {
          const blob = await (await fetch(url)).blob();
          const data = await new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(blob); });
          pdf.addImage(data, "PNG", 166, 12, 24, 24, undefined, "FAST");
        }
      }
    } catch { /* logo optionnel */ }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
    pdf.text("Dossier financier", 20, 22);
    pdf.setFontSize(12); pdf.text(t(name), 20, 32);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    pdf.text(t(`Propriétaire : ${profile?.owner_name ?? "—"}`), 20, 40);
    pdf.text(t(`Téléphone : ${profile?.business_phone || profile?.phone || "—"}`), 20, 46);
    pdf.text(t(`Localisation : ${loc}`), 20, 52, { maxWidth: 170 });

    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13);
    pdf.text(t(`Score de santé financière : ${s.score}/100`), 20, 68);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
    const rows: [string, string][] = [
      ["Régularité des ventes (90 jours)", `${s.regularity}/40 · ${s.activeDays} jours actifs`],
      ["Marge d'exploitation", `${s.margin}/35`],
      ["Maîtrise du crédit", `${s.credit}/25`],
      ["Ventes mensuelles moyennes", formatMoney(s.monthlyRevenue, currency)],
      ["Bénéfice mensuel estimé", formatMoney(s.monthlyProfit, currency)],
    ];
    rows.forEach(([l, v], i) => { pdf.text(t(l), 20, 78 + i * 8); pdf.text(t(v), 190, 78 + i * 8, { align: "right" }); });

    // monthly history (6 months)
    let y = 128;
    pdf.setFont("helvetica", "bold"); pdf.text("Historique mensuel", 20, y); y += 8;
    pdf.setFont("helvetica", "normal");
    const now = new Date();
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = invoices.filter((i) => i.invoice_date.startsWith(key));
      const v = m.filter((i) => i.kind === "vente").reduce((a, i) => a + Number(i.amount), 0);
      const a = m.filter((i) => i.kind === "achat").reduce((x, i) => x + Number(i.amount), 0);
      pdf.text(t(d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })), 20, y);
      pdf.text(t(`Ventes ${formatMoney(v, currency)} · Achats ${formatMoney(a, currency)}`), 190, y, { align: "right" });
      y += 7;
    }
    const open = invoices.filter((i: any) => isOpenCredit(i));
    const owed = open.filter((i) => i.kind === "vente").reduce((a, i) => a + Number(i.amount), 0);
    const owe = open.filter((i) => i.kind === "achat").reduce((a, i) => a + Number(i.amount), 0);
    y += 4; pdf.setFont("helvetica", "bold"); pdf.text("Carnet de crédit", 20, y); y += 8;
    pdf.setFont("helvetica", "normal");
    pdf.text(t(`Créances clients en cours : ${formatMoney(owed, currency)}`), 20, y); y += 7;
    pdf.text(t(`Dettes fournisseurs en cours : ${formatMoney(owe, currency)}`), 20, y); y += 14;

    pdf.setDrawColor(255, 107, 26); pdf.setLineWidth(0.8); pdf.roundedRect(20, y, 170, 22, 3, 3);
    pdf.setFont("helvetica", "bold"); pdf.text(t(`Certifié par qrip · N° ${ref}`), 26, y + 9);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(t(`Établi le ${new Date().toLocaleDateString("fr-FR")} à partir des opérations enregistrées par le commerçant.`), 26, y + 16, { maxWidth: 160 });
    pdf.save(`dossier-financier-${ref}.pdf`);
    toast.success("Dossier téléchargé.");
  }

  return (
    <Screen title="Micro-crédit" back="/accueil" className="space-y-4">
      <section className="rounded-3xl bg-card p-5 text-center soft-shadow">
        <p className="text-sm font-bold text-muted-foreground">Score de santé financière</p>
        <p className={cn("text-6xl font-extrabold", tone)}>{s.score}<span className="text-2xl text-muted-foreground">/100</span></p>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-sun transition-all" style={{ width: `${s.score}%` }} />
        </div>
        <p className="mt-3 text-sm font-bold">{s.advice}</p>
        {s.eligible > 0 && <p className="mt-2 rounded-2xl bg-muted px-3 py-2 text-sm font-extrabold">Financement indicatif jusqu’à {formatMoney(s.eligible, currency)}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-bold">
          <div className="rounded-2xl bg-muted p-2">Régularité<br /><span className="text-base font-extrabold">{s.regularity}/40</span></div>
          <div className="rounded-2xl bg-muted p-2">Marge<br /><span className="text-base font-extrabold">{s.margin}/35</span></div>
          <div className="rounded-2xl bg-muted p-2">Crédit<br /><span className="text-base font-extrabold">{s.credit}/25</span></div>
        </div>
      </section>

      <BigButton tone="teal" onClick={downloadDossier}><Download className="size-5" /> Mon dossier financier (PDF)</BigButton>

      <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Landmark className="size-5 text-primary" /> Demander un financement</h2>
        <p className="text-sm font-bold text-muted-foreground">1. Montant souhaité</p>
        <div className="grid grid-cols-2 gap-2">
          {AMOUNTS.map((a) => (
            <button key={a} type="button" onClick={() => setAmount(a)} className={cn("rounded-2xl py-3 text-sm font-extrabold", amount === a ? "bg-gradient-sun text-sun-foreground" : "bg-muted")}>{formatMoney(a, currency)}</button>
          ))}
        </div>
        <p className="text-sm font-bold text-muted-foreground">2. Motif</p>
        <div className="grid grid-cols-2 gap-2">
          {PURPOSES.map((p) => (
            <button key={p} type="button" onClick={() => setPurpose(p)} className={cn("rounded-2xl py-3 text-sm font-extrabold", purpose === p ? "bg-gradient-sun text-sun-foreground" : "bg-muted")}>{p}</button>
          ))}
        </div>
        <p className="text-sm font-bold text-muted-foreground">3. Durée de remboursement</p>
        <div className="grid grid-cols-3 gap-2">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => setDuration(d)} className={cn("rounded-2xl py-3 text-sm font-extrabold", duration === d ? "bg-gradient-sun text-sun-foreground" : "bg-muted")}>{d} mois</button>
          ))}
        </div>
        <p className="rounded-2xl bg-muted p-3 text-xs font-bold">Votre score ({s.score}/100) et vos ventes moyennes seront transmis avec votre accord à nos partenaires microfinance.</p>
        <BigButton onClick={submit} disabled={sending}>{sending ? "Envoi…" : "Envoyer ma demande"}</BigButton>
      </section>

      {loans.length > 0 && (
        <section className="space-y-2 rounded-3xl bg-card p-5 soft-shadow">
          <h2 className="text-lg font-extrabold">Mes demandes</h2>
          {loans.map((l) => (
            <div key={l.id} className="flex items-center justify-between rounded-2xl bg-muted p-3">
              <div>
                <p className="font-extrabold">{formatMoney(Number(l.amount), currency)}</p>
                <p className="text-xs font-bold text-muted-foreground">{l.purpose} · {l.duration_months} mois · {new Date(l.created_at).toLocaleDateString("fr-FR")}</p>
              </div>
              <span className="rounded-full bg-card px-3 py-1 text-xs font-extrabold">{LOAN_STATUS[l.status] ?? l.status}</span>
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
