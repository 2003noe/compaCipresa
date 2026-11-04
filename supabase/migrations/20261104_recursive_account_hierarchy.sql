-- Hiérarchie OHADA récursive : le lien vers default_compt reste le modèle
-- OHADA, parent_compte_id relie les comptes opérationnels d'une entreprise.
BEGIN;

ALTER TABLE public.default_compt
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.default_compt(id) ON DELETE SET NULL;

ALTER TABLE public.comptes_comptables
  ADD COLUMN IF NOT EXISTS parent_compte_id uuid REFERENCES public.comptes_comptables(id) ON DELETE RESTRICT;

-- L'ancien trigger de permissions référence encore l'ancienne colonne exercice_id.
-- Le remplacer avant les prochaines modifications de cette table évite cet appel.
DROP TRIGGER IF EXISTS comptes_account_plan_permissions ON public.comptes_comptables;

-- Reconstruit les parents de référence avec le préfixe numérique le plus long.
UPDATE public.default_compt child
SET parent_id = (
  SELECT p.id
  FROM public.default_compt p
  WHERE p.id <> child.id
    AND length(regexp_replace(p.num_compte, '\D', '', 'g')) < length(regexp_replace(child.num_compte, '\D', '', 'g'))
    AND regexp_replace(child.num_compte, '\D', '', 'g') LIKE regexp_replace(p.num_compte, '\D', '', 'g') || '%'
  ORDER BY length(regexp_replace(p.num_compte, '\D', '', 'g')) DESC
  LIMIT 1
);

-- Un seul bloc DO conserve l'état des triggers et fait le backfill dans la
-- même exécution, même si SQL Editor sépare les autres instructions en lots.
-- Les entreprise_id restent intacts; seuls les liens hiérarchiques changent.
DO $backfill_company_hierarchy$
DECLARE
  r record;
  v_states jsonb := '[]'::jsonb;
  v_state jsonb;
  v_trigger_name text;
  v_trigger_mode text;
BEGIN
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', t.tgname, 'mode', t.tgenabled)), '[]'::jsonb)
  INTO v_states
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.comptes_comptables'::regclass
    AND NOT t.tgisinternal
    AND t.tgfoid = to_regprocedure('public.stamp_active_entreprise()');

  FOR r IN SELECT t.tgname, t.tgenabled
           FROM pg_trigger t
           WHERE t.tgrelid = 'public.comptes_comptables'::regclass
             AND NOT t.tgisinternal
             AND t.tgfoid = to_regprocedure('public.stamp_active_entreprise()')
             AND t.tgenabled <> 'D'
  LOOP
    EXECUTE format('ALTER TABLE public.comptes_comptables DISABLE TRIGGER %I', r.tgname);
  END LOOP;

  UPDATE public.comptes_comptables child
  SET parent_compte_id = (
    SELECT p.id
    FROM public.comptes_comptables p
    WHERE p.entreprise_id = child.entreprise_id
      AND p.id <> child.id
      AND length(regexp_replace(p.numero, '\D', '', 'g')) < length(regexp_replace(child.numero, '\D', '', 'g'))
      AND regexp_replace(child.numero, '\D', '', 'g') LIKE regexp_replace(p.numero, '\D', '', 'g') || '%'
    ORDER BY length(regexp_replace(p.numero, '\D', '', 'g')) DESC
    LIMIT 1
  );

  FOR v_state IN SELECT value FROM jsonb_array_elements(v_states) LOOP
    v_trigger_name := v_state ->> 'name';
    v_trigger_mode := v_state ->> 'mode';
    IF v_trigger_mode = 'O' THEN
      EXECUTE format('ALTER TABLE public.comptes_comptables ENABLE TRIGGER %I', v_trigger_name);
    ELSIF v_trigger_mode = 'R' THEN
      EXECUTE format('ALTER TABLE public.comptes_comptables ENABLE REPLICA TRIGGER %I', v_trigger_name);
    ELSIF v_trigger_mode = 'A' THEN
      EXECUTE format('ALTER TABLE public.comptes_comptables ENABLE ALWAYS TRIGGER %I', v_trigger_name);
    END IF;
  END LOOP;
END;
$backfill_company_hierarchy$;

CREATE INDEX IF NOT EXISTS default_compt_parent_id_idx ON public.default_compt(parent_id);
CREATE INDEX IF NOT EXISTS comptes_comptables_parent_compte_id_idx ON public.comptes_comptables(parent_compte_id);
CREATE INDEX IF NOT EXISTS comptes_comptables_entreprise_parent_idx ON public.comptes_comptables(entreprise_id, parent_compte_id);

CREATE OR REPLACE FUNCTION public.guard_recursive_account_parent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_parent public.comptes_comptables%rowtype;
  v_child_code text;
  v_parent_code text;
BEGIN
  IF NEW.parent_compte_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_compte_id = NEW.id THEN RAISE EXCEPTION 'Un compte ne peut pas être son propre parent.'; END IF;
  SELECT * INTO v_parent FROM public.comptes_comptables WHERE id = NEW.parent_compte_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte parent introuvable.'; END IF;
  IF v_parent.entreprise_id IS DISTINCT FROM NEW.entreprise_id THEN
    RAISE EXCEPTION 'Le compte parent doit appartenir à la même entreprise.';
  END IF;
  v_child_code := regexp_replace(NEW.numero, '\D', '', 'g');
  v_parent_code := regexp_replace(v_parent.numero, '\D', '', 'g');
  IF length(v_parent_code) >= length(v_child_code) OR v_child_code NOT LIKE v_parent_code || '%' THEN
    RAISE EXCEPTION 'Le numéro du sous-compte doit commencer par celui de son parent et être plus long.';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM public.comptes_comptables WHERE parent_compte_id = NEW.id
      UNION ALL
      SELECT c.id FROM public.comptes_comptables c JOIN descendants d ON c.parent_compte_id = d.id
    ) SELECT 1 FROM descendants WHERE id = NEW.parent_compte_id
  ) THEN RAISE EXCEPTION 'Cette modification créerait une boucle dans la hiérarchie des comptes.'; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comptes_recursive_account_parent ON public.comptes_comptables;
