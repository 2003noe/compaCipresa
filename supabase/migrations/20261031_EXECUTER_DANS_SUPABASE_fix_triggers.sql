-- ============================================================
-- SCRIPT À EXÉCUTER DANS SUPABASE SQL EDITOR
-- Supprime toute référence à comptes_comptables.exercice_id
-- dans les triggers et fonctions de la base de données.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. guard_account_exercise
--    Les comptes sont désormais globaux à l'entreprise
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_account_exercise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF coalesce(NEW.solde_ouverture_debit, 0) < 0
     OR coalesce(NEW.solde_ouverture_credit, 0) < 0 THEN
    RAISE EXCEPTION 'Les soldes d''ouverture ne peuvent pas être négatifs.';
  END IF;
  IF coalesce(NEW.solde_ouverture_debit, 0) > 0
     AND coalesce(NEW.solde_ouverture_credit, 0) > 0 THEN
    RAISE EXCEPTION 'Un compte ne peut pas avoir simultanément un solde d''ouverture débiteur et créditeur.';
  END IF;
  IF NEW.compte_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.default_compt d WHERE d.id = NEW.compte_parent_id
  ) THEN
    RAISE EXCEPTION 'Le compte parent doit provenir du référentiel OHADA.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comptes_comptables_exercise_guard ON public.comptes_comptables;
CREATE TRIGGER comptes_comptables_exercise_guard
  BEFORE INSERT OR UPDATE ON public.comptes_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_exercise();

-- ============================================================
-- 2. guard_entry_integrity
--    Supprime le bloc c.exercice_id IS DISTINCT FROM exercise_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_entry_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  exercise_id uuid;
  entry_date date;
  entry_status text;
  start_date date;
  end_date date;
  exercise_status text;
  line_count bigint;
  debit_total numeric;
  credit_total numeric;
  invalid_line_count bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    exercise_id := OLD.exercice_id;
    entry_date := OLD.date_ecriture;
    entry_status := OLD.statut::text;
    IF entry_status <> 'BROUILLON' THEN
      RAISE EXCEPTION 'Une écriture validée ne peut pas être supprimée.';
    END IF;
  ELSE
    exercise_id := NEW.exercice_id;
    entry_date := NEW.date_ecriture;
    entry_status := NEW.statut::text;
    IF TG_OP = 'INSERT' THEN
      IF entry_status <> 'BROUILLON' THEN
        RAISE EXCEPTION 'Une écriture doit d''abord être créée en brouillon puis validée.';
      END IF;
    ELSE
      IF OLD.statut::text NOT IN ('BROUILLON', 'EN_VALIDATION') THEN
        RAISE EXCEPTION 'Une écriture validée est verrouillée.';
      END IF;
      IF OLD.statut::text = 'EN_VALIDATION'
         AND (entry_status <> 'VALIDEE'
              OR coalesce(current_setting('app.validation_en_cours', true), 'off') <> 'on') THEN
        RAISE EXCEPTION 'Une écriture en validation ne peut être finalisée que par valider_ecriture.';
      END IF;
      IF entry_status = 'VALIDEE'
         AND coalesce(current_setting('app.validation_en_cours', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'La validation définitive doit passer par la fonction valider_ecriture.';
      END IF;
    END IF;
  END IF;

  SELECT e.date_debut, e.date_fin, e.statut::text
  INTO start_date, end_date, exercise_status
  FROM public.exercices_comptables e
  WHERE e.id = exercise_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exercice comptable introuvable.';
  END IF;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Impossible de modifier une écriture dans un exercice clôturé.';
  END IF;
  IF entry_date < start_date OR entry_date > end_date THEN
    RAISE EXCEPTION 'La date de l''écriture doit être comprise dans les dates de l''exercice.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clotures_comptables c
    WHERE c.exercice_id = exercise_id
      AND c.statut = 'CLOTUREE'
      AND entry_date BETWEEN c.periode_debut AND c.periode_fin
  ) THEN
    RAISE EXCEPTION 'La période mensuelle de cette écriture est clôturée.';
  END IF;

  IF TG_OP = 'UPDATE' AND entry_status = 'VALIDEE' THEN
    SELECT count(*), coalesce(sum(l.debit), 0), coalesce(sum(l.credit), 0),
           count(*) FILTER (WHERE NOT ((l.debit > 0 AND l.credit = 0) OR (l.credit > 0 AND l.debit = 0)))
    INTO line_count, debit_total, credit_total, invalid_line_count
    FROM public.lignes_ecritures l
    WHERE l.ecriture_id = NEW.id;

    IF line_count < 2 THEN
      RAISE EXCEPTION 'Une écriture validée doit comporter au moins deux lignes.';
    END IF;
    IF invalid_line_count > 0 THEN
      RAISE EXCEPTION 'Chaque ligne doit porter un montant au débit ou au crédit, mais pas les deux.';
    END IF;
    IF debit_total <= 0 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'Écriture déséquilibrée : total débit %, total crédit %.', debit_total, credit_total;
    END IF;
    -- Bloc c.exercice_id supprimé car les comptes sont globaux
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS ecritures_comptables_integrity_guard ON public.ecritures_comptables;
CREATE TRIGGER ecritures_comptables_integrity_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.ecritures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_entry_integrity();

-- ============================================================
-- 3. guard_entry_line_integrity
--    Supprime la vérification account_exercise_id = exercise_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_entry_line_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  entry_id uuid;
  exercise_id uuid;
  entry_status text;
  exercise_status text;
BEGIN
  entry_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.ecriture_id ELSE NEW.ecriture_id END;

  SELECT e.exercice_id, e.statut::text
  INTO exercise_id, entry_status
  FROM public.ecritures_comptables e
  WHERE e.id = entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Écriture parente introuvable.';
  END IF;
  IF entry_status <> 'BROUILLON' THEN
    RAISE EXCEPTION 'Les lignes d''une écriture validée ne peuvent pas être modifiées.';
  END IF;

  SELECT e.statut::text INTO exercise_status
  FROM public.exercices_comptables e
  WHERE e.id = exercise_id;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Les lignes d''un exercice clôturé ne peuvent pas être modifiées.';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comptes_comptables c WHERE c.id = NEW.compte_id
    ) THEN
      RAISE EXCEPTION 'Compte comptable introuvable.';
    END IF;
    IF NOT ((NEW.debit > 0 AND NEW.credit = 0) OR (NEW.credit > 0 AND NEW.debit = 0)) THEN
      RAISE EXCEPTION 'Chaque ligne doit avoir soit un débit, soit un crédit.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS lignes_ecritures_integrity_guard ON public.lignes_ecritures;
