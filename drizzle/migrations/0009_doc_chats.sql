CREATE TABLE public.doc_chats (
  document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_chats TO authenticated;
GRANT ALL ON public.doc_chats TO service_role;
ALTER TABLE public.doc_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.doc_chats FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());