CREATE OR REPLACE FUNCTION public.write_config_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, detail)
  VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NULL,
    CASE WHEN TG_TABLE_NAME = 'role_config'
      THEN 'Réglage du comité modifié : ' || NEW.key
      ELSE 'Rubrique du menu modifiée : ' || NEW.route END);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_role_config ON public.role_config;
CREATE TRIGGER trg_audit_role_config AFTER INSERT OR UPDATE ON public.role_config
  FOR EACH ROW EXECUTE FUNCTION public.write_config_audit();
DROP TRIGGER IF EXISTS trg_audit_menu_config ON public.menu_config;
CREATE TRIGGER trg_audit_menu_config AFTER INSERT OR UPDATE ON public.menu_config
  FOR EACH ROW EXECUTE FUNCTION public.write_config_audit();