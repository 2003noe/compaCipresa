-- Analytics d'utilisation par entreprise pour ses administrateurs.
-- Le flux ne stocke que les vues de pages, sans IP, email, contenu de page
-- ni données comptables.
BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entreprise_id uuid NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL DEFAULT 'page_view' CHECK (event_type = 'page_view'),
  page_path text NOT NULL CHECK (length(page_path) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_company_created_idx
  ON public.activity_events (entreprise_id, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_events_member_insert ON public.activity_events;
CREATE POLICY activity_events_member_insert
  ON public.activity_events FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_entreprise_member(entreprise_id)
  );

DROP POLICY IF EXISTS activity_events_admin_read ON public.activity_events;
CREATE POLICY activity_events_admin_read
  ON public.activity_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.entreprise_utilisateurs eu
      JOIN public.roles r ON r.id = eu.role_id
      WHERE eu.user_id = auth.uid()
        AND eu.entreprise_id = activity_events.entreprise_id
        AND r.code = 'ADMIN'
    )
  );

REVOKE ALL ON public.activity_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.activity_events_id_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_company_analytics()
RETURNS TABLE (
  entreprise_id uuid,
  entreprise_nom text,
  utilisateurs bigint,
  utilisateurs_actifs bigint,
  roles jsonb
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
    WHERE eu.user_id = auth.uid()
      AND r.code = 'ADMIN'
  ),
  user_totals AS (
    SELECT eu.entreprise_id,
           count(DISTINCT eu.user_id)::bigint AS users,
           count(DISTINCT eu.user_id) FILTER (WHERE p.actif)::bigint AS active_users
    FROM public.entreprise_utilisateurs eu
    JOIN public.profiles p ON p.id = eu.user_id
    GROUP BY eu.entreprise_id
  ),
  role_totals AS (
    SELECT rc.entreprise_id,
           jsonb_agg(jsonb_build_object('code', r.code, 'nom', r.nom, 'utilisateurs', rc.users)
                     ORDER BY r.nom) AS role_counts
    FROM (
      SELECT entreprise_id, role_id, count(DISTINCT user_id)::bigint AS users
      FROM public.entreprise_utilisateurs
      GROUP BY entreprise_id, role_id
    ) rc
    JOIN public.roles r ON r.id = rc.role_id
    GROUP BY rc.entreprise_id
  )
  SELECT e.id, e.nom,
         coalesce(ut.users, 0),
         coalesce(ut.active_users, 0),
         coalesce(rt.role_counts, '[]'::jsonb)
  FROM admin_companies ac
  JOIN public.entreprises e ON e.id = ac.entreprise_id
  LEFT JOIN user_totals ut ON ut.entreprise_id = e.id
  LEFT JOIN role_totals rt ON rt.entreprise_id = e.id
  ORDER BY e.nom;
$function$;

CREATE OR REPLACE FUNCTION public.admin_company_activity(p_limit integer DEFAULT 80)
RETURNS TABLE (
  id bigint,
  entreprise_id uuid,
  entreprise_nom text,
  utilisateur text,
  page_path text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ev.id, ev.entreprise_id, e.nom,
         coalesce(nullif(trim(concat_ws(' ', p.prenom, p.nom)), ''), 'Utilisateur'),
         ev.page_path, ev.created_at
  FROM public.activity_events ev
  JOIN public.entreprises e ON e.id = ev.entreprise_id
  LEFT JOIN public.profiles p ON p.id = ev.user_id
  WHERE EXISTS (
    SELECT 1
    FROM public.entreprise_utilisateurs eu
    JOIN public.roles r ON r.id = eu.role_id
    WHERE eu.user_id = auth.uid()
      AND eu.entreprise_id = ev.entreprise_id
      AND r.code = 'ADMIN'
  )
  ORDER BY ev.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 80), 200));
$function$;

REVOKE ALL ON FUNCTION public.admin_company_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_company_analytics() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_company_activity(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_company_activity(integer) TO authenticated;

-- Active le flux Realtime si la publication Supabase standard est disponible.
DO $publication$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'activity_events'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
END;
$publication$;

NOTIFY pgrst, 'reload schema';
COMMIT;
