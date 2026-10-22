-- Jeu de démonstration comptable multi-entreprise.
-- À exécuter une seule fois ou à relancer : les références DEMO rendent le seed idempotent.
-- Génère des écritures équilibrées pour chaque exercice ouvert qui dispose
-- d'un membre ADMIN/COMPTABLE et d'un plan comptable exploitable.
-- Exécuter dans Supabase SQL Editor avec le rôle postgres.

BEGIN;

-- Ajoute une attribution explicite du créateur aux enregistrements métier.
-- Les données historiques restent NULL : leur auteur réel ne peut pas être deviné.
-- auth.uid() est utilisé par défaut pour les créations faites depuis l'application.
DO $creator_columns$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'entreprises',
    'entreprise_utilisateurs',
    'exercices_comptables',
    'journaux',
    'comptes_comptables',
    'ecritures_comptables',
    'lignes_ecritures',
    'pieces_comptables',
    'immobilisations',
    'clotures_comptables',
    'controles_cloture',
    'declarations_tva',
    'lignes_releve_bancaire',
    'referentiel_controles_cloture',
    'regles_echeances_fiscales',
    'parametres_entreprise'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL',
        v_table
      );
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN created_by SET DEFAULT auth.uid()',
        v_table
      );
    END IF;
  END LOOP;
END;
$creator_columns$;

DO $seed_demo$
DECLARE
  v_ex record;
  v_actor uuid;
  v_kind integer;
  v_i integer;
  v_amount numeric;
  v_date date;
  v_journal_id uuid;
  v_debit_account_id uuid;
  v_credit_account_id uuid;
  v_entry_id uuid;
  v_existing_status text;
  v_ref text;
  v_numero text;
  v_label text;
  v_cash_numero text;
  v_month date;
  v_period_start date;
  v_period_end date;
  v_closure_id uuid;
  v_inserted integer := 0;
  v_trigger_states jsonb := '[]'::jsonb;
  v_trigger record;
