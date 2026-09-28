GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.illustrations TO authenticated;
GRANT ALL ON TABLE public.illustrations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.illustration_history TO authenticated;
GRANT ALL ON TABLE public.illustration_history TO service_role;