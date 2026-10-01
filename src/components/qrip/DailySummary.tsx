import { useEffect, useState } from "react";
import { FileDown, MessageCircle, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/qrip";
import { isOpenCredit, whatsappUrl } from "@/lib/credit";

type Row = { kind: "achat" | "vente"; amount: number; invoice_date: string; on_credit: boolean; settled_at: string | null; merchant: string | null; note: string | null };

const SEEN_KEY = "qrip:bilan-seen";
const EVENING_HOUR = 18;

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const clean = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");

export function DailySummary({ invoices, business, currency, open, onOpenChange }: {
  invoices: Row[];
  business: string;
  currency?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const today = todayISO();
  const rows = invoices.filter((i) => i.invoice_date === today);
  const ventes = rows.filter((i) => i.kind === "vente");
  const achats = rows.filter((i) => i.kind === "achat");
  const sum = (r: Row[]) => r.reduce((s, i) => s + Number(i.amount), 0);
  const encaisse = sum(ventes.filter((i) => !isOpenCredit(i)));
  const credit = sum(ventes.filter(isOpenCredit));
  const depenses = sum(achats);
  const net = sum(ventes) - depenses;
  const m = (v: number) => formatMoney(v, currency);
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const lines = [
    `Ventes (${ventes.length})`, m(sum(ventes)),
    "dont encaissé", m(encaisse),
    "dont à crédit", m(credit),
    `Dépenses (${achats.length})`, m(depenses),
    "Bénéfice du jour", m(net),
  ];

  function text() {
    return `Bilan du soir — ${business}\n${dateLabel}\n\nVentes (${ventes.length}) : ${m(sum(ventes))}\n• encaissé : ${m(encaisse)}\n• à crédit : ${m(credit)}\nDépenses (${achats.length}) : ${m(depenses)}\n\nBénéfice du jour : ${m(net)}\n\nEnvoyé avec qrip`;
  }

  async function pdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(clean(`Bilan du soir - ${business}`), 20, 25);
    doc.setFontSize(12);
    doc.text(clean(dateLabel), 20, 34);
    let y = 52;
    for (let k = 0; k < lines.length; k += 2) {
      doc.setFont("helvetica", k === lines.length - 2 ? "bold" : "normal");
      doc.text(clean(lines[k]!), 20, y);
      doc.text(clean(lines[k + 1]!), 190, y, { align: "right" });
      y += 10;
    }
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    rows.forEach((r) => {
      if (y > 280) return;
      doc.text(clean(`${r.kind === "vente" ? "+" : "-"} ${r.merchant || r.note || (r.kind === "vente" ? "Vente" : "Achat")}${isOpenCredit(r) ? " (crédit)" : ""}`), 20, y);
      doc.text(clean(m(Number(r.amount))), 190, y, { align: "right" });
      y += 7;
    });
    doc.save(`bilan-${today}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-extrabold"><Moon className="size-6 text-primary" /> Bilan du soir</DialogTitle>
          <DialogDescription className="font-semibold capitalize">{dateLabel}</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl bg-gradient-teal p-5 text-center">
          <p className="text-sm font-bold text-teal-foreground/80">Bénéfice du jour</p>
          <p className="text-4xl font-extrabold text-teal-foreground">{m(net)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-muted p-3"><p className="font-bold text-muted-foreground">Ventes ({ventes.length})</p><p className="text-lg font-extrabold">{m(sum(ventes))}</p></div>
          <div className="rounded-2xl bg-muted p-3"><p className="font-bold text-muted-foreground">Dépenses ({achats.length})</p><p className="text-lg font-extrabold">{m(depenses)}</p></div>
          <div className="rounded-2xl bg-muted p-3"><p className="font-bold text-muted-foreground">Encaissé</p><p className="text-lg font-extrabold">{m(encaisse)}</p></div>
          <div className="rounded-2xl bg-muted p-3"><p className="font-bold text-muted-foreground">À crédit</p><p className="text-lg font-extrabold">{m(credit)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={pdf} className="press flex items-center justify-center gap-2 rounded-2xl bg-gradient-flame py-3 font-extrabold text-primary-foreground"><FileDown className="size-5" /> PDF</button>
          <a href={whatsappUrl(text())} target="_blank" rel="noreferrer" className="press flex items-center justify-center gap-2 rounded-2xl bg-gradient-teal py-3 font-extrabold text-teal-foreground"><MessageCircle className="size-5" /> WhatsApp</a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Opens once per day after the evening hour when there was activity today. */
export function useEveningTrigger(hasActivityToday: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!hasActivityToday || new Date().getHours() < EVENING_HOUR) return;
    if (localStorage.getItem(SEEN_KEY) === todayISO()) return;
    localStorage.setItem(SEEN_KEY, todayISO());
    setOpen(true);
  }, [hasActivityToday]);
  return [open, setOpen] as const;
}
