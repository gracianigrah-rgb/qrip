import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  phone: string;
  currency: string;
  business_name: string | null;
  business_phone: string | null;
  city: string | null;
  country: string | null;
  neighborhood: string | null;
  logo_path: string | null;
};

const PROFILE_FIELDS = "id, phone, currency, business_name, business_phone, city, country, neighborhood, logo_path";

/** Reads the profile and creates the row for older accounts that never had one. */
export async function fetchOrCreateProfile(): Promise<Profile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("Session introuvable");
  const user = userData.user;

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_FIELDS)
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (data) return data as Profile;

  const phone = `+${(user.email ?? "").replace(/^u/, "").split("@")[0]?.replace(/\D/g, "") ?? ""}`;
  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: user.id, phone })
    .select(PROFILE_FIELDS)
    .single();
  if (insertError) throw insertError;
  return created as Profile;
}

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchOrCreateProfile });
}

export function isProfileComplete(profile?: Profile | null) {
  return Boolean(
    profile?.business_name?.trim() &&
      profile.business_phone?.trim() &&
      profile.city?.trim() &&
      profile.country?.trim() &&
      profile.neighborhood?.trim() &&
      profile.logo_path,
  );
}

export async function getBusinessLogoUrl(path?: string | null) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("logos-entreprise").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
