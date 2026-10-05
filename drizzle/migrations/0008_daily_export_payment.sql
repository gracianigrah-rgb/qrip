ALTER TABLE public.billing_settings ADD COLUMN IF NOT EXISTS daily_export_price numeric NOT NULL DEFAULT 500 CHECK (daily_export_price >= 0);
ALTER TABLE public.subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_plan_check;
ALTER TABLE public.subscription_payments ADD CONSTRAINT subscription_payments_plan_check CHECK (plan IN ('mensuel','annuel','bilan_jour'));
ALTER TABLE public.subscription_payments ADD COLUMN IF NOT EXISTS export_date date;

CREATE TABLE IF NOT EXISTS public.export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  format text NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.export_history TO authenticated;
GRANT ALL ON public.export_history TO service_role;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own export select" ON public.export_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own export insert" ON public.export_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin export select" ON public.export_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.review_payment(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.subscription_payments; start_at timestamptz; end_at timestamptz; rec text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO p FROM public.subscription_payments WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR p.status <> 'en_attente' THEN RAISE EXCEPTION 'invalid payment'; END IF;
  rec := 'REC-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(p.id::text, '-', ''), 1, 6));
  IF _approve AND p.plan = 'bilan_jour' THEN
    UPDATE public.subscription_payments SET status = 'confirme', confirmed_at = now(), receipt_no = rec, admin_note = _note WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (p.user_id, 'Export du bilan débloqué',
      'Votre paiement est confirmé. Vous pouvez exporter le bilan du ' || to_char(COALESCE(p.export_date, now()::date), 'DD/MM/YYYY') || ' en PDF. Votre reçu est disponible dans Rapport.');
  ELSIF _approve THEN
    SELECT GREATEST(now(), COALESCE(max(period_end), now())) INTO start_at FROM public.subscription_payments WHERE user_id = p.user_id AND status = 'confirme' AND plan <> 'bilan_jour';
    end_at := start_at + CASE WHEN p.plan = 'annuel' THEN interval '1 year' ELSE interval '1 month' END;
    UPDATE public.subscription_payments SET status = 'confirme', period_start = start_at, period_end = end_at, confirmed_at = now(), receipt_no = rec, admin_note = _note WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (p.user_id, 'Abonnement activé',
      'Votre paiement est confirmé. Vos exportations PDF, CSV et Excel sont débloquées jusqu''au ' || to_char(end_at, 'DD/MM/YYYY') || '. Votre reçu est disponible dans Rapport.');
  ELSE
    UPDATE public.subscription_payments SET status = 'refuse', admin_note = _note WHERE id = _id;
    INSERT INTO public.notifications (user_id, title, body) VALUES (p.user_id, 'Paiement non validé',
      'Votre preuve de paiement n''a pas pu être validée.' || COALESCE(' Motif : ' || NULLIF(_note, ''), '') || ' Vous pouvez renvoyer une preuve depuis Rapport.');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_loan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body) VALUES (NEW.user_id, 'Demande de crédit reçue',
    'Votre demande de ' || to_char(NEW.amount, 'FM999G999G999') || ' est bien enregistrée. Vous serez notifié à chaque étape.');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS loan_new_notify ON public.loan_requests;
CREATE TRIGGER loan_new_notify AFTER INSERT ON public.loan_requests FOR EACH ROW EXECUTE FUNCTION public.notify_new_loan();

CREATE OR REPLACE FUNCTION public.notify_new_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body) VALUES (NEW.user_id, 'Preuve de paiement reçue',
    'Votre preuve est en attente de validation par l''administrateur.');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS payment_new_notify ON public.subscription_payments;
CREATE TRIGGER payment_new_notify AFTER INSERT ON public.subscription_payments FOR EACH ROW EXECUTE FUNCTION public.notify_new_payment();