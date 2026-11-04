-- RBAC strict par entreprise d'apres RBAC.pdf.
-- A executer une fois dans Supabase SQL Editor, apres sauvegarde.
begin;

insert into public.permissions(code, nom, description) values
 ('CONFIG_USERS','Gérer les utilisateurs','Créer les rattachements entreprise et gérer les rôles.'),
 ('CONFIG_COMPANY','Gérer les paramètres entreprise','Modifier les paramètres, journaux et intégrations.'),
 ('COMPTA_READ','Lire la comptabilité','Accéder aux pages et données comptables.'),
 ('COMPTA_CREATE','Saisir la comptabilité','Créer et modifier les écritures brouillon, comptes courants, immobilisations et rapprochements.'),
 ('COMPTA_VALIDATE','Valider les écritures','Valider une écriture équilibrée dans une entreprise.'),
 ('COMPTA_CLOTURE','Gérer les clôtures','Permission historique de clôture.'),
 ('COMPTA_CLOTURE_PREPARE','Préparer les clôtures','Créer les clôtures et réaliser les contrôles préparatoires.'),
 ('COMPTA_CLOTURE_APPROVE','Approuver les clôtures','Valider les contrôles de direction et clôturer définitivement.'),
 ('COMPTA_EXERCISE_EDIT','Gérer les exercices','Créer, modifier et ouvrir/fermer un exercice.'),
 ('COMPTA_ACCOUNT_EDIT','Modifier les champs courants des comptes','Modifier libellé, notes et options courantes.'),
 ('COMPTA_ACCOUNT_CREATE','Créer les comptes du référentiel','Créer un compte comptable dans le plan de l’entreprise active.'),
 ('COMPTA_PLAN_EXPORT','Exporter le plan comptable','Télécharger le plan comptable au format Excel ou PDF.'),
 ('COMPTA_ACCOUNT_ADMIN','Gérer les champs sensibles des comptes','Gérer numéros, hiérarchie, nature, activation et soldes d’ouverture.'),
 ('COMPTA_SYNC','Synchroniser les ventes vers la comptabilité','Exécuter et contrôler l’intégration comptable des ventes.'),
 ('SALES_READ','Lire les ventes','Accéder aux données commerciales non comptables.'),
 ('SALES_SYNC','Gérer la synchronisation des ventes','Transmettre les ventes à la comptabilité.'),
 ('STOCK_INVENTORY','Gérer l’inventaire physique','Consulter et mettre à jour les informations physiques des actifs.'),
 ('COMPTA_LETTRAGE','Lettrer les comptes','Réaliser le lettrage des comptes.'),
 ('COMPTA_TREASURY_EDIT','Gérer les rapprochements de trésorerie','Créer et modifier les rapprochements.'),
 ('COMPTA_ASSET_EDIT','Gérer les immobilisations','Créer et modifier les données financières des immobilisations.')
on conflict(code) do update set nom=excluded.nom, description=excluded.description;

-- Remplace les affectations des droits de cette matrice sans toucher aux autres permissions.
delete from public.role_permissions rp using public.permissions p
where rp.permission_id=p.id and p.code in (
 'CONFIG_USERS','CONFIG_COMPANY','COMPTA_READ','COMPTA_CREATE','COMPTA_VALIDATE','COMPTA_CLOTURE',
 'COMPTA_CLOTURE_PREPARE','COMPTA_CLOTURE_APPROVE','COMPTA_EXERCISE_EDIT','COMPTA_ACCOUNT_EDIT',
 'COMPTA_ACCOUNT_ADMIN','COMPTA_ACCOUNT_CREATE','COMPTA_PLAN_EXPORT','COMPTA_SYNC','SALES_READ','SALES_SYNC','STOCK_INVENTORY','COMPTA_LETTRAGE',
 'COMPTA_TREASURY_EDIT','COMPTA_ASSET_EDIT');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