BEGIN
  -- Capture les modes initiaux pour ne réactiver que les triggers qui l'étaient.
  -- Les triggers d'intégrité comptable restent activés.
  SELECT coalesce(
    jsonb_agg(jsonb_build_object(
      'table_name', c.relname,
      'trigger_name', t.tgname,
      'mode', t.tgenabled
    )),
    '[]'::jsonb
  )
  INTO v_trigger_states
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace table_ns ON table_ns.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace function_ns ON function_ns.oid = p.pronamespace
  WHERE NOT t.tgisinternal
    AND t.tgenabled <> 'D'
    AND table_ns.nspname = 'public'
    AND (
      p.proname IN ('notify_users_with_permission', 'capture_audit_event')
      OR (
        p.proname = 'stamp_active_entreprise'
        AND c.relname = ANY(ARRAY[
          'ecritures_comptables', 'lignes_ecritures', 'immobilisations',
          'lignes_releve_bancaire', 'clotures_comptables', 'controles_cloture'
        ])
      )
    );

  FOR v_trigger IN SELECT value FROM jsonb_array_elements(v_trigger_states) LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DISABLE TRIGGER %I',
      v_trigger.value ->> 'table_name',
      v_trigger.value ->> 'trigger_name'
    );
  END LOOP;

  -- Parcourt uniquement les exercices ouverts. Les exercices clôturés sont
  -- volontairement laissés intacts par les gardes comptables.
  FOR v_ex IN
    SELECT
      ex.id AS exercice_id,
      ex.code AS exercice_code,
      ex.annee,
      ex.date_debut,
      ex.date_fin,
      ex.entreprise_id,
      ent.nom AS entreprise
    FROM public.exercices_comptables ex
    JOIN public.entreprises ent ON ent.id = ex.entreprise_id
    WHERE ex.statut::text = 'OUVERT'
    ORDER BY ent.nom, ex.date_debut, ex.code
  LOOP
    -- Le créateur est un utilisateur déjà rattaché à cette entreprise avec
    -- un rôle comptable ou administrateur. ADMIN est privilégié si disponible.
    SELECT eu.user_id
    INTO v_actor
    FROM public.entreprise_utilisateurs eu
    JOIN public.roles r ON r.id = eu.role_id
    WHERE eu.entreprise_id = v_ex.entreprise_id
      AND r.code IN ('ADMIN', 'COMPTABLE')
    ORDER BY CASE r.code WHEN 'ADMIN' THEN 0 ELSE 1 END, eu.user_id
    LIMIT 1;

    IF v_actor IS NULL THEN
      RAISE EXCEPTION
        'Aucun utilisateur ADMIN ou COMPTABLE trouvé pour l’entreprise % (exercice %).',
        v_ex.entreprise, v_ex.exercice_code;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.journaux j
      WHERE j.entreprise_id = v_ex.entreprise_id
    ) THEN
      RAISE EXCEPTION
        'Aucun journal n’existe pour l’entreprise % (exercice %). Créez ses journaux avant le seed.',
        v_ex.entreprise, v_ex.exercice_code;
    END IF;

    FOR v_i IN 1..36 LOOP
      v_kind := ((v_i - 1) % 6) + 1;
      v_ref := 'DEMO-' || left(replace(v_ex.exercice_id::text, '-', ''), 10) || '-' || lpad(v_i::text, 3, '0');
      v_numero := v_ref;

      -- Répare un éventuel brouillon incomplet laissé par un ancien seed.
      SELECT e.id, e.statut::text
      INTO v_entry_id, v_existing_status
      FROM public.ecritures_comptables e
      WHERE e.entreprise_id = v_ex.entreprise_id
        AND e.exercice_id = v_ex.exercice_id
        AND e.reference_piece = v_ref
      LIMIT 1;

      IF v_entry_id IS NOT NULL AND v_existing_status = 'VALIDEE' THEN
        CONTINUE;
      ELSIF v_entry_id IS NOT NULL AND v_existing_status = 'BROUILLON' THEN
        DELETE FROM public.lignes_ecritures l
        WHERE l.entreprise_id = v_ex.entreprise_id
          AND l.ecriture_id = v_entry_id;
        DELETE FROM public.ecritures_comptables e
        WHERE e.id = v_entry_id;
        v_entry_id := NULL;
      ELSIF v_entry_id IS NOT NULL THEN
        RAISE EXCEPTION
          'La pièce de démonstration % existe avec le statut %. Vérifiez-la avant de relancer.',
          v_ref, v_existing_status;
      END IF;

      -- Choisit un jour aléatoire qui n'appartient pas à une clôture définitive.
      SELECT days.day::date
      INTO v_date
      FROM generate_series(
        v_ex.date_debut::timestamp,
        v_ex.date_fin::timestamp,
        interval '1 day'
      ) AS days(day)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.clotures_comptables cl
        WHERE cl.entreprise_id = v_ex.entreprise_id
          AND cl.exercice_id = v_ex.exercice_id
          AND cl.statut = 'CLOTUREE'
          AND days.day::date BETWEEN cl.periode_debut AND cl.periode_fin
      )
      ORDER BY random()
      LIMIT 1;

      IF v_date IS NULL THEN
        RAISE EXCEPTION
          'Aucune date disponible dans l’exercice % de % (périodes clôturées).',
          v_ex.exercice_code, v_ex.entreprise;
      END IF;

      -- Priorité aux journaux du type métier correspondant, puis repli sur
      -- un autre journal de l'entreprise s'il n'y a pas ce type.
      SELECT j.id
      INTO v_journal_id
      FROM public.journaux j
      WHERE j.entreprise_id = v_ex.entreprise_id
        AND (
          (v_kind IN (1, 2) AND j.type::text = 'VENTE')
          OR (v_kind IN (3, 4) AND j.type::text = 'ACHAT')
          OR (v_kind IN (5, 6) AND j.type::text IN ('BANQUE', 'CAISSE', 'OD'))
        )
      ORDER BY random()
      LIMIT 1;

      IF v_journal_id IS NULL THEN
        SELECT j.id INTO v_journal_id
        FROM public.journaux j
        WHERE j.entreprise_id = v_ex.entreprise_id
        ORDER BY random()
        LIMIT 1;
      END IF;

      v_debit_account_id := NULL;
      v_credit_account_id := NULL;

      -- Sélection de comptes actifs du même exercice selon la nature OHADA.
      IF v_kind = 1 THEN
        v_label := 'Vente de récolte encaissée';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'TRESORERIE'
          AND (c.numero LIKE '52%' OR c.numero LIKE '57%')
        ORDER BY random() LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'PRODUIT' AND c.numero LIKE '7%'
        ORDER BY random() LIMIT 1;
      ELSIF v_kind = 2 THEN
        v_label := 'Vente de récolte à crédit';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'ACTIF' AND c.numero LIKE '411%'
        ORDER BY random() LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'PRODUIT' AND c.numero LIKE '7%'
        ORDER BY random() LIMIT 1;
      ELSIF v_kind = 3 THEN
        v_label := 'Achat de semences payé';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'CHARGE' AND c.numero LIKE '6%'
        ORDER BY random() LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'TRESORERIE'
          AND (c.numero LIKE '52%' OR c.numero LIKE '57%')
        ORDER BY random() LIMIT 1;
      ELSIF v_kind = 4 THEN
        v_label := 'Achat de fournitures à crédit';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'CHARGE' AND c.numero LIKE '6%'
        ORDER BY random() LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'PASSIF' AND c.numero LIKE '401%'
        ORDER BY random() LIMIT 1;
      ELSIF v_kind = 5 THEN
        v_label := 'Paiement de charges de personnel';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'CHARGE' AND c.numero LIKE '6%'
        ORDER BY CASE WHEN c.numero LIKE '66%' THEN 0 ELSE 1 END, random()
        LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'TRESORERIE'
          AND (c.numero LIKE '52%' OR c.numero LIKE '57%')
        ORDER BY random() LIMIT 1;
      ELSE
        v_label := 'Acquisition de matériel agricole';
        SELECT c.id INTO v_debit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'ACTIF' AND c.numero LIKE '2%'
        ORDER BY random() LIMIT 1;
        SELECT c.id INTO v_credit_account_id
        FROM public.comptes_comptables c
        WHERE c.entreprise_id = v_ex.entreprise_id AND c.exercice_id = v_ex.exercice_id
          AND c.actif AND c.nature::text = 'TRESORERIE'
          AND (c.numero LIKE '52%' OR c.numero LIKE '57%')
        ORDER BY random() LIMIT 1;
      END IF;

      IF v_debit_account_id IS NULL OR v_credit_account_id IS NULL THEN
        RAISE EXCEPTION
          'Plan comptable incomplet pour % / exercice % / opération %. Vérifiez les comptes actifs des classes 2, 4, 5, 6 et 7.',
          v_ex.entreprise, v_ex.exercice_code, v_kind;
      END IF;

      v_amount := round((25000 + random() * 975000) / 100) * 100;

      INSERT INTO public.ecritures_comptables (
        entreprise_id, exercice_id, journal_id, numero, date_ecriture,
        libelle, reference_piece, statut, created_by
      ) VALUES (
        v_ex.entreprise_id, v_ex.exercice_id, v_journal_id, v_numero,
        v_date, 'DEMO · ' || v_label || ' · ' || to_char(v_date, 'MM/YYYY'),
        v_ref, 'BROUILLON', v_actor
      ) RETURNING id INTO v_entry_id;

      INSERT INTO public.lignes_ecritures (
        entreprise_id, ecriture_id, compte_id, libelle, debit, credit, created_by
      ) VALUES
        (v_ex.entreprise_id, v_entry_id, v_debit_account_id, v_label, v_amount, 0, v_actor),
        (v_ex.entreprise_id, v_entry_id, v_credit_account_id, v_label, 0, v_amount, v_actor);

      -- Le GUC permet au trigger d'intégrité de vérifier et accepter la
      -- transition brouillon -> validée. Les deux lignes restent équilibrées.
      PERFORM set_config('app.validation_en_cours', 'on', true);
      UPDATE public.ecritures_comptables
      SET statut = 'VALIDEE', validated_by = v_actor,
          validated_at = now(), updated_at = now()
      WHERE id = v_entry_id;
      PERFORM set_config('app.validation_en_cours', 'off', true);

      IF v_kind = 6 THEN
        INSERT INTO public.immobilisations (
          entreprise_id, exercice_id, code, designation, categorie,
          date_acquisition, valeur_brute, duree_annees, statut,
          compte_id, created_by, notes
        ) VALUES (
          v_ex.entreprise_id, v_ex.exercice_id,
          'DEMO-IMMO-' || left(replace(v_ex.exercice_id::text, '-', ''), 10) || '-' || lpad(v_i::text, 3, '0'),
          (ARRAY['Tracteur agricole', 'Motopompe', 'Système d’irrigation', 'Pulvérisateur agricole'])[1 + floor(random() * 4)::integer],
          'Matériel agricole', v_date, v_amount,
          (ARRAY[5, 6, 8, 10])[1 + floor(random() * 4)::integer],
          'EN_SERVICE', v_debit_account_id, v_actor,
          'Donnée fictive DEMO liée à la pièce ' || v_ref
        );
      END IF;

      IF v_kind IN (1, 3, 5) THEN
        IF v_kind = 1 THEN
          v_credit_account_id := v_debit_account_id;
        END IF;

        SELECT c.numero INTO v_cash_numero
        FROM public.comptes_comptables c
        WHERE c.id = CASE WHEN v_kind = 1 THEN v_debit_account_id ELSE v_credit_account_id END;

        IF v_cash_numero LIKE '52%' THEN
          INSERT INTO public.lignes_releve_bancaire (
            entreprise_id, compte_id, date_operation, libelle,
            debit, credit, rapproche, valide, created_by
          )
          SELECT
            v_ex.entreprise_id,
            CASE WHEN v_kind = 1 THEN v_debit_account_id ELSE v_credit_account_id END,
            v_date,
            'DEMO · Relevé bancaire · ' || v_ref,
            CASE WHEN v_kind = 1 THEN v_amount ELSE 0 END,
            CASE WHEN v_kind IN (3, 5) THEN v_amount ELSE 0 END,
            false, false, v_actor
          WHERE NOT EXISTS (
            SELECT 1 FROM public.lignes_releve_bancaire lr
            WHERE lr.entreprise_id = v_ex.entreprise_id
              AND lr.libelle = 'DEMO · Relevé bancaire · ' || v_ref
          );
        END IF;
      END IF;

      v_inserted := v_inserted + 1;
    END LOOP;

    -- Ajoute une clôture de démonstration ouverte si un mois libre existe.
    IF NOT EXISTS (
      SELECT 1 FROM public.clotures_comptables cl
      WHERE cl.exercice_id = v_ex.exercice_id
        AND cl.periode LIKE 'DEMO-%'
    ) THEN
      SELECT months.month_start::date
      INTO v_month
      FROM generate_series(
        date_trunc('month', v_ex.date_debut::timestamp),
        date_trunc('month', v_ex.date_fin::timestamp),
        interval '1 month'
      ) AS months(month_start)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.clotures_comptables existing
        WHERE existing.exercice_id = v_ex.exercice_id
          AND existing.periode_debut <= least(
            (months.month_start + interval '1 month' - interval '1 day')::date,
            v_ex.date_fin
          )
          AND existing.periode_fin >= greatest(months.month_start::date, v_ex.date_debut)
      )
      ORDER BY random()
      LIMIT 1;

      IF v_month IS NOT NULL THEN
        v_period_start := greatest(v_month, v_ex.date_debut);
        v_period_end := least(
          (v_month + interval '1 month' - interval '1 day')::date,
          v_ex.date_fin
        );

        INSERT INTO public.clotures_comptables (
          entreprise_id, exercice_id, periode, periode_debut, periode_fin,
          statut, responsable, created_by
        ) VALUES (
          v_ex.entreprise_id, v_ex.exercice_id,
          'DEMO-' || to_char(v_period_start, 'YYYY-MM'),
          v_period_start, v_period_end, 'OUVERTE', v_actor, v_actor
        ) RETURNING id INTO v_closure_id;

        INSERT INTO public.controles_cloture (
          entreprise_id, cloture_id, controle_id, statut,
          commentaire, created_by
        )
        SELECT
          v_ex.entreprise_id, v_closure_id, ref.id, 'A_FAIRE',
          'Contrôle fictif de démonstration.', v_actor
        FROM public.referentiel_controles_cloture ref
        WHERE ref.entreprise_id = v_ex.entreprise_id
          AND ref.actif
          AND NOT EXISTS (
            SELECT 1 FROM public.controles_cloture cc
            WHERE cc.cloture_id = v_closure_id AND cc.controle_id = ref.id
          );
      END IF;
    END IF;
  END LOOP;

  -- Restaure le mode initial de chaque trigger suspendu.
  FOR v_trigger IN SELECT value FROM jsonb_array_elements(v_trigger_states) LOOP
    IF v_trigger.value ->> 'mode' = 'A' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ENABLE ALWAYS TRIGGER %I',
        v_trigger.value ->> 'table_name', v_trigger.value ->> 'trigger_name'
      );
    ELSIF v_trigger.value ->> 'mode' = 'R' THEN
      EXECUTE format(
        'ALTER TABLE public.%I ENABLE REPLICA TRIGGER %I',
        v_trigger.value ->> 'table_name', v_trigger.value ->> 'trigger_name'
      );
    ELSE
      EXECUTE format(
        'ALTER TABLE public.%I ENABLE TRIGGER %I',
        v_trigger.value ->> 'table_name', v_trigger.value ->> 'trigger_name'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Seed terminé : % nouvelle(s) écriture(s) créée(s).', v_inserted;
END;
$seed_demo$;

COMMIT;

-- Contrôle des écritures de démonstration : débit et crédit doivent être égaux.
SELECT
  ent.nom AS entreprise,
  ex.code AS exercice,
  count(DISTINCT e.id) AS ecritures_demo,
  coalesce(sum(l.debit), 0) AS total_debit,
  coalesce(sum(l.credit), 0) AS total_credit,
  coalesce(sum(l.debit), 0) = coalesce(sum(l.credit), 0) AS equilibre
FROM public.ecritures_comptables e
JOIN public.entreprises ent ON ent.id = e.entreprise_id
JOIN public.exercices_comptables ex ON ex.id = e.exercice_id
LEFT JOIN public.lignes_ecritures l ON l.ecriture_id = e.id
WHERE e.reference_piece LIKE 'DEMO-%'
GROUP BY ent.nom, ex.code
ORDER BY ent.nom, ex.code;
