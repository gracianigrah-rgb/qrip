import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Share2, Table2 } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { useInvoices } from "@/routes/_authenticated/accueil";
import { formatMoney } from "@/lib/qrip";
import { getBusinessLogoUrl, useProfile } from "@/lib/profile";
import qripLogoAsset from "@/assets/qrip-logo.png.asset.json";

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

function Rapport() {
  const { data: invoices = [], isLoading } = useInvoices();
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
    ];
  }

  function shareText() {
    return [
      `Rapport d'activité — ${businessName}`,
      `Téléphone : ${businessPhone}`,
      `Localisation : ${location || "Non renseignée"}`,
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

  async function share() {
    const text = shareText();
    try {
      if (navigator.share) {
        const pdf = await buildPdf();
        const file = new File([pdf], "rapport-qrip.pdf", { type: "application/pdf" });
        const data = navigator.canShare?.({ files: [file] })
          ? { title: `Rapport — ${businessName}`, text, files: [file] }
          : { title: `Rapport — ${businessName}`, text };
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Rapport copié, collez-le où vous voulez.");
      }
    } catch {
      /* partage annulé */
    }
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
    pdf.text(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, 20, 63);
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
    sheet.columns = [
      { key: "a", width: 28 },
      { key: "b", width: 30 },
      { key: "c", width: 22 },
      { key: "d", width: 18 },
      { key: "e", width: 14 },
    ];
    const logoData = await getLogoDataUrl().catch(() => null);
    if (logoData) {
      const imageId = workbook.addImage({ base64: logoData, extension: logoData.includes("image/jpeg") ? "jpeg" : "png" });
      sheet.addImage(imageId, { tl: { col: 3.7, row: 0.2 }, ext: { width: 110, height: 80 } });
    }
    sheet.mergeCells("A1:C1");
    sheet.getCell("A1").value = "RAPPORT D’ACTIVITÉ";
    sheet.getCell("A1").font = { name: "Arial", bold: true, size: 18, color: { argb: "FF613300" } };
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
            <Share2 className="size-6" /> Partager mon rapport
          </span>
        </BigButton>
      }
    >
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

      <section>
        <h2 className="mb-3 text-lg font-extrabold">Exporter mes données</h2>
        <div className="grid grid-cols-3 gap-3">
          <BigButton tone="ghost" onClick={exportCsv} className="px-3 py-4 text-base">
            <span className="flex items-center justify-center gap-2"><FileSpreadsheet className="size-5" /> CSV</span>
          </BigButton>
          <BigButton tone="ghost" onClick={exportPdf} className="px-3 py-4 text-base">
            <span className="flex items-center justify-center gap-2"><Download className="size-5" /> PDF</span>
          </BigButton>
          <BigButton tone="ghost" onClick={exportExcel} className="px-2 py-4 text-base">
            <span className="flex items-center justify-center gap-2"><Table2 className="size-5" /> Excel</span>
          </BigButton>
        </div>
      </section>

      <p className="rounded-3xl bg-gradient-sun p-5 text-sm font-semibold text-sun-foreground">
        Plus vous enregistrez de factures, plus votre dossier est solide pour obtenir un financement.
      </p>
    </Screen>
  );
}
