-- Migration : Autoriser le créateur d'une ressource (écriture comptable) à la valider directement.
-- Suppression de la restriction bloquante de séparation des tâches sur valider_ecriture.

create or replace function public.valider_ecriture(p_ecriture_id uuid) returns text
language plpgsql security definer set search_path=public as $$
declare
 v_ecr public.ecritures_comptables%rowtype;
 v_ex public.exercices_comptables%rowtype;
 v_jr public.journaux%rowtype;
 v_nb integer;
 v_debit numeric;
 v_credit numeric;
 v_invalides integer;
 v_inactifs integer;
 v_seq integer;
 v_numero text;
begin
 if auth.uid() is null then raise exception 'Authentification requise.'; end if;

 select * into v_ecr
 from public.ecritures_comptables
 where id = p_ecriture_id and entreprise_id = public.current_entreprise_id()
 for update;

 if not found then
   raise exception 'Écriture introuvable dans l’entreprise active.';
 end if;

 if v_ecr.statut::text not in ('BROUILLON', 'EN_VALIDATION') then
   raise exception 'Seul un brouillon peut être validé (statut actuel : %).', v_ecr.statut;
 end if;

 -- Contrôle des habilitations : l'utilisateur peut valider s'il détient COMPTA_VALIDATE,
 -- OU s'il a créé l'écriture (created_by) et dispose du droit de saisie COMPTA_CREATE,
 -- OU s'il appartient aux rôles habilités (ADMIN, GERANT, COMPTABLE).
 if not (
   public.has_active_entreprise_permission('COMPTA_VALIDATE')
   or (v_ecr.created_by = auth.uid() and public.has_active_entreprise_permission('COMPTA_CREATE'))
   or exists (
     select 1
     from public.entreprise_utilisateurs eu
     join public.roles r on r.id = eu.role_id
     where eu.user_id = auth.uid()
       and eu.entreprise_id = public.current_entreprise_id()
       and r.code in ('ADMIN', 'GERANT', 'COMPTABLE')
   )
 ) then
   raise exception 'Permission de validation requise.';
 end if;

 select * into v_ex
 from public.exercices_comptables
 where id = v_ecr.exercice_id and entreprise_id = v_ecr.entreprise_id;

 if not found or v_ex.statut::text <> 'OUVERT' then
   raise exception 'L’exercice est clôturé ou introuvable.';
 end if;

 if v_ecr.date_ecriture < v_ex.date_debut or v_ecr.date_ecriture > v_ex.date_fin then
   raise exception 'La date d’écriture est hors de l’exercice.';
 end if;

 select * into v_jr
 from public.journaux
 where id = v_ecr.journal_id and entreprise_id = v_ecr.entreprise_id;

 if not found then
   raise exception 'Journal de l’écriture introuvable.';
 end if;

 select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0),
        count(*) filter(where not ((debit > 0 and credit = 0) or (credit > 0 and debit = 0)))
 into v_nb, v_debit, v_credit, v_invalides
 from public.lignes_ecritures
 where ecriture_id = p_ecriture_id and entreprise_id = v_ecr.entreprise_id;

 if v_nb < 2 then
   raise exception 'Une écriture doit comporter au moins deux lignes.';
 end if;

 if v_invalides > 0 then
   raise exception '% ligne(s) invalide(s) : un débit ou un crédit exclusif est requis.', v_invalides;
 end if;

 if v_debit <= 0 or v_debit <> v_credit then
   raise exception 'Écriture déséquilibrée : débit % / crédit %.', v_debit, v_credit;
 end if;

 select count(*) into v_inactifs
 from public.lignes_ecritures l
 join public.comptes_comptables c on c.id = l.compte_id and c.entreprise_id = l.entreprise_id
 where l.ecriture_id = p_ecriture_id
   and l.entreprise_id = v_ecr.entreprise_id
   and not c.actif;

 if v_inactifs > 0 then
   raise exception '% ligne(s) utilisent un compte inactif.', v_inactifs;
 end if;

 insert into public.compteurs_ecritures(entreprise_id, exercice_id, journal_id, derniere_valeur)
 values(v_ecr.entreprise_id, v_ecr.exercice_id, v_ecr.journal_id, 1)
 on conflict(exercice_id, journal_id) do update
   set derniere_valeur = public.compteurs_ecritures.derniere_valeur + 1
 returning derniere_valeur into v_seq;

 v_numero := v_jr.code || '-' || v_ex.annee::text || '-' || lpad(v_seq::text, 6, '0');

 perform set_config('app.validation_en_cours', 'on', true);

 update public.ecritures_comptables
 set statut = 'VALIDEE',
     numero = v_numero,
     reference_piece = case when reference_piece is null or reference_piece = v_ecr.numero then v_numero else reference_piece end,
     validated_by = auth.uid(),
     validated_at = now()
 where id = p_ecriture_id and entreprise_id = v_ecr.entreprise_id;

 perform set_config('app.validation_en_cours', 'off', true);

 return v_numero;
end $$;

revoke all on function public.valider_ecriture(uuid) from public, anon;
grant execute on function public.valider_ecriture(uuid) to authenticated;

