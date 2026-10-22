import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, BookOpen, CircleAlert, Download, Edit3, Eye, FileDown, Minus, Plus, Search, ShieldCheck, Trash2, X, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info, ExternalLink, Clock3 } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { exportChartOfAccountsExcel, ChartOfAccountsPDF, PDFPreviewModal } from '../../lib/generateFile';
import './chartOfAccounts.css';

const CLASS_INFO = {
  1: { title: 'Classe 1 : Ressources durables', column: 'left' },
  2: { title: 'Classe 2 : Actif immobilisé', column: 'right' },
  3: { title: 'Classe 3 : Stocks et en-cours', column: 'left' },
  4: { title: 'Classe 4 : Comptes de tiers', column: 'left' },
  5: { title: 'Classe 5 : Trésorerie', column: 'left' },
  6: { title: "Classe 6 : Charges d'exploitation", column: 'right' },
  7: { title: "Classe 7 : Produits d'exploitation", column: 'right' },
};

const CLASS_OPTIONS = [
  'Classe 1 - Ressources durables', 'Classe 2 - Immobilisations', 'Classe 3 - Stocks',
  'Classe 4 - Comptes de tiers', 'Classe 5 - Trésorerie', 'Classe 6 - Charges', 'Classe 7 - Produits',
];
const NATURE_OPTIONS = ['ACTIF', 'PASSIF', 'CHARGE', 'PRODUIT', 'TRESORERIE'];

function classNumber(account) {
  const match = String(account.numero || '').trim().match(/[1-7]/);
  if (match) return Number(match[0]);
  return Number(String(account.classe || '').match(/[1-7]/)?.[0]) || 0;
}

function classTitle(account) {
  return account.libelle || 'Compte sans libellé';
}

function detailNetSide(account, balance) {
  const value = Number(balance || 0);
  if (!value) return true;
  const debitNature = ['ACTIF', 'CHARGE', 'TRESORERIE'].includes(String(account.nature).toUpperCase());
  return (value > 0) === debitNature;
}

function accountForm(account) {
  return {
    numero: account.numero || '',
    libelle: account.libelle || '',
    classe: account.classe || CLASS_OPTIONS[Math.max(0, classNumber(account) - 1)] || CLASS_OPTIONS[0],
    nature: account.nature || 'ACTIF',
    actif: account.actif !== false,
    compte_parent_id: account.compte_parent_id || '',
    devise: account.devise || 'XAF',
    lettrable: Boolean(account.lettrable),
    reconciliable: Boolean(account.reconciliable),
    notes: account.notes || '',
    solde_ouverture_debit: account.solde_ouverture_debit ?? 0,
    solde_ouverture_credit: account.solde_ouverture_credit ?? 0,
  };
}

function DifferenceValue({ value = 0, money }) {
  const amount = Number(value || 0);
  if (amount === 0) return <span className="chart-difference is-balanced"><Minus size={13} />Équilibré</span>;
  const Icon = amount > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`chart-difference ${amount > 0 ? 'is-positive' : 'is-negative'}`}><Icon size={15} />{amount > 0 ? '+' : '−'}{money(Math.abs(amount))}</span>;
}

function TrendDelta({ value = 0, money }) {
  const amount = Number(value || 0);
  if (amount === 0) return <span className="chart-trend is-balanced"><Minus size={12} />Stable</span>;
  const Icon = amount > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`chart-trend ${amount > 0 ? 'is-positive' : 'is-negative'}`}><Icon size={13} />{amount > 0 ? '+' : '−'}{money(Math.abs(amount))}</span>;
}

