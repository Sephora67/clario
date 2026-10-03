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
  ELSIF _price = 'pro_club_max_monthly' THEN
    UPDATE public.user_credits SET rto_cents = rto_cents + greatest(_amount,0),
      questions = questions + CASE WHEN _is_change THEN 0 ELSE 300 END,
      videos = videos + CASE WHEN _is_change THEN 0 ELSE 35 END,
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