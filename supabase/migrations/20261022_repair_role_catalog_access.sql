-- Corrige les connexions où une adhésion existe mais où son rôle n'est pas
-- visible dans le catalogue roles. Restaure aussi les rôles historiques dans
-- l'entreprise explicitement active du profil et ADMIN pour chaque propriétaire.
BEGIN;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DO $policies$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'roles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.roles', v_policy.policyname);
  END LOOP;
END;
$policies$;
CREATE POLICY roles_authenticated_read
  ON public.roles FOR SELECT TO authenticated
  USING (true);
GRANT SELECT ON public.roles TO authenticated;

-- Les propriétaires d'entreprise sont administrateurs de leur entreprise.
INSERT INTO public.entreprise_utilisateurs (entreprise_id, user_id, role_id)
SELECT e.id, e.owner_id, r.id
FROM public.entreprises e
JOIN public.roles r ON r.code = 'ADMIN'
WHERE e.owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Avant le cloisonnement, les rôles étaient globaux dans user_roles. Pour les
-- utilisateurs qui ont encore ces associations, les rattacher seulement à leur
-- entreprise active explicitement enregistrée dans profiles.
INSERT INTO public.entreprise_utilisateurs (entreprise_id, user_id, role_id)
SELECT p.active_entreprise_id, ur.user_id, ur.role_id
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN public.entreprises e ON e.id = p.active_entreprise_id
WHERE p.active_entreprise_id IS NOT NULL
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Diagnostic après correction : retrouvez votre ligne par l'adresse e-mail.
SELECT
  u.email,
  p.id AS utilisateur_id,
  p.active_entreprise_id AS entreprise_active_id,
  e.nom AS entreprise_active,
  count(DISTINCT eu.role_id) AS nombre_de_roles,
  string_agg(DISTINCT r.code, ', ' ORDER BY r.code) AS roles
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
LEFT JOIN public.entreprises e ON e.id = p.active_entreprise_id
LEFT JOIN public.entreprise_utilisateurs eu
  ON eu.user_id = p.id AND eu.entreprise_id = p.active_entreprise_id
LEFT JOIN public.roles r ON r.id = eu.role_id
GROUP BY u.email, p.id, p.active_entreprise_id, e.nom
ORDER BY u.email;
