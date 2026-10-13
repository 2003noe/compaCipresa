-- Enforce basic accounting invariants in the database, not only in the browser.
-- Run after the application migrations that add exercise_id to accounts/assets.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_account_exercise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  exercise_status text;
  parent_exercise uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.exercice_id IS DISTINCT FROM NEW.exercice_id
     AND EXISTS (
       SELECT 1 FROM public.lignes_ecritures l
       WHERE l.compte_id = OLD.id
     ) THEN
    RAISE EXCEPTION 'L’exercice d’un compte utilisé dans des écritures ne peut pas être changé.';
  END IF;

  IF NEW.exercice_id IS NULL THEN
    RAISE EXCEPTION 'Un compte comptable doit être rattaché à un exercice.';
  END IF;

  SELECT e.statut::text INTO exercise_status
  FROM public.exercices_comptables e
  WHERE e.id = NEW.exercice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exercice comptable introuvable.';
  END IF;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Impossible de créer ou modifier un compte dans un exercice clôturé.';
  END IF;

  IF NEW.compte_parent_id IS NOT NULL THEN
    SELECT c.exercice_id INTO parent_exercise
    FROM public.comptes_comptables c
    WHERE c.id = NEW.compte_parent_id;
    IF NOT FOUND OR parent_exercise IS DISTINCT FROM NEW.exercice_id THEN
      RAISE EXCEPTION 'Le compte parent doit appartenir au même exercice.';
    END IF;
  END IF;

  IF coalesce(NEW.solde_ouverture_debit, 0) < 0
     OR coalesce(NEW.solde_ouverture_credit, 0) < 0 THEN
    RAISE EXCEPTION 'Les soldes d’ouverture ne peuvent pas être négatifs.';
  END IF;
  IF coalesce(NEW.solde_ouverture_debit, 0) > 0
     AND coalesce(NEW.solde_ouverture_credit, 0) > 0 THEN
    RAISE EXCEPTION 'Un compte ne peut pas avoir simultanément un solde d’ouverture débiteur et créditeur.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS comptes_comptables_exercise_guard ON public.comptes_comptables;
CREATE TRIGGER comptes_comptables_exercise_guard
  BEFORE INSERT OR UPDATE ON public.comptes_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_account_exercise();

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
        RAISE EXCEPTION 'Une écriture doit d’abord être créée en brouillon puis validée.';
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
    RAISE EXCEPTION 'La date de l’écriture doit être comprise dans les dates de l’exercice.';
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
    IF EXISTS (
      SELECT 1
      FROM public.lignes_ecritures l
      JOIN public.comptes_comptables c ON c.id = l.compte_id
      WHERE l.ecriture_id = NEW.id
        AND c.exercice_id IS DISTINCT FROM exercise_id
    ) THEN
      RAISE EXCEPTION 'Tous les comptes utilisés doivent appartenir au même exercice que l’écriture.';
    END IF;
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
  account_exercise_id uuid;
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
    RAISE EXCEPTION 'Les lignes d’une écriture validée ne peuvent pas être modifiées.';
  END IF;

  SELECT e.statut::text INTO exercise_status
  FROM public.exercices_comptables e
  WHERE e.id = exercise_id;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Les lignes d’un exercice clôturé ne peuvent pas être modifiées.';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT c.exercice_id INTO account_exercise_id
    FROM public.comptes_comptables c
    WHERE c.id = NEW.compte_id;
    IF NOT FOUND OR account_exercise_id IS DISTINCT FROM exercise_id THEN
      RAISE EXCEPTION 'Le compte de la ligne doit appartenir au même exercice que l’écriture.';
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
  account_exercise_id uuid;
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
    RAISE EXCEPTION 'La date d’acquisition doit être comprise dans l’exercice sélectionné.';
  END IF;
  IF NEW.compte_id IS NOT NULL THEN
    SELECT c.exercice_id INTO account_exercise_id
    FROM public.comptes_comptables c
    WHERE c.id = NEW.compte_id;
    IF NOT FOUND OR account_exercise_id IS DISTINCT FROM NEW.exercice_id THEN
      RAISE EXCEPTION 'Le compte d’immobilisation doit appartenir au même exercice.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS immobilisations_exercise_guard ON public.immobilisations;
