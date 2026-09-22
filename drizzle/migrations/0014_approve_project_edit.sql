-- Application d'une modification de fiche projet après approbation.
CREATE OR REPLACE FUNCTION public.decide_project_edit(_edit uuid, _approve boolean, _comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  IF NOT public.can_approve_project(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls le Producteur général et le Producteur délégué peuvent approuver.';
  END IF;
  SELECT * INTO e FROM public.project_edits WHERE id = _edit;
  IF e IS NULL THEN RAISE EXCEPTION 'Modification introuvable.'; END IF;
  IF e.status <> 'pending' THEN RAISE EXCEPTION 'Cette modification a déjà été traitée.'; END IF;

  IF _approve THEN
    IF e.field NOT IN ('title','description','logline','synopsis','synopsis_link',
                       'script_title','script_link','budget_title','budget_link') THEN
      RAISE EXCEPTION 'Champ non modifiable.';
    END IF;
    EXECUTE format('UPDATE public.projects SET %I = $1, updated_at = now() WHERE id = $2', e.field)
      USING e.new_value, e.project_id;
  END IF;

  UPDATE public.project_edits
     SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
         decision_comment = coalesce(_comment, ''),
         decided_by = auth.uid(),
         decided_at = now()
   WHERE id = _edit;

  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.decide_project_edit(uuid, boolean, text) TO authenticated;