CREATE TRIGGER lignes_ecritures_integrity_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.lignes_ecritures
  FOR EACH ROW EXECUTE FUNCTION public.guard_entry_line_integrity();

-- ============================================================
-- 4. guard_asset_exercise
--    Supprime la vérification account_exercise_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.guard_asset_exercise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  start_date date;
  end_date date;
  exercise_status text;
BEGIN
  SELECT e.date_debut, e.date_fin, e.statut::text
  INTO start_date, end_date, exercise_status
  FROM public.exercices_comptables e
  WHERE e.id = NEW.exercice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exercice comptable introuvable.';
  END IF;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Impossible de modifier une immobilisation dans un exercice clôturé.';
  END IF;
  IF NEW.date_acquisition < start_date OR NEW.date_acquisition > end_date THEN
    RAISE EXCEPTION 'La date d''acquisition doit être comprise dans l''exercice sélectionné.';
  END IF;
  IF NEW.compte_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comptes_comptables c WHERE c.id = NEW.compte_id
    ) THEN
      RAISE EXCEPTION 'Le compte d''immobilisation est introuvable.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS immobilisations_exercise_guard ON public.immobilisations;
CREATE TRIGGER immobilisations_exercise_guard
  BEFORE INSERT OR UPDATE ON public.immobilisations
  FOR EACH ROW EXECUTE FUNCTION public.guard_asset_exercise();

-- ============================================================
-- 5. soldes_comptes_exercice (sans filtre exercice_id sur comptes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.soldes_comptes_exercice(
  p_exercice_id uuid,
  p_date_fin date,
  p_date_debut date DEFAULT NULL::date
)
RETURNS TABLE(
  compte_id uuid,
  numero text,
  libelle text,
  classe text,
  nature text,
  ouverture numeric,
  anterieur numeric,
  periode_debit numeric,
  periode_credit numeric,
  solde_fin numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH bornes AS (
    SELECT coalesce(p_date_debut, date '0001-01-01') AS d0
  ),
  mouv AS (
    SELECT
      l.compte_id AS cid,
      coalesce(sum(l.debit - l.credit) FILTER (WHERE e.date_ecriture < b.d0), 0) AS ant,
      coalesce(sum(l.debit) FILTER (WHERE e.date_ecriture >= b.d0), 0) AS pdeb,
      coalesce(sum(l.credit) FILTER (WHERE e.date_ecriture >= b.d0), 0) AS pcre
    FROM public.lignes_ecritures l
    JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
    CROSS JOIN bornes b
    WHERE e.statut::text = 'VALIDEE'
      AND e.exercice_id = p_exercice_id
      AND e.date_ecriture <= p_date_fin
    GROUP BY l.compte_id
  ),
  calc AS (
    SELECT
      c.id AS compte_id,
      c.numero,
      c.libelle,
      c.classe,
      c.nature::text AS nature,
      coalesce(c.solde_ouverture_debit, 0)
        - coalesce(c.solde_ouverture_credit, 0) AS ouverture,
      coalesce(m.ant, 0) AS anterieur,
      coalesce(m.pdeb, 0) AS periode_debit,
      coalesce(m.pcre, 0) AS periode_credit
    FROM public.comptes_comptables c
    LEFT JOIN mouv m ON m.cid = c.id
  )
  SELECT
    k.compte_id,
    k.numero,
    k.libelle,
    k.classe,
    k.nature,
    k.ouverture,
    k.anterieur,
    k.periode_debit,
    k.periode_credit,
    k.ouverture + k.anterieur + k.periode_debit - k.periode_credit AS solde_fin
  FROM calc k
  WHERE k.ouverture <> 0
     OR k.anterieur <> 0
     OR k.periode_debit <> 0
     OR k.periode_credit <> 0
  ORDER BY k.numero;
$function$;

-- ============================================================
-- 6. Corriger l'index unique sur comptes_comptables
--    (remplacer l'ancien qui incluait exercice_id)
-- ============================================================
DROP INDEX IF EXISTS public.uq_compte_entreprise_exercice_numero;
DROP INDEX IF EXISTS public.uq_comptes_id_entreprise_exercice;

CREATE UNIQUE INDEX IF NOT EXISTS uq_compte_entreprise_numero
  ON public.comptes_comptables(entreprise_id, numero);

NOTIFY pgrst, 'reload schema';

COMMIT;