join (values
 ('ADMIN','CONFIG_USERS'),('ADMIN','CONFIG_COMPANY'),('ADMIN','COMPTA_READ'),('ADMIN','COMPTA_ACCOUNT_ADMIN'),('ADMIN','COMPTA_ACCOUNT_CREATE'),('ADMIN','COMPTA_PLAN_EXPORT'),
 ('GERANT','COMPTA_READ'),('GERANT','COMPTA_VALIDATE'),('GERANT','COMPTA_CLOTURE'),('GERANT','COMPTA_CLOTURE_APPROVE'),
 ('GERANT','COMPTA_EXERCISE_EDIT'),('GERANT','COMPTA_ACCOUNT_EDIT'),('GERANT','COMPTA_ACCOUNT_ADMIN'),('GERANT','SALES_READ'),
 ('COMPTABLE','COMPTA_READ'),('COMPTABLE','COMPTA_CREATE'),('COMPTABLE','COMPTA_VALIDATE'),('COMPTABLE','COMPTA_CLOTURE'),
 ('COMPTABLE','COMPTA_CLOTURE_PREPARE'),('COMPTABLE','COMPTA_ACCOUNT_EDIT'),('COMPTABLE','COMPTA_PLAN_EXPORT'),('COMPTABLE','COMPTA_SYNC'),
 ('COMPTABLE','SALES_READ'),('COMPTABLE','STOCK_INVENTORY'),('COMPTABLE','COMPTA_LETTRAGE'),
 ('COMPTABLE','COMPTA_TREASURY_EDIT'),('COMPTABLE','COMPTA_ASSET_EDIT'),
 ('CONSULTANT','COMPTA_READ'),('MAGASINIER','STOCK_INVENTORY'),('AGENT_COMMERCIAL','SALES_READ'),('AGENT_COMMERCIAL','SALES_SYNC')
) as m(role_code,permission_code) on m.role_code=r.code and m.permission_code=p.code
on conflict do nothing;

-- Ne plus accorder implicitement tous les droits à ADMIN : seuls les droits
-- explicitement attribués au rôle dans l'entreprise active sont valables.
create or replace function public.has_active_entreprise_permission(p_code text)
returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and exists(
   select 1 from public.entreprise_utilisateurs eu
   join public.profiles pr on pr.id=eu.user_id and pr.active_entreprise_id=eu.entreprise_id and pr.actif
   join public.role_permissions rp on rp.role_id=eu.role_id
   join public.permissions p on p.id=rp.permission_id and p.code=p_code
   where eu.user_id=auth.uid() and eu.entreprise_id=public.current_entreprise_id()
 );
$$;
create or replace function public.can_read_active_accounting()
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_entreprise_permission('COMPTA_READ');
$$;
create or replace function public.can_write_active_accounting()
returns boolean language sql stable security definer set search_path=public as $$
 select public.has_active_entreprise_permission('COMPTA_CREATE');
$$;

-- Repart des policies explicites : les politiques permissives PostgreSQL
-- s'additionnent en OR, il faut donc retirer les anciennes pour ces tables.
do $rbac$
declare t text; p record;
begin
 foreach t in array array['comptes_comptables','journaux','exercices_comptables','ecritures_comptables',
  'lignes_ecritures','pieces_comptables','clotures_comptables','controles_cloture','immobilisations',
  'lignes_releve_bancaire','declarations_tva','parametres_entreprise','referentiel_controles_cloture',
  'compteurs_ecritures','regles_echeances_fiscales','notifications'] loop
  if to_regclass('public.'||t) is null then continue; end if;
  execute format('alter table public.%I enable row level security',t);
  for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',p.policyname,t);
  end loop;
  if t <> 'compteurs_ecritures' and t <> 'notifications' then
   execute format('create policy rbac_read on public.%I for select to authenticated using (entreprise_id=public.current_entreprise_id() and public.is_entreprise_member(entreprise_id) and public.has_active_entreprise_permission(''COMPTA_READ''))',t);
  end if;
 end loop;
end
$rbac$;

