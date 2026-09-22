import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { BigButton, Screen } from "@/components/qrip/Screen";

export const PENDING_KEY = "qrip:pending-invoice";

export const Route = createFileRoute("/_authenticated/capture")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Photographier une facture — qrip" },
      { name: "description", content: "Prenez une photo de votre facture ou importez-la depuis votre galerie." },
      { property: "og:title", content: "Photographier une facture — qrip" },
      { property: "og:description", content: "Prenez une photo de votre facture ou importez-la depuis votre galerie." },
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

function Capture() {
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await toResizedDataUrl(file);
      sessionStorage.setItem(PENDING_KEY, dataUrl);
      navigate({ to: "/classer" });
    } catch {
      toast.error("Cette image n'a pas pu être lue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back="/accueil" title="Nouvelle facture" className="flex flex-col justify-center gap-6">
      <div className="mx-auto w-full max-w-sm space-y-5">
        <div className="rounded-4xl bg-card p-8 text-center card-pop">
          <div className="animate-float mx-auto mb-4 flex size-24 items-center justify-center rounded-3xl bg-gradient-sun">
            <Camera className="size-12 text-sun-foreground" />
          </div>
          <h2 className="text-2xl font-extrabold">Montrez-nous la facture</h2>
          <p className="mt-2 text-muted-foreground">
            Posez le papier à plat, bien éclairé. qrip lira le montant pour vous.
          </p>
        </div>

        <BigButton disabled={busy} onClick={() => cameraRef.current?.click()}>
          <span className="flex items-center justify-center gap-3">
            <Camera className="size-6" /> Prendre une photo
          </span>
        </BigButton>
        <BigButton tone="ghost" disabled={busy} onClick={() => galleryRef.current?.click()}>
          <span className="flex items-center justify-center gap-3">
            <ImagePlus className="size-6" /> Importer une image
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
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </Screen>
  );
}
