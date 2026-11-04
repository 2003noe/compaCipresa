-- Return the already registered users who do not yet have any role in a
-- company managed by the current administrator. Email addresses stay behind
-- this company-scoped, administrator-only RPC instead of being read directly
-- from auth.users by the frontend.
begin;

create or replace function public.list_unassigned_company_users(p_entreprise_id uuid)
returns table (
  user_id uuid,
  email text,
  prenom text,
  nom text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;

  if p_entreprise_id is null or not exists (
    select 1
    from public.entreprise_utilisateurs eu
    join public.roles r on r.id = eu.role_id
    where eu.user_id = auth.uid()
      and eu.entreprise_id = p_entreprise_id
      and r.code = 'ADMIN'
  ) then
    raise exception 'Vous devez être administrateur de l’entreprise sélectionnée.';
  end if;

  return query
  select u.id, u.email::text, p.prenom::text, p.nom::text
  from auth.users u
  join public.profiles p on p.id = u.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(p.actif, false)
    and not exists (
      select 1 from public.entreprise_utilisateurs eu
      where eu.entreprise_id = p_entreprise_id and eu.user_id = u.id
    )
  order by lower(u.email);
end;
$$;

revoke all on function public.list_unassigned_company_users(uuid) from public, anon;
grant execute on function public.list_unassigned_company_users(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
