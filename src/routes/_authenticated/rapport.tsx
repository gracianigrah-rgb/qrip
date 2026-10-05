import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Download, FileSpreadsheet, MessageCircle, Receipt, Table2 } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { useInvoices } from "@/routes/_authenticated/accueil";
import { formatMoney } from "@/lib/qrip";
import { getBusinessLogoUrl, useProfile } from "@/lib/profile";
import qripLogoAsset from "@/assets/qrip-logo.png.asset.json";
import { whatsappUrl } from "@/lib/credit";
import { PaymentDialog } from "@/components/qrip/PaymentDialog";
import { canExport, downloadReceipt, logExport, PAY_STATUS, PLAN_LABEL, useBilling, useExportHistory, useSubscription, type Payment } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/rapport")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mon rapport d'activité — qrip" },
      {
        name: "description",
        content: "Chiffre d'affaires, dépenses et résultat : un rapport clair à partager avec une banque ou une microfinance.",
      },
      { property: "og:title", content: "Mon rapport d'activité — qrip" },
      {
        property: "og:description",
        content: "Chiffre d'affaires, dépenses et résultat à partager avec une banque ou une microfinance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rapport,
});

const PERIODS = [
  { id: "all", label: "Tout" },
  { id: "7d", label: "7 jours" },
  { id: "month", label: "Ce mois" },
  { id: "lastmonth", label: "Mois dernier" },
  { id: "year", label: "Cette année" },
] as const;
const KINDS = [
  { id: "all", label: "Tout" },
  { id: "vente", label: "Ventes" },
  { id: "achat", label: "Achats" },
] as const;

function inPeriod(date: string, period: string) {
  if (period === "all") return true;
  const now = new Date();
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "7d") {
    const from = new Date(now);
    from.setDate(now.getDate() - 6);
    return date >= ymd(from);
  }
  if (period === "month") return date.slice(0, 7) === ymd(now).slice(0, 7);
  if (period === "lastmonth") return date.slice(0, 7) === ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  if (period === "year") return date.slice(0, 4) === String(now.getFullYear());
  return true;
}

