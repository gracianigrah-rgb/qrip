import type { Kind } from "@/lib/qrip";

export const CATEGORIES = ["Marchandises", "Transport", "Loyer", "Salaires", "Services", "Fournitures", "Autre"] as const;

export type VoiceResult = { kind: Kind | null; amount: number | null; item: string };

/** Parses "j'ai vendu du riz 15000" / "j'ai acheté 2 sacs de ciment 30 000 francs". */
export function parseVoiceCommand(raw: string): VoiceResult {
  let text = raw.toLowerCase().replace(/[’']/g, "'").trim();
  let kind: Kind | null = null;
  if (/\b(vendu|vend|vente|vendre)\b/.test(text)) kind = "vente";
  else if (/\b(achet\w*|achat)\b/.test(text)) kind = "achat";
  text = text.replace(/^(j'ai|j ai|je)\s+/, "").replace(/^(vendu|vend|vendre|achet\w*)\s+/, "");
  // join spoken thousands like "15 000"
  text = text.replace(/(\d)[\s\u00a0\u202f.](?=\d{3}\b)/g, "$1");
  const numbers = [...text.matchAll(/\d+(?:[.,]\d+)?/g)];
  let amount: number | null = null;
  let item = text;
  const last = numbers.at(-1);
  if (last) {
    amount = Number(last[0].replace(",", "."));
    item = text.slice(0, last.index) + text.slice((last.index ?? 0) + last[0].length);
  }
  item = item
    .replace(/\b(f\s?cfa|francs?|fcfa|f)\b/g, "")
    .replace(/\b(pour|à|a|au prix de|de)\s*$/g, "")
    .replace(/[+,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { kind, amount, item: item ? item[0]!.toUpperCase() + item.slice(1) : "" };
}

type Rec = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null };

export function createRecognizer(): Rec | null {
  if (typeof window === "undefined") return null;
  const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec: Rec = new Ctor();
  rec.lang = "fr-FR";
  rec.interimResults = false;
  return rec;
}
