CREATE TABLE public.procedural_icon_visibility (
  key text PRIMARY KEY,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.procedural_icon_visibility TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.procedural_icon_visibility TO authenticated;
GRANT ALL ON public.procedural_icon_visibility TO service_role;

ALTER TABLE public.procedural_icon_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed in users read procedural icon visibility"
ON public.procedural_icon_visibility
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins insert procedural icon visibility"
ON public.procedural_icon_visibility
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update procedural icon visibility"
ON public.procedural_icon_visibility
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete procedural icon visibility"
ON public.procedural_icon_visibility
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));