-- Données commerciales rattachées à l’entreprise. Les colonnes sont ajoutées
-- sans rattacher arbitrairement les anciennes ventes à une société.
create table if not exists public.ventes (
 id uuid primary key default gen_random_uuid(), entreprise_id uuid references public.entreprises(id),
 external_id text not null, reference_facture text, client_nom text, client_identifiant text,
 date_vente timestamptz, montant_ht numeric not null default 0, montant_tva numeric not null default 0,
 montant_ttc numeric not null default 0, mode_reglement text, statut_comptable text not null default 'A_COMPTABILISER',
 donnees_brutes jsonb, created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz
);
alter table public.ventes add column if not exists entreprise_id uuid references public.entreprises(id);
alter table public.ventes add column if not exists created_by uuid references public.profiles(id);
alter table public.ventes alter column created_by set default auth.uid();
alter table public.ventes add column if not exists created_at timestamptz not null default now();
alter table public.ventes add column if not exists updated_at timestamptz;
alter table public.ventes add column if not exists donnees_brutes jsonb;
alter table public.ventes add column if not exists statut_comptable text not null default 'A_COMPTABILISER';
create table if not exists public.sync_logs (
 id uuid primary key default gen_random_uuid(), entreprise_id uuid references public.entreprises(id),
 statut text not null, source text not null, started_at timestamptz not null default now(),
 finished_at timestamptz, total_recupere integer not null default 0, total_insere integer not null default 0,
 message_erreur text, created_by uuid references public.profiles(id)
);
alter table public.sync_logs add column if not exists entreprise_id uuid references public.entreprises(id);
alter table public.sync_logs add column if not exists created_by uuid references public.profiles(id);
do $sales_constraints$
declare c record;
begin
 for c in
  select con.conname from pg_constraint con
  join pg_class tbl on tbl.oid=con.conrelid join pg_namespace n on n.oid=tbl.relnamespace
  join unnest(con.conkey) with ordinality as k(attnum,ord) on true
  join pg_attribute a on a.attrelid=tbl.oid and a.attnum=k.attnum
  where n.nspname='public' and tbl.relname='ventes' and con.contype='u'
  group by con.conname having array_agg(a.attname::text order by k.ord)=array['external_id']::text[]
 loop execute format('alter table public.ventes drop constraint %I',c.conname); end loop;
end $sales_constraints$;
create unique index if not exists ventes_entreprise_external_id_uidx on public.ventes(entreprise_id,external_id);
alter table public.ventes enable row level security;
alter table public.sync_logs enable row level security;
do $sales_policies$ declare p record; begin
 for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('ventes','sync_logs') loop
  execute format('drop policy %I on public.%I',p.policyname,case when p.tablename='ventes' then 'ventes' else 'sync_logs' end);
 end loop;
end $sales_policies$;
create policy rbac_sales_read on public.ventes for select to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_READ') or public.has_active_entreprise_permission('COMPTA_READ')));
create policy rbac_sales_insert on public.ventes for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and created_by=auth.uid() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')));
create policy rbac_sales_update on public.ventes for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')));
create policy rbac_sales_log_read on public.sync_logs for select to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_READ') or public.has_active_entreprise_permission('COMPTA_READ')));
create policy rbac_sales_log_insert on public.sync_logs for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and created_by=auth.uid() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')));
create policy rbac_sales_log_update on public.sync_logs for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('SALES_SYNC') or public.has_active_entreprise_permission('COMPTA_SYNC')));
drop trigger if exists stamp_entreprise_id on public.ventes;
create trigger stamp_entreprise_id before insert or update on public.ventes for each row execute function public.stamp_active_entreprise();
drop trigger if exists stamp_entreprise_id on public.sync_logs;
create trigger stamp_entreprise_id before insert or update on public.sync_logs for each row execute function public.stamp_active_entreprise();
create or replace function public.guard_sales_accounting_status() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and coalesce(new.statut_comptable,'A_COMPTABILISER')<>'A_COMPTABILISER'
    and not public.has_active_entreprise_permission('COMPTA_SYNC') then
  raise exception 'Une vente importée doit commencer au statut À comptabiliser.';
 end if;
 if tg_op='UPDATE' and old.statut_comptable is distinct from new.statut_comptable
    and not public.has_active_entreprise_permission('COMPTA_SYNC') then
  raise exception 'Seul le comptable peut modifier le statut comptable d’une vente.';
 end if;
 if tg_op='UPDATE' and old.created_by is distinct from new.created_by then raise exception 'Le créateur de la vente ne peut pas être modifié.'; end if;
 return new;
