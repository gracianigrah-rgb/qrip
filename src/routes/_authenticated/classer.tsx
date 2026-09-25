import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { clearPendingDocument, getPendingDocument, PENDING_KIND_KEY, type PendingDocument } from "@/lib/pending-invoice";
import { supabase } from "@/integrations/supabase/client";
import { analyzeInvoice, type InvoiceSuggestion } from "@/lib/invoice-ai.functions";
import type { Kind } from "@/lib/qrip";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/classer")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Achat ou vente ? — qrip" },
      { name: "description", content: "L'IA propose, vous décidez : classez la facture en achat ou en vente." },
      { property: "og:title", content: "Achat ou vente ? — qrip" },
      { property: "og:description", content: "L'IA propose, vous décidez : classez la facture en achat ou en vente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Classer,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Classer() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const analyze = useServerFn(analyzeInvoice);

  const [document, setDocument] = useState<PendingDocument | null>(null);
  const [suggestion, setSuggestion] = useState<InvoiceSuggestion | null>(null);
  const [analyzing, setAnalyzing] = useState(true);
  const [kind, setKind] = useState<Kind | null>(null);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPendingDocument().then((stored) => {
      if (!stored) {
        navigate({ to: "/capture", replace: true });
        return;
      }
      setDocument(stored);
      const presetKind = sessionStorage.getItem(PENDING_KIND_KEY);
      if (presetKind === "achat" || presetKind === "vente") setKind(presetKind);
      analyze({ data: { documentDataUrl: stored.dataUrl, mimeType: stored.mimeType, fileName: stored.fileName } })
        .then((result) => {
          setSuggestion(result);
          if (!presetKind && result.kind) setKind(result.kind);
          if (result.amount) setAmount(String(result.amount));
          if (result.merchant) setMerchant(result.merchant);
          if (result.invoice_date) setDate(result.invoice_date);
        })
        .catch(() => setSuggestion(null))
        .finally(() => setAnalyzing(false));
    }).catch(() => {
      toast.error("Le document n’a pas pu être ouvert.");
      navigate({ to: "/capture", replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!kind) {
      toast.error("Choisissez Achat ou Vente.");
      return;
    }
    const value = Number(amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Indiquez le montant de la facture.");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("no session");

      let imagePath: string | null = null;
      if (document) {
        const blob = await (await fetch(document.dataUrl)).blob();
        const extension = document.mimeType === "application/pdf" ? "pdf" : "jpg";
        const path = `${userId}/${Date.now()}.${extension}`;
        const { error: upErr } = await supabase.storage
          .from("factures")
          .upload(path, blob, { contentType: document.mimeType });
        if (!upErr) imagePath = path;
      }

      const { error } = await supabase.from("invoices").insert({
        user_id: userId,
        kind,
        amount: value,
        merchant: merchant.trim() || null,
        invoice_date: date,
        image_path: imagePath,
        ai_kind: suggestion?.kind ?? null,
        ai_confidence: suggestion?.confidence ?? null,
      });
      if (error) throw error;

      await clearPendingDocument();
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(kind === "vente" ? "Vente enregistrée 🎉" : "Achat enregistré ✅");
      navigate({ to: "/accueil", replace: true });
    } catch {
      toast.error("Enregistrement impossible. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      back="/capture"
      title="Achat ou vente ?"
      className="space-y-5"
      footer={
        <BigButton tone="sun" disabled={saving || !kind} onClick={save}>
          {saving ? "Enregistrement…" : "Valider et mettre à jour ma trésorerie"}
        </BigButton>
      }
    >
      {document?.mimeType === "image/jpeg" && (
        <img
          src={document.dataUrl}
          alt="Facture"
          className="h-40 w-full rounded-3xl object-cover soft-shadow"
          loading="lazy"
        />
      )}
      {document?.mimeType === "application/pdf" && (
        <div className="flex items-center gap-4 rounded-3xl bg-card p-5 soft-shadow">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-sun"><FileText className="size-7 text-sun-foreground" /></div>
          <div className="min-w-0"><p className="font-extrabold">Document PDF</p><p className="truncate text-sm font-semibold text-muted-foreground">{document.fileName}</p></div>
        </div>
      )}

      <div className="rounded-3xl bg-card p-4 soft-shadow">
        <p className="flex items-center gap-2 text-sm font-extrabold text-primary">
          <Sparkles className="size-4" /> Suggestion de l'IA
        </p>
        <p className="mt-1 font-semibold text-muted-foreground">
          {analyzing
            ? "Lecture de la facture en cours…"
            : suggestion?.error
              ? suggestion.error + " Classez la facture vous-même."
              : suggestion?.kind
                ? `${suggestion.kind === "vente" ? "Vente" : "Achat"} (${Math.round((suggestion.confidence || 0) * 100)}% sûr) — ${suggestion.reason ?? ""}`
                : "Pas de suggestion, à vous de choisir."}
        </p>
        <p className="mt-2 text-xs font-bold text-muted-foreground">
          Vous avez toujours le dernier mot.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setKind("achat")}
          className={cn(
            "press flex h-40 flex-col items-center justify-center gap-2 rounded-4xl bg-gradient-flame text-primary-foreground card-pop active:press-active",
            kind && kind !== "achat" && "opacity-40",
            kind === "achat" && "ring-4 ring-ink/20",
          )}
        >
          <ArrowDownLeft className="size-10" />
          <span className="text-2xl font-extrabold">Achat</span>
          <span className="text-xs font-bold opacity-80">Une dépense</span>
        </button>
        <button
          onClick={() => setKind("vente")}
          className={cn(
            "press flex h-40 flex-col items-center justify-center gap-2 rounded-4xl bg-gradient-teal text-teal-foreground card-pop active:press-active",
            kind && kind !== "vente" && "opacity-40",
            kind === "vente" && "ring-4 ring-ink/20",
          )}
        >
          <ArrowUpRight className="size-10" />
          <span className="text-2xl font-extrabold">Vente</span>
          <span className="text-xs font-bold opacity-80">Une entrée d'argent</span>
        </button>
      </div>

      <div className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Montant</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="mt-1 w-full rounded-2xl bg-muted px-4 py-3 text-2xl font-extrabold outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Commerce / client</span>
          <input
            value={merchant}
            maxLength={80}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Nom du fournisseur ou du client"
            className="mt-1 w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none"
          />
        </label>
      </div>
    </Screen>
  );
}
