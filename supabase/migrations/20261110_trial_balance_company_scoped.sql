-- Balance de vérification versionnée, commune à la Balance et au Livre d'inventaire.
-- Aucun mouvement ni compte n'est modifié : la fonction ne fait que lire.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_trial_balance_company_scoped(
  p_company_id uuid,
  p_fiscal_year_id uuid,
  p_date_from date,
  p_date_to date
)
RETURNS TABLE (
  account_id uuid,
  account_code text,
  account_name text,
  account_class text,
  nature text,
  opening_debit numeric,
  opening_credit numeric,
  period_debit numeric,
  period_credit numeric,
  closing_debit numeric,
  closing_credit numeric,
  signed_closing_balance numeric,
  has_activity boolean,
  has_anomaly boolean,
  is_active boolean,
  possible_duplicate_opening boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_company uuid;
  v_start date;
  v_end date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_entreprise_member(p_company_id) THEN
    RAISE EXCEPTION 'Accès refusé à cette entreprise.' USING ERRCODE = '42501';
  END IF;

  SELECT e.entreprise_id, e.date_debut, e.date_fin
    INTO v_company, v_start, v_end
  FROM public.exercices_comptables e
  WHERE e.id = p_fiscal_year_id;
  IF NOT FOUND OR v_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Exercice introuvable pour cette entreprise.' USING ERRCODE = '22023';
  END IF;
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_from > p_date_to
     OR p_date_from < v_start OR p_date_to > v_end THEN
    RAISE EXCEPTION 'La période doit être comprise dans les dates de l’exercice.' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH before_period AS (
    SELECT l.compte_id, COALESCE(SUM(l.debit - l.credit), 0)::numeric AS signed_movement
    FROM public.lignes_ecritures l
    JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
    WHERE e.entreprise_id = p_company_id AND e.exercice_id = p_fiscal_year_id
      AND e.statut::text = 'VALIDEE' AND e.date_ecriture >= v_start AND e.date_ecriture < p_date_from
    GROUP BY l.compte_id
  ),
  period AS (
    SELECT l.compte_id, COALESCE(SUM(l.debit), 0)::numeric AS debit,
           COALESCE(SUM(l.credit), 0)::numeric AS credit
    FROM public.lignes_ecritures l
    JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
    WHERE e.entreprise_id = p_company_id AND e.exercice_id = p_fiscal_year_id
      AND e.statut::text = 'VALIDEE' AND e.date_ecriture BETWEEN p_date_from AND p_date_to
    GROUP BY l.compte_id
  ),
  exercise_first_day AS (
    SELECT l.compte_id, COALESCE(SUM(l.debit), 0)::numeric AS debit,
           COALESCE(SUM(l.credit), 0)::numeric AS credit
    FROM public.lignes_ecritures l
    JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
    WHERE e.entreprise_id = p_company_id AND e.exercice_id = p_fiscal_year_id
      AND e.statut::text = 'VALIDEE' AND e.date_ecriture = v_start
    GROUP BY l.compte_id
  ),
  per_account AS (
    SELECT c.id, c.numero::text AS code, c.libelle::text AS name,
           c.classe::text AS class_name, c.nature::text AS account_nature,
           c.actif AS active,
           (COALESCE(c.solde_ouverture_debit, 0) <> 0 OR COALESCE(c.solde_ouverture_credit, 0) <> 0)
             AND f.compte_id IS NOT NULL
             AND f.debit = COALESCE(c.solde_ouverture_debit, 0)
             AND f.credit = COALESCE(c.solde_ouverture_credit, 0) AS duplicate_opening,
           (COALESCE(c.solde_ouverture_debit, 0) - COALESCE(c.solde_ouverture_credit, 0)
             + COALESCE(b.signed_movement, 0))::numeric AS opening_signed,
           COALESCE(m.debit, 0)::numeric AS movement_debit,
           COALESCE(m.credit, 0)::numeric AS movement_credit
    FROM public.comptes_comptables c
    LEFT JOIN before_period b ON b.compte_id = c.id
    LEFT JOIN period m ON m.compte_id = c.id
    LEFT JOIN exercise_first_day f ON f.compte_id = c.id
    WHERE c.entreprise_id = p_company_id
  ),
  signed_rows AS (
    SELECT a.*, (a.opening_signed + a.movement_debit - a.movement_credit)::numeric AS closing_signed,
           regexp_replace(a.code, '\D', '', 'g') AS numeric_code
    FROM per_account a
  )
  SELECT s.id, s.code, s.name, s.class_name, s.account_nature,
         GREATEST(s.opening_signed, 0)::numeric,
         GREATEST(-s.opening_signed, 0)::numeric,
         s.movement_debit, s.movement_credit,
         GREATEST(s.closing_signed, 0)::numeric,
         GREATEST(-s.closing_signed, 0)::numeric,
         s.closing_signed,
         (s.opening_signed <> 0 OR s.movement_debit <> 0 OR s.movement_credit <> 0),
         CASE
           WHEN NOT s.active OR s.duplicate_opening THEN true
           WHEN s.numeric_code ~ '^(28|29|39|49|59)' THEN s.closing_signed > 0
           WHEN s.numeric_code ~ '^1' THEN s.closing_signed > 0
           WHEN s.numeric_code ~ '^(2|3)' THEN s.closing_signed < 0
           WHEN s.numeric_code ~ '^(40|42|43|419|4453|4454|56)' THEN s.closing_signed > 0
           WHEN s.numeric_code ~ '^(41|4451|4452)' THEN s.closing_signed < 0
           WHEN s.numeric_code ~ '^5' THEN s.closing_signed < 0
           WHEN s.account_nature IN ('ACTIF','TRESORERIE','CHARGE') THEN s.closing_signed < 0
           WHEN s.account_nature IN ('PASSIF','PRODUIT') THEN s.closing_signed > 0
           ELSE false
         END,
         s.active,
         s.duplicate_opening
  FROM signed_rows s
  ORDER BY s.code;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_trial_balance_company_scoped(uuid, uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trial_balance_company_scoped(uuid, uuid, date, date) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
