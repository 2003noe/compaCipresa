-- Permissions granulaire et protection backend des modifications du plan comptable.
-- ADMIN est autorise par has_active_entreprise_permission(). GERANT recoit les
-- changements sensibles et COMPTABLE les changements courants.
BEGIN;

INSERT INTO public.permissions (code, nom, description)
VALUES
  ('COMPTA_ACCOUNT_EDIT', 'Modifier les champs courants du plan comptable', 'Modifier le libellé, les notes et les options de lettrage/rapprochement des comptes.'),
  ('COMPTA_ACCOUNT_ADMIN', 'Gérer les champs sensibles du plan comptable', 'Modifier les numéros, classes, natures, comptes de référence, statut, devise et soldes d’ouverture.')
ON CONFLICT (code) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'COMPTA_ACCOUNT_EDIT'
WHERE r.code IN ('COMPTABLE', 'GERANT')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code = 'COMPTA_ACCOUNT_ADMIN'
WHERE r.code = 'GERANT'
ON CONFLICT DO NOTHING;

-- Uniquement les utilisateurs avec l’une des permissions explicites peuvent
-- écrire via cette policy. Les autres policies de lecture restent inchangées.
DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comptes_comptables'
      AND policyname = 'account_plan_permission_update'
  ) THEN
    CREATE POLICY account_plan_permission_update
      ON public.comptes_comptables
      FOR UPDATE TO authenticated
      USING (
        entreprise_id = public.current_entreprise_id()
        AND (
          public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT')
          OR public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN')
        )
      )
      WITH CHECK (
        entreprise_id = public.current_entreprise_id()
        AND (
          public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT')
          OR public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN')
        )
      );
  END IF;
END;
$policy$;

DO $policy$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'comptes_comptables'
      AND policyname = 'account_plan_permission_delete'
  ) THEN
    CREATE POLICY account_plan_permission_delete
      ON public.comptes_comptables
      FOR DELETE TO authenticated
      USING (
        entreprise_id = public.current_entreprise_id()
        AND public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN')
      );
  END IF;
END;
$policy$;

CREATE OR REPLACE FUNCTION public.guard_account_plan_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_basic_changed boolean;
  v_sensitive_changed boolean;
  v_identity_changed boolean;
  v_used_in_validated_entry boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN') THEN
      RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_ADMIN est requise pour supprimer un compte.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.lignes_ecritures l WHERE l.compte_id = OLD.id) THEN
      RAISE EXCEPTION 'Ce compte est lié à une écriture et ne peut pas être supprimé. Désactivez-le à la place.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_identity_changed :=
    OLD.entreprise_id IS DISTINCT FROM NEW.entreprise_id
    OR OLD.exercice_id IS DISTINCT FROM NEW.exercice_id;

  IF v_identity_changed THEN
    RAISE EXCEPTION 'L’entreprise et l’exercice d’un compte ne peuvent pas être modifiés depuis le plan comptable.';
  END IF;

  v_basic_changed :=
    OLD.libelle IS DISTINCT FROM NEW.libelle
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.lettrable IS DISTINCT FROM NEW.lettrable
    OR OLD.reconciliable IS DISTINCT FROM NEW.reconciliable;

  v_sensitive_changed :=
    OLD.numero IS DISTINCT FROM NEW.numero
    OR OLD.classe IS DISTINCT FROM NEW.classe
    OR OLD.nature IS DISTINCT FROM NEW.nature
    OR OLD.actif IS DISTINCT FROM NEW.actif
    OR OLD.compte_parent_id IS DISTINCT FROM NEW.compte_parent_id
    OR OLD.devise IS DISTINCT FROM NEW.devise
    OR OLD.solde_ouverture_debit IS DISTINCT FROM NEW.solde_ouverture_debit
    OR OLD.solde_ouverture_credit IS DISTINCT FROM NEW.solde_ouverture_credit;

  IF v_basic_changed
     AND NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT') THEN
    RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_EDIT est requise pour modifier les champs courants du compte.';
  END IF;

  IF v_sensitive_changed
     AND NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN') THEN
    RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_ADMIN est requise pour modifier les champs sensibles du compte.';
  END IF;

  IF OLD.numero IS DISTINCT FROM NEW.numero
     OR OLD.classe IS DISTINCT FROM NEW.classe
     OR OLD.nature IS DISTINCT FROM NEW.nature
     OR OLD.compte_parent_id IS DISTINCT FROM NEW.compte_parent_id THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.lignes_ecritures l
      JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
      WHERE l.compte_id = OLD.id
        AND e.statut::text = 'VALIDEE'
    ) INTO v_used_in_validated_entry;

    IF v_used_in_validated_entry THEN
      RAISE EXCEPTION 'Le numéro, la classe, la nature ou le compte de référence est verrouillé car ce compte figure dans une écriture validée.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comptes_account_plan_permissions ON public.comptes_comptables;
CREATE TRIGGER comptes_account_plan_permissions
  BEFORE UPDATE ON public.comptes_comptables
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_account_plan_permissions();

GRANT EXECUTE ON FUNCTION public.guard_account_plan_permissions() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
