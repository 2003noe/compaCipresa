```sql
-- Schema for required tables

CREATE TABLE public.profiles (id uuid NOT NULL,
  nom text,
  prenom text,
  telephone text,
  photo_url text,
  adresse text,
  ville text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  notifications_enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.roles (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.permissions (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nom text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (user_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id)
);

CREATE TABLE public.role_permissions (role_id uuid NOT NULL,
  permission_id uuid NOT NULL,
  CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
  CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id)
);

CREATE TABLE public.exercices_comptables (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  annee integer NOT NULL UNIQUE,
  date_debut date NOT NULL,
  date_fin date NOT NULL,
  statut USER-DEFINED NOT NULL DEFAULT 'OUVERT'::exercice_statut,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT exercices_comptables_pkey PRIMARY KEY (id)
);

CREATE TABLE public.journaux (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  type USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT journaux_pkey PRIMARY KEY (id)
);

CREATE TABLE public.comptes_comptables (id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  libelle text NOT NULL,
  classe text NOT NULL,
  nature USER-DEFINED NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  compte_parent_id uuid,
  devise text NOT NULL DEFAULT 'XAF'::text,
  lettrable boolean NOT NULL DEFAULT false,
  reconciliable boolean NOT NULL DEFAULT false,
  notes text,
  solde_ouverture_debit numeric NOT NULL DEFAULT 0,
  solde_ouverture_credit numeric NOT NULL DEFAULT 0,
  CONSTRAINT comptes_comptables_pkey PRIMARY KEY (id),
  CONSTRAINT comptes_comptables_compte_parent_id_fkey FOREIGN KEY (compte_parent_id) REFERENCES public.comptes_comptables(id)
);

CREATE TABLE public.ecritures_comptables (id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  exercice_id uuid NOT NULL,
  journal_id uuid NOT NULL,
  date_ecriture date NOT NULL DEFAULT CURRENT_DATE,
  libelle text NOT NULL,
  reference_piece text,
  statut USER-DEFINED NOT NULL DEFAULT 'BROUILLON'::ecriture_statut,
  created_by uuid,
  validated_by uuid,
  validated_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ecritures_comptables_pkey PRIMARY KEY (id),
  CONSTRAINT ecritures_comptables_exercice_id_fkey FOREIGN KEY (exercice_id) REFERENCES public.exercices_comptables(id),
  CONSTRAINT ecritures_comptables_journal_id_fkey FOREIGN KEY (journal_id) REFERENCES public.journaux(id),
  CONSTRAINT ecritures_comptables_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT ecritures_comptables_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.lignes_ecritures (id uuid NOT NULL DEFAULT gen_random_uuid(),
  ecriture_id uuid NOT NULL,
  compte_id uuid NOT NULL,
  libelle text,
  debit numeric NOT NULL DEFAULT 0 CHECK (debit >= 0::numeric),
  credit numeric NOT NULL DEFAULT 0 CHECK (credit >= 0::numeric),
  CONSTRAINT lignes_ecritures_pkey PRIMARY KEY (id),
  CONSTRAINT lignes_ecritures_ecriture_id_fkey FOREIGN KEY (ecriture_id) REFERENCES public.ecritures_comptables(id),
  CONSTRAINT lignes_ecritures_compte_id_fkey FOREIGN KEY (compte_id) REFERENCES public.comptes_comptables(id)
);

CREATE TABLE public.pieces_comptables (id uuid NOT NULL DEFAULT gen_random_uuid(),
  ecriture_id uuid NOT NULL,
  type text NOT NULL,
  reference text,
  fichier_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pieces_comptables_pkey PRIMARY KEY (id),
  CONSTRAINT pieces_comptables_ecriture_id_fkey FOREIGN KEY (ecriture_id) REFERENCES public.ecritures_comptables(id)
);

CREATE TABLE public.notifications (id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  titre text NOT NULL,
  message text NOT NULL,
  lu boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.immobilisations (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  designation text NOT NULL,
  categorie text NOT NULL,
  date_acquisition date NOT NULL,
  valeur_brute numeric NOT NULL CHECK (valeur_brute >= 0::numeric),
  duree_annees numeric CHECK (duree_annees > 0::numeric),
  statut text NOT NULL DEFAULT 'EN_SERVICE'::text CHECK (statut = ANY (ARRAY['EN_SERVICE'::text, 'SORTIE'::text, 'A_AMORTIR'::text])),
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  compte_id uuid,
  methode USER-DEFINED NOT NULL DEFAULT 'LINEAIRE'::immobilisation_methode,
  notes text,
  CONSTRAINT immobilisations_pkey PRIMARY KEY (id),
  CONSTRAINT immobilisations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT immobilisations_compte_id_fkey FOREIGN KEY (compte_id) REFERENCES public.comptes_comptables(id)
);

CREATE TABLE public.clotures_comptables (id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL,
  periode text NOT NULL,
  balance_validee boolean NOT NULL DEFAULT false,
  rapprochement_valide boolean NOT NULL DEFAULT false,
  fiscalite_verifiee boolean NOT NULL DEFAULT false,
  statut text NOT NULL DEFAULT 'OUVERTE'::text CHECK (statut = ANY (ARRAY['OUVERTE'::text, 'CONTROLES_EN_COURS'::text, 'PRE_CLOTURE'::text, 'CLOTUREE'::text])),
  responsable uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  periode_debut date,
  periode_fin date,
  cloturee_par uuid,
  cloturee_le timestamp with time zone,
  CONSTRAINT clotures_comptables_pkey PRIMARY KEY (id),
  CONSTRAINT clotures_comptables_exercice_id_fkey FOREIGN KEY (exercice_id) REFERENCES public.exercices_comptables(id),
  CONSTRAINT clotures_comptables_responsable_fkey FOREIGN KEY (responsable) REFERENCES public.profiles(id),
  CONSTRAINT clotures_comptables_cloturee_par_fkey FOREIGN KEY (cloturee_par) REFERENCES public.profiles(id)
);

CREATE TABLE public.lignes_releve_bancaire (id uuid NOT NULL DEFAULT gen_random_uuid(),
  compte_id uuid NOT NULL,
  date_operation date NOT NULL,
  libelle text NOT NULL,
  debit numeric NOT NULL DEFAULT 0,
  credit numeric NOT NULL DEFAULT 0,
  rapproche boolean NOT NULL DEFAULT false,
  valide boolean NOT NULL DEFAULT false,
  ligne_ecriture_id uuid,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT lignes_releve_bancaire_pkey PRIMARY KEY (id),
  CONSTRAINT lignes_releve_bancaire_compte_id_fkey FOREIGN KEY (compte_id) REFERENCES public.comptes_comptables(id),
  CONSTRAINT lignes_releve_bancaire_ligne_ecriture_id_fkey FOREIGN KEY (ligne_ecriture_id) REFERENCES public.lignes_ecritures(id),
  CONSTRAINT lignes_releve_bancaire_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.declarations_tva (id uuid NOT NULL DEFAULT gen_random_uuid(),
  exercice_id uuid NOT NULL,
  periodicite text NOT NULL CHECK (periodicite = ANY (ARRAY['MENSUELLE'::text, 'TRIMESTRIELLE'::text])),
  periode_debut date NOT NULL,
  periode_fin date NOT NULL,
  periode_libelle text NOT NULL,
  compte_tva_collectee_id uuid,
  compte_tva_deductible_id uuid,
  base_imposable numeric NOT NULL DEFAULT 0 CHECK (base_imposable >= 0::numeric),
  tva_collectee numeric NOT NULL DEFAULT 0 CHECK (tva_collectee >= 0::numeric),
  tva_deductible numeric NOT NULL DEFAULT 0 CHECK (tva_deductible >= 0::numeric),
  tva_nette numeric DEFAULT (tva_collectee - tva_deductible),
  statut text NOT NULL DEFAULT 'BROUILLON'::text CHECK (statut = ANY (ARRAY['BROUILLON'::text, 'EN_ATTENTE'::text, 'DECLAREE'::text, 'PAYEE'::text])),
  date_echeance date,
  date_declaration date,
  date_paiement date,
  reference_declaration text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT declarations_tva_pkey PRIMARY KEY (id),
  CONSTRAINT declarations_tva_exercice_id_fkey FOREIGN KEY (exercice_id) REFERENCES public.exercices_comptables(id),
  CONSTRAINT declarations_tva_compte_tva_collectee_id_fkey FOREIGN KEY (compte_tva_collectee_id) REFERENCES public.comptes_comptables(id),
  CONSTRAINT declarations_tva_compte_tva_deductible_id_fkey FOREIGN KEY (compte_tva_deductible_id) REFERENCES public.comptes_comptables(id),
  CONSTRAINT declarations_tva_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.regles_echeances_fiscales (id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  description text,
  categorie text NOT NULL DEFAULT 'TVA'::text CHECK (categorie = ANY (ARRAY['TVA'::text, 'AUTRE'::text])),
  decalage_jours integer,
  mois_fixe integer CHECK (mois_fixe >= 1 AND mois_fixe <= 12),
  jour_fixe integer CHECK (jour_fixe >= 1 AND jour_fixe <= 28),
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT regles_echeances_fiscales_pkey PRIMARY KEY (id)
);

CREATE TABLE public.referentiel_controles_cloture (id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero integer NOT NULL UNIQUE,
  controle text NOT NULL,
  frequence text,
  responsable_type text,
  justificatif_attendu text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT referentiel_controles_cloture_pkey PRIMARY KEY (id)
);

CREATE TABLE public.controles_cloture (id uuid NOT NULL DEFAULT gen_random_uuid(),
  cloture_id uuid NOT NULL,
  controle_id uuid NOT NULL,
  statut text NOT NULL DEFAULT 'A_FAIRE'::text CHECK (statut = ANY (ARRAY['A_FAIRE'::text, 'FAIT'::text, 'NON_APPLICABLE'::text])),
  commentaire text,
  justificatif_ref text,
  verifie_par uuid,
  verifie_le timestamp with time zone,
  CONSTRAINT controles_cloture_pkey PRIMARY KEY (id),
  CONSTRAINT controles_cloture_controle_id_fkey FOREIGN KEY (controle_id) REFERENCES public.referentiel_controles_cloture(id),
  CONSTRAINT controles_cloture_verifie_par_fkey FOREIGN KEY (verifie_par) REFERENCES public.profiles(id),
  CONSTRAINT controles_cloture_cloture_id_fkey FOREIGN KEY (cloture_id) REFERENCES public.clotures_comptables(id)
);

CREATE TABLE public.parametres_entreprise (id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid),
  raison_sociale text,
  forme_juridique text,
  numero_rccm text,
  numero_cc text,
  regime_fiscal text,
  secteur_activite text,
  adresse_postale text,
  telephone text,
  email_contact text,
  plan_comptable_referentiel text DEFAULT 'OHADA révisé'::text,
  devise text DEFAULT 'FCFA - Franc CFA BCEAO'::text,
  tva_defaut_taux numeric,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT parametres_entreprise_pkey PRIMARY KEY (id),
  CONSTRAINT parametres_entreprise_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);
```
