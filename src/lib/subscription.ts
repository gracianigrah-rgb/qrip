import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/qrip";

export type Billing = {
  monthly_price: number;
  yearly_price: number;
  daily_export_price: number;
  currency: string;
  payment_number: string | null;
  payment_link: string | null;
  instructions: string | null;
};

export type Payment = {
  id: string;
  user_id: string;
  plan: "mensuel" | "annuel" | "bilan_jour";
  export_date: string | null;
  amount: number;
  currency: string;
  proof_path: string | null;
  payer_ref: string | null;
  status: "en_attente" | "confirme" | "refuse";
  receipt_no: string | null;
  admin_note: string | null;
  period_start: string | null;
  period_end: string | null;
  confirmed_at: string | null;
  created_at: string;
};

export const PAY_STATUS: Record<string, string> = { en_attente: "En vérification", confirme: "Confirmé", refuse: "Refusé" };
export const EXPIRING_DAYS = 7;

export function useBilling() {
  return useQuery({
    queryKey: ["billing"],
    queryFn: async () => {
      const { data, error } = await supabase.from("billing_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data as Billing | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyPayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as Payment[];
      const { data, error } = await supabase.from("subscription_payments").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
    refetchInterval: 120_000,
  });
}

export type SubState = "active" | "expiring" | "expired" | "none";

export function subscriptionState(payments: Payment[] = []) {
  const ends = payments.filter((p) => p.status === "confirme" && p.plan !== "bilan_jour" && p.period_end).map((p) => new Date(p.period_end!).getTime());
  const end = ends.length ? Math.max(...ends) : null;
  const pending = payments.some((p) => p.status === "en_attente");
  if (!end) return { state: "none" as SubState, end: null, daysLeft: 0, pending };
  const daysLeft = Math.ceil((end - Date.now()) / 86_400_000);
  const state: SubState = daysLeft <= 0 ? "expired" : daysLeft <= EXPIRING_DAYS ? "expiring" : "active";
  return { state, end: new Date(end), daysLeft, pending };
}

export function useSubscription() {
  const q = useMyPayments();
  return { ...subscriptionState(q.data), payments: q.data ?? [], isLoading: q.isLoading };
}

export const canExport = (s: SubState) => s === "active" || s === "expiring";

export const PLAN_LABEL: Record<string, string> = { mensuel: "Mensuel", annuel: "Annuel", bilan_jour: "Export du bilan du jour" };

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** One-off payment confirmed for today's evening summary export. */
export const dailyUnlocked = (payments: Payment[] = [], date = todayISO()) =>
  payments.some((p) => p.plan === "bilan_jour" && p.status === "confirme" && p.export_date === date);

export type ExportLog = { id: string; format: string; label: string; created_at: string };

export function useExportHistory() {
  return useQuery({
    queryKey: ["exports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("export_history").select("id, format, label, created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as ExportLog[];
    },
  });
}

export async function logExport(format: string, label: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("export_history").insert({ user_id: u.user.id, format, label });
}

export async function qrDataUrl(text: string) {
  const QR = await import("qrcode");
  return QR.toDataURL(text, { margin: 1, width: 240, color: { dark: "#0f3b3a", light: "#ffffff" } });
}

export function verifyUrl(code: string) {
  return `${window.location.origin}/verifier?c=${encodeURIComponent(code)}`;
}

/** Receipt generated after admin confirmation. */
export async function downloadReceipt(p: Payment, business: string, owner?: string | null, phone?: string | null) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();
  const t = (v: string) => v.replace(/[\u00a0\u202f]/g, " ").replace("€", "EUR");
  const d = (v: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
  pdf.setFillColor(255, 211, 7); pdf.rect(0, 0, 210, 30, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.text("qrip", 20, 19);
  pdf.setFontSize(14); pdf.text("Recu de paiement", 190, 19, { align: "right" });
  pdf.setFontSize(11); pdf.text(t(`N° ${p.receipt_no ?? "—"}`), 20, 45);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  const rows: [string, string][] = [
    ["Client", business],
    ["Proprietaire", owner || "—"],
    ["Telephone", phone || "—"],
    ["Objet", PLAN_LABEL[p.plan] ?? p.plan],
    ["Montant paye", formatMoney(Number(p.amount), p.currency)],
    ["Reference du paiement", p.payer_ref || "—"],
    ["Date de confirmation", d(p.confirmed_at)],
    p.plan === "bilan_jour" ? ["Bilan concerne", d(p.export_date)] : ["Periode couverte", `${d(p.period_start)} au ${d(p.period_end)}`],
  ];
  rows.forEach(([l, v], i) => { pdf.text(t(l), 20, 58 + i * 9); pdf.setFont("helvetica", "bold"); pdf.text(t(v), 190, 58 + i * 9, { align: "right" }); pdf.setFont("helvetica", "normal"); });
  if (p.receipt_no) {
    try { pdf.addImage(await qrDataUrl(verifyUrl(p.receipt_no)), "PNG", 20, 140, 32, 32); } catch { /* QR optionnel */ }
  }
  pdf.setFontSize(9); pdf.text(t("Paiement confirme par l'administrateur qrip. Merci pour votre confiance."), 58, 158);
  pdf.save(`recu-${p.receipt_no ?? p.id}.pdf`);
}
