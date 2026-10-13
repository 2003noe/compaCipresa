-- Add exercise ownership to fixed assets. Existing assets are assigned only
-- when their acquisition date matches exactly one accounting exercise.
ALTER TABLE public.immobilisations
  ADD COLUMN IF NOT EXISTS exercice_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'immobilisations_exercice_id_fkey'
      AND conrelid = 'public.immobilisations'::regclass
  ) THEN
    ALTER TABLE public.immobilisations
      ADD CONSTRAINT immobilisations_exercice_id_fkey
      FOREIGN KEY (exercice_id)
      REFERENCES public.exercices_comptables(id);
  END IF;
END $$;

WITH correspondances AS (
  SELECT
    i.id AS immobilisation_id,
    (array_agg(e.id))[1] AS exercice_id,
    COUNT(e.id) AS nombre_exercices
  FROM public.immobilisations i
  LEFT JOIN public.exercices_comptables e
    ON i.date_acquisition BETWEEN e.date_debut AND e.date_fin
  WHERE i.exercice_id IS NULL
  GROUP BY i.id
)
UPDATE public.immobilisations i
SET exercice_id = c.exercice_id
FROM correspondances c
WHERE c.immobilisation_id = i.id
  AND c.nombre_exercices = 1;

CREATE INDEX IF NOT EXISTS immobilisations_exercice_id_idx
  ON public.immobilisations(exercice_id);
