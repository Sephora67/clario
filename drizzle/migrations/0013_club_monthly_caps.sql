-- Club Pro : les crédits appartiennent à l'élève pour toujours (aucune expiration),
-- mais la vitesse d'utilisation est plafonnée à 300 questions et 35 vidéos par mois.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS usage_month date,
  ADD COLUMN IF NOT EXISTS questions_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS videos_used integer NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.consume_credit(text);

-- Versements mensuels du Club annuel : 100 Q + 10 V par mois.
CREATE OR REPLACE FUNCTION public.claim_yearly_grants(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_credits SET questions = questions + 100, videos = videos + 10,
    yearly_grants_left = yearly_grants_left - 1, next_grant_at = next_grant_at + interval '1 month', updated_at = now()
  WHERE user_id = _uid AND yearly_grants_left > 0 AND next_grant_at IS NOT NULL AND next_grant_at <= now()
    AND public.has_active_club(_uid);
END $$;
REVOKE ALL ON FUNCTION public.claim_yearly_grants(uuid) FROM PUBLIC, anon, authenticated;

-- Retire 1 crédit de façon atomique.
-- Renvoie 1 = ok, 0 = solde nul, 2 = plafond mensuel du Club atteint (les crédits restent, Clario part aux Bahamas).
CREATE OR REPLACE FUNCTION public.consume_credit(_kind text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; m date := date_trunc('month', now())::date; used_q integer; used_v integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  INSERT INTO public.user_credits (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  PERFORM public.claim_yearly_grants(auth.uid());
  -- Nouveau mois : les compteurs de vitesse repartent à zéro (les crédits, eux, restent).
  UPDATE public.user_credits SET questions_used = 0, videos_used = 0, usage_month = m
    WHERE user_id = auth.uid() AND usage_month IS DISTINCT FROM m;
  IF public.has_active_club(auth.uid()) THEN
    SELECT questions_used, videos_used INTO used_q, used_v FROM public.user_credits WHERE user_id = auth.uid();
    IF (_kind = 'question' AND used_q >= 300) OR (_kind = 'video' AND used_v >= 35) THEN RETURN 2; END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.consume_credit(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credit(text) TO authenticated;

-- Applique un paiement vérifié (webhook uniquement), idempotent par transaction.
-- Club Pro : 100 questions + 10 vidéos par mois (l'annuel les verse chaque mois).
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
      questions = questions + CASE WHEN _is_change THEN 0 ELSE 100 END,
      videos = videos + CASE WHEN _is_change THEN 0 ELSE 10 END,
      yearly_grants_left = 0, next_grant_at = NULL, updated_at = now() WHERE user_id = _uid;
  ELSIF _price = 'pro_club_yearly' THEN
    UPDATE public.user_credits SET rto_cents = rto_cents + greatest(_amount,0),
      questions = questions + CASE WHEN _is_change THEN 0 ELSE 100 END,
      videos = videos + CASE WHEN _is_change THEN 0 ELSE 10 END,
      yearly_grants_left = 11, next_grant_at = now() + interval '1 month', updated_at = now() WHERE user_id = _uid;
  END IF;
  UPDATE public.user_credits SET has_pass = true WHERE user_id = _uid AND rto_cents >= 3099;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.apply_purchase(uuid, text, text, text, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_purchase(uuid, text, text, text, integer, boolean) TO service_role;