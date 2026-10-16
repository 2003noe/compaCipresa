-- Les comptes du referentiel OHADA sont des modeles globaux a l'entreprise
-- et ne sont rattaches a aucun exercice. Le compte cree par un utilisateur,
-- lui, reste rattache a l'exercice choisi dans le formulaire.
BEGIN;

-- Remplacer la relation parent auto-referencee (comptes_comptables) par la
-- relation vers le referentiel partage utilise par AccountForm (default_compt).
DO $migration$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.comptes_comptables'::regclass
      AND contype = 'f'
      AND conkey = ARRAY[(
        SELECT attnum
        FROM pg_attribute
        WHERE attrelid = 'public.comptes_comptables'::regclass
          AND attname = 'compte_parent_id'
          AND NOT attisdropped
      )]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.comptes_comptables DROP CONSTRAINT %I', v_constraint.conname);
  END LOOP;
END;
$migration$;

-- Convertir les anciennes références auto-référencées vers le code OHADA
-- correspondant. Les parents sans équivalent dans le référentiel deviennent
-- NULL plutôt que de conserver un lien invalide.
UPDATE public.comptes_comptables c
SET compte_parent_id = COALESCE(d_existing.id, d_by_number.id)
FROM public.comptes_comptables old_parent
LEFT JOIN public.default_compt d_existing ON d_existing.id = old_parent.id
LEFT JOIN public.default_compt d_by_number
  ON regexp_replace(d_by_number.num_compte, '\s', '', 'g') = regexp_replace(old_parent.numero, '\s', '', 'g')
WHERE c.compte_parent_id = old_parent.id;

-- Nettoyer les liens qui ne sont déjà pas dans le référentiel (ou qui n'ont
-- pas pu être rapprochés par numéro).
UPDATE public.comptes_comptables c
SET compte_parent_id = NULL
WHERE c.compte_parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.default_compt d WHERE d.id = c.compte_parent_id
  );

ALTER TABLE public.comptes_comptables
  ADD CONSTRAINT comptes_comptables_parent_referentiel_fkey
  FOREIGN KEY (compte_parent_id)
  REFERENCES public.default_compt(id)
  NOT VALID;

CREATE OR REPLACE FUNCTION public.guard_account_exercise()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  exercise_status text;
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

  -- Le parent est un modèle du référentiel OHADA partagé, jamais un compte
  -- comptable d'un autre exercice.
  IF NEW.compte_parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.default_compt d WHERE d.id = NEW.compte_parent_id
  ) THEN
    RAISE EXCEPTION 'Le compte parent doit provenir du référentiel OHADA.';
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

NOTIFY pgrst, 'reload schema';
COMMIT;
