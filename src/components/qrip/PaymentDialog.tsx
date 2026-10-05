import { useRef, useState } from "react";
import { Copy, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/qrip";
import { PLAN_LABEL, todayISO, useBilling, type Payment } from "@/lib/subscription";

type Plan = Payment["plan"];

export function PaymentDialog({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const { data: billing } = useBilling();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [ref, setRef] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!plan) return null;
  const amount = Number(plan === "annuel" ? billing?.yearly_price : plan === "mensuel" ? billing?.monthly_price : billing?.daily_export_price) || 0;
  const currency = billing?.currency ?? "XOF";

  async function submit() {
    if (!file) { toast.error("Ajoutez la capture de votre paiement."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Fichier trop lourd (5 Mo max)."); return; }
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const up = await supabase.storage.from("preuves-paiement").upload(path, file);
    if (up.error) { setSending(false); toast.error("Envoi de la preuve impossible."); return; }
    const { error } = await supabase.from("subscription_payments").insert({
      user_id: uid, plan: plan!, amount, currency, proof_path: path, payer_ref: ref.trim() || null,
      export_date: plan === "bilan_jour" ? todayISO() : null,
    });
    setSending(false);
    if (error) { toast.error("Envoi impossible, réessayez."); return; }
    toast.success("Preuve envoyée ! Validation en cours.");
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    setFile(null); setRef(""); onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-extrabold">{PLAN_LABEL[plan]}</DialogTitle>
          <DialogDescription className="font-semibold">Payez, puis envoyez la preuve.</DialogDescription>
        </DialogHeader>
        <div className="rounded-3xl bg-gradient-sun p-5 text-center">
          <p className="text-sm font-bold text-sun-foreground/80">Montant à payer</p>
          <p className="text-4xl font-extrabold text-sun-foreground">{formatMoney(amount, currency)}</p>
        </div>
        <p className="text-sm font-extrabold">1. Payez</p>
        {billing?.payment_number && (
          <button type="button" onClick={() => { navigator.clipboard.writeText(billing.payment_number!); toast.success("Numéro copié."); }}
            className="press flex w-full items-center justify-between rounded-2xl bg-muted px-4 py-3 font-extrabold">
            {billing.payment_number} <Copy className="size-5 text-primary" />
          </button>
        )}
        {billing?.payment_link && (
          <a href={billing.payment_link} target="_blank" rel="noreferrer" className="press flex items-center justify-center gap-2 rounded-2xl bg-gradient-teal py-3 font-extrabold text-teal-foreground">
            <ExternalLink className="size-5" /> Payer par lien
          </a>
        )}
        {!billing?.payment_number && !billing?.payment_link && <p className="rounded-2xl bg-muted p-3 text-sm font-bold">Le moyen de paiement sera bientôt disponible.</p>}
        {billing?.instructions && <p className="text-xs font-bold text-muted-foreground whitespace-pre-line">{billing.instructions}</p>}
        <p className="text-sm font-extrabold">2. Envoyez la preuve</p>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="press flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-3 font-extrabold">
          <Upload className="size-5" /> {file ? file.name : "Capture du paiement"}
        </button>
        <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Référence de la transaction (facultatif)" className="w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none" />
        <button type="button" disabled={sending} onClick={submit} className="press w-full rounded-3xl bg-gradient-flame py-4 text-lg font-extrabold text-primary-foreground disabled:opacity-50">
          {sending ? "Envoi…" : "J'ai payé"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
