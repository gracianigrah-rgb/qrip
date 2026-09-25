import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Check, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Kind } from "@/lib/qrip";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ kind: z.enum(["achat", "vente"]).optional() });

export const Route = createFileRoute("/_authenticated/saisie")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Saisie manuelle — qrip" },
      { name: "description", content: "Saisissez et vérifiez manuellement un achat ou une vente." },
      { property: "og:title", content: "Saisie manuelle — qrip" },
      { property: "og:description", content: "Saisissez et vérifiez manuellement un achat ou une vente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManualEntry,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ManualEntry() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [kind, setKind] = useState<Kind>(search.kind ?? "achat");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsedAmount = Number(amount.replace(/[^\d.,]/g, "").replace(",", "."));

  function review() {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    if (!date) {
      toast.error("Indiquez la date de l’opération.");
      return;
    }
    setReviewing(true);
  }

  async function save() {
    setSaving(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (userError || !userId) throw userError ?? new Error("Session introuvable");
      const { error } = await supabase.from("invoices").insert({
        user_id: userId,
        kind,
        amount: parsedAmount,
        merchant: merchant.trim() || null,
        invoice_date: date,
        note: note.trim() || null,
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(kind === "vente" ? "Vente enregistrée" : "Achat enregistré");
      navigate({ to: "/accueil", replace: true });
    } catch {
      toast.error("L’opération n’a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen {...(!reviewing ? { back: "/capture" } : {})} title={reviewing ? "Vérifiez l’opération" : "Saisie manuelle"} className="space-y-5">
      {reviewing ? (
        <>
          <section className={cn("rounded-3xl p-6 card-pop", kind === "vente" ? "bg-gradient-teal" : "bg-gradient-flame")}>
            <p className={cn("text-sm font-bold", kind === "vente" ? "text-teal-foreground/80" : "text-primary-foreground/80")}>{kind === "vente" ? "VENTE" : "ACHAT"}</p>
            <p className={cn("mt-1 text-4xl font-extrabold", kind === "vente" ? "text-teal-foreground" : "text-primary-foreground")}>{new Intl.NumberFormat("fr-FR").format(parsedAmount)} F</p>
          </section>
          <section className="space-y-3 rounded-3xl bg-card p-5 soft-shadow">
            <div><p className="text-xs font-bold text-muted-foreground">Client / fournisseur</p><p className="font-extrabold">{merchant.trim() || "Non renseigné"}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground">Date</p><p className="font-extrabold">{new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR")}</p></div>
            <div><p className="text-xs font-bold text-muted-foreground">Note</p><p className="whitespace-pre-wrap font-semibold">{note.trim() || "Aucune note"}</p></div>
          </section>
          <Button variant="outline" className="h-14 w-full rounded-2xl text-base font-extrabold" onClick={() => setReviewing(false)}>
            <Pencil className="size-5" /> Modifier
          </Button>
          <BigButton tone="sun" disabled={saving} onClick={save}>
            <span className="flex items-center justify-center gap-2"><Check className="size-5" />{saving ? "Enregistrement…" : "Valider définitivement"}</span>
          </BigButton>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Button type="button" variant="ghost" onClick={() => setKind("achat")} className={cn("h-28 flex-col rounded-3xl bg-gradient-flame text-primary-foreground card-pop", kind !== "achat" && "opacity-40")}>
              <ArrowDownLeft className="size-8" /><span className="text-lg font-extrabold">ACHAT</span>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setKind("vente")} className={cn("h-28 flex-col rounded-3xl bg-gradient-teal text-teal-foreground card-pop", kind !== "vente" && "opacity-40")}>
              <ArrowUpRight className="size-8" /><span className="text-lg font-extrabold">VENTE</span>
            </Button>
          </div>
          <section className="space-y-4 rounded-3xl bg-card p-5 soft-shadow">
            <label className="block"><span className="text-sm font-bold text-muted-foreground">Montant</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="mt-2 w-full rounded-2xl bg-muted px-4 py-3 text-2xl font-extrabold outline-none" /></label>
            <label className="block"><span className="text-sm font-bold text-muted-foreground">Client / fournisseur</span><input value={merchant} onChange={(event) => setMerchant(event.target.value)} maxLength={80} placeholder="Nom (facultatif)" className="mt-2 w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none" /></label>
            <label className="block"><span className="text-sm font-bold text-muted-foreground">Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-2xl bg-muted px-4 py-3 font-bold outline-none" /></label>
            <label className="block"><span className="text-sm font-bold text-muted-foreground">Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} placeholder="Détail utile (facultatif)" className="mt-2 w-full resize-none rounded-2xl bg-muted px-4 py-3 font-semibold outline-none" /></label>
          </section>
          <BigButton onClick={review}>Vérifier avant de valider</BigButton>
        </>
      )}
    </Screen>
  );
}