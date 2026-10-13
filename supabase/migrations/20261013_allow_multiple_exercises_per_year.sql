BEGIN;

DO $migration$
DECLARE
  annee_attnum smallint;
  unique_constraint record;
BEGIN
  SELECT attnum
  INTO annee_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.exercices_comptables'::regclass
    AND attname = 'annee'
    AND NOT attisdropped;

  IF annee_attnum IS NULL THEN
    RAISE EXCEPTION 'Colonne public.exercices_comptables.annee introuvable.';
  END IF;

  -- Retire toute contrainte UNIQUE qui porte uniquement sur annee.
  -- L'unicité du code est conservée.
  FOR unique_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.exercices_comptables'::regclass
      AND contype = 'u'
      AND cardinality(conkey) = 1
      AND conkey[1] = annee_attnum
  LOOP
    EXECUTE format(
      'ALTER TABLE public.exercices_comptables DROP CONSTRAINT %I',
      unique_constraint.conname
    );
  END LOOP;

  -- NOT VALID conserve les anciennes lignes éventuellement incohérentes,
  -- mais bloque immédiatement toute nouvelle insertion ou modification invalide.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.exercices_comptables'::regclass
      AND conname = 'exercices_comptables_annee_dates_check'
  ) THEN
    ALTER TABLE public.exercices_comptables
      ADD CONSTRAINT exercices_comptables_annee_dates_check
      CHECK (
        EXTRACT(YEAR FROM date_debut)::integer = annee
        AND EXTRACT(YEAR FROM date_fin)::integer = annee
        AND date_debut <= date_fin
      ) NOT VALID;
  END IF;
END
$migration$;

COMMIT;
