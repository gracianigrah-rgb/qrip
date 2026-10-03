CREATE TABLE IF NOT EXISTS public.loan_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  amount numeric NOT NULL CHECK (amount > 0),
  purpose text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months IN (3, 6, 12)),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  monthly_revenue numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'en_analyse', 'valide', 'refuse', 'decaisse')),
  partner text,
  commission numeric NOT NULL DEFAULT 0,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_requests TO authenticated;
GRANT ALL ON public.loan_requests TO service_role;
ALTER TABLE public.loan_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own loans select" ON public.loan_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own loans insert" ON public.loan_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'en_attente' AND commission = 0 AND partner IS NULL AND admin_note IS NULL);
CREATE POLICY "admin loans select" ON public.loan_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin loans update" ON public.loan_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin loans delete" ON public.loan_requests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));