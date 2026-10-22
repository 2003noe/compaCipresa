-- Journalise les actions métier en base, sans stocker les valeurs comptables.
-- Lecture et statistiques limitées aux entreprises administrées par l'appelant.
BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_company_created_idx
  ON public.audit_events (entreprise_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_admin_read ON public.audit_events;
CREATE POLICY audit_events_admin_read
  ON public.audit_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.entreprise_utilisateurs eu
      JOIN public.roles r ON r.id = eu.role_id
      WHERE eu.user_id = auth.uid()
        AND eu.entreprise_id = audit_events.entreprise_id
        AND r.code = 'ADMIN'
    )
  );

REVOKE ALL ON public.audit_events FROM anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_row jsonb;
  v_old jsonb;
  v_company uuid;
  v_record text;
  v_operation text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := v_row;
    v_operation := 'DELETE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    IF v_row IS NOT DISTINCT FROM v_old THEN
      RETURN NEW;
    END IF;
    v_operation := 'UPDATE';
  ELSE
    v_row := to_jsonb(NEW);
    v_operation := 'INSERT';
  END IF;

  v_company := nullif(v_row ->> 'entreprise_id', '')::uuid;
  IF v_company IS NULL THEN
    -- The legacy profile table has no tenant column. Resolve its company
    -- memberships rather than recording an unscoped event.
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  v_record := coalesce(v_row ->> 'id', v_row ->> 'user_id', v_row ->> 'ecriture_id');
  INSERT INTO public.audit_events (entreprise_id, actor_id, table_name, operation, record_id)
  VALUES (v_company, auth.uid(), TG_TABLE_NAME, v_operation, v_record);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

DO $triggers$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'comptes_comptables', 'journaux', 'ecritures_comptables', 'lignes_ecritures',
    'pieces_comptables', 'immobilisations', 'clotures_comptables', 'controles_cloture',
    'declarations_tva', 'lignes_releve_bancaire', 'parametres_entreprise',
    'entreprise_utilisateurs'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = v_table AND column_name = 'entreprise_id'
       ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_event_capture ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER audit_event_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_audit_event()',
        v_table
      );
    END IF;
  END LOOP;
END;
$triggers$;

-- profiles n'a pas de entreprise_id : journaliser seulement l'activation ou
-- la désactivation, une fois par entreprise à laquelle la personne appartient.
CREATE OR REPLACE FUNCTION public.capture_profile_status_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF OLD.actif IS DISTINCT FROM NEW.actif THEN
    INSERT INTO public.audit_events (entreprise_id, actor_id, table_name, operation, record_id)
    SELECT eu.entreprise_id, auth.uid(), 'profiles', 'UPDATE', NEW.id::text
    FROM public.entreprise_utilisateurs eu
    WHERE eu.user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS audit_profile_status_capture ON public.profiles;
CREATE TRIGGER audit_profile_status_capture
AFTER UPDATE OF actif ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.capture_profile_status_audit_event();

