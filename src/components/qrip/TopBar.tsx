import { Link } from "@tanstack/react-router";
import { Bell, Building2, CloudOff, Download } from "lucide-react";
import { dailyUnlocked, useSubscription } from "@/lib/subscription";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import qripLogoAsset from "@/assets/qrip-logo.png.asset.json";
import { getBusinessLogoUrl, useProfile } from "@/lib/profile";
import { useMyNotifications } from "@/lib/admin";
import { useAutoSync, useNetworkState } from "@/lib/offline";

export function TopBar() {
  const { data: profile } = useProfile();
  const { data: notifications } = useMyNotifications();
  const [logo, setLogo] = useState<string | null>(null);
  const unread = (notifications ?? []).filter((n) => !n.read_at).length;
  useAutoSync(useQueryClient());
  const { online, pending } = useNetworkState();
  const sub = useSubscription();
  const level = sub.state === "active" ? "ok" : sub.state === "expiring" || dailyUnlocked(sub.payments) ? "warn" : "off";
  const exportTone = level === "ok" ? "text-success" : level === "warn" ? "text-warning" : "text-destructive";
  const exportDot = level === "ok" ? "bg-success" : level === "warn" ? "bg-warning" : "bg-destructive";
  const exportLabel = level === "ok" ? "Exportations actives" : level === "warn" ? (sub.state === "expiring" ? `Abonnement : ${sub.daysLeft} j restants` : "Export du bilan du jour activé") : "Exportations bloquées";

  useEffect(() => {
    getBusinessLogoUrl(profile?.logo_path).then(setLogo).catch(() => setLogo(null));
  }, [profile?.logo_path]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 mx-auto flex h-[calc(3.75rem+env(safe-area-inset-top))] max-w-lg items-end justify-between gap-3 border-b border-border bg-card/95 px-5 pb-3 backdrop-blur-xl">
      <div className="flex shrink-0 items-center gap-2">
        <img src={qripLogoAsset.url} alt="qrip" className="h-8 w-auto shrink-0" />
        {(!online || pending > 0) && (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-extrabold text-muted-foreground">
            <CloudOff className="size-3" />{!online ? "Hors-ligne" : "Envoi…"}{pending > 0 ? ` · ${pending}` : ""}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <Link to="/rapport" aria-label={exportLabel} title={exportLabel}
          className="press relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted active:press-active">
          <Download className={`size-5 ${exportTone}`} />
          <span className={`absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-card ${exportDot}`} />
        </Link>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="press relative flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:press-active"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
        <Link to="/profil" aria-label="Profil entreprise" className="flex items-center">
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {logo ? <img src={logo} alt="Logo de l’entreprise" className="size-full object-contain" /> : <Building2 className="size-5 text-muted-foreground" />}
          </span>
        </Link>
      </div>
    </header>
  );
}
