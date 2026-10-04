import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verifier")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ c: typeof s.c === "string" ? s.c : "" }),
  head: () => ({
    meta: [
      { title: "Vérifier un document — qrip" },
      { name: "description", content: "Vérifiez l’authenticité d’un dossier financier ou d’un reçu qrip." },
      { property: "og:title", content: "Vérifier un document — qrip" },
      { property: "og:description", content: "Vérifiez l’authenticité d’un dossier financier ou d’un reçu qrip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Verify,
});

function Verify() {
  const { c } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["verify", c],
    enabled: !!c,
    queryFn: async () => {
      const { data } = await supabase.rpc("verify_certificate", { _code: c });
      return (data as any[] | null)?.[0] ?? null;
    },
  });
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      {isLoading ? <p className="font-bold">Vérification…</p> : data ? (
        <div className="w-full max-w-sm space-y-2 rounded-4xl bg-card p-6 soft-shadow">
          <BadgeCheck className="mx-auto size-14 text-teal-deep" />
          <h1 className="text-2xl font-extrabold">Document authentique</h1>
          <p className="font-bold text-muted-foreground">N° {c}</p>
          <p className="text-lg font-extrabold">{data.business_name || "Commerçant qrip"}</p>
          <p className="text-sm font-bold text-muted-foreground">{[data.city, data.country].filter(Boolean).join(", ")}</p>
          {data.score != null && <p className="rounded-2xl bg-muted p-2 font-extrabold">Score de santé financière : {data.score}/100</p>}
          <p className="text-xs font-bold text-muted-foreground">Émis le {new Date(data.issued_at).toLocaleDateString("fr-FR")}</p>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-2 rounded-4xl bg-card p-6 soft-shadow">
          <ShieldX className="mx-auto size-14 text-destructive" />
          <h1 className="text-2xl font-extrabold">Document introuvable</h1>
          <p className="text-sm font-bold text-muted-foreground">Ce numéro ne correspond à aucun document qrip.</p>
        </div>
      )}
      <Link to="/" className="font-bold text-primary">Découvrir qrip</Link>
    </div>
  );
}
