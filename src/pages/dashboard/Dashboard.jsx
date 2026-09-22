import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Wallet, FileText, Award } from 'lucide-react';
import Card from '../../components/ui/Card';
import KpiCard from '../../components/accounting/KpiCard';
import AccountingTable from '../../components/accounting/AccountingTable';
import AlertCard from '../../components/accounting/AlertCard';
import ChartCard from '../../components/accounting/ChartCard';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { money, dateFr, CHARGE_PREFIX_LABEL, MONTH_LABELS, DONUT_COLORS } from '../../lib/dashboard';

const todayFr = () => new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [exercices, setExercices] = useState([]);
  const [comptes, setComptes] = useState([]);
  const [lignesTout, setLignesTout] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [ecrituresLight, setEcrituresLight] = useState([]);
  const [declarations, setDeclarations] = useState([]);
  const [clotures, setClotures] = useState([]);
  const [controlesCloture, setControlesCloture] = useState([]);
  const [releveNonRapproche, setReleveNonRapproche] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [userRoles, setUserRoles] = useState([]);

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }

    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,date_debut,date_fin,statut').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,nature,solde_ouverture_debit,solde_ouverture_credit'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables(date_ecriture,statut)'),
      supabase.from('ecritures_comptables').select('id,numero,date_ecriture,libelle,reference_piece,statut,lignes_ecritures(debit,credit)').order('date_ecriture', { ascending: false }).limit(8),
      supabase.from('ecritures_comptables').select('id,date_ecriture,statut'),
      supabase.from('declarations_tva').select('id,periode_libelle,statut,date_echeance'),
      supabase.from('clotures_comptables').select('id,periode,statut'),
      supabase.from('controles_cloture').select('cloture_id,statut'),
      supabase.from('lignes_releve_bancaire').select('id,compte_id,rapproche').eq('rapproche', false),
      supabase.from('profiles').select('id,nom,prenom,actif'),
      supabase.from('user_roles').select('user_id'),
    ]).then((results) => {
      const errs = results.filter((r) => r.error);
      if (errs.length) { setNotice(`Certaines données n'ont pas pu être chargées : ${errs[0].error.message}`); }
      const [ex, ac, ln, rec, ecl, decl, clo, ctrl, releve, prof, roles] = results.map((r) => r.data || []);
      setExercices(ex); setComptes(ac);
      setLignesTout(ln.filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
      setRecentes(rec);
      setEcrituresLight(ecl);
      setDeclarations(decl); setClotures(clo); setControlesCloture(ctrl);
      setReleveNonRapproche(releve); setProfiles(prof); setUserRoles(roles);
      setLoading(false);
    });
  }, []);

  const currentExercice = exercices.find((e) => e.statut === 'OUVERT') || exercices[0];
  const previousExercice = exercices.find((e) => e.annee === (currentExercice?.annee ? currentExercice.annee - 1 : null));

  // --- Trésorerie (cumulée, toutes périodes — cohérent avec la page Trésorerie) ---
  const comptesTresorerie = useMemo(() => comptes.filter((c) => c.nature === 'TRESORERIE'), [comptes]);
  const soldeTresorerie = useMemo(() => comptesTresorerie.reduce((acc, a) => {
    const base = Number(a.solde_ouverture_debit || 0) - Number(a.solde_ouverture_credit || 0);
    const mvt = lignesTout.filter((l) => l.compte_id === a.id).reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0);
    return acc + base + mvt;
  }, 0), [comptesTresorerie, lignesTout]);

  const now = new Date();
  const moisCourantKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const deltaTresorerieMois = useMemo(() => lignesTout
    .filter((l) => comptesTresorerie.some((a) => a.id === l.compte_id) && l.ecritures_comptables?.date_ecriture?.slice(0, 7) === moisCourantKey)
    .reduce((s, l) => s + Number(l.debit || 0) - Number(l.credit || 0), 0), [lignesTout, comptesTresorerie, moisCourantKey]);

  // --- CA & résultat net (exercice courant, logique identique à la page Compte de résultat) ---
  const periodNet = (compteId, start, end) => {
    if (!start || !end) return 0;
    return lignesTout.filter((l) => l.compte_id === compteId && l.ecritures_comptables.date_ecriture >= start && l.ecritures_comptables.date_ecriture <= end)
      .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);
  };

  const crRows = useMemo(() => comptes.filter((a) => a.nature === 'CHARGE' || a.nature === 'PRODUIT').map((a) => {
    const rawN = periodNet(a.id, currentExercice?.date_debut, currentExercice?.date_fin);
    const rawN1 = previousExercice ? periodNet(a.id, previousExercice.date_debut, previousExercice.date_fin) : null;
    const sign = a.nature === 'CHARGE' ? 1 : -1;
    return { ...a, valueN: rawN * sign, valueN1: rawN1 === null ? null : rawN1 * sign };
  }), [comptes, lignesTout, currentExercice, previousExercice]); // eslint-disable-line react-hooks/exhaustive-deps

  const produitsExploit = crRows.filter((r) => r.nature === 'PRODUIT' && !r.numero.startsWith('77'));
  const chargesExploit = crRows.filter((r) => r.nature === 'CHARGE' && !r.numero.startsWith('67'));
  const produitsFin = crRows.filter((r) => r.nature === 'PRODUIT' && r.numero.startsWith('77'));
  const chargesFin = crRows.filter((r) => r.nature === 'CHARGE' && r.numero.startsWith('67'));
  const sum = (list, key = 'valueN') => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);

  const caN = sum(produitsExploit); const caN1 = sum(produitsExploit, 'valueN1');
  const resultatExploitN = caN - sum(chargesExploit);
  const resultatExploitN1 = caN1 - sum(chargesExploit, 'valueN1');
  const resultatNetN = resultatExploitN + sum(produitsFin) - sum(chargesFin);
  const resultatNetN1 = resultatExploitN1 + sum(produitsFin, 'valueN1') - sum(chargesFin, 'valueN1');

  const pctChange = (n, n1) => (previousExercice && n1) ? ((n - n1) / Math.abs(n1)) * 100 : null;
  const caPct = pctChange(caN, caN1);
  const resultatPct = pctChange(resultatNetN, resultatNetN1);

  // --- Écritures ---
  const ecrituresCeMois = ecrituresLight.filter((e) => e.date_ecriture?.slice(0, 7) === moisCourantKey).length;
  const ecrituresBrouillon = ecrituresLight.filter((e) => e.statut === 'BROUILLON').length;

  // --- Répartition des charges (donut, exercice courant) ---
  const donutData = useMemo(() => {
    const groups = {};
    chargesExploit.forEach((r) => {
      const prefix = r.numero.slice(0, 2);
      groups[prefix] = (groups[prefix] || 0) + Number(r.valueN || 0);
    });
    const entries = Object.entries(groups).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((a, [, v]) => a + v, 0);
    const top = entries.slice(0, 4);
    const autres = entries.slice(4).reduce((a, [, v]) => a + v, 0);
    const items = [...top.map(([k, v]) => ({ label: CHARGE_PREFIX_LABEL[k] || `Classe ${k}`, value: v })), ...(autres > 0 ? [{ label: 'Autres', value: autres }] : [])];
    return { items, total };
  }, [chargesExploit]);

  let cumPct = 0;
  const gradientStops = donutData.items.map((it, i) => {
    const pct = donutData.total > 0 ? (it.value / donutData.total) * 100 : 0;
    const start = cumPct; cumPct += pct;
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start.toFixed(1)}% ${cumPct.toFixed(1)}%`;
  });

  // --- Flux de trésorerie 12 mois (entrées/sorties réelles) ---
  const monthlyFlows = useMemo(() => {
    const buckets = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MONTH_LABELS[d.getMonth()], entrees: 0, sorties: 0 });
    }
    lignesTout.filter((l) => comptesTresorerie.some((a) => a.id === l.compte_id)).forEach((l) => {
      const key = l.ecritures_comptables?.date_ecriture?.slice(0, 7);
      const bucket = buckets.find((b) => b.key === key);
      if (!bucket) return;
      bucket.entrees += Number(l.debit || 0);
      bucket.sorties += Number(l.credit || 0);
    });
    return buckets;
  }, [lignesTout, comptesTresorerie]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Alertes réelles ---
  const comptesMap = useMemo(() => Object.fromEntries(comptes.map((c) => [c.id, c])), [comptes]);
  const clotureProgress = useMemo(() => {
    const map = {};
    controlesCloture.forEach((c) => { map[c.cloture_id] = map[c.cloture_id] || { total: 0, faits: 0 }; map[c.cloture_id].total += 1; if (c.statut !== 'A_FAIRE') map[c.cloture_id].faits += 1; });
    return map;
  }, [controlesCloture]);
  const rolesUserIds = useMemo(() => new Set(userRoles.map((r) => r.user_id)), [userRoles]);

  const alerts = useMemo(() => {
    const items = [];
    declarations.filter((d) => d.date_echeance && !['DECLAREE', 'PAYEE'].includes(d.statut)).sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)).slice(0, 2).forEach((d) => {
      items.push({ key: `tva-${d.id}`, tone: 'danger', text: `Déclaration TVA ${d.periode_libelle} à traiter avant le ${dateFr(d.date_echeance)}`, onClick: () => nav(`/tva-taxes/${d.id}`) });
    });
    clotures.filter((c) => c.statut !== 'CLOTUREE').slice(0, 2).forEach((c) => {
      const p = clotureProgress[c.id] || { total: 0, faits: 0 };
      items.push({ key: `clot-${c.id}`, tone: 'warning', text: `Clôture ${c.periode} en cours (${p.faits}/${p.total} contrôles)`, onClick: () => nav(`/clotures/${c.id}`) });
    });
    if (releveNonRapproche.length > 0) {
      const parCompte = {};
      releveNonRapproche.forEach((r) => { parCompte[r.compte_id] = (parCompte[r.compte_id] || 0) + 1; });
      Object.entries(parCompte).slice(0, 2).forEach(([compteId, n]) => {
        items.push({ key: `rappro-${compteId}`, tone: 'warning', text: `${n} ligne(s) de relevé non rapprochée(s) — ${comptesMap[compteId]?.libelle || 'compte de trésorerie'}`, onClick: () => nav('/rapprochement') });
      });
    }
    if (ecrituresBrouillon > 0) items.push({ key: 'brouillons', tone: 'info', text: `${ecrituresBrouillon} écriture(s) en brouillon à valider`, onClick: () => nav('/journal') });
    const sansRole = profiles.filter((p) => p.actif && !rolesUserIds.has(p.id)).length;
    if (sansRole > 0) items.push({ key: 'roles', tone: 'info', text: `${sansRole} utilisateur(s) actif(s) sans rôle assigné`, onClick: () => nav('/configuration') });
    return items.slice(0, 6);
  }, [declarations, clotures, clotureProgress, releveNonRapproche, comptesMap, ecrituresBrouillon, profiles, rolesUserIds, nav]);

  // --- Table écritures récentes ---
  const recentRows = useMemo(() => recentes.map((e) => {
    const debit = (e.lignes_ecritures || []).reduce((a, l) => a + Number(l.debit || 0), 0);
    const credit = (e.lignes_ecritures || []).reduce((a, l) => a + Number(l.credit || 0), 0);
    return {
      id: e.id, date: e.date_ecriture ? new Date(e.date_ecriture).toLocaleDateString('fr-FR') : '—',
      ref: e.reference_piece || e.numero, description: e.libelle,
      debit: money(debit), credit: money(credit),
      status: e.statut === 'VALIDEE' ? 'Validée' : 'Brouillon', statusTone: e.statut === 'VALIDEE' ? 'success' : 'warning',
    };
  }), [recentes]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble de votre activité comptable{currentExercice ? ` · Exercice ${currentExercice.code || currentExercice.annee}` : ''}{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div className="dashboard-date">Dernière mise à jour : {todayFr()}</div>
      </div>

      {notice && <div className="message error" role="alert">{notice}</div>}

      <div className="grid grid-4">
        <KpiCard label="Trésorerie" value={`${money(soldeTresorerie)} FCFA`} icon={Wallet} onClick={() => nav('/tresorerie')}
          deltaLabel={`${deltaTresorerieMois >= 0 ? '+' : ''}${money(deltaTresorerieMois)} FCFA ce mois`} trend={deltaTresorerieMois >= 0 ? 'up' : 'down'} />
        <KpiCard label="Chiffre d'affaires" value={`${money(caN)} FCFA`} icon={TrendingUp} onClick={() => nav('/compte-resultat')}
          deltaLabel={caPct === null ? 'Pas de comparaison N-1' : `${caPct >= 0 ? '+' : ''}${caPct.toFixed(1)}% vs N-1`} trend={caPct === null ? 'neutral' : caPct >= 0 ? 'up' : 'down'} />
        <KpiCard label="Résultat net" value={`${money(resultatNetN)} FCFA`} icon={Award} onClick={() => nav('/compte-resultat')}
          deltaLabel={resultatPct === null ? 'Pas de comparaison N-1' : `${resultatPct >= 0 ? '+' : ''}${resultatPct.toFixed(1)}% vs N-1`} trend={resultatPct === null ? 'neutral' : resultatPct >= 0 ? 'up' : 'down'} />
        <KpiCard label="Écritures" value={String(ecrituresLight.length)} icon={FileText} onClick={() => nav('/journal')}
          deltaLabel={`${ecrituresCeMois} ce mois-ci`} trend="neutral" />
      </div>

      <div className="grid grid-2 dashboard-middle">
        <ChartCard data={monthlyFlows} />
        <Card className="summary-card">
          <div className="card-heading">
            <div><h2>Répartition des charges</h2><p>Exercice {currentExercice?.code || currentExercice?.annee || 'en cours'}</p></div>
          </div>
          <div className="donut-wrap">
            <div className="donut" style={donutData.total > 0 ? { background: `conic-gradient(${gradientStops.join(',')})` } : undefined}>
              <div><b>{(donutData.total / 1000000).toFixed(1)}M</b><span>Total</span></div>
            </div>
            <div className="legend">
              {donutData.items.map((it, i) => (
                <span key={it.label}><i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{it.label} <b>{donutData.total > 0 ? Math.round((it.value / donutData.total) * 100) : 0}%</b></span>
              ))}
              {donutData.items.length === 0 && <span>Aucune charge d'exploitation sur la période.</span>}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid dashboard-bottom">
        <AccountingTable rows={recentRows} onSeeAll={() => nav('/journal')} />
        <AlertCard items={alerts} />
      </div>
    </div>
  );
}
