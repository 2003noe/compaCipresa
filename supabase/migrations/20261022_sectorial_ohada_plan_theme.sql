-- Migration: 20261022_sectorial_ohada_plan_theme.sql
-- Ajout des colonnes de thème et détail au plan référentiel default_compt
-- et insertion/mise à jour des comptes sectoriels agricoles (SYSCOHADA).

ALTER TABLE public.default_compt
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS details text;

-- Insertion des comptes sectoriels agricoles selon le document de référence
INSERT INTO public.default_compt (num_compte, libelle, classe, categorie, theme, details)
VALUES
  -- CLASSE 1 : RESSOURCES DURABLES
  ('1011', 'Capital social', 1, 'Capitaux', 'CLASSE 1 : RESSOURCES DURABLES', 'souscrire non appelé, souscrit appelé non versé, souscrit appelé versé non amorti'),
  ('111', 'Réserve', 1, 'Capitaux', 'CLASSE 1 : RESSOURCES DURABLES', 'légale statutaire, facultative'),
  ('121', 'Report à nouveau', 1, 'Capitaux', 'CLASSE 1 : RESSOURCES DURABLES', 'créditeur: Bénéfices antérieurs, débiteur: perte antérieure'),
  ('131', 'Résultat de l''exercice', 1, 'Capitaux', 'CLASSE 1 : RESSOURCES DURABLES', 'Bénéfice, perte'),
  ('161', 'Emprunt', 1, 'Dettes', 'CLASSE 1 : RESSOURCES DURABLES', NULL),
  ('162', 'Dette', 1, 'Dettes', 'CLASSE 1 : RESSOURCES DURABLES', 'Dette fournisseur, dette salariale'),

  -- CLASSE 2 : ACTIF IMMOBILISÉ
  ('211', 'Immobilisation incorporelle', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', 'Droit de bail, brevet, licence, logiciel, marque'),
  ('221', 'Terrain agricole', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('231', 'Bâtiment et autre installation', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('241', 'Matériel agricole', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('242', 'Matériel informatique', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('243', 'Mobilier de bureau', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('244', 'Matériel de transport', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),
  ('245', 'Actif biologique', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', 'Pied mère'),
  ('246', 'Matériel et outillage agricole en-cours', 2, 'Immobilisations', 'CLASSE 2 : ACTIF IMMOBILISÉ', NULL),

  -- CLASSE 3 : STOCKS ET EN-COURS
  ('311', 'Matières premières', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', 'Semences, graines, sachets'),
  ('312', 'Équipement d''irrigation', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),
  ('313', 'Matériel agricole', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),
  ('341', 'Produit en-cours', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),
  ('351', 'Prestation de services', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),
  ('361', 'Produit fini', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),
  ('381', 'Marchandise importée en-cours de route', 3, 'Stocks', 'CLASSE 3 : STOCKS ET EN-COURS', NULL),

  -- CLASSES 4 & 5 : TIERS ET TRÉSORERIE
  ('401', 'Fournisseur', 4, 'Tiers', 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE', NULL),
  ('411', 'Client', 4, 'Tiers', 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE', NULL),
  ('521', 'Banque', 5, 'Trésorerie', 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE', NULL),
  ('552', 'Autre compte', 5, 'Trésorerie', 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE', NULL),
  ('571', 'Caisse', 5, 'Trésorerie', 'CLASSES 4 & 5 : TIERS ET TRÉSORERIE', NULL),

  -- CLASSE 6 : CHARGES D'EXPLOITATION
  ('601', 'Achat des semences', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('602', 'Achat du matériel d''irrigation', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('603', 'Achat du matériel agricole', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('604', 'Transport, carburant et huile', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('605', 'Alimentation', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('622', 'Location, eau et électricité', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('626', 'Maintenance informatique et logiciels', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('628', 'Internet et autre télécommunication', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('641', 'Patente, licence, taxe', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('661', 'Salaires et sous-traitance', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),
  ('662', 'Mission et autre', 6, 'Charges', 'CLASSE 6 : CHARGES D''EXPLOITATION', NULL),

  -- CLASSE 7 : PRODUITS D'EXPLOITATION
  ('701', 'Vente des plants', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL),
  ('703', 'Vente du matériel agricole', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL),
  ('704', 'Vente du matériel d''irrigation', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL),
  ('705', 'Prestation de service', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL),
  ('706', 'Transport et livraisons facturés', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL),
  ('754', 'Autre produit, formation', 7, 'Produits', 'CLASSE 7 : PRODUITS D''EXPLOITATION', NULL)
ON CONFLICT (id) DO NOTHING;

-- RLS: Permettre la lecture publique / authentifiée sur default_compt
ALTER TABLE public.default_compt ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'default_compt' AND policyname = 'default_compt_public_read'
  ) THEN
    CREATE POLICY default_compt_public_read ON public.default_compt
      FOR SELECT TO public USING (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
