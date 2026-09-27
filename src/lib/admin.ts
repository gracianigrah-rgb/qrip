import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Server decides: only the designated phone account becomes admin after signing in. */
export function useIsAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("claim_admin");
      if (error) return false;
      return Boolean(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function useMyNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as AppNotification[];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, read_at, created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AppNotification[];
    },
    refetchInterval: 60_000,
  });
}
