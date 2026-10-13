-- Read-only audit of existing accounting data before relying on the new guards.
-- Run each SELECT in Supabase SQL Editor and review the returned rows.

-- 1) Legacy accounts without an exercise and the exercises of entries that use them.
SELECT
  c.id AS compte_id,
  c.numero,
  c.libelle,
  count(DISTINCT e.id) AS nombre_ecritures,
  array_agg(DISTINCT e.exercice_id) FILTER (WHERE e.exercice_id IS NOT NULL) AS exercices_utilisateurs
FROM public.comptes_comptables c
LEFT JOIN public.lignes_ecritures l ON l.compte_id = c.id
LEFT JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
WHERE c.exercice_id IS NULL
GROUP BY c.id, c.numero, c.libelle
ORDER BY c.numero;

-- 2) Lines whose account and entry are not attached to the same exercise.
SELECT
  e.id AS ecriture_id,
  e.numero,
  e.exercice_id AS exercice_ecriture,
  c.id AS compte_id,
  c.numero AS numero_compte,
  c.exercice_id AS exercice_compte
FROM public.lignes_ecritures l
JOIN public.ecritures_comptables e ON e.id = l.ecriture_id
JOIN public.comptes_comptables c ON c.id = l.compte_id
WHERE c.exercice_id IS DISTINCT FROM e.exercice_id
ORDER BY e.date_ecriture, e.numero, c.numero;

-- 3) Validated entries with fewer than two lines, unbalanced totals, or malformed lines.
SELECT
  e.id AS ecriture_id,
  e.numero,
  count(l.id) AS nombre_lignes,
  coalesce(sum(l.debit), 0) AS total_debit,
  coalesce(sum(l.credit), 0) AS total_credit,
  count(l.id) FILTER (WHERE NOT ((l.debit > 0 AND l.credit = 0) OR (l.credit > 0 AND l.debit = 0))) AS lignes_mal_formees
FROM public.ecritures_comptables e
LEFT JOIN public.lignes_ecritures l ON l.ecriture_id = e.id
WHERE e.statut::text = 'VALIDEE'
GROUP BY e.id, e.numero
HAVING count(l.id) < 2
    OR coalesce(sum(l.debit), 0) <> coalesce(sum(l.credit), 0)
    OR count(l.id) FILTER (WHERE NOT ((l.debit > 0 AND l.credit = 0) OR (l.credit > 0 AND l.debit = 0))) > 0
ORDER BY e.numero;

-- 4) Entries dated outside their assigned exercise.
SELECT
  e.id AS ecriture_id,
  e.numero,
  e.date_ecriture,
  x.code AS code_exercice,
  x.date_debut,
  x.date_fin
FROM public.ecritures_comptables e
JOIN public.exercices_comptables x ON x.id = e.exercice_id
WHERE e.date_ecriture < x.date_debut OR e.date_ecriture > x.date_fin
ORDER BY e.date_ecriture, e.numero;

-- 5) Opening balances that do not balance for an exercise.
SELECT
  x.id AS exercice_id,
  x.code,
  coalesce(sum(c.solde_ouverture_debit), 0) AS total_ouverture_debit,
  coalesce(sum(c.solde_ouverture_credit), 0) AS total_ouverture_credit,
  coalesce(sum(c.solde_ouverture_debit), 0) - coalesce(sum(c.solde_ouverture_credit), 0) AS ecart
FROM public.exercices_comptables x
LEFT JOIN public.comptes_comptables c ON c.exercice_id = x.id
GROUP BY x.id, x.code
HAVING coalesce(sum(c.solde_ouverture_debit), 0) <> coalesce(sum(c.solde_ouverture_credit), 0)
ORDER BY x.code;