end $$;
drop trigger if exists sales_accounting_status_rbac on public.ventes;
create trigger sales_accounting_status_rbac before update on public.ventes for each row execute function public.guard_sales_accounting_status();
create or replace function public.guard_sales_log_identity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.created_by is distinct from old.created_by or new.entreprise_id is distinct from old.entreprise_id) then
  raise exception 'Le créateur et l’entreprise du journal de synchronisation sont immuables.';
 end if;
 return new;
end $$;
drop trigger if exists sales_log_identity_rbac on public.sync_logs;
create trigger sales_log_identity_rbac before update on public.sync_logs for each row execute function public.guard_sales_log_identity();
grant select,insert,update on public.ventes to authenticated;
grant select,insert,update on public.sync_logs to authenticated;

-- Plan comptable : lecture, édition courante, édition sensible, suppression ADMIN.
create policy rbac_account_insert on public.comptes_comptables for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CREATE') or public.has_active_entreprise_permission('COMPTA_ACCOUNT_CREATE')));
create policy rbac_account_update on public.comptes_comptables for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT') or public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_ACCOUNT_EDIT') or public.has_active_entreprise_permission('COMPTA_ACCOUNT_ADMIN')));
create policy rbac_account_delete on public.comptes_comptables for delete to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_USERS'));

-- Journaux et paramètres entreprise : ADMIN uniquement.
create policy rbac_journal_write on public.journaux for all to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));
create policy rbac_company_settings_write on public.parametres_entreprise for all to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));
create policy rbac_referential_write on public.referentiel_controles_cloture for all to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));
create policy rbac_tax_rules_write on public.regles_echeances_fiscales for all to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));
create policy rbac_notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());
create policy rbac_notifications_update on public.notifications for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy rbac_notifications_insert on public.notifications for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_READ'));
do $reference$
declare p record;
begin
 if to_regclass('public.default_compt') is not null then
  alter table public.default_compt enable row level security;
  for p in select policyname from pg_policies where schemaname='public' and tablename='default_compt' loop
   execute format('drop policy %I on public.default_compt',p.policyname);
  end loop;
  execute 'create policy default_chart_read on public.default_compt for select to authenticated using(true)';
 end if;
end
$reference$;

-- Exercice : ADMIN ou GERANT en création/édition, ADMIN seul en suppression.
create policy rbac_exercise_insert on public.exercices_comptables for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('CONFIG_COMPANY') or public.has_active_entreprise_permission('COMPTA_EXERCISE_EDIT')));
create policy rbac_exercise_update on public.exercices_comptables for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('CONFIG_COMPANY') or public.has_active_entreprise_permission('COMPTA_EXERCISE_EDIT')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('CONFIG_COMPANY') or public.has_active_entreprise_permission('COMPTA_EXERCISE_EDIT')));
create policy rbac_exercise_delete on public.exercices_comptables for delete to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('CONFIG_COMPANY'));

-- Écritures, lignes et justificatifs : seul COMPTABLE saisit/modifie les brouillons.
create policy rbac_entry_insert on public.ecritures_comptables for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and statut::text in ('BROUILLON','EN_VALIDATION'));
create policy rbac_entry_update on public.ecritures_comptables for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and statut::text in ('BROUILLON','EN_VALIDATION'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and statut::text in ('BROUILLON','EN_VALIDATION'));
create policy rbac_entry_delete on public.ecritures_comptables for delete to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and statut::text in ('BROUILLON','EN_VALIDATION'));
create policy rbac_lines_insert on public.lignes_ecritures for insert to authenticated
 with check(lignes_ecritures.entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=lignes_ecritures.ecriture_id and e.entreprise_id=lignes_ecritures.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));
