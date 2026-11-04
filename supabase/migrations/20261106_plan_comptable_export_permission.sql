-- Export Excel/PDF du plan comptable réservé à ADMIN et COMPTABLE.
begin;

insert into public.permissions(code, nom, description)
values (
  'COMPTA_PLAN_EXPORT',
  'Exporter le plan comptable',
  'Télécharger le plan comptable de l’entreprise active au format Excel ou PDF.'
)
on conflict (code) do update set
  nom = excluded.nom,
  description = excluded.description;

delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and p.code = 'COMPTA_PLAN_EXPORT';

insert into public.role_permissions(role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on p.code = 'COMPTA_PLAN_EXPORT'
where r.code in ('ADMIN', 'COMPTABLE')
on conflict do nothing;

notify pgrst, 'reload schema';
commit;
