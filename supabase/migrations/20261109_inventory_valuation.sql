-- Extensible sans réécrire les lignes physiques existantes ni les écritures comptables.
BEGIN;

ALTER TABLE public.inventaire_physique
  ADD COLUMN IF NOT EXISTS unite text,
  ADD COLUMN IF NOT EXISTS quantite_theorique numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantite_reelle numeric(14,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cout_unitaire numeric(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valeur_comptable numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ecart_quantite numeric(14,3)
    GENERATED ALWAYS AS (quantite_reelle - quantite_theorique) STORED,
  ADD COLUMN IF NOT EXISTS valeur_constatee numeric(18,2)
    GENERATED ALWAYS AS (round(quantite_reelle * cout_unitaire, 2)) STORED,
  ADD COLUMN IF NOT EXISTS ecart_valeur numeric(18,2)
    GENERATED ALWAYS AS (round(quantite_reelle * cout_unitaire, 2) - valeur_comptable) STORED;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventaire_physique_quantites_nonnegatives') THEN
    ALTER TABLE public.inventaire_physique ADD CONSTRAINT inventaire_physique_quantites_nonnegatives
      CHECK (quantite_theorique >= 0 AND quantite_reelle >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventaire_physique_valeurs_nonnegatives') THEN
    ALTER TABLE public.inventaire_physique ADD CONSTRAINT inventaire_physique_valeurs_nonnegatives
      CHECK (cout_unitaire >= 0 AND valeur_comptable >= 0) NOT VALID;
  END IF;
END;
$constraints$;

ALTER TABLE public.inventaire_physique VALIDATE CONSTRAINT inventaire_physique_quantites_nonnegatives;
ALTER TABLE public.inventaire_physique VALIDATE CONSTRAINT inventaire_physique_valeurs_nonnegatives;

DROP POLICY IF EXISTS rbac_physical_read ON public.inventaire_physique;
CREATE POLICY rbac_physical_read ON public.inventaire_physique FOR SELECT TO authenticated
USING (
  entreprise_id = public.current_entreprise_id()
  AND (
    public.has_active_entreprise_permission('STOCK_INVENTORY')
    OR public.has_active_entreprise_permission('COMPTA_READ')
  )
);

GRANT SELECT, INSERT, UPDATE ON public.inventaire_physique TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
