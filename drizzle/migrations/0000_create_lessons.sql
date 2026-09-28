CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ready',
  content jsonb NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own lessons select" ON public.lessons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own lessons insert" ON public.lessons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own lessons update" ON public.lessons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own lessons delete" ON public.lessons FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX lessons_user_idx ON public.lessons(user_id, created_at DESC);

CREATE POLICY "Own media read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own media write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own media update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own media delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lesson-media' AND (storage.foldername(name))[1] = auth.uid()::text);