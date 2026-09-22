import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Kind = "achat" | "vente";

export const CURRENCY = "XOF";

export function formatMoney(value: number, currency = CURRENCY) {
  const rounded = Math.round(value);
  const formatted = new Intl.NumberFormat("fr-FR").format(Math.abs(rounded));
  const sign = rounded < 0 ? "-" : "";
  if (currency === "XOF") return `${sign}${formatted} F`;
  if (currency === "EUR") return `${sign}${formatted} €`;
  if (currency === "USD") return `${sign}$${formatted}`;
  return `${sign}${formatted} ${currency}`;
}

/** Keeps digits and a leading +, strips spaces and separators. */
export function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return (plus ? "+" : "") + digits;
}

export function phoneDigits(raw: string) {
  return raw.replace(/\D/g, "");
}

/** Phone accounts are backed by a synthetic e-mail identity. */
export function phoneToEmail(phone: string) {
  return `u${phoneDigits(phone)}@qrip.app`;
}

/** The 4-digit code is expanded into a strong, stable passphrase. */
export function pinToPassword(phone: string, pin: string) {
  return `qrip-${phoneDigits(phone)}-${pin}-v1`;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
}

/* ---------- gamification ---------- */

export const LEVELS = [
  { min: 0, name: "Débutant", emoji: "🌱" },
  { min: 5, name: "Régulier", emoji: "🔥" },
  { min: 15, name: "Organisé", emoji: "⭐" },
  { min: 30, name: "Pro", emoji: "🏆" },
  { min: 60, name: "Champion", emoji: "👑" },
];

export function levelFor(count: number) {
  let current = LEVELS[0]!;
  let next: (typeof LEVELS)[number] | null = null;
  for (const level of LEVELS) {
    if (count >= level.min) current = level;
    else if (!next) next = level;
  }
  const floor = current.min;
  const ceiling = next ? next.min : current.min + 1;
  const progress = next ? Math.min(100, ((count - floor) / (ceiling - floor)) * 100) : 100;
  return { current, next, progress, remaining: next ? next.min - count : 0 };
}
