import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import mascotAsset from "@/assets/qrip-mascot.png.asset.json";

const KEY = "qrip:install";
type State = { visits: number; firstSeen: number; lastVisit: number; dismissedAt?: number; installed?: boolean };
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function read(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s) return s;
  } catch { /* ignore */ }
  return { visits: 0, firstSeen: Date.now(), lastVisit: 0 };
}
function write(s: State) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const s = read();
    if (standalone) {
      write({ ...s, installed: true });
      return;
    }
    // Count a new visit when 30 min passed since the last one
    const now = Date.now();
    if (now - s.lastVisit > 30 * 60 * 1000) s.visits += 1;
    s.lastVisit = now;
    write(s);

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    const snoozed = s.dismissedAt && now - s.dismissedAt < 3 * 24 * 3600 * 1000;
    const eligible = !s.installed && !snoozed && (s.visits >= 2 || now - s.firstSeen > 0);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      write({ ...read(), installed: true });
      setShow(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    // Show after the visitor has had time to look around
    const delay = s.visits >= 2 ? 4000 : 25000;
    const t = eligible ? setTimeout(() => setShow(true), delay) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!show || (!deferred && !ios)) return null;

  const dismiss = () => {
    write({ ...read(), dismissedAt: Date.now() });
    setShow(false);
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") write({ ...read(), installed: true });
    else write({ ...read(), dismissedAt: Date.now() });
    setDeferred(null);
    setShow(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg px-4">
      <div className="animate-pop-in flex items-center gap-3 rounded-3xl border border-border bg-card p-4 card-pop">
        <img src={mascotAsset.url} alt="" className="size-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">Installer qrip sur votre téléphone</p>
          {ios ? (
            <p className="mt-1 flex flex-wrap items-center gap-1 text-xs font-semibold text-muted-foreground">
              Appuyez sur <Share className="size-3.5" /> puis « Sur l’écran d’accueil ».
            </p>
          ) : (
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Ouvrez qrip en un clic, même sans réseau.</p>
          )}
          {!ios && (
            <button onClick={install} className="press mt-2 flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground active:press-active">
              <Download className="size-4" /> Installer
            </button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Plus tard" className="self-start rounded-full p-1 text-muted-foreground">
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}