function Rapport() {
  const qc = useQueryClient();
  const { data: allInvoices = [], isLoading } = useInvoices();
  const [period, setPeriod] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const invoices = allInvoices.filter((i) => inPeriod(i.invoice_date, period) && (kind === "all" || i.kind === kind));
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "Tout";
  const kindLabel = KINDS.find((k) => k.id === kind)?.label ?? "Tout";
  const { data: profile } = useProfile();
  const businessName = profile?.business_name?.trim() || "Mon entreprise";
  const location = [profile?.neighborhood, profile?.city, profile?.country].filter(Boolean).join(", ");
  const businessPhone = profile?.business_phone?.trim() || profile?.phone || "Non renseigné";

  const ventes = invoices.filter((i) => i.kind === "vente");
  const achats = invoices.filter((i) => i.kind === "achat");
  const ca = ventes.reduce((s, i) => s + Number(i.amount), 0);
  const depenses = achats.reduce((s, i) => s + Number(i.amount), 0);
  const resultat = ca - depenses;
  const marge = ca > 0 ? Math.round((resultat / ca) * 100) : 0;
  const mois = new Set(invoices.map((i) => i.invoice_date.slice(0, 7))).size;
  const caMensuel = mois > 0 ? ca / mois : 0;

  const lignes = [
    { label: "Chiffre d'affaires", value: formatMoney(ca) },
    { label: "Dépenses", value: formatMoney(depenses) },
    { label: "Résultat", value: formatMoney(resultat) },
    { label: "Taux de marge", value: `${marge} %` },
    { label: "Ventes par mois (moyenne)", value: formatMoney(caMensuel) },
    { label: "Factures enregistrées", value: String(invoices.length) },
    { label: "Mois suivis", value: String(mois) },
  ];

  function identityRows() {
    return [
      ["Entreprise", businessName],
      ["Téléphone", businessPhone],
      ["Localisation", location || "Non renseignée"],
      ["Filtre", `${periodLabel} · ${kindLabel}`],
    ];
  }

  function shareText() {
    return [
      `Rapport d'activité — ${businessName}`,
      `Téléphone : ${businessPhone}`,
      `Localisation : ${location || "Non renseignée"}`,
      `Période : ${periodLabel} · ${kindLabel}`,
      ...lignes.map((l) => `${l.label} : ${l.value}`),
    ].join("\n");
  }

  async function imageToDataUrl(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Image indisponible");
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function getLogoDataUrl() {
    if (!profile?.logo_path) return null;
    const url = await getBusinessLogoUrl(profile.logo_path);
    return url ? imageToDataUrl(url) : null;
  }

  function share() {
    window.open(whatsappUrl(`${shareText()}\n\nEnvoyé avec qrip`), "_blank", "noopener");
  }

  const sub = useSubscription();
  const { data: billing } = useBilling();
  const { data: exportsLog = [] } = useExportHistory();
  const [payPlan, setPayPlan] = useState<Payment["plan"] | null>(null);
  const unlocked = canExport(sub.state);
  const filterLabel = `${periodLabel} · ${kindLabel}`;
  async function guarded(fmt: string, fn: () => unknown) {
    if (!unlocked) { toast.error("Abonnez-vous pour exporter."); return; }
    await fn();
    await logExport(fmt, `Rapport · ${filterLabel}`);
    qc.invalidateQueries({ queryKey: ["exports"] });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = [
      ...identityRows(),
      ["Logo", profile?.logo_path ? "Fourni — voir le rapport PDF ou Excel" : "Non fourni"],
      [],
      ["Date", "Type", "Commerce ou client", "Montant", "Devise"],
      ...invoices.map((invoice) => [
        invoice.invoice_date,
        invoice.kind === "vente" ? "Vente" : "Achat",
        invoice.merchant ?? "",
        String(Number(invoice.amount)),
        invoice.currency,
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), "rapport-qrip.csv");
    toast.success("Export CSV téléchargé.");
  }

  async function buildPdf() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pdfText = (value: string) => value.replace(/[\u00a0\u202f]/g, " ");
    const [companyLogo, brandLogo] = await Promise.all([
      getLogoDataUrl().catch(() => null),
      imageToDataUrl(qripLogoAsset.url).catch(() => null),
    ]);
    if (brandLogo) pdf.addImage(brandLogo, "PNG", 20, 14, 28, 18, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text("Rapport d'activite", 20, 43);
    if (companyLogo) pdf.addImage(companyLogo, "PNG", 166, 12, 24, 24, undefined, "FAST");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text(pdfText(businessName), 190, 43, { align: "right", maxWidth: 90 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(pdfText(`Telephone : ${businessPhone}`), 20, 51);
    pdf.text(pdfText(`Localisation : ${location || "Non renseignee"}`), 20, 57, { maxWidth: 170 });
    pdf.text(pdfText(`Genere le ${new Date().toLocaleDateString("fr-FR")} · Filtre : ${periodLabel} / ${kindLabel}`), 20, 63);
    lignes.forEach((ligne, index) => {
      const y = 78 + index * 12;
      pdf.setFont("helvetica", "normal");
      pdf.text(ligne.label, 20, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(pdfText(ligne.value.replace("€", "EUR")), 190, y, { align: "right" });
    });
    return pdf.output("blob");
  }

  async function exportPdf() {
    const blob = await buildPdf();
    downloadBlob(blob, "rapport-qrip.pdf");
    toast.success("Rapport PDF téléchargé.");
  }

  async function exportExcel() {
    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Rapport");
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    sheet.columns = [
      { key: "a", width: 28 },
      { key: "b", width: 30 },
      { key: "c", width: 22 },
      { key: "d", width: 18 },
      { key: "e", width: 14 },
    ];
    const [logoData, brandLogoData] = await Promise.all([
      getLogoDataUrl().catch(() => null),
      imageToDataUrl(qripLogoAsset.url).catch(() => null),
    ]);
    if (brandLogoData) {
      const brandImageId = workbook.addImage({ base64: brandLogoData, extension: "png" });
      sheet.addImage(brandImageId, { tl: { col: 0, row: 0.1 }, ext: { width: 90, height: 54 } });
    }
    if (logoData) {
      const imageId = workbook.addImage({ base64: logoData, extension: logoData.includes("image/jpeg") ? "jpeg" : "png" });
      sheet.addImage(imageId, { tl: { col: 3.7, row: 0.2 }, ext: { width: 110, height: 80 } });
    }
    sheet.mergeCells("A2:C2");
    sheet.getCell("A2").value = "RAPPORT D’ACTIVITÉ";
    sheet.getCell("A2").font = { name: "Arial", bold: true, size: 18, color: { argb: "FF613300" } };
    identityRows().forEach(([label, value], index) => {
      sheet.getCell(index + 3, 1).value = label;
      sheet.getCell(index + 3, 1).font = { name: "Arial", bold: true };
      sheet.getCell(index + 3, 2).value = value;
    });
    const headerRow = 8;
    ["Date", "Type", "Commerce ou client", "Montant", "Devise"].forEach((value, index) => {
      const cell = sheet.getCell(headerRow, index + 1);
      cell.value = value;
      cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF079C95" } };
    });
    invoices.forEach((invoice, index) => {
      const row = sheet.getRow(headerRow + index + 1);
      row.values = [invoice.invoice_date, invoice.kind === "vente" ? "Vente" : "Achat", invoice.merchant ?? "", Number(invoice.amount), invoice.currency];
      row.getCell(4).numFmt = '#,##0;(#,##0);-';
    });
    const summaryRow = headerRow + invoices.length + 3;
    lignes.forEach((line, index) => {
      sheet.getCell(summaryRow + index, 1).value = line.label;
      sheet.getCell(summaryRow + index, 1).font = { name: "Arial", bold: true };
      sheet.getCell(summaryRow + index, 2).value = line.value;
    });
    sheet.views = [{ state: "frozen", ySplit: headerRow }];
    sheet.pageSetup.printArea = `A1:E${summaryRow + lignes.length}`;
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "rapport-qrip.xlsx");
    toast.success("Export Excel téléchargé.");
  }

  return (
    <Screen
      back="/accueil"
      title="Mon rapport"
      subtitle="À montrer à une banque ou une microfinance"
      className="space-y-5"
      footer={
        <BigButton onClick={share}>
          <span className="flex items-center justify-center gap-3">
            <MessageCircle className="size-6" /> Partager sur WhatsApp (gratuit)
          </span>
        </BigButton>
      }
    >
      <section className="space-y-2">
        {[{ items: PERIODS, value: period, set: setPeriod }, { items: KINDS, value: kind, set: setKind }].map((g, gi) => (
          <div key={gi} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {g.items.map((it) => (
              <button
                key={it.id}
                onClick={() => g.set(it.id)}
                className={`press shrink-0 rounded-full px-4 py-2 text-sm font-extrabold active:press-active ${g.value === it.id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground soft-shadow"}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </section>

      <section className="rounded-4xl bg-gradient-teal p-6 card-pop">
        <div className="flex items-start justify-between gap-4">
          <p className="shrink-0 text-sm font-bold text-teal-foreground/80">Résultat net</p>
          <p className="min-w-0 max-w-[55%] break-words text-right text-sm font-extrabold leading-tight text-teal-foreground">
            {businessName}
          </p>
        </div>
        <p className="mt-1 text-5xl font-extrabold text-teal-foreground">
          {isLoading ? "…" : formatMoney(resultat)}
        </p>
        <p className="mt-2 font-semibold text-teal-foreground/80">Taux de marge : {marge} %</p>
      </section>

      <section className="divide-y divide-border overflow-hidden rounded-3xl bg-card soft-shadow">
        {lignes.map((l) => (
          <div key={l.label} className="flex items-center justify-between px-5 py-4">
            <span className="font-semibold text-muted-foreground">{l.label}</span>
            <span className="font-extrabold">{l.value}</span>
          </div>
        ))}
      </section>

      {unlocked ? (
        <section>
          <h2 className="mb-1 text-lg font-extrabold">Exporter mes données</h2>
          <p className="mb-3 text-sm font-bold text-success">Abonnement actif jusqu’au {sub.end?.toLocaleDateString("fr-FR")}</p>
          <div className="grid grid-cols-3 gap-3">
            <BigButton tone="ghost" onClick={() => guarded("CSV", exportCsv)} className="px-3 py-4 text-base">
              <span className="flex items-center justify-center gap-2"><FileSpreadsheet className="size-5" /> CSV</span>
            </BigButton>
            <BigButton tone="ghost" onClick={() => guarded("PDF", exportPdf)} className="px-3 py-4 text-base">
              <span className="flex items-center justify-center gap-2"><Download className="size-5" /> PDF</span>
            </BigButton>
            <BigButton tone="ghost" onClick={() => guarded("Excel", exportExcel)} className="px-2 py-4 text-base">
              <span className="flex items-center justify-center gap-2"><Table2 className="size-5" /> Excel</span>
            </BigButton>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">{unlocked ? "Prolonger mon abonnement" : "Débloquer PDF, CSV et Excel"}</h2>
        {sub.state === "expired" && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-bold text-destructive">Abonnement terminé : exportations bloquées.</p>}
        {sub.pending && <p className="flex items-center gap-2 rounded-2xl bg-muted p-3 text-sm font-bold"><Clock className="size-4" /> Paiement en cours de vérification.</p>}
        <div className="grid grid-cols-2 gap-3">
          {(["mensuel", "annuel"] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPayPlan(p)} className={`press rounded-3xl p-4 text-left card-pop ${p === "annuel" ? "bg-gradient-flame text-primary-foreground" : "bg-gradient-teal text-teal-foreground"}`}>
              <p className="text-sm font-bold opacity-80">{PLAN_LABEL[p]}</p>
              <p className="text-xl font-extrabold">{formatMoney(Number(p === "annuel" ? billing?.yearly_price ?? 0 : billing?.monthly_price ?? 0), billing?.currency)}</p>
              <p className="text-xs font-bold opacity-80">{p === "annuel" ? "par an" : "par mois"}</p>
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-muted-foreground">Sans abonnement, le bilan du jour peut être exporté à l’unité ({formatMoney(Number(billing?.daily_export_price ?? 0), billing?.currency)}) depuis « Bilan du soir ».</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-extrabold">Historique des paiements</h2>
        {sub.payments.length === 0 && <p className="rounded-3xl bg-card p-4 text-sm font-bold text-muted-foreground soft-shadow">Aucun paiement.</p>}
        {sub.payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-3xl bg-card p-4 soft-shadow">
            <div className="min-w-0">
              <p className="font-extrabold">{PLAN_LABEL[p.plan]} · {formatMoney(Number(p.amount), p.currency)}</p>
              <p className="text-xs font-bold text-muted-foreground">{new Date(p.created_at).toLocaleDateString("fr-FR")} · <span className={p.status === "confirme" ? "text-success" : p.status === "refuse" ? "text-destructive" : ""}>{PAY_STATUS[p.status]}</span>{p.admin_note ? ` · ${p.admin_note}` : ""}</p>
            </div>
            {p.status === "confirme" && (
              <button type="button" onClick={() => downloadReceipt(p, businessName, profile?.owner_name, businessPhone)} className="press flex shrink-0 items-center gap-1 rounded-2xl bg-muted px-3 py-2 text-sm font-extrabold">
                <Receipt className="size-4" /> Reçu
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-extrabold">Historique des exportations</h2>
        {exportsLog.length === 0 && <p className="rounded-3xl bg-card p-4 text-sm font-bold text-muted-foreground soft-shadow">Aucune exportation.</p>}
        {exportsLog.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-sm soft-shadow">
            <span className="font-bold">{e.format} · {e.label}</span>
            <span className="text-xs font-bold text-muted-foreground">{new Date(e.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
        ))}
      </section>

      <PaymentDialog plan={payPlan} onClose={() => setPayPlan(null)} />

      <p className="rounded-3xl bg-gradient-sun p-5 text-sm font-semibold text-sun-foreground">
        Plus vous enregistrez de factures, plus votre dossier est solide pour obtenir un financement.
      </p>
    </Screen>
  );
}
