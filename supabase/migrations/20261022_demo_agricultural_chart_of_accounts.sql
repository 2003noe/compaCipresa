-- Jeu de demonstration du plan comptable sectoriel agricole fourni par CIPRESA.
-- Cible volontairement les 3 entreprises deja presentes au moment de l'execution
-- et copie les comptes dans TOUS leurs exercices ouverts. Le referentiel OHADA
-- est partage; les comptes de travail restent isoles par entreprise/exercice.
-- Idempotent: les comptes deja presents ne sont jamais ecrases.
BEGIN;

DO $check$
DECLARE
  v_company_count integer;
BEGIN
  SELECT count(*) INTO v_company_count FROM public.entreprises;
  IF v_company_count <> 3 THEN
    RAISE EXCEPTION 'Migration de demonstration interrompue : 3 entreprises etaient attendues, % trouvee(s). Verifiez les entreprises ciblees avant de continuer.', v_company_count;
  END IF;
END;
$check$;

ALTER TABLE public.default_compt ADD COLUMN IF NOT EXISTS notes text;

CREATE TEMP TABLE demo_plan_seed (
  numero text PRIMARY KEY,
  libelle text NOT NULL,
  classe text NOT NULL,
  categorie text NOT NULL,
  notes text
) ON COMMIT DROP;

INSERT INTO demo_plan_seed (numero, libelle, classe, categorie, notes) VALUES
  ('1011','Capital social','Classe 1 - Ressources durables','PASSIF','Souscrit non appelé, souscrit appelé non versé, souscrit appelé versé non amorti.'),
  ('111','Réserve','Classe 1 - Ressources durables','PASSIF','Légale, statutaire ou facultative.'),
  ('121','Report à nouveau','Classe 1 - Ressources durables','PASSIF','Créditeur : bénéfices antérieurs ; débiteur : perte antérieure.'),
  ('131','Résultat de l’exercice','Classe 1 - Ressources durables','PASSIF','Bénéfice ou perte.'),
  ('161','Emprunt','Classe 1 - Ressources durables','PASSIF',NULL),
  ('162','Dette','Classe 1 - Ressources durables','PASSIF','Dette fournisseur ou dette salariale.'),
  ('211','Immobilisation incorporelle','Classe 2 - Immobilisations','ACTIF','Droit de bail, brevet, licence, logiciel ou marque.'),
  ('221','Terrain agricole','Classe 2 - Immobilisations','ACTIF',NULL),
  ('231','Bâtiment et autre installation','Classe 2 - Immobilisations','ACTIF',NULL),
  ('241','Matériel agricole','Classe 2 - Immobilisations','ACTIF',NULL),
  ('242','Matériel informatique','Classe 2 - Immobilisations','ACTIF',NULL),
  ('243','Mobilier de bureau','Classe 2 - Immobilisations','ACTIF',NULL),
  ('244','Matériel de transport','Classe 2 - Immobilisations','ACTIF',NULL),
  ('245','Actif biologique','Classe 2 - Immobilisations','ACTIF','Pied mère.'),
  ('246','Matériel et outillage agricole en-cours','Classe 2 - Immobilisations','ACTIF',NULL),
  ('311','Matières premières','Classe 3 - Stocks','ACTIF','Semences, graines, sachets.'),
  ('312','Équipement d’irrigation','Classe 3 - Stocks','ACTIF',NULL),
  ('313','Matériel agricole','Classe 3 - Stocks','ACTIF',NULL),
  ('341','Produit en-cours','Classe 3 - Stocks','ACTIF',NULL),
  ('351','Prestation de services','Classe 3 - Stocks','ACTIF',NULL),
  ('361','Produit fini','Classe 3 - Stocks','ACTIF',NULL),
  ('381','Marchandise importée en-cours de route','Classe 3 - Stocks','ACTIF',NULL),
  ('401','Fournisseur','Classe 4 - Comptes de tiers','PASSIF',NULL),
  ('411','Client','Classe 4 - Comptes de tiers','ACTIF',NULL),
  ('521','Banque','Classe 5 - Trésorerie','TRESORERIE',NULL),
  ('552','Autre compte','Classe 5 - Trésorerie','TRESORERIE',NULL),
  ('571','Caisse','Classe 5 - Trésorerie','TRESORERIE',NULL),
  ('601','Achat des semences','Classe 6 - Charges','CHARGE',NULL),
  ('602','Achat du matériel d’irrigation','Classe 6 - Charges','CHARGE',NULL),
  ('603','Achat du matériel agricole','Classe 6 - Charges','CHARGE',NULL),
  ('604','Transport, carburant et huile','Classe 6 - Charges','CHARGE',NULL),
  ('605','Alimentation','Classe 6 - Charges','CHARGE',NULL),
  ('622','Location, eau et électricité','Classe 6 - Charges','CHARGE',NULL),
  ('626','Maintenance informatique et logiciels','Classe 6 - Charges','CHARGE',NULL),
  ('628','Internet et autre télécommunication','Classe 6 - Charges','CHARGE',NULL),
  ('641','Patente, licence, taxe','Classe 6 - Charges','CHARGE',NULL),
  ('661','Salaires et sous-traitance','Classe 6 - Charges','CHARGE',NULL),
  ('662','Mission et autre','Classe 6 - Charges','CHARGE',NULL),
  ('701','Vente des plants','Classe 7 - Produits','PRODUIT',NULL),
  ('703','Vente du matériel agricole','Classe 7 - Produits','PRODUIT',NULL),
  ('704','Vente du matériel d’irrigation','Classe 7 - Produits','PRODUIT',NULL),
  ('705','Prestation de service','Classe 7 - Produits','PRODUIT',NULL),
  ('706','Transport et livraisons facturés','Classe 7 - Produits','PRODUIT',NULL),
  ('754','Autre produit, formation','Classe 7 - Produits','PRODUIT',NULL);

