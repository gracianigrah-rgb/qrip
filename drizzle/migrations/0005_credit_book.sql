ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS on_credit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;