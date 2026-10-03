CREATE OR REPLACE FUNCTION public.claim_yearly_grants(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _is_max boolean;
BEGIN
  SELECT public.has_active_club_max(_uid) INTO _is_max;
  LOOP
    UPDATE public.user_credits SET
      questions = questions + CASE WHEN _is_max THEN 300 ELSE 100 END,
      videos = videos + CASE WHEN _is_max THEN 35 ELSE 10 END,
      yearly_grants_left = yearly_grants_left - 1,
      next_grant_at = next_grant_at + interval '1 month',
      updated_at = now()
    WHERE user_id = _uid
      AND yearly_grants_left > 0
      AND next_grant_at IS NOT NULL
      AND next_grant_at <= now()
      AND public.has_active_club(_uid);
    EXIT WHEN NOT FOUND;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.claim_yearly_grants(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_yearly_grants(uuid) TO service_role;