DROP TRIGGER IF EXISTS zz_guard_recursive_account_parent ON public.comptes_comptables;
CREATE TRIGGER zz_guard_recursive_account_parent
BEFORE INSERT OR UPDATE OF parent_compte_id, numero, entreprise_id ON public.comptes_comptables
FOR EACH ROW EXECUTE FUNCTION public.guard_recursive_account_parent();

CREATE OR REPLACE FUNCTION public.guard_default_compt_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $function$
DECLARE v_parent public.default_compt%rowtype;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Un compte OHADA ne peut pas être son propre parent.'; END IF;
  SELECT * INTO v_parent FROM public.default_compt WHERE id = NEW.parent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compte parent OHADA introuvable.'; END IF;
  IF length(regexp_replace(v_parent.num_compte, '\D', '', 'g')) >= length(regexp_replace(NEW.num_compte, '\D', '', 'g'))
     OR regexp_replace(NEW.num_compte, '\D', '', 'g') NOT LIKE regexp_replace(v_parent.num_compte, '\D', '', 'g') || '%' THEN
    RAISE EXCEPTION 'Le numéro du sous-compte OHADA doit commencer par celui de son parent.';
  END IF;
  IF EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT id FROM public.default_compt WHERE parent_id = NEW.id
      UNION ALL SELECT d.id FROM public.default_compt d JOIN descendants x ON d.parent_id = x.id
    ) SELECT 1 FROM descendants WHERE id = NEW.parent_id
  ) THEN RAISE EXCEPTION 'Cette modification créerait une boucle dans le référentiel OHADA.'; END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS default_compt_parent_guard ON public.default_compt;
CREATE TRIGGER default_compt_parent_guard
BEFORE INSERT OR UPDATE OF parent_id, num_compte ON public.default_compt
FOR EACH ROW EXECUTE FUNCTION public.guard_default_compt_parent();

-- Le déplacement d'un compte dans l'arbre est un changement structurel :
-- il exige le privilège élevé déjà utilisé pour les champs sensibles.
CREATE OR REPLACE FUNCTION public.guard_account_plan_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_basic_changed boolean; v_sensitive_changed boolean; v_used boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN') THEN RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_ADMIN est requise pour supprimer un compte.'; END IF;
    IF EXISTS (SELECT 1 FROM public.lignes_ecritures l WHERE l.compte_id = OLD.id) THEN RAISE EXCEPTION 'Ce compte est lié à une écriture et ne peut pas être supprimé. Désactivez-le à la place.'; END IF;
    RETURN OLD;
  END IF;
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  v_basic_changed := OLD.libelle IS DISTINCT FROM NEW.libelle OR OLD.notes IS DISTINCT FROM NEW.notes OR OLD.lettrable IS DISTINCT FROM NEW.lettrable OR OLD.reconciliable IS DISTINCT FROM NEW.reconciliable;
  v_sensitive_changed := OLD.numero IS DISTINCT FROM NEW.numero OR OLD.classe IS DISTINCT FROM NEW.classe OR OLD.nature IS DISTINCT FROM NEW.nature OR OLD.actif IS DISTINCT FROM NEW.actif OR OLD.compte_parent_id IS DISTINCT FROM NEW.compte_parent_id OR OLD.parent_compte_id IS DISTINCT FROM NEW.parent_compte_id OR OLD.devise IS DISTINCT FROM NEW.devise OR OLD.solde_ouverture_debit IS DISTINCT FROM NEW.solde_ouverture_debit OR OLD.solde_ouverture_credit IS DISTINCT FROM NEW.solde_ouverture_credit;
  IF v_basic_changed AND NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT') THEN RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_EDIT est requise pour modifier les champs courants du compte.'; END IF;
  IF v_sensitive_changed AND NOT public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN') THEN RAISE EXCEPTION 'La permission COMPTA_ACCOUNT_ADMIN est requise pour modifier les champs sensibles du compte.'; END IF;
  IF OLD.numero IS DISTINCT FROM NEW.numero OR OLD.classe IS DISTINCT FROM NEW.classe OR OLD.nature IS DISTINCT FROM NEW.nature OR OLD.compte_parent_id IS DISTINCT FROM NEW.compte_parent_id OR OLD.parent_compte_id IS DISTINCT FROM NEW.parent_compte_id THEN
    SELECT EXISTS (SELECT 1 FROM public.lignes_ecritures l JOIN public.ecritures_comptables e ON e.id = l.ecriture_id WHERE l.compte_id = OLD.id AND e.statut::text = 'VALIDEE') INTO v_used;
    IF v_used THEN RAISE EXCEPTION 'Le numéro, la classe, la nature ou le rattachement hiérarchique est verrouillé car ce compte figure dans une écriture validée.'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER comptes_account_plan_permissions
  BEFORE UPDATE OR DELETE ON public.comptes_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_plan_permissions();

NOTIFY pgrst, 'reload schema';
COMMIT;
