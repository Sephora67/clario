CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY,
  questions integer NOT NULL DEFAULT 25 CHECK (questions >= 0),
  videos integer NOT NULL DEFAULT 3 CHECK (videos >= 0),
  has_pass boolean NOT NULL DEFAULT false,
  rto_cents integer NOT NULL DEFAULT 0,
  yearly_grants_left integer NOT NULL DEFAULT 0,
  next_grant_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own credits" ON public.user_credits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  environment text NOT NULL,
  paddle_transaction_id text NOT NULL UNIQUE,
  price_id text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own purchases" ON public.purchases FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,
  price_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_active_club(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _uid AND (
    (status IN ('active','trialing','past_due') AND (current_period_end IS NULL OR current_period_end > now()))
    OR (status = 'canceled' AND current_period_end > now())))
$$;

-- Versements mensuels du Club annuel (200 Q + 20 V par mois).
CREATE OR REPLACE FUNCTION public.claim_yearly_grants(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  LOOP
    UPDATE public.user_credits SET questions = questions + 200, videos = videos + 20,
      yearly_grants_left = yearly_grants_left - 1, next_grant_at = next_grant_at + interval '1 month', updated_at = now()
    WHERE user_id = _uid AND yearly_grants_left > 0 AND next_grant_at IS NOT NULL AND next_grant_at <= now()
      AND public.has_active_club(_uid);
    EXIT WHEN NOT FOUND;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.claim_yearly_grants(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_credits()
RETURNS TABLE(questions integer, videos integer, has_pass boolean, club boolean, rto_cents integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.user_credits (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  PERFORM public.claim_yearly_grants(auth.uid());
  RETURN QUERY SELECT c.questions, c.videos, c.has_pass, public.has_active_club(auth.uid()), c.rto_cents FROM public.user_credits c WHERE c.user_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.my_credits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_credits() TO authenticated;

-- Retire 1 crédit de façon atomique ; false si solde nul.
CREATE OR REPLACE FUNCTION public.consume_credit(_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_credits (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  PERFORM public.claim_yearly_grants(auth.uid());
  IF _kind = 'question' THEN
    UPDATE public.user_credits SET questions = questions - 1, updated_at = now() WHERE user_id = auth.uid() AND questions > 0;
  ELSIF _kind = 'video' THEN
    UPDATE public.user_credits SET videos = videos - 1, updated_at = now() WHERE user_id = auth.uid() AND videos > 0;
  ELSE RETURN false; END IF;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n = 1;
END $$;
REVOKE ALL ON FUNCTION public.consume_credit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credit(text) TO authenticated;

-- Rembourse 1 crédit si l'IA a échoué (appelée par le serveur seulement).
CREATE OR REPLACE FUNCTION public.refund_credit(_uid uuid, _kind text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_credits SET questions = questions + CASE WHEN _kind='question' THEN 1 ELSE 0 END,
    videos = videos + CASE WHEN _kind='video' THEN 1 ELSE 0 END, updated_at = now() WHERE user_id = _uid
$$;
REVOKE ALL ON FUNCTION public.refund_credit(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, text) TO service_role;

-- Applique un paiement vérifié (webhook uniquement), idempotent par transaction.
CREATE OR REPLACE FUNCTION public.apply_purchase(_uid uuid, _env text, _txn text, _price text, _amount integer, _is_change boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted integer;
BEGIN
  INSERT INTO public.purchases (user_id, environment, paddle_transaction_id, price_id, amount_cents)
  VALUES (_uid, _env, _txn, _price, greatest(_amount, 0)) ON CONFLICT (paddle_transaction_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN RETURN false; END IF;
  INSERT INTO public.user_credits (user_id) VALUES (_uid) ON CONFLICT DO NOTHING;
  IF _price = 'notebook_pass_once' THEN
    UPDATE public.user_credits SET has_pass = true, updated_at = now() WHERE user_id = _uid;
  ELSIF _price = 'topup_questions_100' THEN
    UPDATE public.user_credits SET questions = questions + 100, updated_at = now() WHERE user_id = _uid;
  ELSIF _price = 'topup_videos_5' THEN
    UPDATE public.user_credits SET videos = videos + 5, updated_at = now() WHERE user_id = _uid;
  ELSIF _price = 'pro_club_monthly' THEN
    UPDATE public.user_credits SET rto_cents = rto_cents + greatest(_amount,0),
      questions = questions + CASE WHEN _is_change THEN 0 ELSE 200 END,
      videos = videos + CASE WHEN _is_change THEN 0 ELSE 20 END,
      yearly_grants_left = 0, next_grant_at = NULL, updated_at = now() WHERE user_id = _uid;
  ELSIF _price = 'pro_club_yearly' THEN
    UPDATE public.user_credits SET rto_cents = rto_cents + greatest(_amount,0),
      questions = questions + CASE WHEN _is_change THEN 0 ELSE 200 END,
      videos = videos + CASE WHEN _is_change THEN 0 ELSE 20 END,
      yearly_grants_left = 11, next_grant_at = now() + interval '1 month', updated_at = now() WHERE user_id = _uid;
  END IF;
  UPDATE public.user_credits SET has_pass = true WHERE user_id = _uid AND rto_cents >= 3099;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_purchase(uuid, text, text, text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_purchase(uuid, text, text, text, integer, boolean) TO service_role;

-- Limite de 5 documents sans Pass ni Club.
CREATE OR REPLACE FUNCTION public.enforce_document_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_credits WHERE user_id = NEW.user_id AND has_pass) OR public.has_active_club(NEW.user_id) THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM public.documents WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'DOC_LIMIT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documents_limit BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION public.enforce_document_limit();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_credits (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $function$;

INSERT INTO public.user_credits (user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;