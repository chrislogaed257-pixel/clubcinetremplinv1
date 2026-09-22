CREATE OR REPLACE FUNCTION public.sandbox_exec_sql(q text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  EXECUTE q;
END;
$fn$;
REVOKE ALL ON FUNCTION public.sandbox_exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sandbox_exec_sql(text) TO sandbox_exec;