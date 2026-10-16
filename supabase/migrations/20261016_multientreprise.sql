-- Sauvegarder la base avant execution. Les données actuelles sont rattachees a
-- une entreprise historique creee a partir de parametres_entreprise.
begin;
create table if not exists public.entreprises(id uuid primary key default gen_random_uuid(),nom text not null check(length(trim(nom))>0),owner_id uuid references auth.users(id),actif boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.entreprise_utilisateurs(entreprise_id uuid not null references public.entreprises(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,role_id uuid not null references public.roles(id),created_at timestamptz not null default now(),primary key(entreprise_id,user_id,role_id));
alter table public.profiles add column if not exists active_entreprise_id uuid references public.entreprises(id);
do $$
declare v_company uuid; v_owner uuid; v_name text;
begin
 select id into v_company from public.entreprises order by created_at limit 1;
 if v_company is null then select updated_by,nullif(trim(raison_sociale),'') into v_owner,v_name from public.parametres_entreprise order by updated_at desc limit 1; insert into public.entreprises(nom,owner_id) values(coalesce(v_name,'Entreprise historique'),v_owner) returning id into v_company; end if;
 insert into public.entreprise_utilisateurs(entreprise_id,user_id,role_id) select v_company,user_id,role_id from public.user_roles on conflict do nothing;
 if v_owner is not null then insert into public.entreprise_utilisateurs(entreprise_id,user_id,role_id) select v_company,v_owner,id from public.roles where code='ADMIN' on conflict do nothing; end if;
end $$;
alter table public.parametres_entreprise drop constraint if exists parametres_entreprise_id_check;
alter table public.parametres_entreprise alter column id set default gen_random_uuid();
-- L'application classe aussi son plan comptable par exercice, bien que la copie
-- de schéma fournie ne contienne pas cette colonne.
alter table public.comptes_comptables add column if not exists exercice_id uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.comptes_comptables'::regclass and conname='comptes_comptables_exercice_id_fkey') then
  alter table public.comptes_comptables add constraint comptes_comptables_exercice_id_fkey foreign key(exercice_id) references public.exercices_comptables(id);
 end if;
end $$;
-- Reparer les references parent cassees, puis faire le backfill d'exercice.
-- Les comptes concernes restent presents avec leurs soldes et deviennent des
-- racines. Le trigger guard_account_exercise est desactive uniquement pendant
-- ce backfill, dans cette transaction, puis immediatement reactive.
do $$
declare
  v_exercice_id uuid;
  v_trigger record;
  v_sans_exercice integer;
begin
  select id into v_exercice_id
  from public.exercices_comptables
  where statut::text = 'OUVERT'
  order by date_debut desc
  limit 1;

  select count(*) into v_sans_exercice
  from public.comptes_comptables
  where exercice_id is null;

  if v_exercice_id is null and v_sans_exercice > 0 then
    raise exception 'Aucun exercice ouvert pour rattacher les comptes sans exercice.';
  end if;

  for v_trigger in
    select tgname from pg_trigger
    where tgrelid = 'public.comptes_comptables'::regclass
      and not tgisinternal
      and tgfoid = 'public.guard_account_exercise()'::regprocedure
  loop
    execute format('alter table public.comptes_comptables disable trigger %I', v_trigger.tgname);
  end loop;

  update public.comptes_comptables c
  set compte_parent_id = null
  where c.compte_parent_id is not null
    and not exists (
      select 1 from public.comptes_comptables p
      where p.id = c.compte_parent_id
    );

  if v_sans_exercice > 0 then
    update public.comptes_comptables
    set exercice_id = v_exercice_id
    where exercice_id is null;
  end if;

  for v_trigger in
    select tgname from pg_trigger
    where tgrelid = 'public.comptes_comptables'::regclass
      and not tgisinternal
      and tgfoid = 'public.guard_account_exercise()'::regprocedure
  loop
    execute format('alter table public.comptes_comptables enable trigger %I', v_trigger.tgname);
  end loop;
end $$;
create temporary table migration_trigger_states (
  table_name text not null,
  trigger_name text not null,
  trigger_mode "char" not null
) on commit drop;
insert into pg_temp.migration_trigger_states(table_name,trigger_name,trigger_mode)
select c.relname,tr.tgname,tr.tgenabled
from pg_trigger tr
join pg_class c on c.oid=tr.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname=any(array['exercices_comptables','journaux','comptes_comptables','ecritures_comptables','lignes_ecritures','pieces_comptables','notifications','immobilisations','clotures_comptables','lignes_releve_bancaire','regles_echeances_fiscales','referentiel_controles_cloture','controles_cloture','parametres_entreprise','compteurs_ecritures','declarations_tva'])
  and not tr.tgisinternal
  and tr.tgenabled<>'D';
-- Commande separee du backfill afin que PostgreSQL applique la desactivation
-- des triggers avant l'UPDATE des ecritures validees.
do $$ declare x record; begin
 for x in select table_name,trigger_name from pg_temp.migration_trigger_states loop
  execute format('alter table public.%I disable trigger %I',x.table_name,x.trigger_name);
 end loop;
end $$;
do $$
declare
 v_table_name text;
 v_company uuid;
 v_table_names text[]:=array['exercices_comptables','journaux','comptes_comptables','ecritures_comptables','lignes_ecritures','pieces_comptables','notifications','immobilisations','clotures_comptables','lignes_releve_bancaire','regles_echeances_fiscales','referentiel_controles_cloture','controles_cloture','parametres_entreprise','compteurs_ecritures','declarations_tva'];
begin
 select id into v_company from public.entreprises order by created_at limit 1;
 foreach v_table_name in array v_table_names loop
  execute format('alter table public.%I add column if not exists entreprise_id uuid references public.entreprises(id)',v_table_name);
  execute format('update public.%I set entreprise_id=$1 where entreprise_id is null',v_table_name) using v_company;
  execute format('create index if not exists %I on public.%I(entreprise_id)','idx_'||v_table_name||'_entreprise',v_table_name);
 end loop;
 update public.profiles p set active_entreprise_id=v_company where p.active_entreprise_id is null and exists(select 1 from public.entreprise_utilisateurs eu where eu.user_id=p.id and eu.entreprise_id=v_company);
 insert into public.parametres_entreprise(entreprise_id,raison_sociale) select v_company,e.nom from public.entreprises e where e.id=v_company and not exists(select 1 from public.parametres_entreprise p where p.entreprise_id=e.id);
end $$;
-- Restaurer chaque trigger utilisateur avec son mode initial.
do $$ declare x record; begin
 for x in select table_name,trigger_name,trigger_mode from pg_temp.migration_trigger_states loop
  if x.trigger_mode='A' then
   execute format('alter table public.%I enable always trigger %I',x.table_name,x.trigger_name);
  elsif x.trigger_mode='R' then
   execute format('alter table public.%I enable replica trigger %I',x.table_name,x.trigger_name);
  else
   execute format('alter table public.%I enable trigger %I',x.table_name,x.trigger_name);
  end if;
 end loop;
end $$;
create or replace function public.current_entreprise_id() returns uuid language sql stable security definer set search_path=public as $$ select active_entreprise_id from public.profiles where id=auth.uid() $$;
create or replace function public.is_entreprise_member(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null and exists(select 1 from public.entreprise_utilisateurs eu join public.profiles p on p.id=eu.user_id where eu.user_id=auth.uid() and eu.entreprise_id=p_id and p.active_entreprise_id=p_id and p.actif) $$;
create or replace function public.is_entreprise_user(p_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null and exists(select 1 from public.entreprise_utilisateurs eu join public.profiles p on p.id=eu.user_id where eu.user_id=auth.uid() and eu.entreprise_id=p_id and p.actif) $$;
create or replace function public.is_active_entreprise_profile_member(p_user_id uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.entreprise_utilisateurs eu join public.profiles p on p.id=eu.user_id where eu.user_id=p_user_id and eu.entreprise_id=public.current_entreprise_id() and p.actif) $$;
create or replace function public.has_active_entreprise_permission(p_code text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.entreprise_utilisateurs eu join public.roles r on r.id=eu.role_id left join public.role_permissions rp on rp.role_id=r.id left join public.permissions p on p.id=rp.permission_id where eu.user_id=auth.uid() and eu.entreprise_id=public.current_entreprise_id() and (r.code='ADMIN' or p.code=p_code)) $$;
create or replace function public.can_read_active_accounting() returns boolean language sql stable security definer set search_path=public as $$ select public.has_active_entreprise_permission('COMPTA_READ') or public.has_active_entreprise_permission('COMPTA_CREATE') or public.has_active_entreprise_permission('COMPTA_VALIDATE') or public.has_active_entreprise_permission('COMPTA_CLOTURE') or exists(select 1 from public.entreprise_utilisateurs eu join public.roles r on r.id=eu.role_id where eu.user_id=auth.uid() and eu.entreprise_id=public.current_entreprise_id() and r.code in ('GERANT','COMPTABLE','CONSULTANT')) $$;
create or replace function public.can_write_active_accounting() returns boolean language sql stable security definer set search_path=public as $$ select public.has_active_entreprise_permission('COMPTA_CREATE') or exists(select 1 from public.entreprise_utilisateurs eu join public.roles r on r.id=eu.role_id where eu.user_id=auth.uid() and eu.entreprise_id=public.current_entreprise_id() and r.code in ('GERANT','COMPTABLE')) $$;
create or replace function public.switch_active_entreprise(p_entreprise_id uuid) returns uuid language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null or not exists(select 1 from public.entreprise_utilisateurs where user_id=auth.uid() and entreprise_id=p_entreprise_id) then raise exception 'Vous ne faites pas partie de cette entreprise.'; end if; update public.profiles set active_entreprise_id=p_entreprise_id,updated_at=now() where id=auth.uid(); return p_entreprise_id; end $$;
create or replace function public.create_entreprise_for_current_user(p_nom text) returns uuid language plpgsql security definer set search_path=public as $$ declare v_company uuid; v_admin uuid; begin if auth.uid() is null then raise exception 'Authentification requise.'; end if; if length(trim(coalesce(p_nom,'')))<2 then raise exception 'Le nom doit contenir au moins 2 caractères.'; end if; select id into v_admin from public.roles where code='ADMIN' limit 1; if v_admin is null then raise exception 'Le rôle ADMIN doit exister.'; end if; insert into public.entreprises(nom,owner_id) values(trim(p_nom),auth.uid()) returning id into v_company; insert into public.entreprise_utilisateurs(entreprise_id,user_id,role_id) values(v_company,auth.uid(),v_admin); update public.profiles set active_entreprise_id=v_company,updated_at=now() where id=auth.uid(); insert into public.parametres_entreprise(entreprise_id,raison_sociale) values(v_company,trim(p_nom)); return v_company; end $$;
create or replace function public.add_user_to_active_company(p_email text,p_role_code text) returns uuid language plpgsql security definer set search_path=public,auth as $$ declare v_user uuid; v_role uuid; v_company uuid:=public.current_entreprise_id(); begin if not public.has_active_entreprise_permission('CONFIG_USERS') then raise exception 'Seul un administrateur peut gérer les utilisateurs.'; end if; select id into v_user from auth.users where lower(email)=lower(trim(p_email)) limit 1; if v_user is null then raise exception 'Aucun compte trouvé pour cet e-mail. La personne doit d’abord créer son compte.'; end if; select id into v_role from public.roles where code=p_role_code; if v_role is null then raise exception 'Rôle inconnu.'; end if; insert into public.entreprise_utilisateurs(entreprise_id,user_id,role_id) values(v_company,v_user,v_role) on conflict do nothing; return v_user; end $$;
create or replace function public.stamp_active_entreprise() returns trigger language plpgsql security definer set search_path=public as $$ declare v_id uuid:=public.current_entreprise_id(); begin if v_id is null or not public.is_entreprise_member(v_id) then raise exception 'Aucune entreprise active autorisée.'; end if; if tg_op='INSERT' then if new.entreprise_id is not null and new.entreprise_id<>v_id then raise exception 'Entreprise incohérente.'; end if; new.entreprise_id:=v_id; else if old.entreprise_id is distinct from v_id then raise exception 'Accès à cette entreprise refusé.'; end if; if new.entreprise_id is distinct from old.entreprise_id then raise exception 'Le rattachement a une entreprise ne peut pas être modifie.'; end if; end if; return new; end $$;
-- Anciennes policies supprimees car PostgreSQL les combine avec OR.
do $$
declare t text; p record; v_write text; v_delete text;
ts text[]:=array['exercices_comptables','journaux','comptes_comptables','ecritures_comptables','lignes_ecritures','pieces_comptables','notifications','immobilisations','clotures_comptables','lignes_releve_bancaire','regles_echeances_fiscales','referentiel_controles_cloture','controles_cloture','parametres_entreprise','compteurs_ecritures','declarations_tva'];
begin
 foreach t in array ts loop
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
  v_write:='public.can_write_active_accounting()'; v_delete:='public.can_write_active_accounting()';
  if t in ('exercices_comptables','clotures_comptables','controles_cloture') then v_write:='public.has_active_entreprise_permission(''COMPTA_CLOTURE'') or public.can_write_active_accounting()'; end if;
  if t='exercices_comptables' then v_delete:='public.has_active_entreprise_permission(''CONFIG_COMPANY'')'; end if;
  if t='referentiel_controles_cloture' then v_write:='public.has_active_entreprise_permission(''CONFIG_COMPANY'')'; v_delete:=v_write; end if;
  if t='parametres_entreprise' then v_write:='public.has_active_entreprise_permission(''CONFIG_COMPANY'')'; v_delete:=v_write; end if;
  execute format('create policy tenant_read on public.%I for select to authenticated using(public.is_entreprise_member(entreprise_id) and public.can_read_active_accounting())',t);
  execute format('create policy tenant_insert on public.%I for insert to authenticated with check(public.is_entreprise_member(entreprise_id) and (%s))',t,v_write);
  execute format('create policy tenant_update on public.%I for update to authenticated using(public.is_entreprise_member(entreprise_id) and (%s)) with check(public.is_entreprise_member(entreprise_id) and (%s))',t,v_write,v_write);
  execute format('create policy tenant_delete on public.%I for delete to authenticated using(public.is_entreprise_member(entreprise_id) and (%s))',t,v_delete);
  execute format('drop trigger if exists stamp_entreprise_id on public.%I',t);
  execute format('create trigger stamp_entreprise_id before insert or update on public.%I for each row execute function public.stamp_active_entreprise()',t);
 end loop;
end $$;
alter table public.entreprises enable row level security;
alter table public.entreprise_utilisateurs enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='user_roles' loop execute format('drop policy %I on public.user_roles',p.policyname); end loop; end $$;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop execute format('drop policy %I on public.profiles',p.policyname); end loop; end $$;
create policy profile_self_access on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy profile_company_member_read on public.profiles for select to authenticated using(public.is_active_entreprise_profile_member(id));
create policy profile_company_admin_update on public.profiles for update to authenticated using(public.has_active_entreprise_permission('CONFIG_USERS') and exists(select 1 from public.entreprise_utilisateurs eu where eu.user_id=profiles.id and eu.entreprise_id=public.current_entreprise_id())) with check(public.has_active_entreprise_permission('CONFIG_USERS') and exists(select 1 from public.entreprise_utilisateurs eu where eu.user_id=profiles.id and eu.entreprise_id=profiles.active_entreprise_id));
drop policy if exists companies_members_read on public.entreprises;
create policy companies_members_read on public.entreprises for select to authenticated using(public.is_entreprise_user(id));
drop policy if exists companies_admin_update on public.entreprises;
create policy companies_admin_update on public.entreprises for update to authenticated using(id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY')) with check(id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));
drop policy if exists company_membership_read on public.entreprise_utilisateurs;
create policy company_membership_read on public.entreprise_utilisateurs for select to authenticated using(user_id=auth.uid() or entreprise_id=public.current_entreprise_id());
drop policy if exists company_membership_admin on public.entreprise_utilisateurs;
create policy company_membership_admin on public.entreprise_utilisateurs for all to authenticated using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_USERS')) with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_USERS'));
create or replace function public.prevent_last_company_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (select code from public.roles where id=old.role_id)='ADMIN' and (tg_op='DELETE' or new.role_id is distinct from old.role_id) and not exists(select 1 from public.entreprise_utilisateurs eu join public.roles r on r.id=eu.role_id where eu.entreprise_id=old.entreprise_id and eu.user_id<>old.user_id and r.code='ADMIN') then
  raise exception 'Chaque entreprise doit conserver au moins un administrateur.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
drop trigger if exists company_keep_admin on public.entreprise_utilisateurs;
create trigger company_keep_admin before delete or update of role_id on public.entreprise_utilisateurs for each row execute function public.prevent_last_company_admin();
grant execute on function public.current_entreprise_id() to authenticated;
grant execute on function public.is_entreprise_member(uuid) to authenticated;
grant execute on function public.is_entreprise_user(uuid) to authenticated;
grant execute on function public.is_active_entreprise_profile_member(uuid) to authenticated;
grant execute on function public.has_active_entreprise_permission(text) to authenticated;
grant execute on function public.can_read_active_accounting() to authenticated;
grant execute on function public.can_write_active_accounting() to authenticated;
grant execute on function public.switch_active_entreprise(uuid) to authenticated;
grant execute on function public.create_entreprise_for_current_user(text) to authenticated;
grant execute on function public.add_user_to_active_company(text,text) to authenticated;
revoke all on function public.create_entreprise_for_current_user(text) from public, anon;
grant execute on function public.create_entreprise_for_current_user(text) to authenticated;
revoke all on function public.add_user_to_active_company(text,text) from public, anon;
grant execute on function public.add_user_to_active_company(text,text) to authenticated;
do $$
declare x record;
begin
 for x in select * from (values ('exercices_comptables','code','exercices_comptables_code_key','uq_exercice_entreprise_code'),('journaux','code','journaux_code_key','uq_journal_entreprise_code'),('comptes_comptables','numero','comptes_comptables_numero_key','uq_compte_entreprise_exercice_numero'),('ecritures_comptables','numero','ecritures_comptables_numero_key','uq_ecriture_entreprise_numero'),('immobilisations','code','immobilisations_code_key','uq_immobilisation_entreprise_code'),('referentiel_controles_cloture','numero','referentiel_controles_cloture_numero_key','uq_referentiel_entreprise_numero'),('regles_echeances_fiscales','code','regles_echeances_fiscales_code_key','uq_regle_fiscale_entreprise_code')) as v(tbl,col,constraint_name,index_name) loop if exists(select 1 from pg_constraint where conrelid=format('public.%I',x.tbl)::regclass and conname=x.constraint_name) then execute format('alter table public.%I drop constraint %I',x.tbl,x.constraint_name); end if; if x.tbl='comptes_comptables' then execute format('create unique index if not exists %I on public.%I(entreprise_id,exercice_id,%I)',x.index_name,x.tbl,x.col); else execute format('create unique index if not exists %I on public.%I(entreprise_id,%I)',x.index_name,x.tbl,x.col); end if; end loop;
end $$;

-- Version tenant-aware de la validation définitive des écritures.
create or replace function public.valider_ecriture(p_ecriture_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare v_ecr public.ecritures_comptables%rowtype; v_ex public.exercices_comptables%rowtype; v_jr public.journaux%rowtype;
v_nb integer; v_debit numeric; v_credit numeric; v_invalides integer; v_inactifs integer; v_seq integer; v_numero text; v_perm_utilisee boolean;
begin
 if auth.uid() is null then raise exception 'Authentification requise.'; end if;
 select exists(select 1 from public.role_permissions rp join public.permissions p on p.id=rp.permission_id where p.code='COMPTA_VALIDATE') into v_perm_utilisee;
 if v_perm_utilisee then
   if not public.has_active_entreprise_permission('COMPTA_VALIDATE') then raise exception 'Permission COMPTA_VALIDATE requise.'; end if;
 elsif not exists(select 1 from public.entreprise_utilisateurs eu join public.roles r on r.id=eu.role_id where eu.user_id=auth.uid() and eu.entreprise_id=public.current_entreprise_id() and r.code in ('ADMIN','GERANT','COMPTABLE')) then
   raise exception 'Vous ne pouvez pas valider des écritures.';
 end if;
 select * into v_ecr from public.ecritures_comptables where id=p_ecriture_id and entreprise_id=public.current_entreprise_id() for update;
 if not found then raise exception 'Écriture introuvable dans l’entreprise active.'; end if;
 if v_ecr.statut::text not in ('BROUILLON','EN_VALIDATION') then raise exception 'Seul un brouillon peut être validé (statut actuel : %).',v_ecr.statut; end if;
 select * into v_ex from public.exercices_comptables where id=v_ecr.exercice_id and entreprise_id=v_ecr.entreprise_id;
 if not found or v_ex.statut::text<>'OUVERT' then raise exception 'L’exercice est clôturé ou introuvable.'; end if;
 if v_ecr.date_ecriture<v_ex.date_debut or v_ecr.date_ecriture>v_ex.date_fin then raise exception 'La date d’écriture est hors de l’exercice.'; end if;
 select * into v_jr from public.journaux where id=v_ecr.journal_id and entreprise_id=v_ecr.entreprise_id;
 if not found then raise exception 'Journal de l’écriture introuvable.'; end if;
 select count(*),coalesce(sum(debit),0),coalesce(sum(credit),0),count(*) filter(where not ((debit>0 and credit=0) or (credit>0 and debit=0)))
 into v_nb,v_debit,v_credit,v_invalides from public.lignes_ecritures where ecriture_id=p_ecriture_id and entreprise_id=v_ecr.entreprise_id;
 if v_nb<2 then raise exception 'Une écriture doit comporter au moins deux lignes.'; end if;
 if v_invalides>0 then raise exception '% ligne(s) invalide(s) : un débit ou un crédit exclusif est requis.',v_invalides; end if;
 if v_debit<=0 or v_debit<>v_credit then raise exception 'Écriture déséquilibrée : débit % / crédit %.',v_debit,v_credit; end if;
 select count(*) into v_inactifs from public.lignes_ecritures l join public.comptes_comptables c on c.id=l.compte_id and c.entreprise_id=l.entreprise_id where l.ecriture_id=p_ecriture_id and l.entreprise_id=v_ecr.entreprise_id and not c.actif;
 if v_inactifs>0 then raise exception '% ligne(s) utilisent un compte inactif.',v_inactifs; end if;
 insert into public.compteurs_ecritures(entreprise_id,exercice_id,journal_id,derniere_valeur) values(v_ecr.entreprise_id,v_ecr.exercice_id,v_ecr.journal_id,1)
 on conflict(exercice_id,journal_id) do update set derniere_valeur=public.compteurs_ecritures.derniere_valeur+1 returning derniere_valeur into v_seq;
 v_numero:=v_jr.code||'-'||v_ex.annee::text||'-'||lpad(v_seq::text,6,'0');
 perform set_config('app.validation_en_cours','on',true);
 update public.ecritures_comptables set statut='VALIDEE',numero=v_numero,
   reference_piece=case when reference_piece is null or reference_piece=v_ecr.numero then v_numero else reference_piece end,
   validated_by=auth.uid(),validated_at=now() where id=p_ecriture_id and entreprise_id=v_ecr.entreprise_id;
 perform set_config('app.validation_en_cours','off',true);
 return v_numero;
end $$;
revoke all on function public.valider_ecriture(uuid) from public, anon;
grant execute on function public.valider_ecriture(uuid) to authenticated;

-- Les FK composees interdisent aussi les references croisees entre entreprises
-- dans les fonctions SECURITY DEFINER et les traitements serveur.
create unique index if not exists uq_exercices_id_entreprise on public.exercices_comptables(id,entreprise_id);
create unique index if not exists uq_journaux_id_entreprise on public.journaux(id,entreprise_id);
create unique index if not exists uq_comptes_id_entreprise on public.comptes_comptables(id,entreprise_id);
create unique index if not exists uq_comptes_id_entreprise_exercice on public.comptes_comptables(id,entreprise_id,exercice_id);
create unique index if not exists uq_ecritures_id_entreprise on public.ecritures_comptables(id,entreprise_id);
create unique index if not exists uq_clotures_id_entreprise on public.clotures_comptables(id,entreprise_id);
create unique index if not exists uq_lignes_id_entreprise on public.lignes_ecritures(id,entreprise_id);
create unique index if not exists uq_referentiel_id_entreprise on public.referentiel_controles_cloture(id,entreprise_id);
do $$
declare x record;
begin
 for x in select * from (values
  ('ecritures_comptables','ecriture_exercice_company_fk','exercice_id','exercices_comptables'),('ecritures_comptables','ecriture_journal_company_fk','journal_id','journaux'),
  ('comptes_comptables','compte_exercice_company_fk','exercice_id','exercices_comptables'),('lignes_ecritures','ligne_ecriture_company_fk','ecriture_id','ecritures_comptables'),('lignes_ecritures','ligne_compte_company_fk','compte_id','comptes_comptables'),
  ('pieces_comptables','piece_ecriture_company_fk','ecriture_id','ecritures_comptables'),('immobilisations','immobilisation_exercice_company_fk','exercice_id','exercices_comptables'),('immobilisations','immobilisation_compte_company_fk','compte_id','comptes_comptables'),
  ('clotures_comptables','cloture_exercice_company_fk','exercice_id','exercices_comptables'),('controles_cloture','controle_cloture_company_fk','cloture_id','clotures_comptables'),('controles_cloture','controle_referentiel_company_fk','controle_id','referentiel_controles_cloture'),
  ('lignes_releve_bancaire','releve_compte_company_fk','compte_id','comptes_comptables'),('compteurs_ecritures','compteur_exercice_company_fk','exercice_id','exercices_comptables'),('compteurs_ecritures','compteur_journal_company_fk','journal_id','journaux'),('declarations_tva','declaration_exercice_company_fk','exercice_id','exercices_comptables')
 ) as v(child_table,constraint_name,child_column,parent_table) loop
   if not exists(select 1 from pg_constraint where conrelid=format('public.%I',x.child_table)::regclass and conname=x.constraint_name) then
     execute format('alter table public.%I add constraint %I foreign key (%I,entreprise_id) references public.%I(id,entreprise_id)',x.child_table,x.constraint_name,x.child_column,x.parent_table);
   end if;
 end loop;
end $$;
commit;
