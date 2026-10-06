CREATE TABLE public.treasury_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  viewer_id uuid,
  code text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
GRANT SELECT, INSERT, DELETE ON public.treasury_shares TO authenticated;
GRANT ALL ON public.treasury_shares TO service_role;
ALTER TABLE public.treasury_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "share owner all select" ON public.treasury_shares FOR SELECT TO authenticated USING (auth.uid() = owner_id OR auth.uid() = viewer_id);
CREATE POLICY "share owner insert" ON public.treasury_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND viewer_id IS NULL);
CREATE POLICY "share delete" ON public.treasury_shares FOR DELETE TO authenticated USING (auth.uid() = owner_id OR auth.uid() = viewer_id);

CREATE OR REPLACE FUNCTION public.can_view_treasury(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.treasury_shares WHERE owner_id = _owner AND viewer_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.redeem_share_code(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.treasury_shares;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO s FROM public.treasury_shares WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'code invalide'; END IF;
  IF s.owner_id = auth.uid() THEN RAISE EXCEPTION 'propre code'; END IF;
  IF s.viewer_id IS NOT NULL AND s.viewer_id <> auth.uid() THEN RAISE EXCEPTION 'code deja utilise'; END IF;
  UPDATE public.treasury_shares SET viewer_id = auth.uid(), accepted_at = now() WHERE id = s.id;
  INSERT INTO public.notifications(user_id, title, body) VALUES (s.owner_id, 'Accès à votre trésorerie', 'Un utilisateur a utilisé votre code de partage. Vous pouvez retirer cet accès dans Profil > Partage.');
  RETURN s.owner_id;
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_share_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_treasury(uuid) TO authenticated;

CREATE POLICY "shared invoices read" ON public.invoices FOR SELECT TO authenticated USING (public.can_view_treasury(user_id));
CREATE POLICY "shared profile read" ON public.profiles FOR SELECT TO authenticated USING (public.can_view_treasury(id));