CREATE TRIGGER immobilisations_exercise_guard
  BEFORE INSERT OR UPDATE ON public.immobilisations
  FOR EACH ROW EXECUTE FUNCTION public.guard_asset_exercise();

CREATE OR REPLACE FUNCTION public.guard_monthly_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  exercise_status text;
  exercise_start date;
  exercise_end date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.statut = 'CLOTUREE' AND NEW.statut <> 'CLOTUREE' THEN
      RAISE EXCEPTION 'Une clôture mensuelle définitive ne peut pas être rouverte directement.';
    END IF;
  END IF;

  SELECT e.statut::text, e.date_debut, e.date_fin
  INTO exercise_status, exercise_start, exercise_end
  FROM public.exercices_comptables e
  WHERE e.id = NEW.exercice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exercice comptable introuvable pour cette clôture.';
  END IF;
  IF NEW.periode_debut IS NULL OR NEW.periode_fin IS NULL OR NEW.periode_debut > NEW.periode_fin
     OR NEW.periode_debut < exercise_start OR NEW.periode_fin > exercise_end THEN
    RAISE EXCEPTION 'La période de clôture doit être valide et comprise dans les dates de l’exercice.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.clotures_comptables c
    WHERE c.exercice_id = NEW.exercice_id
      AND c.id <> NEW.id
      AND daterange(c.periode_debut, c.periode_fin, '[]')
          && daterange(NEW.periode_debut, NEW.periode_fin, '[]')
  ) THEN
    RAISE EXCEPTION 'Une clôture existe déjà pour une période qui se chevauche.';
  END IF;
  IF exercise_status <> 'OUVERT' THEN
    RAISE EXCEPTION 'Une clôture mensuelle ne peut être créée ou modifiée que dans un exercice ouvert.';
  END IF;
  IF NEW.statut <> 'CLOTUREE' THEN
    RETURN NEW;
  END IF;
  IF NOT (NEW.balance_validee AND NEW.rapprochement_valide AND NEW.fiscalite_verifiee) THEN
    RAISE EXCEPTION 'La balance, le rapprochement et la fiscalité doivent être validés avant la clôture.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.controles_cloture c WHERE c.cloture_id = NEW.id) THEN
    RAISE EXCEPTION 'La checklist de clôture est absente.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.controles_cloture c
    WHERE c.cloture_id = NEW.id AND c.statut = 'A_FAIRE'
  ) THEN
    RAISE EXCEPTION 'Tous les contrôles doivent être traités avant la clôture.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ecritures_comptables e
    WHERE e.exercice_id = NEW.exercice_id
      AND e.date_ecriture BETWEEN NEW.periode_debut AND NEW.periode_fin
      AND e.statut::text = 'BROUILLON'
  ) THEN
    RAISE EXCEPTION 'Des écritures brouillon restent à traiter dans cette période.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS clotures_comptables_integrity_guard ON public.clotures_comptables;
CREATE TRIGGER clotures_comptables_integrity_guard
  BEFORE INSERT OR UPDATE ON public.clotures_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_monthly_close();

CREATE OR REPLACE FUNCTION public.guard_exercise_period_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ecritures_comptables e
    WHERE e.exercice_id = NEW.id
      AND (e.date_ecriture < NEW.date_debut OR e.date_ecriture > NEW.date_fin)
  ) THEN
    RAISE EXCEPTION 'La plage de dates ne peut pas exclure une écriture déjà rattachée à cet exercice.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.statut::text = 'OUVERT' AND NEW.statut::text = 'CLOTURE'
     AND EXISTS (
       SELECT 1 FROM public.ecritures_comptables e
       WHERE e.exercice_id = NEW.id AND e.statut::text = 'BROUILLON'
     ) THEN
    RAISE EXCEPTION 'Traitez les écritures brouillon avant de clôturer l’exercice.';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS exercices_comptables_integrity_guard ON public.exercices_comptables;
CREATE TRIGGER exercices_comptables_integrity_guard
  BEFORE UPDATE ON public.exercices_comptables
  FOR EACH ROW EXECUTE FUNCTION public.guard_exercise_period_integrity();

COMMIT;
