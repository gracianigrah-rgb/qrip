import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  phone: string;
  currency: string;
  business_name: string | null;
};

/** Reads the profile and creates the row for older accounts that never had one. */
export async function fetchOrCreateProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Session introuvable");
  const user = userData.user;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, phone, currency, business_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;

  const phone = `+${(user.email ?? "").replace(/^u/, "").split("@")[0]?.replace(/\D/g, "") ?? ""}`;
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, phone })
    .select("id, phone, currency, business_name")
    .single();
  if (insertError) throw insertError;
  return created as Profile;
}

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchOrCreateProfile });
}

export function isProfileComplete(profile?: Profile | null) {
  return Boolean(profile?.business_name && profile.business_name.trim().length > 1);
}
