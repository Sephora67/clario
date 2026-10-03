CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  user_email text NOT NULL DEFAULT '',
  user_name text NOT NULL DEFAULT '',
  document_id uuid,
  document_name text NOT NULL DEFAULT '',
  question text NOT NULL,
  context text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'nouveau',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  handled_at timestamp with time zone
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own support messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own support messages" ON public.support_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update support messages" ON public.support_messages
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete support messages" ON public.support_messages
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX support_messages_created_idx ON public.support_messages (created_at DESC);