-- Ajoute les modèles manquants sans altérer les entrées OHADA déjà présentes.
INSERT INTO public.default_compt (num_compte, libelle, classe, categorie, notes)
SELECT s.numero, s.libelle, regexp_replace(s.classe, '\D', '', 'g')::integer, s.categorie, s.notes
FROM demo_plan_seed s
WHERE NOT EXISTS (
  SELECT 1 FROM public.default_compt d WHERE regexp_replace(d.num_compte, '\s', '', 'g') = s.numero
);

-- Les triggers de rattachement actif sont conçus pour des requêtes utilisateur.
-- Cette migration d'administration fixe explicitement entreprise_id, donc seul
-- le trigger qui réécrit ce rattachement est suspendu pendant les INSERT.
ALTER TABLE public.comptes_comptables DISABLE TRIGGER stamp_entreprise_id;

INSERT INTO public.comptes_comptables (entreprise_id, exercice_id, numero, libelle, classe, nature, notes)

SELECT
  ent.id,
  ex.id,
  s.numero,
  s.libelle,
  s.classe,
  s.categorie::public.compte_nature,
  s.notes
FROM public.entreprises ent
JOIN public.exercices_comptables ex
  ON ex.entreprise_id = ent.id AND ex.statut::text = 'OUVERT'
CROSS JOIN demo_plan_seed s
WHERE NOT EXISTS (
  SELECT 1
  FROM public.comptes_comptables existing
  WHERE existing.entreprise_id = ent.id
    AND existing.exercice_id = ex.id
    AND existing.numero = s.numero
);

ALTER TABLE public.comptes_comptables ENABLE TRIGGER stamp_entreprise_id;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- Contrôle de résultat après exécution :
-- SELECT e.nom AS entreprise, x.code AS exercice, c.classe, count(*) AS comptes
-- FROM public.comptes_comptables c
-- JOIN public.entreprises e ON e.id = c.entreprise_id
-- JOIN public.exercices_comptables x ON x.id = c.exercice_id
-- WHERE x.statut::text = 'OUVERT'
-- GROUP BY e.nom, x.code, c.classe ORDER BY e.nom, x.code, c.classe;
