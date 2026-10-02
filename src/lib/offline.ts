import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "qrip:offline-queue";
const CACHE_KEY = "qrip:invoices-cache";
const EVT = "qrip:queue-change";

export type NewInvoice = Record<string, unknown> & { user_id: string; kind: "achat" | "vente"; amount: number; invoice_date: string };
type Queued = NewInvoice & { id: string; created_at: string; _pending: true };

function read<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; }
}
export const getQueue = () => read<Queued[]>(QUEUE_KEY, []);
function setQueue(q: Queued[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event(EVT));
}
export const getCachedInvoices = () => read<any[] | undefined>(CACHE_KEY, undefined);
export const setCachedInvoices = (rows: unknown[]) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch { /* quota */ } };

/** Rows waiting to sync, shaped like server rows so lists and totals include them. */
export function pendingRows() {
  return getQueue().map((q) => ({ category: null, merchant: null, note: null, on_credit: false, settled_at: null, contact_phone: null, image_path: null, ...q }));
}

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Saves now when online, otherwise keeps the operation on the phone. Returns true if queued. */
export async function saveInvoice(row: NewInvoice, qc: QueryClient): Promise<boolean> {
  if (navigator.onLine) {
    try {
      const { error } = await supabase.from("invoices").insert(row as never);
      if (!error) { await qc.invalidateQueries({ queryKey: ["invoices"] }); return false; }
      if (!/fetch|network/i.test(error.message)) throw error;
    } catch (e) {
      if (!(e instanceof TypeError) && !/fetch|network/i.test(String((e as Error)?.message))) throw e;
    }
  }
  setQueue([...getQueue(), { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString(), _pending: true }]);
  await qc.invalidateQueries({ queryKey: ["invoices"] });
  return true;
}

let syncing = false;
export async function syncQueue(qc: QueryClient) {
  if (syncing || !navigator.onLine) return;
  const queue = getQueue();
  if (!queue.length) return;
  syncing = true;
  let done = 0;
  try {
    for (const item of queue) {
      const { _pending, ...row } = item;
      const { error } = await supabase.from("invoices").upsert(row as never, { onConflict: "id", ignoreDuplicates: true });
      if (error) break;
      setQueue(getQueue().filter((q) => q.id !== item.id));
      done++;
    }
  } finally { syncing = false; }
  if (done) {
    await qc.invalidateQueries({ queryKey: ["invoices"] });
    toast.success(`${done} opération(s) hors-ligne synchronisée(s)`);
  }
}

/** Mount once: syncs on reconnect and at startup. */
export function useAutoSync(qc: QueryClient) {
  useEffect(() => {
    const run = () => void syncQueue(qc);
    run();
    window.addEventListener("online", run);
    const t = setInterval(run, 30000);
    return () => { window.removeEventListener("online", run); clearInterval(t); };
  }, [qc]);
}

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  window.addEventListener(EVT, cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); window.removeEventListener(EVT, cb); };
}
export function useNetworkState() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const pending = useSyncExternalStore(subscribe, () => getQueue().length, () => 0);
  return { online, pending };
}

/* Daily goal (kept on the phone, works offline) */
const GOAL_KEY = "qrip:daily-goal";
const GOAL_EVT = "qrip:goal-change";
export function setDailyGoal(v: number) {
  localStorage.setItem(GOAL_KEY, String(Math.max(0, Math.round(v))));
  window.dispatchEvent(new Event(GOAL_EVT));
}
export function useDailyGoal() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener(GOAL_EVT, cb); window.addEventListener("storage", cb); return () => { window.removeEventListener(GOAL_EVT, cb); window.removeEventListener("storage", cb); }; },
    () => Number(localStorage.getItem(GOAL_KEY) ?? 0) || 0,
    () => 0,
  );
}
