-- Company admin controls and explicit company selection for recruited users.
-- Run this migration in the Supabase SQL Editor before deploying the frontend.

create or replace function public.create_entreprise_for_current_user(p_nom text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_admin_role uuid;
  v_active_company uuid := public.current_entreprise_id();
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
  if length(trim(coalesce(p_nom, ''))) < 2 then
    raise exception 'Le nom doit contenir au moins 2 caractères.';
  end if;

  -- A new account without any company can create its first company during signup.
  -- Existing users may create another company only as ADMIN of their active company.
  if exists (select 1 from public.entreprise_utilisateurs eu where eu.user_id = auth.uid())
     and not exists (
       select 1
       from public.entreprise_utilisateurs eu
       join public.roles r on r.id = eu.role_id
       where eu.user_id = auth.uid()
         and eu.entreprise_id = v_active_company
         and r.code = 'ADMIN'
     ) then
    raise exception 'Seul l’administrateur de l’entreprise active peut créer une autre entreprise.';
  end if;

  select id into v_admin_role from public.roles where code = 'ADMIN' limit 1;
  if v_admin_role is null then raise exception 'Le rôle ADMIN doit exister.'; end if;

  insert into public.entreprises(nom, owner_id)
  values (trim(p_nom), auth.uid())
  returning id into v_company;

  insert into public.entreprise_utilisateurs(entreprise_id, user_id, role_id)
  values (v_company, auth.uid(), v_admin_role);

  update public.profiles
  set active_entreprise_id = v_company, updated_at = now()
  where id = auth.uid();

  insert into public.parametres_entreprise(entreprise_id, raison_sociale)
  values (v_company, trim(p_nom));

  return v_company;
end;
$$;

create or replace function public.add_user_to_company(
  p_email text,
  p_role_code text,
  p_entreprise_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
  v_role uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if p_entreprise_id is null then raise exception 'Choisissez une entreprise.'; end if;

  if not exists (
    select 1
    from public.entreprise_utilisateurs eu
    join public.roles r on r.id = eu.role_id
    where eu.user_id = auth.uid()
      and eu.entreprise_id = p_entreprise_id
      and r.code = 'ADMIN'
  ) then
    raise exception 'Vous devez être administrateur de l’entreprise sélectionnée.';
  end if;

  select id into v_user
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;
  if v_user is null then
    raise exception 'Aucun compte trouvé pour cet e-mail. La personne doit d’abord créer son compte.';
  end if;

  select id into v_role from public.roles where code = p_role_code limit 1;
  if v_role is null then raise exception 'Rôle inconnu.'; end if;

  insert into public.entreprise_utilisateurs(entreprise_id, user_id, role_id)
  values (p_entreprise_id, v_user, v_role)
  on conflict do nothing;

  -- A newly registered employee has no active company yet. Attach that profile
  -- to the recruited company so tenant RLS recognizes the membership at login.
  update public.profiles
  set active_entreprise_id = p_entreprise_id, updated_at = now()
  where id = v_user and active_entreprise_id is null;

  return v_user;
end;
$$;

create or replace function public.list_admin_company_memberships()
returns table (
  membre_id uuid,
  entreprise_id uuid,
  entreprise_nom text,
  role_id uuid,
  role_code text,
  role_nom text
)
language sql
stable
security definer
set search_path = public
as $$
  select eu.user_id, eu.entreprise_id, e.nom, r.id, r.code, r.nom
  from public.entreprise_utilisateurs eu
  join public.entreprises e on e.id = eu.entreprise_id
  join public.roles r on r.id = eu.role_id
  where exists (
    select 1
    from public.entreprise_utilisateurs admin_eu
    join public.roles admin_role on admin_role.id = admin_eu.role_id
    where admin_eu.user_id = auth.uid()
      and admin_eu.entreprise_id = eu.entreprise_id
      and admin_role.code = 'ADMIN'
  )
  order by e.nom, eu.user_id, r.nom;
$$;

create or replace function public.remove_user_company_role(
  p_user_id uuid,
  p_entreprise_id uuid,
  p_role_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if not exists (
    select 1
    from public.entreprise_utilisateurs eu
    join public.roles r on r.id = eu.role_id
    where eu.user_id = auth.uid()
      and eu.entreprise_id = p_entreprise_id
      and r.code = 'ADMIN'
  ) then
    raise exception 'Vous devez être administrateur de l’entreprise sélectionnée.';
  end if;

  delete from public.entreprise_utilisateurs
  where user_id = p_user_id
    and entreprise_id = p_entreprise_id
    and role_id = p_role_id;

  if not exists (
    select 1 from public.entreprise_utilisateurs
    where user_id = p_user_id and entreprise_id = p_entreprise_id
  ) then
    select entreprise_id into v_next_company
    from public.entreprise_utilisateurs
    where user_id = p_user_id
    order by created_at, entreprise_id
    limit 1;
    update public.profiles
    set active_entreprise_id = v_next_company, updated_at = now()
    where id = p_user_id and active_entreprise_id = p_entreprise_id;
  end if;
end;
$$;

create or replace function public.add_user_company_role(
  p_user_id uuid,
  p_entreprise_id uuid,
  p_role_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if not exists (
    select 1 from public.entreprise_utilisateurs eu
    join public.roles r on r.id = eu.role_id
    where eu.user_id = auth.uid()
      and eu.entreprise_id = p_entreprise_id
      and r.code = 'ADMIN'
  ) then
    raise exception 'Vous devez être administrateur de l’entreprise sélectionnée.';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profil utilisateur introuvable.';
  end if;
  select id into v_role from public.roles where code = p_role_code limit 1;
  if v_role is null then raise exception 'Rôle inconnu.'; end if;

  insert into public.entreprise_utilisateurs(entreprise_id, user_id, role_id)
  values (p_entreprise_id, p_user_id, v_role)
  on conflict do nothing;

  update public.profiles
  set active_entreprise_id = p_entreprise_id, updated_at = now()
  where id = p_user_id and active_entreprise_id is null;
end;
$$;

create or replace function public.remove_user_from_company(
  p_user_id uuid,
  p_entreprise_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_company uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise.'; end if;
  if not exists (
    select 1
    from public.entreprise_utilisateurs eu
    join public.roles r on r.id = eu.role_id
    where eu.user_id = auth.uid()
      and eu.entreprise_id = p_entreprise_id
      and r.code = 'ADMIN'
  ) then
    raise exception 'Vous devez être administrateur de l’entreprise sélectionnée.';
  end if;

  delete from public.entreprise_utilisateurs
  where user_id = p_user_id and entreprise_id = p_entreprise_id;

  select entreprise_id into v_next_company
  from public.entreprise_utilisateurs
  where user_id = p_user_id
  order by created_at, entreprise_id
  limit 1;

  update public.profiles
  set active_entreprise_id = v_next_company, updated_at = now()
  where id = p_user_id and active_entreprise_id = p_entreprise_id;
end;
$$;

-- Remove browser access to the old RPC that selected a company implicitly.
revoke all on function public.add_user_to_active_company(text, text) from public, anon, authenticated;
revoke all on function public.add_user_to_company(text, text, uuid) from public, anon, authenticated;
grant execute on function public.add_user_to_company(text, text, uuid) to authenticated;
revoke all on function public.list_admin_company_memberships() from public, anon, authenticated;
grant execute on function public.list_admin_company_memberships() to authenticated;
revoke all on function public.remove_user_company_role(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_user_company_role(uuid, uuid, uuid) to authenticated;
revoke all on function public.add_user_company_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.add_user_company_role(uuid, uuid, text) to authenticated;
revoke all on function public.remove_user_from_company(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_user_from_company(uuid, uuid) to authenticated;
revoke all on function public.create_entreprise_for_current_user(text) from public, anon, authenticated;
grant execute on function public.create_entreprise_for_current_user(text) to authenticated;

-- Make the new RPC signatures visible to PostgREST without waiting for its cache timer.
notify pgrst, 'reload schema';
