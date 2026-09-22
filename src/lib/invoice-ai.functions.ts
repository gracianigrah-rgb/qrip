import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachAuth } from "@/lib/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageDataUrl: z.string().min(20),
});

export type InvoiceSuggestion = {
  kind: "achat" | "vente" | null;
  confidence: number;
  amount: number | null;
  merchant: string | null;
  invoice_date: string | null;
  reason: string | null;
  error?: string;
};

const PROMPT = `Tu analyses la photo d'une facture ou d'un reçu pour un petit commerçant en Afrique de l'Ouest.
Réponds UNIQUEMENT avec un objet JSON, sans texte autour, avec ces clés :
{"kind":"achat"|"vente","confidence":0-1,"amount":nombre,"merchant":"texte","invoice_date":"AAAA-MM-JJ","reason":"une phrase courte en français"}
"vente" = le document prouve que l'utilisateur a vendu quelque chose (facture émise par lui, reçu client).
"achat" = le document prouve une dépense (ticket de caisse, facture fournisseur).
Si une valeur est inconnue, mets null. Le montant est le total TTC en chiffres, sans devise.`;

function extractText(payload: unknown): string {
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const chunk of item.content ?? []) {
      if (chunk.type === "output_text" && chunk.text) parts.push(chunk.text);
    }
  }
  return parts.join("");
}

export const analyzeInvoice = createServerFn({ method: "POST" })
  .middleware([attachAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<InvoiceSuggestion> => {
    const key = process.env["LOVABLE_API_KEY"];
    const empty: InvoiceSuggestion = {
      kind: null,
      confidence: 0,
      amount: null,
      merchant: null,
      invoice_date: null,
      reason: null,
    };
    if (!key) return { ...empty, error: "AI indisponible" };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning: { effort: "low" },
        store: false,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_image", image_url: data.imageDataUrl },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("AI gateway error", response.status, body);
      if (response.status === 429) return { ...empty, error: "Trop de demandes, réessayez dans un instant." };
      if (response.status === 402) return { ...empty, error: "Crédits IA épuisés." };
      return { ...empty, error: "L'analyse automatique n'a pas abouti." };
    }

    const payload = await response.json();
    const text = extractText(payload);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...empty, error: "Analyse illisible" };

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const kind = parsed["kind"] === "achat" || parsed["kind"] === "vente" ? parsed["kind"] : null;
      const amount = Number(parsed["amount"]);
      return {
        kind,
        confidence: Number(parsed["confidence"]) || 0,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        merchant: typeof parsed["merchant"] === "string" ? parsed["merchant"] : null,
        invoice_date:
          typeof parsed["invoice_date"] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed["invoice_date"])
            ? parsed["invoice_date"]
            : null,
        reason: typeof parsed["reason"] === "string" ? parsed["reason"] : null,
      };
    } catch {
      return { ...empty, error: "Analyse illisible" };
    }
  });