create policy rbac_lines_update on public.lignes_ecritures for update to authenticated
 using(lignes_ecritures.entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=lignes_ecritures.ecriture_id and e.entreprise_id=lignes_ecritures.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')))
 with check(lignes_ecritures.entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=lignes_ecritures.ecriture_id and e.entreprise_id=lignes_ecritures.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));
create policy rbac_lines_delete on public.lignes_ecritures for delete to authenticated
 using(lignes_ecritures.entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=lignes_ecritures.ecriture_id and e.entreprise_id=lignes_ecritures.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));
create policy rbac_pieces_insert on public.pieces_comptables for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=pieces_comptables.ecriture_id and e.entreprise_id=pieces_comptables.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));
create policy rbac_pieces_update on public.pieces_comptables for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=pieces_comptables.ecriture_id and e.entreprise_id=pieces_comptables.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=pieces_comptables.ecriture_id and e.entreprise_id=pieces_comptables.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));
create policy rbac_pieces_delete on public.pieces_comptables for delete to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE') and exists(select 1 from public.ecritures_comptables e where e.id=pieces_comptables.ecriture_id and e.entreprise_id=pieces_comptables.entreprise_id and e.statut::text in ('BROUILLON','EN_VALIDATION')));

-- Clôtures : COMPTABLE prépare, GERANT approuve; personne d'autre ne modifie.
create policy rbac_closure_insert on public.clotures_comptables for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')));
create policy rbac_closure_update on public.clotures_comptables for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')));
create policy rbac_checks_insert on public.controles_cloture for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')));
create policy rbac_checks_update on public.controles_cloture for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')))
 with check(entreprise_id=public.current_entreprise_id() and (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')));

create or replace function public.guard_closure_approval_rbac() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' and new.statut::text='CLOTUREE' then raise exception 'Une clôture ne peut pas être créée directement comme définitive.'; end if;
 if tg_op='UPDATE' then
  if new.statut::text='CLOTUREE' and old.statut::text is distinct from 'CLOTUREE'
     and not public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE') then
   raise exception 'Seul le gérant peut clôturer définitivement.';
  end if;
  if (new.balance_validee is distinct from old.balance_validee
      or new.rapprochement_valide is distinct from old.rapprochement_valide
      or new.fiscalite_verifiee is distinct from old.fiscalite_verifiee
      or new.cloturee_par is distinct from old.cloturee_par
      or new.cloturee_le is distinct from old.cloturee_le)
     and not public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE') then
   raise exception 'Seul le gérant peut approuver les contrôles de clôture.';
  end if;
  if new.statut::text is distinct from old.statut::text
     and not (public.has_active_entreprise_permission('COMPTA_CLOTURE_PREPARE') or public.has_active_entreprise_permission('COMPTA_CLOTURE_APPROVE')) then
   raise exception 'Permission de préparation de clôture requise.';
  end if;
 end if;
 return new;
end $$;
drop trigger if exists closure_approval_rbac on public.clotures_comptables;
create trigger closure_approval_rbac before insert or update on public.clotures_comptables
 for each row execute function public.guard_closure_approval_rbac();

-- Rapprochement de trésorerie, déclarations et immobilisations.
create policy rbac_bank_rows_insert on public.lignes_releve_bancaire for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_TREASURY_EDIT'));
create policy rbac_bank_rows_update on public.lignes_releve_bancaire for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_TREASURY_EDIT'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_TREASURY_EDIT'));
create policy rbac_tax_insert on public.declarations_tva for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE'));
create policy rbac_tax_update on public.declarations_tva for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_CREATE'));
create policy rbac_assets_insert on public.immobilisations for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_ASSET_EDIT'));
create policy rbac_assets_update on public.immobilisations for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_ASSET_EDIT'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('COMPTA_ASSET_EDIT'));

