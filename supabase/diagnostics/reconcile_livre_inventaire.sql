-- Rapprochement en lecture seule au 31/03/2026, sans identifiants à saisir.
-- Le diagnostic inclut toutes les entreprises ayant un exercice couvrant cette date.
-- Aucune écriture ni aucun solde n'est modifié.
WITH params AS (
  SELECT ex.id AS exercice_id, ex.entreprise_id, ex.code AS exercice,
         ex.date_debut, ex.date_fin, DATE '2026-03-31' AS date_situation
  FROM public.exercices_comptables ex
  WHERE ex.date_debut <= DATE '2026-03-31'
    AND ex.date_fin >= DATE '2026-03-31'
),
mouvements AS (
  SELECT p.entreprise_id, p.exercice_id, l.compte_id,
         COALESCE(SUM(l.debit), 0)::numeric AS debit,
         COALESCE(SUM(l.credit), 0)::numeric AS credit,
         COUNT(*)::bigint AS nombre_lignes
  FROM params p
  JOIN public.ecritures_comptables e
    ON e.entreprise_id = p.entreprise_id
   AND e.exercice_id = p.exercice_id
   AND e.statut::text = 'VALIDEE'
   AND e.date_ecriture BETWEEN p.date_debut AND p.date_situation
  JOIN public.lignes_ecritures l ON l.ecriture_id = e.id
  GROUP BY p.entreprise_id, p.exercice_id, l.compte_id
),
premier_jour AS (
  SELECT p.entreprise_id, p.exercice_id, l.compte_id,
         COALESCE(SUM(l.debit),0)::numeric AS debit,
         COALESCE(SUM(l.credit),0)::numeric AS credit
  FROM params p
  JOIN public.ecritures_comptables e
    ON e.entreprise_id = p.entreprise_id AND e.exercice_id = p.exercice_id
   AND e.statut::text = 'VALIDEE' AND e.date_ecriture = p.date_debut
  JOIN public.lignes_ecritures l ON l.ecriture_id = e.id
  GROUP BY p.entreprise_id, p.exercice_id, l.compte_id
),
soldes AS (
  SELECT p.entreprise_id, p.exercice_id, p.exercice,
         p.date_debut, p.date_fin, p.date_situation,
         c.id AS compte_id, c.numero,
         regexp_replace(c.numero, '\D', '', 'g') AS code,
         c.libelle, c.nature::text AS nature,
         COALESCE(c.solde_ouverture_debit, 0)::numeric AS ouverture_debit,
         COALESCE(c.solde_ouverture_credit, 0)::numeric AS ouverture_credit,
         COALESCE(m.debit, 0)::numeric AS mouvement_debit,
         COALESCE(m.credit, 0)::numeric AS mouvement_credit,
         COALESCE(m.nombre_lignes, 0)::bigint AS nombre_lignes,
         COALESCE(j.debit, 0)::numeric AS premier_jour_debit,
         COALESCE(j.credit, 0)::numeric AS premier_jour_credit,
         (COALESCE(c.solde_ouverture_debit, 0) <> 0 OR COALESCE(c.solde_ouverture_credit, 0) <> 0)
           AND COALESCE(j.debit, 0) = COALESCE(c.solde_ouverture_debit, 0)
           AND COALESCE(j.credit, 0) = COALESCE(c.solde_ouverture_credit, 0) AS ouverture_possiblement_doublonnee,
         (COALESCE(c.solde_ouverture_debit, 0) - COALESCE(c.solde_ouverture_credit, 0)
           + COALESCE(m.debit, 0) - COALESCE(m.credit, 0))::numeric AS solde_signe
  FROM params p
  JOIN public.comptes_comptables c ON c.entreprise_id = p.entreprise_id
  LEFT JOIN mouvements m
    ON m.entreprise_id = p.entreprise_id
   AND m.exercice_id = p.exercice_id
   AND m.compte_id = c.id
  LEFT JOIN premier_jour j
    ON j.entreprise_id = p.entreprise_id
   AND j.exercice_id = p.exercice_id
   AND j.compte_id = c.id
),
financiers AS (
  SELECT s.*,
    CASE
      WHEN code LIKE '2%' OR code LIKE '3%' THEN solde_signe
      WHEN code LIKE '4%' AND code LIKE '49%' THEN solde_signe
      WHEN code LIKE '4%' AND solde_signe > 0 THEN solde_signe
      WHEN code LIKE '5%' AND code LIKE '59%' THEN solde_signe
      WHEN code LIKE '5%' AND solde_signe > 0 THEN solde_signe
      ELSE 0
    END AS bilan_actif,
    CASE
      WHEN code LIKE '1%' THEN -solde_signe
      WHEN code LIKE '4%' AND code NOT LIKE '49%' AND solde_signe < 0 THEN -solde_signe
      WHEN code LIKE '5%' AND code NOT LIKE '59%' AND solde_signe < 0 THEN -solde_signe
      ELSE 0
    END AS bilan_passif_hors_resultat,
    CASE
      WHEN code LIKE '6%' OR code LIKE '7%' OR code LIKE '8%'
        OR nature IN ('CHARGE', 'PRODUIT')
      THEN mouvement_credit - mouvement_debit ELSE 0
    END AS bilan_resultat_periode,
    CASE
      WHEN code LIKE '6%' OR code LIKE '7%' OR code LIKE '8%'
        OR nature IN ('CHARGE', 'PRODUIT')
      THEN -(ouverture_debit - ouverture_credit) ELSE 0
    END AS bilan_resultat_anterieur,
    CASE WHEN nature = 'CHARGE' THEN mouvement_debit - mouvement_credit ELSE 0 END AS compte_resultat_charge,
    CASE WHEN nature = 'PRODUIT' THEN mouvement_credit - mouvement_debit ELSE 0 END AS compte_resultat_produit
  FROM soldes s
),
synthese AS (
  SELECT entreprise_id, exercice_id, exercice, date_debut, date_fin, date_situation,
    COALESCE(SUM(ouverture_debit),0)::numeric AS ouverture_debit_totale,
    COALESCE(SUM(ouverture_credit),0)::numeric AS ouverture_credit_totale,
    COALESCE(SUM(ouverture_debit - ouverture_credit),0)::numeric AS ecart_a_nouveaux,
    COALESCE(SUM(mouvement_debit),0)::numeric AS mouvements_debit,
    COALESCE(SUM(mouvement_credit),0)::numeric AS mouvements_credit,
    COALESCE(SUM(GREATEST(solde_signe, 0)),0)::numeric AS balance_debit,
    COALESCE(SUM(GREATEST(-solde_signe, 0)),0)::numeric AS balance_credit,
    COALESCE(SUM(bilan_resultat_periode),0)::numeric AS resultat_net,
    COALESCE(SUM(bilan_resultat_anterieur),0)::numeric AS resultat_anterieur,
    COALESCE(SUM(bilan_actif),0)::numeric AS bilan_actif,
    COALESCE(SUM(bilan_passif_hors_resultat),0)::numeric AS bilan_passif_hors_resultat,
    COALESCE(SUM(compte_resultat_charge),0)::numeric AS compte_resultat_charges,
    COALESCE(SUM(compte_resultat_produit),0)::numeric AS compte_resultat_produits
  FROM financiers
  GROUP BY entreprise_id, exercice_id, exercice, date_debut, date_fin, date_situation
),
comptes_cibles AS (
  SELECT entreprise_id, exercice_id,
    jsonb_agg(jsonb_build_object(
      'numero', numero, 'libelle', libelle, 'nature', nature,
      'ouverture_debit', ouverture_debit, 'ouverture_credit', ouverture_credit,
      'mouvement_debit', mouvement_debit, 'mouvement_credit', mouvement_credit,
      'premier_jour_debit', premier_jour_debit, 'premier_jour_credit', premier_jour_credit,
      'ouverture_possiblement_doublonnee', ouverture_possiblement_doublonnee,
      'solde_signe_au_31_03_2026', solde_signe, 'nombre_lignes_validees', nombre_lignes
    ) ORDER BY numero) AS comptes
  FROM soldes
  WHERE code IN ('101', '10221', '242', '3611', '4454')
  GROUP BY entreprise_id, exercice_id
),
lignes_cibles AS (
  SELECT p.entreprise_id, p.exercice_id,
    jsonb_agg(jsonb_build_object(
      'date', e.date_ecriture, 'numero_ecriture', e.numero, 'ecriture_id', e.id,
      'compte', c.numero, 'libelle_compte', c.libelle,
      'libelle_ecriture', e.libelle, 'debit', l.debit, 'credit', l.credit
    ) ORDER BY e.date_ecriture, e.numero, c.numero) AS lignes
  FROM params p
  JOIN public.ecritures_comptables e
    ON e.entreprise_id = p.entreprise_id AND e.exercice_id = p.exercice_id
   AND e.statut::text = 'VALIDEE'
   AND e.date_ecriture BETWEEN p.date_debut AND p.date_situation
  JOIN public.lignes_ecritures l ON l.ecriture_id = e.id
  JOIN public.comptes_comptables c ON c.id = l.compte_id
  WHERE regexp_replace(c.numero, '\D', '', 'g') IN ('101', '10221', '242', '3611', '4454')
  GROUP BY p.entreprise_id, p.exercice_id
)
SELECT jsonb_pretty(COALESCE(jsonb_agg(jsonb_build_object(
  'entreprise_id', s.entreprise_id,
  'exercice_id', s.exercice_id,
  'exercice', s.exercice,
  'date_situation', s.date_situation,
  'a_nouveaux', jsonb_build_object(
    'debit', s.ouverture_debit_totale,
    'credit', s.ouverture_credit_totale,
    'ecart_debit_moins_credit', s.ecart_a_nouveaux
  ),
  'balance_et_grand_livre', jsonb_build_object(
    'mouvements_debit_valides', s.mouvements_debit,
    'mouvements_credit_valides', s.mouvements_credit,
    'total_balance_debit', s.balance_debit,
    'total_balance_credit', s.balance_credit
  ),
  'indicateurs_pour_rapprochement', jsonb_build_object(
    'bilan_actif', s.bilan_actif,
    'bilan_passif_hors_resultat', s.bilan_passif_hors_resultat,
    'resultat_anterieur', s.resultat_anterieur,
    'resultat_periode_bilan', s.resultat_net,
    'ecart_bilan_selon_regles_frontend', s.bilan_actif - s.bilan_passif_hors_resultat - s.resultat_anterieur - s.resultat_net,
    'compte_resultat_produits_selon_nature', s.compte_resultat_produits,
    'compte_resultat_charges_selon_nature', s.compte_resultat_charges,
    'resultat_compte_de_resultat', s.compte_resultat_produits - s.compte_resultat_charges
  ),
  'comptes_101_10221_242_3611_4454', COALESCE(cc.comptes, '[]'::jsonb),
  'lignes_source_validees_de_ces_comptes', COALESCE(lc.lignes, '[]'::jsonb)
) ORDER BY s.exercice, s.entreprise_id), '[]'::jsonb)) AS diagnostic
FROM synthese s
LEFT JOIN comptes_cibles cc USING (entreprise_id, exercice_id)
LEFT JOIN lignes_cibles lc USING (entreprise_id, exercice_id);
