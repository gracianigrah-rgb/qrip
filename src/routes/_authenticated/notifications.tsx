import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { Screen } from "@/components/qrip/Screen";
import { supabase } from "@/integrations/supabase/client";
import { useMyNotifications } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/notifications")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Notifications — qrip" },
      { name: "description", content: "Messages reçus de l’équipe qrip." },
      { property: "og:title", content: "Notifications — qrip" },
      { property: "og:description", content: "Messages reçus de l’équipe qrip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { data, isLoading } = useMyNotifications();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unread = (data ?? []).filter((n) => !n.read_at).map((n) => n.id);
    if (!unread.length) return;
    supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
  }, [data, queryClient]);

  return (
    <Screen title="Notifications" back="/accueil" className="space-y-3">
      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {!isLoading && !data?.length && (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center soft-shadow">
          <Bell className="size-10 text-muted-foreground" />
          <p className="font-bold text-muted-foreground">Aucune notification pour le moment.</p>
        </div>
      )}
      {data?.map((n) => (
        <article key={n.id} className="rounded-3xl bg-card p-5 soft-shadow">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-extrabold">{n.title}</h2>
            {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary" />}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm">{n.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p>
        </article>
      ))}
    </Screen>
  );
}
