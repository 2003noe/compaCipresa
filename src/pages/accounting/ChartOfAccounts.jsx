import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CircleAlert, Download, Edit3, FileDown, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { exportToExcel, GenericTablePDF, PDFPreviewModal } from '../../lib/generateFile';
import './chartOfAccounts.css';

const CLASS_INFO = {
  1: { title: 'Classe 1 : Ressources durables', column: 'left' },
  2: { title: 'Classe 2 : Actif immobilisé', column: 'right' },
  3: { title: 'Classe 3 : Stocks et en-cours', column: 'left' },
  6: { title: "Classe 6 : Charges d'exploitation", column: 'right' },
  7: { title: "Classe 7 : Produits d'exploitation", column: 'right' },
};
const CLASS45 = { title: 'Classes 4 & 5 : Tiers et trésorerie', column: 'left' };

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

export default function ChartOfAccounts() {
  const { selectedExerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
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

  const isAdmin = hasRole('ADMIN');
  const canRead = isAdmin || can('COMPTA_READ') || can('COMPTA_CREATE') || can('COMPTA_ACCOUNT_EDIT') || can('COMPTA_ACCOUNT_ADMIN') || roles.some((r) => ['GERANT', 'COMPTABLE', 'CONSULTANT'].includes(r.code));
  const canCreate = isAdmin || can('COMPTA_CREATE') || roles.some((r) => ['GERANT', 'COMPTABLE'].includes(r.code));
  const canEditBasic = isAdmin || can('COMPTA_ACCOUNT_EDIT');
  const canEditSensitive = isAdmin || can('COMPTA_ACCOUNT_ADMIN');

  const loadAccounts = useCallback(async () => {
    if (exercicesLoading) return;
    if (!selectedExerciceId || !supabaseConfigured || !canRead) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [accountResult, parentResult] = await Promise.all([
      supabase.from('comptes_comptables')
        .select('id,numero,libelle,classe,nature,actif,compte_parent_id,devise,lettrable,reconciliable,notes,solde_ouverture_debit,solde_ouverture_credit')
        .eq('exercice_id', selectedExerciceId).order('numero'),
      supabase.from('default_compt').select('id,num_compte,libelle').order('num_compte'),
    ]);
    if (accountResult.error) setError(`Impossible de charger le plan comptable : ${accountResult.error.message}`);
    else setAccounts(accountResult.data || []);
    if (parentResult.error) setError((current) => current || `Impossible de charger le référentiel OHADA : ${parentResult.error.message}`);
    else setParents(parentResult.data || []);
    setLoading(false);
  }, [canRead, exercicesLoading, selectedExerciceId]);

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
      { key: '45', ...CLASS45, classes: [4, 5] },
      { key: '6', ...CLASS_INFO[6], classes: [6] },
      { key: '7', ...CLASS_INFO[7], classes: [7] },
    ];
    return standardGroups.map((group) => ({
      ...group,
      rows: group.classes.flatMap((number) => byClass.get(number) || []),
    })).filter((group) => group.rows.length || (!searchHasFilter(query, selectedClass) && !loading));
  }, [filteredAccounts, query, selectedClass, loading]);

  const openEditor = (account) => {
    setEditing(account);
    setForm(accountForm(account));
  };

  const exportRows = filteredAccounts.map((account) => ({
    numero: account.numero,
    libelle: account.libelle,
    classe: account.classe,
    nature: account.nature,
    statut: account.actif ? 'Actif' : 'Inactif',
    soldeOuverture: Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0),
    notes: account.notes || '',
  }));
  const exportColumns = [
    { key: 'numero', label: 'Compte' },
    { key: 'libelle', label: 'Intitulé du compte' },
    { key: 'classe', label: 'Classe' },
    { key: 'nature', label: 'Nature' },
    { key: 'statut', label: 'Statut' },
    { key: 'soldeOuverture', label: 'Solde d’ouverture' },
    { key: 'notes', label: 'Notes' },
  ];

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
      <header className="chart-page-header">
        <div>
          <span className="chart-eyebrow">SYSTÈME COMPTABLE OHADA · AGRICULTURE</span>
          <h1><BookOpen size={23} /> Plan comptable général &amp; sectoriel</h1>
          <p>Plan de l’exercice <strong>{selectedExercice?.code || selectedExercice?.annee || 'sélectionné'}</strong> · {accounts.length} compte(s)</p>
        </div>
        <div className="chart-header-actions">
          <button type="button" className="chart-export-button" onClick={() => exportToExcel({ rows: exportRows, columns: exportColumns, filename: `Plan_Comptable_${selectedExercice?.code || 'exercice'}`, sheet: 'Plan comptable', title: 'Plan comptable général & sectoriel', subtitle: `Exercice : ${selectedExercice?.code || selectedExercice?.annee || ''}` })}><Download size={15} /> Excel</button>
          <button type="button" className="chart-export-button" onClick={() => setShowPdfPreview(true)}><FileDown size={15} /> PDF</button>
          {canCreate && <button type="button" className="chart-add-button" onClick={() => navigate('/nouveau-compte')}><Plus size={16} /> Nouveau compte</button>}
        </div>
      </header>

      <div className="chart-toolbar">
        <label className="chart-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un numéro, un intitulé…" /></label>
        <label className="chart-class-filter"><span>Classe</span><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="">Toutes</option>{[1, 2, 3, 4, 5, 6, 7].map((num) => <option key={num} value={num}>Classe {num}</option>)}</select></label>
        <span className="chart-result-count">{loading ? 'Chargement…' : `${filteredAccounts.length} compte(s)`}</span>
      </div>

      {error && <div className="message error chart-error" role="alert"><CircleAlert size={16} /> {error}</div>}
      {!loading && accounts.length === 0 && !error && <div className="chart-empty"><BookOpen size={25} /><strong>Aucun compte pour cet exercice</strong><span>Les comptes seront regroupés ici selon leur classe comptable.</span>{canCreate && <button type="button" onClick={() => navigate('/nouveau-compte')}>Créer le premier compte</button>}</div>}
      {!loading && accounts.length > 0 && filteredAccounts.length === 0 && <div className="chart-empty"><Search size={22} /><strong>Aucun compte correspondant</strong><span>Modifiez la recherche ou réinitialisez le filtre de classe.</span></div>}

      {(loading || filteredAccounts.length > 0) && <div className="chart-columns">
        {['left', 'right'].map((column) => (
          <div className="chart-column" key={column}>
            {groups.filter((group) => group.column === column).map((group) => (
              <section className="chart-class-card" key={group.key}>
                <h2>{group.title}</h2>
                <table>
                  <thead><tr><th>Compte</th><th>Intitulé du compte</th>{(canEditBasic || canEditSensitive) && <th aria-label="Actions" />}</tr></thead>
                  <tbody>
                    {group.rows.map((account) => (
                      <tr key={account.id} className={!account.actif ? 'chart-account-inactive' : ''}>
                        <td className="chart-account-number">{account.numero}</td>
                        <td><span className="chart-account-label">{classTitle(account)}</span>{account.notes && <small className="chart-account-note">{account.notes}</small>}</td>
                        {(canEditBasic || canEditSensitive) && <td className="chart-account-action"><span><button type="button" onClick={() => openEditor(account)} aria-label={`Modifier le compte ${account.numero}`} title="Modifier"><Edit3 size={14} /></button>{canEditSensitive && <button type="button" className="chart-delete-button" disabled={deletingId === account.id} onClick={() => deleteAccount(account)} aria-label={`Supprimer le compte ${account.numero}`} title="Supprimer">{deletingId === account.id ? '…' : <Trash2 size={14} />}</button>}</span></td>}
                      </tr>
                    ))}
                    {!group.rows.length && <tr><td colSpan={(canEditBasic || canEditSensitive) ? 3 : 2} className="chart-no-rows">Aucun compte dans cette classe.</td></tr>}
                  </tbody>
                </table>
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

      <PDFPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        title="Plan comptable général & sectoriel"
        subtitle={`Exercice : ${selectedExercice?.code || selectedExercice?.annee || ''} · ${filteredAccounts.length} compte(s)`}
        filename={`Plan_Comptable_${selectedExercice?.code || 'exercice'}`}
        defaultOrientation="landscape"
        renderDocument={(orientation) => <GenericTablePDF title="Plan comptable général & sectoriel" subtitle={`Exercice : ${selectedExercice?.code || selectedExercice?.annee || ''}`} columns={exportColumns} rows={exportRows} footerText="CIPRESA · Plan comptable OHADA sectoriel agricole" orientation={orientation} />}
      />
    </div>
  );
}

function searchHasFilter(query, selectedClass) {
  return Boolean(query.trim() || selectedClass);
}



