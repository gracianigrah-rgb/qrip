CREATE TABLE IF NOT EXISTS public.billing_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  monthly_price numeric NOT NULL DEFAULT 2500 CHECK (monthly_price >= 0),
  yearly_price numeric NOT NULL DEFAULT 25000 CHECK (yearly_price >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  payment_number text,
  payment_link text,
  instructions text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.billing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, UPDATE ON public.billing_settings TO authenticated;
GRANT ALL ON public.billing_settings TO service_role;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing read" ON public.billing_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "billing admin update" ON public.billing_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  plan text NOT NULL CHECK (plan IN ('mensuel', 'annuel')),
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'XOF',
  proof_path text,
  payer_ref text,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'confirme', 'refuse')),
  receipt_no text,
  admin_note text,
  period_start timestamptz,
  period_end timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pay select" ON public.subscription_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own pay insert" ON public.subscription_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'en_attente' AND receipt_no IS NULL AND period_end IS NULL AND confirmed_at IS NULL);
CREATE POLICY "admin pay select" ON public.subscription_payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin pay update" ON public.subscription_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin pay delete" ON public.subscription_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.review_payment(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.subscription_payments; start_at timestamptz; end_at timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO p FROM public.subscription_payments WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'en_attente' THEN RAISE EXCEPTION 'invalid payment'; END IF;
  IF _approve THEN
    SELECT GREATEST(now(), COALESCE(max(period_end), now())) INTO start_at FROM public.subscription_payments WHERE user_id = p.user_id AND status = 'confirme';
    end_at := start_at + CASE WHEN p.plan = 'annuel' THEN interval '1 year' ELSE interval '1 month' END;
    UPDATE public.subscription_payments SET status = 'confirme', period_start = start_at, period_end = end_at, confirmed_at = now(),
      receipt_no = 'REC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6)), admin_note = _note WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (p.user_id, 'Abonnement activé',
      'Votre paiement est confirmé. Vos exportations PDF, CSV et Excel sont débloquées jusqu''au ' || to_char(end_at, 'DD/MM/YYYY') || '. Votre reçu est disponible dans Rapport.');
  ELSE
    UPDATE public.subscription_payments SET status = 'refuse', admin_note = _note WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (p.user_id, 'Paiement non validé',
      'Votre preuve de paiement n''a pas pu être validée.' || COALESCE(' Motif : ' || NULLIF(_note, ''), '') || ' Vous pouvez renvoyer une preuve depuis Rapport.');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.review_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payment(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_loan_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    label := CASE NEW.status WHEN 'en_attente' THEN 'En attente' WHEN 'en_analyse' THEN 'En analyse' WHEN 'valide' THEN 'Validée'
      WHEN 'refuse' THEN 'Refusée' WHEN 'decaisse' THEN 'Décaissée' ELSE NEW.status END;
    INSERT INTO public.notifications (user_id, title, body) VALUES (NEW.user_id, 'Suivi de votre demande de crédit',
      'Votre demande de ' || to_char(NEW.amount, 'FM999G999G999') || ' est maintenant : ' || label || '.' ||
      CASE WHEN NEW.status = 'decaisse' AND NEW.partner IS NOT NULL THEN ' Partenaire : ' || NEW.partner || '.' ELSE '' END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS loan_status_notify ON public.loan_requests;
CREATE TRIGGER loan_status_notify AFTER UPDATE ON public.loan_requests FOR EACH ROW EXECUTE FUNCTION public.notify_loan_status();

CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE (business_name text, city text, country text, score integer, issued_at timestamptz, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  (SELECT p.business_name, p.city, p.country, l.score, l.created_at, 'demande'::text
  FROM public.loan_requests l JOIN public.profiles p ON p.id = l.user_id
  WHERE upper(substr(replace(l.id::text, '-', ''), 1, 10)) = upper(regexp_replace(_code, '^QRIP-', '', 'i')))
  UNION ALL
  (SELECT p.business_name, p.city, p.country, NULL::integer, p.created_at, 'commercant'::text
  FROM public.profiles p
  WHERE upper(substr(replace(p.id::text, '-', ''), 1, 10)) = upper(regexp_replace(_code, '^QRIP-', '', 'i')))
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

CREATE POLICY "proof own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'preuves-paiement' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proof own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'preuves-paiement' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));