-- Migration: Création des tables pour le module de synchronisation des ventes externes
-- Date: 2026-10-16

-- 1. Table d'historique des synchronisations
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source VARCHAR(50) NOT NULL DEFAULT 'VENTES_API',
    statut VARCHAR(20) NOT NULL CHECK (statut IN ('EN_COURS', 'SUCCES', 'ERREUR', 'PARTIEL')),
    total_recupere INT DEFAULT 0,
    total_insere INT DEFAULT 0,
    total_mis_a_jour INT DEFAULT 0,
    message_erreur TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ
);

-- 2. Table des ventes externes synchronisées
CREATE TABLE IF NOT EXISTS public.ventes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100) UNIQUE NOT NULL,
    reference_facture VARCHAR(100),
    client_nom VARCHAR(255),
    client_identifiant VARCHAR(100),
    date_vente TIMESTAMPTZ NOT NULL,
    montant_ht NUMERIC(15, 2) NOT NULL DEFAULT 0,
    montant_tva NUMERIC(15, 2) NOT NULL DEFAULT 0,
    montant_ttc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    mode_reglement VARCHAR(50) DEFAULT 'ESPECES',
    statut_comptable VARCHAR(30) DEFAULT 'A_COMPTABILISER' 
        CHECK (statut_comptable IN ('A_COMPTABILISER', 'COMPTABILISE', 'IGNORE')),
    donnees_brutes JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes performantes
CREATE INDEX IF NOT EXISTS idx_ventes_date ON public.ventes(date_vente DESC);
CREATE INDEX IF NOT EXISTS idx_ventes_external_id ON public.ventes(external_id);
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON public.ventes(statut_comptable);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started ON public.sync_logs(started_at DESC);

-- Sécurité RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventes ENABLE ROW LEVEL SECURITY;

-- Politiques RLS (lecture et écriture pour les utilisateurs authentifiés)
DROP POLICY IF EXISTS sync_logs_all ON public.sync_logs;
CREATE POLICY sync_logs_all ON public.sync_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ventes_all ON public.ventes;
CREATE POLICY ventes_all ON public.ventes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Politiques pour anon en développement si requis
DROP POLICY IF EXISTS sync_logs_anon ON public.sync_logs;
CREATE POLICY sync_logs_anon ON public.sync_logs FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ventes_anon ON public.ventes;
CREATE POLICY ventes_anon ON public.ventes FOR ALL TO anon USING (true) WITH CHECK (true);