-- La RPC de validation est l'unique accès GERANT pour valider un brouillon.
-- La fonction valider_ecriture existante conserve ses vérifications métier;
-- elle appelle has_active_entreprise_permission('COMPTA_VALIDATE'), désormais
-- strictement limité à l'entreprise active et aux rôles autorisés ci-dessus.
create or replace function public.valider_ecriture(p_ecriture_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare
 v_ecr public.ecritures_comptables%rowtype; v_ex public.exercices_comptables%rowtype; v_jr public.journaux%rowtype;
 v_nb integer; v_debit numeric; v_credit numeric; v_invalides integer; v_inactifs integer; v_seq integer; v_numero text;
begin
 if auth.uid() is null then raise exception 'Authentification requise.'; end if;
 if not public.has_active_entreprise_permission('COMPTA_VALIDATE') then raise exception 'Permission COMPTA_VALIDATE requise.'; end if;
 select * into v_ecr from public.ecritures_comptables where id=p_ecriture_id and entreprise_id=public.current_entreprise_id() for update;
 if not found then raise exception 'Écriture introuvable dans l’entreprise active.'; end if;
 if v_ecr.statut::text not in ('BROUILLON','EN_VALIDATION') then raise exception 'Seul un brouillon peut être validé (statut actuel : %).',v_ecr.statut; end if;
 if v_ecr.created_by=auth.uid() then raise exception 'Séparation des tâches : vous ne pouvez pas valider une écriture que vous avez créée.'; end if;
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
 select count(*) into v_inactifs from public.lignes_ecritures l join public.comptes_comptables c on c.id=l.compte_id and c.entreprise_id=l.entreprise_id
 where l.ecriture_id=p_ecriture_id and l.entreprise_id=v_ecr.entreprise_id and not c.actif;
 if v_inactifs>0 then raise exception '% ligne(s) utilisent un compte inactif.',v_inactifs; end if;
 insert into public.compteurs_ecritures(entreprise_id,exercice_id,journal_id,derniere_valeur)
 values(v_ecr.entreprise_id,v_ecr.exercice_id,v_ecr.journal_id,1)
 on conflict(exercice_id,journal_id) do update set derniere_valeur=public.compteurs_ecritures.derniere_valeur+1 returning derniere_valeur into v_seq;
 v_numero:=v_jr.code||'-'||v_ex.annee::text||'-'||lpad(v_seq::text,6,'0');
 perform set_config('app.validation_en_cours','on',true);
 update public.ecritures_comptables set statut='VALIDEE',numero=v_numero,
   reference_piece=case when reference_piece is null or reference_piece=v_ecr.numero then v_numero else reference_piece end,
   validated_by=auth.uid(),validated_at=now() where id=p_ecriture_id and entreprise_id=v_ecr.entreprise_id;
 perform set_config('app.validation_en_cours','off',true);
 return v_numero;
end $$;
revoke all on function public.valider_ecriture(uuid) from public,anon;
grant execute on function public.valider_ecriture(uuid) to authenticated;

-- Champs physiques isolés des valeurs financières pour le rôle magasinier.
alter table public.immobilisations add column if not exists etat_physique text;
alter table public.immobilisations add column if not exists emplacement_physique text;
alter table public.immobilisations add column if not exists date_inventaire_physique date;
alter table public.immobilisations add column if not exists observation_physique text;
create table if not exists public.inventaire_physique (
 id uuid primary key default gen_random_uuid(),
 entreprise_id uuid not null references public.entreprises(id) on delete cascade,
 exercice_id uuid not null references public.exercices_comptables(id) on delete restrict,
 code text not null,
 designation text not null,
 categorie text,
 etat_physique text,
 emplacement_physique text,
 date_inventaire date not null default current_date,
 observation text,
 created_by uuid references public.profiles(id) default auth.uid(),
 created_at timestamptz not null default now()
);
alter table public.inventaire_physique enable row level security;
drop policy if exists rbac_physical_read on public.inventaire_physique;
drop policy if exists rbac_physical_insert on public.inventaire_physique;
drop policy if exists rbac_physical_update on public.inventaire_physique;
do $physical_policies$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='inventaire_physique'
   and policyname not in ('rbac_physical_read','rbac_physical_insert','rbac_physical_update') loop
  execute format('drop policy %I on public.inventaire_physique',p.policyname);
 end loop;
end $physical_policies$;
create policy rbac_physical_read on public.inventaire_physique for select to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('STOCK_INVENTORY'));
create policy rbac_physical_insert on public.inventaire_physique for insert to authenticated
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('STOCK_INVENTORY') and created_by=auth.uid());
create policy rbac_physical_update on public.inventaire_physique for update to authenticated
 using(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('STOCK_INVENTORY'))
 with check(entreprise_id=public.current_entreprise_id() and public.has_active_entreprise_permission('STOCK_INVENTORY'));
