CREATE OR REPLACE FUNCTION public.write_config_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d text;
BEGIN
  IF TG_TABLE_NAME = 'role_config' THEN
    d := 'Réglage du comité modifié : ' || NEW.key;
  ELSE
    d := 'Rubrique du menu modifiée : ' || NEW.route;
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, detail)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NULL, d);
  RETURN NEW;
END; $$;