export default function ChartOfAccounts() {
  const { exercices, selectedExerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const { can, hasRole, roles = [] } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [balances, setBalances] = useState({});
  const [expandedClasses, setExpandedClasses] = useState(() => new Set());
  const [previousBalances, setPreviousBalances] = useState({});
  const [previousExercise, setPreviousExercise] = useState(null);
  const [detailAccountId, setDetailAccountId] = useState('');
  const [detailEntries, setDetailEntries] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);

  const previousCandidate = useMemo(() => {
    if (!selectedExercice?.date_debut) return null;
    return exercices
      .filter((item) => item.id !== selectedExercice.id && item.date_fin < selectedExercice.date_debut)
      .sort((a, b) => b.date_fin.localeCompare(a.date_fin))[0] || null;
  }, [exercices, selectedExercice]);

  const isAdmin = hasRole('ADMIN');
  const canRead = isAdmin || can('COMPTA_READ') || can('COMPTA_CREATE') || can('COMPTA_ACCOUNT_EDIT') || can('COMPTA_ACCOUNT_ADMIN') || roles.some((r) => ['GERANT', 'COMPTABLE', 'CONSULTANT'].includes(r.code));
  const canCreate = isAdmin || can('COMPTA_CREATE') || roles.some((r) => ['GERANT', 'COMPTABLE'].includes(r.code));
  const canEditBasic = isAdmin || can('COMPTA_ACCOUNT_EDIT');
  const canEditSensitive = isAdmin || can('COMPTA_ACCOUNT_ADMIN');
  const money = (value) => Number(value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  const loadAccounts = useCallback(async () => {
    if (exercicesLoading) return;
    if (!selectedExerciceId || !supabaseConfigured || !canRead) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [accountResult, parentResult, balanceResult, previousBalanceResult] = await Promise.all([
      supabase.from('comptes_comptables')
        .select('id,numero,libelle,classe,nature,actif,compte_parent_id,devise,lettrable,reconciliable,notes,solde_ouverture_debit,solde_ouverture_credit')
        .eq('exercice_id', selectedExerciceId).order('numero'),
      supabase.from('default_compt').select('id,num_compte,libelle').order('num_compte'),
      selectedExercice?.date_fin ? supabase.rpc('soldes_comptes_exercice', {
        p_exercice_id: selectedExerciceId,
        p_date_debut: selectedExercice.date_debut,
        p_date_fin: selectedExercice.date_fin,
      }) : Promise.resolve({ data: [], error: null }),
      previousCandidate?.date_fin ? supabase.rpc('soldes_comptes_exercice', {
        p_exercice_id: previousCandidate.id,
        p_date_debut: previousCandidate.date_debut,
        p_date_fin: previousCandidate.date_fin,
      }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (accountResult.error) setError(`Impossible de charger le plan comptable : ${accountResult.error.message}`);
    else setAccounts(accountResult.data || []);
    if (parentResult.error) setError((current) => current || `Impossible de charger le référentiel OHADA : ${parentResult.error.message}`);
    else setParents(parentResult.data || []);
    if (balanceResult.error) setError((current) => current || `Impossible de calculer les soldes du plan : ${balanceResult.error.message}`);
    else setBalances(Object.fromEntries((balanceResult.data || []).map((row) => [row.compte_id, row])));
    if (previousBalanceResult.error) setError((current) => current || `Comparaison N-1 indisponible : ${previousBalanceResult.error.message}`);
    else setPreviousBalances(Object.fromEntries((previousBalanceResult.data || []).map((row) => [row.numero, row])));
    setPreviousExercise(previousCandidate);
    setLoading(false);
  }, [canRead, exercicesLoading, selectedExerciceId, selectedExercice, previousCandidate]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const filteredAccounts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('fr');
    return accounts.filter((account) => {
      const number = classNumber(account);
      const matchesSearch = !search || `${account.numero} ${account.libelle} ${account.notes || ''}`.toLocaleLowerCase('fr').includes(search);
      const matchesClass = !selectedClass || String(number) === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [accounts, query, selectedClass]);

  const groups = useMemo(() => {
    const byClass = new Map();
    for (const account of filteredAccounts) {
      const num = classNumber(account);
      if (!byClass.has(num)) byClass.set(num, []);
      byClass.get(num).push(account);
    }
    const standardGroups = [
      { key: '1', ...CLASS_INFO[1], classes: [1] },
      { key: '2', ...CLASS_INFO[2], classes: [2] },
      { key: '3', ...CLASS_INFO[3], classes: [3] },
      { key: '4', ...CLASS_INFO[4], classes: [4] },
      { key: '5', ...CLASS_INFO[5], classes: [5] },
      { key: '6', ...CLASS_INFO[6], classes: [6] },
      { key: '7', ...CLASS_INFO[7], classes: [7] },
    ];
    return standardGroups.map((group) => ({
      ...group,
      rows: group.classes.flatMap((number) => byClass.get(number) || []),
    })).filter((group) => group.rows.length || (!searchHasFilter(query, selectedClass) && !loading)).map((group) => {
      const totalDebit = group.rows.reduce((sum, account) => sum + Number(balances[account.id]?.periode_debit || 0), 0);
      const totalCredit = group.rows.reduce((sum, account) => sum + Number(balances[account.id]?.periode_credit || 0), 0);
      const previousRows = group.rows.map((account) => previousBalances[account.numero]).filter(Boolean);
      const previousDebit = previousRows.reduce((sum, row) => sum + Number(row.periode_debit || 0), 0);
      const previousCredit = previousRows.reduce((sum, row) => sum + Number(row.periode_credit || 0), 0);
      const previousBalance = previousRows.reduce((sum, row) => sum + Number(row.solde_fin || 0), 0);
      const endingBalance = group.rows.reduce((sum, account) => sum + Number(balances[account.id]?.solde_fin || 0), 0);
      return { ...group, totalDebit, totalCredit, difference: totalDebit - totalCredit, previousDebit, previousCredit, previousBalance, endingBalance };
    });
  }, [filteredAccounts, query, selectedClass, loading, balances, previousBalances]);

  const healthItems = useMemo(() => {
    const items = [];
    for (const account of accounts) {
      const current = balances[account.id] || {};
      const debit = Number(current.periode_debit || 0);
      const credit = Number(current.periode_credit || 0);
      const balance = Number(current.solde_fin || 0);
      const openingDebit = Number(account.solde_ouverture_debit || 0);
      const openingCredit = Number(account.solde_ouverture_credit || 0);
      const previous = previousBalances[account.numero];
      if (openingDebit > 0 && openingCredit > 0) items.push({ account, type: 'warning', label: 'Solde d’ouverture à vérifier', detail: `Débit ${money(openingDebit)} et crédit ${money(openingCredit)} sont tous deux renseignés.` });
      if (!account.actif && (debit > 0 || credit > 0)) items.push({ account, type: 'warning', label: 'Compte inactif avec mouvements', detail: `Mouvements validés : débit ${money(debit)}, crédit ${money(credit)}.` });
      const debitNature = ['ACTIF', 'CHARGE', 'TRESORERIE'].includes(String(account.nature).toUpperCase());
      if (balance !== 0 && ((debitNature && balance < 0) || (!debitNature && balance > 0))) items.push({ account, type: 'warning', label: 'Solde du côté inhabituel', detail: `Nature ${account.nature || 'non définie'} · ${balance < 0 ? 'solde créditeur' : 'solde débiteur'} de ${money(Math.abs(balance))}. À contrôler selon le contexte.` });
      if (previous) {
        const previousTurnover = Number(previous.periode_debit || 0) + Number(previous.periode_credit || 0);
        const currentTurnover = debit + credit;
        if (currentTurnover >= 1000000 && (previousTurnover === 0 || currentTurnover > previousTurnover * 2)) items.push({ account, type: 'info', label: 'Variation importante par rapport à N-1', detail: `Mouvements ${money(currentTurnover)} cette année contre ${money(previousTurnover)} sur ${previousExercise?.code || 'l’exercice précédent'}.` });
      }
      if (debit === 0 && credit === 0) items.push({ account, type: 'muted', label: 'Aucun mouvement sur la période', detail: 'Le compte n’a reçu aucun mouvement validé pendant l’exercice.' });
    }
    return items;
  }, [accounts, balances, previousBalances, previousExercise]);
  const healthCounts = useMemo(() => ({ warning: healthItems.filter((item) => item.type === 'warning').length, info: healthItems.filter((item) => item.type === 'info').length, muted: healthItems.filter((item) => item.type === 'muted').length }), [healthItems]);

  const openEditor = (account) => {
    setEditing(account);
    setForm(accountForm(account));
  };

  const exportGroups = groups.map((group) => ({
    ...group,
    totalDebit: group.totalDebit,
    totalCredit: group.totalCredit,
    difference: group.difference,
    rows: group.rows.map((account) => ({
      id: account.id,
      numero: account.numero,
      libelle: account.libelle || '',
      notes: account.notes || '',
      debit: Number(balances[account.id]?.periode_debit || 0),
      credit: Number(balances[account.id]?.periode_credit || 0),
      difference: Number(balances[account.id]?.periode_debit || 0) - Number(balances[account.id]?.periode_credit || 0),
    })),
  }));
  const exportTitle = 'PLAN COMPTABLE GÉNÉRAL & SECTORIEL';
  const exportSubtitle = `Système comptable OHADA · Adapté aux activités agricoles · Exercice ${selectedExercice?.code || selectedExercice?.annee || ''}`;

  const deleteAccount = async (account) => {
    const confirmed = window.confirm(`Supprimer le compte ${account.numero} — ${account.libelle} ?\n\nUn compte utilisé dans une écriture ne peut pas être supprimé. Il faudra alors le désactiver.`);
    if (!confirmed) return;
    setDeletingId(account.id);
    setError('');
    const { error: deleteError } = await supabase.from('comptes_comptables').delete().eq('id', account.id).eq('exercice_id', selectedExerciceId);
    setDeletingId('');
    if (deleteError) {
      setError(`Suppression refusée : ${deleteError.message}`);
      return;
    }
    await loadAccounts();
  };

  const closeEditor = () => {
    if (saving) return;
    setEditing(null);
    setForm(null);
  };

  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleClass = (key) => setExpandedClasses((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const detailAccount = accounts.find((account) => account.id === detailAccountId) || null;
  const detailBalance = detailAccount ? balances[detailAccount.id] || {} : {};
  const normalDebit = detailAccount && ['ACTIF', 'CHARGE', 'TRESORERIE'].includes(String(detailAccount.nature).toUpperCase());
  const detailNet = Number(detailBalance.solde_fin || 0);
  const detailSide = detailNet === 0 ? 'Solde nul' : ((detailNet > 0) === normalDebit ? 'Solde normal' : 'Solde à vérifier');

  useEffect(() => {
    if (!detailAccountId || !selectedExerciceId) { setDetailEntries([]); return undefined; }
    let active = true;
    setDetailLoading(true);
    supabase.from('lignes_ecritures')
      .select('id,debit,credit,libelle,ecritures_comptables!ligne_ecriture_company_fk!inner(id,numero,date_ecriture,statut,exercice_id,journaux!ecriture_journal_company_fk(code))')
      .eq('compte_id', detailAccountId)
      .eq('ecritures_comptables.exercice_id', selectedExerciceId)
      .gte('ecritures_comptables.date_ecriture', selectedExercice?.date_debut)
      .lte('ecritures_comptables.date_ecriture', selectedExercice?.date_fin)
      .eq('ecritures_comptables.statut', 'VALIDEE')
      .limit(100)
      .then(({ data, error: detailError }) => {
        if (!active) return;
        if (detailError) setError(`Impossible de charger la fiche du compte : ${detailError.message}`);
        else setDetailEntries((data || []).sort((a, b) => b.ecritures_comptables.date_ecriture.localeCompare(a.ecritures_comptables.date_ecriture)).slice(0, 12));
        setDetailLoading(false);
      });
    return () => { active = false; };
  }, [detailAccountId, selectedExerciceId, selectedExercice]);

  const saveAccount = async (event) => {
    event.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setError('');
    const patch = {};
    if (canEditBasic) {
      patch.libelle = form.libelle.trim();
      patch.notes = form.notes.trim() || null;
      patch.lettrable = form.lettrable;
      patch.reconciliable = form.reconciliable;
    }
    if (canEditSensitive) {
      patch.numero = form.numero.trim();
      patch.classe = form.classe;
      patch.nature = form.nature;
      patch.actif = form.actif;
      patch.compte_parent_id = form.compte_parent_id || null;
      patch.devise = form.devise;
      patch.solde_ouverture_debit = Number(form.solde_ouverture_debit) || 0;
      patch.solde_ouverture_credit = Number(form.solde_ouverture_credit) || 0;
    }
    const { error: updateError } = await supabase.from('comptes_comptables').update(patch).eq('id', editing.id).eq('exercice_id', selectedExerciceId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(null);
    setForm(null);
    await loadAccounts();
  };

  if (!canRead) return <div className="page-content"><div className="message error" role="alert">Votre rôle n’a pas le privilège de consulter le plan comptable.</div></div>;
  if (!selectedExerciceId && !exercicesLoading) return <div className="page-content"><div className="message error" role="alert">Sélectionnez un exercice dans la barre supérieure pour afficher son plan comptable.</div></div>;

  return (
    <div className="page-content chart-of-accounts-page">
      <header className="page-header chart-page-header">
        <div>
          <h1 className="page-title chart-page-title"><BookOpen size={20} /> Plan comptable général &amp; sectoriel</h1>
          <p className="page-subtitle">Système comptable OHADA · Exercice <strong>{selectedExercice?.code || selectedExercice?.annee || 'sélectionné'}</strong> · {accounts.length} compte(s)</p>
        </div>
        <div className="chart-header-actions">
          <button type="button" className="chart-export-button" onClick={() => exportChartOfAccountsExcel({ groups: exportGroups, filename: `Plan_Comptable_${selectedExercice?.code || 'exercice'}`, title: exportTitle, subtitle: exportSubtitle })}><Download size={15} /> Excel</button>
          <button type="button" className="chart-export-button" onClick={() => setShowPdfPreview(true)}><FileDown size={15} /> PDF</button>
          {canCreate && <button type="button" className="chart-add-button" onClick={() => navigate('/nouveau-compte')}><Plus size={16} /> Nouveau compte</button>}
        </div>
      </header>

      <div className="chart-toolbar">
        <label className="chart-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un numéro, un intitulé…" /></label>
        <label className="chart-class-filter"><span>Classe</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="">Toutes</option>{[1, 2, 3, 4, 5, 6, 7].map((num) => <option key={num} value={num}>Classe {num}</option>)}</select></label>
        <span className="chart-result-count">{loading ? 'Chargement…' : `${filteredAccounts.length} compte(s)`}</span>
        <button type="button" className="chart-expand-button chart-health-toggle" onClick={() => setHealthExpanded((value) => !value)} aria-expanded={healthExpanded}>{healthExpanded ? 'Fermer les contrôles' : `Contrôles · ${healthCounts.warning}`} {healthExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
      </div>

      {healthExpanded && <section className="chart-health-panel" aria-labelledby="chart-health-title">
        <div className="chart-health-header"><div><span className="chart-eyebrow">Contrôle de cohérence</span><h2 id="chart-health-title">État du plan comptable</h2><p>Ces signaux aident à repérer les points qui méritent une vérification humaine.</p></div></div>
        <div className="chart-health-counts"><div className={healthCounts.warning ? 'has-warning' : 'is-clear'}><AlertTriangle size={16} /><strong>{healthCounts.warning}</strong><span>à vérifier</span></div><div><Info size={16} /><strong>{healthCounts.info}</strong><span>variations fortes</span></div><div><Clock3 size={16} /><strong>{healthCounts.muted}</strong><span>sans mouvement</span></div></div>
        {healthExpanded && <div className="chart-health-list">{healthItems.length ? healthItems.slice(0, 30).map((item, index) => <button type="button" className={`chart-health-item tone-${item.type}`} key={`${item.account.id}-${item.label}-${index}`} onClick={() => setDetailAccountId(item.account.id)}><span className="chart-health-account">{item.account.numero} · {item.account.libelle}</span><span className="chart-health-message"><strong>{item.label}</strong><small>{item.detail}</small></span><Eye size={15} /></button>) : <div className="chart-health-empty"><CheckCircle2 size={17} />Aucun signal particulier détecté sur cet exercice.</div>}</div>}
      </section>}

      {error && <div className="message error chart-error" role="alert"><CircleAlert size={16} /> {error}</div>}
      {!loading && accounts.length === 0 && !error && <div className="chart-empty"><BookOpen size={25} /><strong>Aucun compte pour cet exercice</strong><span>Les comptes seront regroupés ici selon leur classe comptable.</span>{canCreate && <button type="button" onClick={() => navigate('/nouveau-compte')}>Créer le premier compte</button>}</div>}
      {!loading && accounts.length > 0 && filteredAccounts.length === 0 && <div className="chart-empty"><Search size={22} /><strong>Aucun compte correspondant</strong><span>Modifiez la recherche ou réinitialisez le filtre de classe.</span></div>}

      {(loading || filteredAccounts.length > 0) && <div className="chart-columns">
        {['left', 'right'].map((column) => (
          <div className="chart-column" key={column}>
            {groups.filter((group) => group.column === column).map((group) => (
              <section className="chart-class-card" key={group.key}>
                <div className="chart-class-summary"><div><span className="chart-class-count">{group.rows.length} compte{group.rows.length > 1 ? 's' : ''}</span><h2>{group.title}</h2></div><div className="chart-class-totals"><span><small>Débit</small><strong>{money(group.totalDebit)}</strong></span><span><small>Crédit</small><strong>{money(group.totalCredit)}</strong></span><span><small>Différence</small><DifferenceValue value={group.difference} money={money} /></span></div><button type="button" className="chart-expand-button" onClick={() => toggleClass(group.key)} aria-expanded={expandedClasses.has(group.key)}>{expandedClasses.has(group.key) ? <>Réduire <ChevronUp size={15} /></> : <>Voir plus <ChevronDown size={15} /></>}</button></div>
                {expandedClasses.has(group.key) && <>
                <table>
                  <thead><tr><th>Compte</th><th>Intitulé du compte</th><th className="numeric">Débit</th><th className="numeric">Crédit</th><th className="numeric">Différence</th><th aria-label="Actions" /></tr></thead>
                  <tbody>
                    {group.rows.map((account) => (
                      <tr key={account.id} className={!account.actif ? 'chart-account-inactive' : ''}>
                        <td className="chart-account-number">{account.numero}</td>
                        <td><span className="chart-account-label">{classTitle(account)}</span><small className="chart-nature-line"><span className="chart-nature-pill">{account.nature || 'Nature non définie'}</span>{balances[account.id]?.solde_fin ? <span className={detailNetSide(account, balances[account.id].solde_fin) ? 'normal-side' : 'unusual-side'}>{Number(balances[account.id].solde_fin) > 0 ? 'Solde débiteur' : 'Solde créditeur'} · {detailNetSide(account, balances[account.id].solde_fin) ? 'normal' : 'à vérifier'}</span> : null}</small>{account.notes && <small className="chart-account-note">{account.notes}</small>}</td>
                        <td className="numeric">{money(balances[account.id]?.periode_debit)}</td><td className="numeric">{money(balances[account.id]?.periode_credit)}</td><td className="numeric"><DifferenceValue value={Number(balances[account.id]?.periode_debit || 0) - Number(balances[account.id]?.periode_credit || 0)} money={money} /></td>
                        <td className="chart-account-action"><span><button type="button" onClick={() => setDetailAccountId(account.id)} aria-label={`Voir la fiche du compte ${account.numero}`} title="Voir la fiche"><Eye size={14} /></button>{canCreate && <button type="button" onClick={() => navigate(`/nouveau-compte?parentCode=${encodeURIComponent(account.numero)}`)} aria-label={`Ajouter un sous-compte à ${account.numero}`} title="Ajouter un sous-compte"><Plus size={14} /></button>}{(canEditBasic || canEditSensitive) && <button type="button" onClick={() => openEditor(account)} aria-label={`Modifier le compte ${account.numero}`} title="Modifier"><Edit3 size={14} /></button>}{canEditSensitive && <button type="button" className="chart-delete-button" disabled={deletingId === account.id} onClick={() => deleteAccount(account)} aria-label={`Supprimer le compte ${account.numero}`} title="Supprimer">{deletingId === account.id ? '…' : <Trash2 size={14} />}</button>}</span></td>
                      </tr>
                    ))}
                    {!group.rows.length && <tr><td colSpan={(canEditBasic || canEditSensitive || canCreate) ? 6 : 5} className="chart-no-rows">Aucun compte dans cette classe.</td></tr>}
                  </tbody>
                </table>
                {previousExercise && <div className="chart-class-comparison"><span className="comparison-title">Évolution vs {previousExercise.code || previousExercise.annee}</span><span>Débit <TrendDelta value={group.totalDebit - group.previousDebit} money={money} /></span><span>Crédit <TrendDelta value={group.totalCredit - group.previousCredit} money={money} /></span><span>Solde net <TrendDelta value={group.endingBalance - group.previousBalance} money={money} /></span></div>}
                </>}
              </section>
            ))}
          </div>
        ))}
      </div>}

      {editing && form && (
        <div className="chart-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }}>
          <section className="chart-edit-modal" role="dialog" aria-modal="true" aria-labelledby="chart-edit-title">
            <header><div><span>Compte {editing.numero}</span><h2 id="chart-edit-title">Modifier le compte</h2></div><button type="button" onClick={closeEditor} aria-label="Fermer"><X size={19} /></button></header>
            <div className="chart-permission-note"><ShieldCheck size={15} /> Les champs modifiables dépendent de votre rôle dans cette entreprise.</div>
            <form onSubmit={saveAccount}>
              <div className="chart-edit-grid">
                <label>Numéro de compte<input required value={form.numero} disabled={!canEditSensitive} onChange={(event) => change('numero', event.target.value)} /></label>
                <label>Libellé<input required value={form.libelle} disabled={!canEditBasic} onChange={(event) => change('libelle', event.target.value)} /></label>
                <label>Classe<select value={form.classe} disabled={!canEditSensitive} onChange={(event) => change('classe', event.target.value)}>{CLASS_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Nature<select value={form.nature} disabled={!canEditSensitive} onChange={(event) => change('nature', event.target.value)}>{NATURE_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Compte de référence OHADA<select value={form.compte_parent_id} disabled={!canEditSensitive} onChange={(event) => change('compte_parent_id', event.target.value)}><option value="">Aucun</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.num_compte} · {parent.libelle}</option>)}</select></label>
                <label>Devise<select value={form.devise} disabled={!canEditSensitive} onChange={(event) => change('devise', event.target.value)}>{['XAF', 'EUR', 'USD'].map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Solde d’ouverture débiteur<input type="number" min="0" step="0.01" value={form.solde_ouverture_debit} disabled={!canEditSensitive} onChange={(event) => change('solde_ouverture_debit', event.target.value)} /></label>
                <label>Solde d’ouverture créditeur<input type="number" min="0" step="0.01" value={form.solde_ouverture_credit} disabled={!canEditSensitive} onChange={(event) => change('solde_ouverture_credit', event.target.value)} /></label>
                <label className="chart-edit-notes">Notes / description<textarea rows="3" value={form.notes} disabled={!canEditBasic} onChange={(event) => change('notes', event.target.value)} /></label>
              </div>
              <div className="chart-edit-toggles">
                <label><input type="checkbox" checked={form.actif} disabled={!canEditSensitive} onChange={(event) => change('actif', event.target.checked)} /> Compte actif</label>
                <label><input type="checkbox" checked={form.lettrable} disabled={!canEditBasic} onChange={(event) => change('lettrable', event.target.checked)} /> Lettrable</label>
                <label><input type="checkbox" checked={form.reconciliable} disabled={!canEditBasic} onChange={(event) => change('reconciliable', event.target.checked)} /> Rapprochable</label>
              </div>
              {canEditSensitive && <p className="chart-sensitive-hint">Les changements du numéro, de la classe, de la nature et des soldes sont réservés aux privilèges élevés.</p>}
              <footer><button className="chart-cancel-button" type="button" onClick={closeEditor} disabled={saving}>Annuler</button><button className="chart-save-button" type="submit" disabled={saving || (!canEditBasic && !canEditSensitive)}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></footer>
            </form>
          </section>
        </div>
      )}

      {detailAccount && (
        <div className="chart-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailAccountId(''); }}>
          <section className="chart-detail-modal" role="dialog" aria-modal="true" aria-labelledby="chart-detail-title">
            <header><div><span className="chart-detail-kicker">Fiche compte · {selectedExercice?.code || selectedExercice?.annee}</span><h2 id="chart-detail-title">{detailAccount.numero} · {detailAccount.libelle}</h2><p><span className="chart-nature-pill">{detailAccount.nature}</span><span className={detailNetSide(detailAccount, detailNet) ? 'normal-side' : 'unusual-side'}>{detailSide}</span></p></div><button type="button" onClick={() => setDetailAccountId('')} aria-label="Fermer"><X size={19} /></button></header>
            <div className="chart-detail-stats">
              <article><span>Solde d’ouverture débit</span><strong>{money(detailAccount.solde_ouverture_debit)} <small>{detailAccount.devise || 'XAF'}</small></strong></article>
              <article><span>Solde d’ouverture crédit</span><strong>{money(detailAccount.solde_ouverture_credit)} <small>{detailAccount.devise || 'XAF'}</small></strong></article>
              <article><span>Mouvements débit</span><strong>{money(detailBalance.periode_debit)} <small>{detailAccount.devise || 'XAF'}</small></strong></article>
              <article><span>Mouvements crédit</span><strong>{money(detailBalance.periode_credit)} <small>{detailAccount.devise || 'XAF'}</small></strong></article>
              <article className="detail-ending-balance"><span>Solde final net</span><strong>{detailNet < 0 ? '−' : ''}{money(Math.abs(detailNet))} <small>{detailAccount.devise || 'XAF'}</small></strong><DifferenceValue value={detailNet} money={money} /></article>
            </div>
            <div className="chart-detail-ledger-heading"><div><h3>Mouvements validés</h3><span>Dernières opérations de l’exercice</span></div><button type="button" className="chart-expand-button" onClick={() => { setDetailAccountId(''); navigate(`/grand-livre?compte=${encodeURIComponent(detailAccount.id)}`); }}>Ouvrir le grand livre <ExternalLink size={14} /></button></div>
            {detailLoading ? <div className="chart-detail-loading">Chargement des mouvements…</div> : detailEntries.length ? <div className="chart-detail-lines"><table><thead><tr><th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th className="numeric">Débit</th><th className="numeric">Crédit</th></tr></thead><tbody>{detailEntries.map((line) => <tr key={line.id}><td>{new Date(`${line.ecritures_comptables.date_ecriture}T00:00:00`).toLocaleDateString('fr-FR')}</td><td>{line.ecritures_comptables.journaux?.code || '—'}</td><td>{line.ecritures_comptables.numero || '—'}</td><td>{line.libelle || '—'}</td><td className="numeric">{money(line.debit)}</td><td className="numeric">{money(line.credit)}</td></tr>)}</tbody></table></div> : <div className="chart-detail-loading">Aucun mouvement validé sur ce compte pour cet exercice.</div>}
            {previousExercise && previousBalances[detailAccount.numero] && <p className="chart-detail-compare">Exercice précédent ({previousExercise.code || previousExercise.annee}) : débit {money(previousBalances[detailAccount.numero].periode_debit)} · crédit {money(previousBalances[detailAccount.numero].periode_credit)} · solde net {money(previousBalances[detailAccount.numero].solde_fin)}.</p>}
          </section>
        </div>
      )}

      <PDFPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Plan comptable général & sectoriel"
        subtitle={`${exportSubtitle} · ${filteredAccounts.length} compte(s)`}
        filename={`Plan_Comptable_${selectedExercice?.code || 'exercice'}`}
        defaultOrientation="landscape"
        renderDocument={(orientation) => <ChartOfAccountsPDF title={exportTitle} subtitle={exportSubtitle} groups={exportGroups} footerText="CIPRESA · Plan comptable OHADA sectoriel agricole" orientation={orientation} />}
      />
    </div>
  );
}

function searchHasFilter(query, selectedClass) {
  return Boolean(query.trim() || selectedClass);
}
