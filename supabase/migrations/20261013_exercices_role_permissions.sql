-- Apply granular role permissions to accounting exercises.
-- COMPTA_READ: view exercises; COMPTA_CLOTURE: create/update; ADMIN: delete.

CREATE OR REPLACE FUNCTION public.user_has_permission(requested_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND p.code = requested_permission
  );
$function$;

REVOKE ALL ON FUNCTION public.user_has_permission(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text) TO authenticated;

ALTER TABLE public.exercices_comptables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exercices_comptables_access ON public.exercices_comptables;
DROP POLICY IF EXISTS exercices_comptables_read_permission ON public.exercices_comptables;
DROP POLICY IF EXISTS exercices_comptables_insert_permission ON public.exercices_comptables;
DROP POLICY IF EXISTS exercices_comptables_update_permission ON public.exercices_comptables;
DROP POLICY IF EXISTS exercices_comptables_delete_admin ON public.exercices_comptables;

CREATE POLICY exercices_comptables_read_permission
  ON public.exercices_comptables
  FOR SELECT TO authenticated
  USING (public.user_has_permission('COMPTA_READ'));

CREATE POLICY exercices_comptables_insert_permission
  ON public.exercices_comptables
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_permission('COMPTA_CLOTURE'));

CREATE POLICY exercices_comptables_update_permission
  ON public.exercices_comptables
  FOR UPDATE TO authenticated
  USING (public.user_has_permission('COMPTA_CLOTURE'))
  WITH CHECK (public.user_has_permission('COMPTA_CLOTURE'));

CREATE POLICY exercices_comptables_delete_admin
  ON public.exercices_comptables
  FOR DELETE TO authenticated
  USING (public.user_has_role('ADMIN'));
