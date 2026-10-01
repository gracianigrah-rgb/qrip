import { formatMoney } from "@/lib/qrip";

export type CreditRow = {
  id: string;
  kind: "achat" | "vente";
  amount: number;
  merchant: string | null;
  note: string | null;
  invoice_date: string;
  on_credit: boolean;
  contact_phone: string | null;
  settled_at: string | null;
};

/** Credit not yet settled does not move the cash balance. */
export function isOpenCredit(i: { on_credit: boolean; settled_at: string | null }) {
  return i.on_credit && !i.settled_at;
}

/** wa.me needs international digits; local Ivorian 10-digit numbers get +225. */
export function waDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = `225${d}`;
  return d;
}

export function whatsappUrl(text: string, phone?: string | null) {
  const target = phone ? waDigits(phone) : "";
  return `https://wa.me/${target}?text=${encodeURIComponent(text)}`;
}

export function reminderText(row: CreditRow, business: string, currency?: string) {
  const date = new Date(`${row.invoice_date}T12:00:00`).toLocaleDateString("fr-FR");
  const who = row.merchant ? `Bonjour ${row.merchant}, ` : "Bonjour, ";
  if (row.kind === "vente") {
    return `${who}petit rappel de ${business} : il reste ${formatMoney(Number(row.amount), currency)} à régler pour l'achat du ${date}${row.note ? ` (${row.note})` : ""}. Merci beaucoup !`;
  }
  return `${who}c'est ${business}. Je vous confirme que je vous dois ${formatMoney(Number(row.amount), currency)} pour l'achat du ${date}. Je reviens vers vous pour le règlement.`;
}
