-- Recensement réel et arrêté explicite de l'inventaire physique.
-- Ne modifie aucune écriture ni aucun solde comptable.
BEGIN;

ALTER TABLE public.inventaire_physique
  ADD COLUMN IF NOT EXISTS recensement_effectue boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.inventaire_physique_validations (
  exercice_id uuid PRIMARY KEY REFERENCES public.exercices_comptables(id) ON DELETE RESTRICT,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  valide_par uuid NOT NULL REFERENCES public.profiles(id),
  valide_le timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventaire_physique_validation_company_exercise_uq UNIQUE (entreprise_id, exercice_id)
);

ALTER TABLE public.inventaire_physique_validations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inventaire_physique_validations_read ON public.inventaire_physique_validations;
CREATE POLICY inventaire_physique_validations_read
  ON public.inventaire_physique_validations FOR SELECT TO authenticated
  USING (
    entreprise_id = public.current_entreprise_id()
    AND public.is_entreprise_member(entreprise_id)
    AND (
      public.has_active_entreprise_permission('STOCK_INVENTORY')
      OR public.has_active_entreprise_permission('COMPTA_READ')
    )
  );
REVOKE ALL ON public.inventaire_physique_validations FROM anon, authenticated;
GRANT SELECT ON public.inventaire_physique_validations TO authenticated;

CREATE OR REPLACE FUNCTION public.valider_inventaire_physique(p_exercice_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_entreprise_id uuid := public.current_entreprise_id();
  v_date timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF v_entreprise_id IS NULL OR NOT public.is_entreprise_member(v_entreprise_id) THEN
    RAISE EXCEPTION 'Aucune entreprise active autorisée.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_entreprise_permission('STOCK_INVENTORY') THEN
    RAISE EXCEPTION 'Permission STOCK_INVENTORY requise pour arrêter l’inventaire.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.exercices_comptables e
    WHERE e.id = p_exercice_id AND e.entreprise_id = v_entreprise_id
  ) THEN
    RAISE EXCEPTION 'Exercice introuvable pour l’entreprise active.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventaire_physique i
    WHERE i.exercice_id = p_exercice_id AND i.entreprise_id = v_entreprise_id
  ) THEN
    RAISE EXCEPTION 'Ajoutez et recensez au moins un élément avant de valider l’inventaire.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventaire_physique i
    WHERE i.exercice_id = p_exercice_id AND i.entreprise_id = v_entreprise_id
      AND NOT i.recensement_effectue
  ) THEN
    RAISE EXCEPTION 'Chaque ligne doit être recensée avant la validation.';
  END IF;

  INSERT INTO public.inventaire_physique_validations(exercice_id, entreprise_id, valide_par)
  VALUES (p_exercice_id, v_entreprise_id, auth.uid())
  ON CONFLICT (exercice_id) DO NOTHING
  RETURNING valide_le INTO v_date;
  IF v_date IS NULL THEN
    SELECT valide_le INTO v_date FROM public.inventaire_physique_validations
    WHERE exercice_id = p_exercice_id AND entreprise_id = v_entreprise_id;
  END IF;
  RETURN v_date;
END;
$function$;

REVOKE ALL ON FUNCTION public.valider_inventaire_physique(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valider_inventaire_physique(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_inventory_after_finalization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_exercice uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.exercice_id ELSE NEW.exercice_id END;
  v_entreprise uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.entreprise_id ELSE NEW.entreprise_id END;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventaire_physique_validations v
    WHERE v.exercice_id = v_exercice AND v.entreprise_id = v_entreprise
  ) THEN
    RAISE EXCEPTION 'Inventaire physique arrêté : modification interdite.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS inventory_locked_after_finalization ON public.inventaire_physique;
CREATE TRIGGER inventory_locked_after_finalization
BEFORE INSERT OR UPDATE OR DELETE ON public.inventaire_physique
FOR EACH ROW EXECUTE FUNCTION public.guard_inventory_after_finalization();

NOTIFY pgrst, 'reload schema';
COMMIT;
