-- Exports visibles selon les habilitations décrites dans RBAC.pdf.
begin;

insert into public.permissions(code, nom, description) values
 ('COMPTA_EXPORT','Exporter les états comptables','Exporter les états de consultation au format Excel ou PDF.'),
 ('COMPTA_JOURNAL_EXPORT','Exporter le journal comptable','Exporter les écritures du journal au format Excel ou PDF.')
on conflict(code) do update set nom=excluded.nom, description=excluded.description;

delete from public.role_permissions rp using public.permissions p
where rp.permission_id=p.id and p.code in ('COMPTA_EXPORT','COMPTA_JOURNAL_EXPORT');

insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
join (values
 ('GERANT','COMPTA_EXPORT'),('COMPTABLE','COMPTA_EXPORT'),('CONSULTANT','COMPTA_EXPORT'),
 ('CONSULTANT','COMPTA_JOURNAL_EXPORT')
) as allowed(role_code,permission_code)
on allowed.role_code=r.code and allowed.permission_code=p.code
on conflict do nothing;

notify pgrst, 'reload schema';
commit;
