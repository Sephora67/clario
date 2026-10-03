CREATE TABLE public.page_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  page integer NOT NULL,
  title text NOT NULL DEFAULT 'Quiz',
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  score integer,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT page_quizzes_page_nonnegative CHECK (page >= 0),
  CONSTRAINT page_quizzes_score_range CHECK (score IS NULL OR score BETWEEN 0 AND 5)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.page_quizzes TO authenticated;
GRANT ALL ON public.page_quizzes TO service_role;
ALTER TABLE public.page_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own page quizzes" ON public.page_quizzes FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX page_quizzes_document_page_idx ON public.page_quizzes (document_id, page, created_at DESC);

CREATE TABLE public.page_quiz_keys (
  quiz_id uuid PRIMARY KEY REFERENCES public.page_quizzes(id) ON DELETE CASCADE,
  answer_key jsonb NOT NULL
);
GRANT ALL ON public.page_quiz_keys TO service_role;
ALTER TABLE public.page_quiz_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_active_club_max(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _uid
      AND price_id = 'pro_club_max_monthly'
      AND (
        (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
        OR (status = 'canceled' AND current_period_end > now())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.consume_credit(_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
  m date := date_trunc('month', now())::date;
  used_q integer;
  used_v integer;
  max_q integer;
  max_v integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.user_credits (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  PERFORM public.claim_yearly_grants(auth.uid());
  UPDATE public.user_credits SET questions_used = 0, videos_used = 0, usage_month = m
    WHERE user_id = auth.uid() AND usage_month IS DISTINCT FROM m;
  IF public.has_active_club(auth.uid()) THEN
    IF public.has_active_club_max(auth.uid()) THEN max_q := 600; max_v := 70;
    ELSE max_q := 300; max_v := 35;
    END IF;
    SELECT questions_used, videos_used INTO used_q, used_v FROM public.user_credits WHERE user_id = auth.uid();
    IF (_kind = 'question' AND used_q >= max_q) OR (_kind = 'video' AND used_v >= max_v) THEN RETURN 2; END IF;
  END IF;
  IF _kind = 'question' THEN
    UPDATE public.user_credits SET questions = questions - 1, questions_used = questions_used + 1, updated_at = now()
      WHERE user_id = auth.uid() AND questions > 0;
  ELSIF _kind = 'video' THEN
    UPDATE public.user_credits SET videos = videos - 1, videos_used = videos_used + 1, updated_at = now()
      WHERE user_id = auth.uid() AND videos > 0;
  ELSE RETURN 0; END IF;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN CASE WHEN n = 1 THEN 1 ELSE 0 END;
END
$$;

CREATE OR REPLACE FUNCTION public.refund_credit(_uid uuid, _kind text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.user_credits SET
    questions = questions + CASE WHEN _kind='question' THEN 1 ELSE 0 END,
    videos = videos + CASE WHEN _kind='video' THEN 1 ELSE 0 END,
    questions_used = greatest(0, questions_used - CASE WHEN _kind='question' THEN 1 ELSE 0 END),
    videos_used = greatest(0, videos_used - CASE WHEN _kind='video' THEN 1 ELSE 0 END),
    updated_at = now()
  WHERE user_id = _uid
$$;