CREATE OR REPLACE FUNCTION public.admin_company_event_feed(p_limit integer DEFAULT 100)
RETURNS TABLE (
  event_id text,
  entreprise_id uuid,
  entreprise_nom text,
  utilisateur text,
  categorie text,
  libelle text,
  detail text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH admin_companies AS (
    SELECT DISTINCT eu.entreprise_id
    FROM public.entreprise_utilisateurs eu
    JOIN public.roles r ON r.id = eu.role_id
    WHERE eu.user_id = auth.uid() AND r.code = 'ADMIN'
  ),
  events AS (
    SELECT ('view-' || v.id::text) AS event_id, v.entreprise_id, v.user_id,
           'VISITE'::text AS categorie, 'Page consultée'::text AS libelle,
           v.page_path AS detail, v.created_at
    FROM public.activity_events v
    JOIN admin_companies ac ON ac.entreprise_id = v.entreprise_id
    UNION ALL
    SELECT ('audit-' || a.id::text), a.entreprise_id, a.actor_id,
           CASE WHEN a.table_name = 'entreprise_utilisateurs' THEN 'ACCÈS' ELSE 'COMPTABILITÉ' END,
           CASE a.table_name
             WHEN 'comptes_comptables' THEN 'Compte'
             WHEN 'journaux' THEN 'Journal'
             WHEN 'ecritures_comptables' THEN 'Écriture'
             WHEN 'lignes_ecritures' THEN 'Ligne d’écriture'
             WHEN 'immobilisations' THEN 'Immobilisation'
             WHEN 'clotures_comptables' THEN 'Clôture'
             WHEN 'controles_cloture' THEN 'Contrôle de clôture'
             WHEN 'pieces_comptables' THEN 'Pièce justificative'
             WHEN 'declarations_tva' THEN 'Déclaration TVA'
             WHEN 'lignes_releve_bancaire' THEN 'Ligne de relevé bancaire'
             WHEN 'parametres_entreprise' THEN 'Paramètre entreprise'
             WHEN 'entreprise_utilisateurs' THEN 'Association utilisateur'
             WHEN 'profiles' THEN 'Compte utilisateur'
             ELSE 'Action'
           END || CASE a.operation
             WHEN 'INSERT' THEN ' créée'
             WHEN 'UPDATE' THEN ' modifiée'
             WHEN 'DELETE' THEN ' supprimée'
             ELSE ' mise à jour'
           END,
           NULL::text, a.created_at
    FROM public.audit_events a
    JOIN admin_companies ac ON ac.entreprise_id = a.entreprise_id
  )
  SELECT ev.event_id, ev.entreprise_id, e.nom,
         coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), 'Utilisateur'),
         ev.categorie, ev.libelle, ev.detail, ev.created_at
  FROM events ev
  JOIN public.entreprises e ON e.id = ev.entreprise_id
  LEFT JOIN public.profiles p ON p.id = ev.user_id
  ORDER BY ev.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 100), 300));
$function$;

CREATE OR REPLACE FUNCTION public.admin_company_event_stats(p_days integer DEFAULT 14)
RETURNS TABLE (jour date, visites bigint, actions bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH admin_companies AS (
    SELECT DISTINCT eu.entreprise_id
    FROM public.entreprise_utilisateurs eu
    JOIN public.roles r ON r.id = eu.role_id
    WHERE eu.user_id = auth.uid() AND r.code = 'ADMIN'
  ),
  days AS (
    SELECT generate_series(
      current_date - (greatest(1, least(coalesce(p_days, 14), 90)) - 1),
      current_date,
      interval '1 day'
    )::date AS jour
  ),
  counts AS (
    SELECT v.created_at::date AS jour, count(*)::bigint AS visites, 0::bigint AS actions
    FROM public.activity_events v
    JOIN admin_companies ac ON ac.entreprise_id = v.entreprise_id
    WHERE v.created_at >= current_date - (greatest(1, least(coalesce(p_days, 14), 90)) - 1)
    GROUP BY v.created_at::date
    UNION ALL
    SELECT a.created_at::date, 0::bigint, count(*)::bigint
    FROM public.audit_events a
    JOIN admin_companies ac ON ac.entreprise_id = a.entreprise_id
    WHERE a.created_at >= current_date - (greatest(1, least(coalesce(p_days, 14), 90)) - 1)
    GROUP BY a.created_at::date
  ),
  totals AS (
    SELECT jour, sum(visites)::bigint AS visites, sum(actions)::bigint AS actions
    FROM counts GROUP BY jour
  )
  SELECT d.jour, coalesce(t.visites, 0), coalesce(t.actions, 0)
  FROM days d
  LEFT JOIN totals t USING (jour)
  ORDER BY d.jour;
$function$;

REVOKE ALL ON FUNCTION public.admin_company_event_feed(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_company_event_feed(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_company_event_stats(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_company_event_stats(integer) TO authenticated;

DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'audit_events'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_events;
  END IF;
END;
$publication$;

NOTIFY pgrst, 'reload schema';
COMMIT;
