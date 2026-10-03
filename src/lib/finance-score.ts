import { isOpenCredit } from "@/lib/credit";

type Row = { kind: "achat" | "vente"; amount: number | string; invoice_date: string; on_credit?: boolean; settled_at?: string | null };

export type FinanceScore = {
  score: number;
  regularity: number; // 0-40
  margin: number; // 0-35
  credit: number; // 0-25
  activeDays: number;
  monthlyRevenue: number;
  monthlyProfit: number;
  eligible: number;
  advice: string;
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Score over the last 90 days: regularity of sales, margin, and credit control. */
export function computeScore(rows: Row[]): FinanceScore {
  const now = new Date();
  const since = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89));
  const recent = rows.filter((r) => r.invoice_date >= since);
  const salesDays = new Set(recent.filter((r) => r.kind === "vente").map((r) => r.invoice_date));
  const activeDays = salesDays.size;
  const ventes = recent.filter((r) => r.kind === "vente").reduce((s, r) => s + Number(r.amount), 0);
  const achats = recent.filter((r) => r.kind === "achat").reduce((s, r) => s + Number(r.amount), 0);

  const regularity = Math.round(Math.min(activeDays / 60, 1) * 40);
  const marginRate = ventes > 0 ? (ventes - achats) / ventes : 0;
  const margin = Math.round(Math.max(0, Math.min(marginRate / 0.3, 1)) * 35);

  const clientCredits = rows.filter((r) => r.kind === "vente" && r.on_credit);
  const recovered = clientCredits.filter((r) => !isOpenCredit({ on_credit: true, settled_at: r.settled_at ?? null })).length;
  const supplierOpen = rows.filter((r) => r.kind === "achat" && r.on_credit && !r.settled_at).reduce((s, r) => s + Number(r.amount), 0);
  const recoveryRate = clientCredits.length ? recovered / clientCredits.length : 1;
  const debtPenalty = ventes > 0 ? Math.min(supplierOpen / ventes, 1) : 0;
  const credit = Math.round(Math.max(0, recoveryRate - debtPenalty * 0.5) * 25);

  const score = recent.length === 0 ? 0 : Math.min(100, regularity + margin + credit);
  const months = 3;
  const monthlyRevenue = ventes / months;
  const monthlyProfit = (ventes - achats) / months;
  const eligible = score >= 40 ? Math.round((Math.max(monthlyProfit, 0) * (score >= 70 ? 3 : 1.5)) / 5000) * 5000 : 0;

  let advice = "Enregistrez vos ventes chaque jour pour construire votre dossier.";
  if (score >= 70) advice = `Bravo, ${activeDays} jours de ventes suivies ! Votre profil est solide pour un financement.`;
  else if (score >= 40) advice = "Bon début ! Continuez chaque jour et relancez vos clients à crédit.";
  else if (activeDays > 0) advice = "Notez toutes vos ventes et achats : chaque jour compte pour votre score.";

  return { score, regularity, margin, credit, activeDays, monthlyRevenue, monthlyProfit, eligible, advice };
}

export const LOAN_STATUS: Record<string, string> = {
  en_attente: "En attente",
  en_analyse: "En analyse",
  valide: "Validé",
  refuse: "Refusé",
  decaisse: "Décaissé",
};

/** Short authenticity number derived from the request id. */
export function certNumber(id: string) {
  return `QRIP-${id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}