drop trigger if exists stamp_entreprise_id on public.inventaire_physique;
create trigger stamp_entreprise_id before insert or update on public.inventaire_physique
 for each row execute function public.stamp_active_entreprise();
create or replace function public.guard_physical_exercise_company() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_company uuid:=public.current_entreprise_id();
begin
 if v_company is null or not public.is_entreprise_member(v_company) then raise exception 'Aucune entreprise active autorisée.'; end if;
 if tg_op='INSERT' then
  if new.entreprise_id is not null and new.entreprise_id<>v_company then raise exception 'Entreprise incohérente.'; end if;
  new.entreprise_id:=v_company;
  if new.created_by is null then new.created_by:=auth.uid(); end if;
  if new.created_by is distinct from auth.uid() then raise exception 'Le créateur doit être l’utilisateur connecté.'; end if;
 else
  if old.entreprise_id<>v_company or new.entreprise_id is distinct from old.entreprise_id then raise exception 'Le rattachement à l’entreprise ne peut pas être modifié.'; end if;
  if new.created_by is distinct from old.created_by then raise exception 'Le créateur de la ligne ne peut pas être modifié.'; end if;
 end if;
 if not exists(select 1 from public.exercices_comptables e where e.id=new.exercice_id and e.entreprise_id=new.entreprise_id) then
  raise exception 'L’exercice choisi n’appartient pas à cette entreprise.';
 end if;
 return new;
end $$;
drop trigger if exists physical_exercise_company on public.inventaire_physique;
create trigger physical_exercise_company before insert or update of exercice_id,entreprise_id on public.inventaire_physique
 for each row execute function public.guard_physical_exercise_company();
grant select,insert,update on public.inventaire_physique to authenticated;
create or replace view public.immobilisations_parc_physique as
 select id,entreprise_id,exercice_id,code,designation,categorie,date_acquisition,statut,
        etat_physique,emplacement_physique,date_inventaire_physique,observation_physique
 from public.immobilisations
 where entreprise_id=public.current_entreprise_id()
   and public.is_entreprise_member(entreprise_id)
   and public.has_active_entreprise_permission('STOCK_INVENTORY');
grant select on public.immobilisations_parc_physique to authenticated;
create or replace function public.update_asset_physical_inventory(
 p_id uuid,p_etat text,p_emplacement text,p_date date,p_observation text
) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.has_active_entreprise_permission('STOCK_INVENTORY') then raise exception 'Permission STOCK_INVENTORY requise.'; end if;
 update public.immobilisations set etat_physique=nullif(trim(p_etat),''),
   emplacement_physique=nullif(trim(p_emplacement),''),date_inventaire_physique=p_date,
   observation_physique=nullif(trim(p_observation),'')
 where id=p_id and entreprise_id=public.current_entreprise_id();
 if not found then raise exception 'Immobilisation introuvable dans l’entreprise active.'; end if;
end $$;
revoke all on function public.update_asset_physical_inventory(uuid,text,text,date,text) from public,anon;
grant execute on function public.update_asset_physical_inventory(uuid,text,text,date,text) to authenticated;

notify pgrst, 'reload schema';
commit;
