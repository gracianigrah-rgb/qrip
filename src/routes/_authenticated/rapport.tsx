import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Share2 } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { useInvoices } from "@/routes/_authenticated/accueil";
import { formatMoney } from "@/lib/qrip";

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

  async function share() {
    const text = [
      "Rapport d'activité qrip",
      ...lignes.map((l) => `${l.label} : ${l.value}`),
    ].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Rapport qrip", text });
      else {
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
      ["Date", "Type", "Commerce ou client", "Montant", "Devise"],
      ...invoices.map((invoice) => [
        invoice.invoice_date,
        invoice.kind === "vente" ? "Vente" : "Achat",
        invoice.merchant ?? "",
        String(Number(invoice.amount)),
        "XOF",
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";")).join("\n");
    downloadBlob(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), "rapport-qrip.csv");
    toast.success("Export CSV téléchargé.");
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(24);
    pdf.text("qrip", 20, 24);
    pdf.setFontSize(16);
    pdf.text("Rapport d'activite", 20, 36);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, 20, 45);
    lignes.forEach((ligne, index) => {
      const y = 62 + index * 12;
      pdf.setFont("helvetica", "normal");
      pdf.text(ligne.label, 20, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(ligne.value.replace("€", "EUR"), 190, y, { align: "right" });
    });
    pdf.save("rapport-qrip.pdf");
    toast.success("Rapport PDF téléchargé.");
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
        <p className="text-sm font-bold text-teal-foreground/80">Résultat net</p>
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
        <div className="grid grid-cols-2 gap-3">
          <BigButton tone="ghost" onClick={exportCsv} className="px-3 py-4 text-base">
            <span className="flex items-center justify-center gap-2"><FileSpreadsheet className="size-5" /> CSV</span>
          </BigButton>
          <BigButton tone="ghost" onClick={exportPdf} className="px-3 py-4 text-base">
            <span className="flex items-center justify-center gap-2"><Download className="size-5" /> PDF</span>
          </BigButton>
        </div>
      </section>

      <p className="rounded-3xl bg-gradient-sun p-5 text-sm font-semibold text-sun-foreground">
        Plus vous enregistrez de factures, plus votre dossier est solide pour obtenir un financement.
      </p>
    </Screen>
  );
}
