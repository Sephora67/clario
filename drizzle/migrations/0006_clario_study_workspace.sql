CREATE TABLE public.profiles (id uuid PRIMARY KEY, display_name text, timezone text NOT NULL DEFAULT 'America/Toronto', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated; GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL, description text NOT NULL DEFAULT '', tone text NOT NULL DEFAULT 'yellow', status text NOT NULL DEFAULT 'en_cours', progress integer NOT NULL DEFAULT 0, archived boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.folders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL, tone text NOT NULL DEFAULT 'yellow', course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL, kind text NOT NULL DEFAULT 'PDF', mime text NOT NULL DEFAULT '', size bigint NOT NULL DEFAULT 0, storage_path text NOT NULL, folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL, course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL, state jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE, name text NOT NULL, mime text NOT NULL, page integer NOT NULL DEFAULT 0, storage_path text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.calendar_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), title text NOT NULL, notes text NOT NULL DEFAULT '', course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL, starts_at timestamptz NOT NULL, remind_minutes integer, reminded boolean NOT NULL DEFAULT false, done boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), title text NOT NULL, body text NOT NULL DEFAULT '', link text, event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses, public.folders, public.documents, public.media, public.calendar_events, public.notifications TO authenticated;
GRANT ALL ON public.courses, public.folders, public.documents, public.media, public.calendar_events, public.notifications TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY; ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY; ALTER TABLE public.media ENABLE ROW LEVEL SECURITY; ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rows" ON public.courses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.folders FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.documents FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.media FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.calendar_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX ON public.documents (user_id, updated_at DESC);
CREATE INDEX ON public.calendar_events (user_id, starts_at);
CREATE INDEX ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))) ON CONFLICT DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
INSERT INTO public.profiles (id, display_name) SELECT id, split_part(email, '@', 1) FROM auth.users ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.reset_event_reminder() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN IF NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.remind_minutes IS DISTINCT FROM OLD.remind_minutes THEN NEW.reminded := false; END IF; RETURN NEW; END $$;
CREATE TRIGGER calendar_events_reset BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.reset_event_reminder();

-- Called by the signed-in user's app; only touches that user's rows (RLS + explicit filter).
CREATE OR REPLACE FUNCTION public.generate_my_reminders() RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH due AS (
    UPDATE public.calendar_events SET reminded = true
    WHERE user_id = auth.uid() AND reminded = false AND done = false AND remind_minutes IS NOT NULL AND starts_at - make_interval(mins => remind_minutes) <= now() AND starts_at > now() - interval '1 day'
    RETURNING id, user_id, title, starts_at)
  INSERT INTO public.notifications (user_id, title, body, link, event_id)
  SELECT user_id, 'Rappel : ' || title, to_char(starts_at AT TIME ZONE coalesce((SELECT timezone FROM public.profiles p WHERE p.id = due.user_id), 'UTC'), 'DD/MM/YYYY à HH24:MI'), '/calendrier', id FROM due;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.generate_my_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_my_reminders() TO authenticated;

CREATE POLICY "clario own files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'clario-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "clario own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'clario-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "clario own files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'clario-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "clario own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'clario-files' AND (storage.foldername(name))[1] = auth.uid()::text);