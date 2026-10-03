CREATE TABLE public.admin_credit_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  admin_id uuid NOT NULL,
  questions_delta integer NOT NULL DEFAULT 0,
  videos_delta integer NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_credit_adjustments TO authenticated;
GRANT ALL ON public.admin_credit_adjustments TO service_role;
ALTER TABLE public.admin_credit_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read adjustments" ON public.admin_credit_adjustments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));