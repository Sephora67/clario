ALTER TABLE public.folders ADD COLUMN parent_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
CREATE INDEX folders_parent_idx ON public.folders(parent_id);