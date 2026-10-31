-- Migration : Mise à jour de la fonction soldes_comptes_exercice
-- Suite à la suppression de la colonne exercice_id de la table comptes_comptables.
-- Les comptes appartiennent désormais à l'entreprise globale, tandis que les écritures restent filtrées par exercice.

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

REVOKE ALL ON FUNCTION public.soldes_comptes_exercice(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soldes_comptes_exercice(uuid, date, date) TO authenticated;
