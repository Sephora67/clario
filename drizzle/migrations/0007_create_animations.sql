CREATE TABLE public.animations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  page integer not null default 0,
  title text not null default 'Animation',
  script jsonb not null default '{}'::jsonb,
  audio_path text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.animations TO authenticated;
GRANT ALL ON public.animations TO service_role;
ALTER TABLE public.animations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.animations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX animations_document_idx ON public.animations (document_id);
CREATE INDEX animations_course_idx ON public.animations (course_id);