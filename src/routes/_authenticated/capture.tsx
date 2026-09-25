import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, FileUp, Keyboard } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { BigButton, Screen } from "@/components/qrip/Screen";
import { PENDING_KIND_KEY, savePendingDocument } from "@/lib/pending-invoice";

const captureSearchSchema = z.object({ kind: z.enum(["achat", "vente"]).optional() });

export const Route = createFileRoute("/_authenticated/capture")({
  ssr: false,
  validateSearch: captureSearchSchema,
  head: () => ({
    meta: [
      { title: "Photographier une facture — qrip" },
      { name: "description", content: "Prenez une photo de votre facture ou importez-la depuis votre galerie." },
      { property: "og:title", content: "Photographier une facture — qrip" },
      { property: "og:description", content: "Prenez une photo de votre facture ou importez-la depuis votre galerie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Capture,
});

async function toResizedDataUrl(file: File, max = 1400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("file"));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function Capture() {
  const navigate = useNavigate();
  const { kind } = Route.useSearch();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File | null) {
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    const isImage = file.type.startsWith("image/");
    if ((!isPdf && !isImage) || file.size > 10 * 1024 * 1024) {
      toast.error("Choisissez une image ou un PDF de moins de 10 Mo.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = isPdf ? await toDataUrl(file) : await toResizedDataUrl(file);
      await savePendingDocument({
        dataUrl,
        mimeType: isPdf ? "application/pdf" : "image/jpeg",
        fileName: file.name.slice(0, 120) || (isPdf ? "facture.pdf" : "facture.jpg"),
      });
      if (kind) sessionStorage.setItem(PENDING_KIND_KEY, kind);
      else sessionStorage.removeItem(PENDING_KIND_KEY);
      navigate({ to: "/classer" });
    } catch {
      toast.error("Ce document n'a pas pu être lu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back="/accueil" title="Nouvelle facture" className="flex flex-col justify-center gap-6">
      <div className="mx-auto w-full max-w-sm space-y-5">
        {kind && (
          <p className="text-center text-sm font-extrabold uppercase text-primary">
            Nouvelle {kind === "achat" ? "dépense" : "vente"}
          </p>
        )}
        <div className="rounded-4xl bg-card p-8 text-center card-pop">
          <div className="animate-float mx-auto mb-4 flex size-24 items-center justify-center rounded-3xl bg-gradient-sun">
            <Camera className="size-12 text-sun-foreground" />
          </div>
          <h2 className="text-2xl font-extrabold">Ajoutez votre opération</h2>
          <p className="mt-2 text-muted-foreground">
            Photographiez la facture, importez un document ou saisissez les informations vous-même.
          </p>
        </div>

        <BigButton disabled={busy} onClick={() => cameraRef.current?.click()}>
          <span className="flex items-center justify-center gap-3">
            <Camera className="size-6" /> Prendre une photo
          </span>
        </BigButton>
        <BigButton tone="ghost" disabled={busy} onClick={() => galleryRef.current?.click()}>
          <span className="flex items-center justify-center gap-3">
            <FileUp className="size-6" /> Importer une image ou un PDF
          </span>
        </BigButton>
        <BigButton tone="sun" disabled={busy} onClick={() => navigate({ to: "/saisie", search: { kind } })}>
          <span className="flex items-center justify-center gap-3">
            <Keyboard className="size-6" /> Saisir manuellement
          </span>
        </BigButton>
        {busy && <p className="text-center font-bold text-muted-foreground">Préparation…</p>}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Screen>
  );
}
