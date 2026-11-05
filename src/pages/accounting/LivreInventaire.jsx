import { useEffect, useMemo, useState } from 'react';
import { 
  ClipboardList, 
  Download, 
  Printer, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Building2, 
  Package, 
  Users, 
  Wallet, 
  ShieldCheck, 
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { editPhysicalInventory, toast } from '../../lib/notifications';
import { computeDepreciation } from '../../lib/depreciation';
import { exportLivreInventaireExcel, exportLivreInventairePDF, LivreInventairePDFDocument, PDFPreviewModal } from '../../lib/generateFile';
import { calculateInventoryStatement, calculatePhysicalInventoryTotals, classifyInventoryAccount, hasAtypicalInventoryBalance, isContraAssetAccount, isPatrimonialAccount } from '../../lib/accounting/inventoryStatement';
import './LivreInventaire.css';

function PhysicalInventoryBook() {
  const { selectedExerciceId, exercices } = useExercice();
  const [rows, setRows] = useState([]);
  const [validation, setValidation] = useState(null);
  const [notice, setNotice] = useState('');
  const emptyForm = { code: '', designation: '', categorie: '', etat_physique: '', emplacement_physique: '', observation: '', unite: '', quantite_theorique: '', quantite_reelle: '', cout_unitaire: '', valeur_comptable: '' };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const money = (value) => Number(value || 0).toLocaleString('fr-FR');
  const selected = exercices.find((item) => item.id === selectedExerciceId);
  useEffect(() => {
    if (!selectedExerciceId) { setRows([]); return; }
    Promise.all([
      supabase.from('inventaire_physique').select('*').eq('exercice_id', selectedExerciceId).order('code'),
      supabase.from('inventaire_physique_validations').select('valide_le,valide_par').eq('exercice_id', selectedExerciceId).maybeSingle(),
    ]).then(([inventory, finalized]) => {
      if (inventory.error) setNotice(inventory.error.message);
      else setRows(inventory.data || []);
      setValidation(finalized.data || null);
    });
  }, [selectedExerciceId]);
  const create = async (event) => {
    event.preventDefault(); setSaving(true); setNotice('');
    const payload = { ...form, quantite_theorique: Number(form.quantite_theorique), quantite_reelle: Number(form.quantite_reelle), cout_unitaire: Number(form.cout_unitaire), valeur_comptable: Number(form.valeur_comptable), recensement_effectue: true, exercice_id: selectedExerciceId, date_inventaire: new Date().toISOString().slice(0, 10) };
    const { error } = await supabase.from('inventaire_physique').insert(payload);
    setSaving(false);
    if (error) { setNotice(error.message); return; }
    setForm(emptyForm);
    const { data } = await supabase.from('inventaire_physique').select('*').eq('exercice_id', selectedExerciceId).order('code'); setRows(data || []);
  };
  const edit = async (row) => {
    const values = await editPhysicalInventory({ title: `Inventaire physique · ${row.code}`, etat: row.etat_physique || '', emplacement: row.emplacement_physique || '', observation: row.observation || '', unite: row.unite || '', quantite_theorique: row.quantite_theorique ?? '', quantite_reelle: row.quantite_reelle ?? '', cout_unitaire: row.cout_unitaire ?? '', valeur_comptable: row.valeur_comptable ?? '' });
    if (!values) return;
    const { error } = await supabase.from('inventaire_physique').update({ etat_physique: values.etat, emplacement_physique: values.emplacement, unite: values.unite, quantite_theorique: values.quantite_theorique, quantite_reelle: values.quantite_reelle, cout_unitaire: values.cout_unitaire, valeur_comptable: values.valeur_comptable, recensement_effectue: true, date_inventaire: new Date().toISOString().slice(0, 10), observation: values.observation }).eq('id', row.id);
    if (error) { setNotice(error.message); toast.error('Mise à jour impossible', error.message); }
    else {
      const { data } = await supabase.from('inventaire_physique').select('*').eq('exercice_id', selectedExerciceId).order('code');
      setRows(data || []);
      toast.success('Inventaire mis à jour', row.designation);
    }
  };
  const finalize = async () => {
    const { error } = await supabase.rpc('valider_inventaire_physique', { p_exercice_id: selectedExerciceId });
    if (error) { setNotice(error.message); toast.error('Validation impossible', error.message); return; }
    const { data } = await supabase.from('inventaire_physique_validations').select('valide_le,valide_par').eq('exercice_id', selectedExerciceId).maybeSingle();
    setValidation(data || null);
    toast.success('Inventaire physique arrêté', 'Les lignes sont désormais verrouillées.');
  };
  return <div className="page-content"><div className="page-header"><div><h1 className="page-title">Inventaire physique</h1><p className="page-subtitle">Registre de terrain · Exercice {selected?.code || selected?.annee || '—'}</p></div></div>
    {notice && <div className="message error" role="alert">{notice}</div>}
    {validation ? <Card><Badge variant="success">Inventaire validé le {new Date(validation.valide_le).toLocaleDateString('fr-FR')}</Badge><p>Le recensement est arrêté et les lignes sont verrouillées.</p></Card> : <Card><h2 className="section-title">Ajouter un élément physique</h2><form onSubmit={create} className="grid grid-3"><Input label="Code inventaire" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /><Input label="Désignation" required value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /><Input label="Catégorie" value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} /><Input label="État physique" value={form.etat_physique} onChange={(e) => setForm({ ...form, etat_physique: e.target.value })} /><Input label="Emplacement" value={form.emplacement_physique} onChange={(e) => setForm({ ...form, emplacement_physique: e.target.value })} /><Input label="Unité" placeholder="kg, sac, unité…" value={form.unite} onChange={(e) => setForm({ ...form, unite: e.target.value })} /><Input label="Quantité comptable" type="number" min="0" step="0.001" required value={form.quantite_theorique} onChange={(e) => setForm({ ...form, quantite_theorique: e.target.value })} /><Input label="Quantité constatée" type="number" min="0" step="0.001" required value={form.quantite_reelle} onChange={(e) => setForm({ ...form, quantite_reelle: e.target.value })} /><Input label="Coût unitaire" type="number" min="0" step="0.01" required value={form.cout_unitaire} onChange={(e) => setForm({ ...form, cout_unitaire: e.target.value })} /><Input label="Valeur comptable" type="number" min="0" step="0.01" required value={form.valeur_comptable} onChange={(e) => setForm({ ...form, valeur_comptable: e.target.value })} /><Input label="Observation" value={form.observation} onChange={(e) => setForm({ ...form, observation: e.target.value })} /><Button type="submit" disabled={saving || !selectedExerciceId}>{saving ? 'Enregistrement…' : 'Ajouter un élément recensé'}</Button></form><small>La quantité réelle peut être zéro, mais doit être saisie explicitement pour compter la ligne comme recensée.</small></Card>}
    <Card><div className="page-header"><div><h2 className="section-title">Registre du recensement</h2><p>{rows.filter((row) => row.recensement_effectue).length} / {rows.length} ligne(s) recensée(s)</p></div>{!validation && <Button onClick={finalize} disabled={!rows.length || rows.some((row) => !row.recensement_effectue)}>Valider et arrêter l’inventaire</Button>}</div><div className="table-wrap"><table className="balance-table"><thead><tr><th>Code</th><th>Bien</th><th>Catégorie</th><th>Qté comptable</th><th>Qté réelle</th><th>Écart Qté</th><th>Valeur comptable</th><th>Valeur constatée</th><th>Écart valeur</th><th>État</th><th>Emplacement</th><th>Inventorié le</th><th>Observation</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.designation}</td><td>{row.categorie}</td><td>{row.recensement_effectue ? `${row.quantite_theorique} ${row.unite || ''}` : 'Non déterminé'}</td><td>{row.recensement_effectue ? `${row.quantite_reelle} ${row.unite || ''}` : 'Non déterminé'}</td><td>{row.recensement_effectue ? `${row.ecart_quantite} ${row.unite || ''}` : 'Non déterminé'}</td><td>{row.recensement_effectue ? money(row.valeur_comptable) : 'Non déterminé'}</td><td>{row.recensement_effectue ? money(row.valeur_constatee) : 'Non déterminé'}</td><td>{row.recensement_effectue ? money(row.ecart_valeur) : 'Non déterminé'}</td><td>{row.etat_physique || 'À inventorier'}</td><td>{row.emplacement_physique || '—'}</td><td>{row.date_inventaire || '—'}</td><td>{row.observation || '—'}</td><td>{!validation && <Button size="sm" variant="secondary" onClick={() => edit(row)}>Mettre à jour / recenser</Button>}</td></tr>)}{!rows.length && <tr><td colSpan={14}>Aucun bien pour cet exercice. Inventaire physique non déterminé.</td></tr>}</tbody></table></div></Card>
  </div>;
}

function AccountingLivreInventaire() {
  const { exercices: exercises, selectedExerciceId: exerciceId, loading: exercicesLoading } = useExercice();
  const { selectedEntrepriseId, can } = useAuth();
  const canExport = can('COMPTA_EXPORT');
  const [accounts, setAccounts] = useState([]);
  const [lines, setLines] = useState([]);
  const [physicalAssets, setPhysicalAssets] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [viewMode, setViewMode] = useState('SIMPLE');
  const [balanceRows, setBalanceRows] = useState([]);
  const [physicalInventoryRows, setPhysicalInventoryRows] = useState([]);
  const [inventoryValidation, setInventoryValidation] = useState(null);

  const devise = 'FCFA (XAF) — BEAC';

  const money = (v) => {
    const n = Math.round(Number(v || 0));
    return n.toLocaleString('fr-FR');
  };

  const dash = (v) => {
    const n = Number(v || 0);
    return n === 0 ? '-' : money(n);
  };

  // Chargement 100% dynamique depuis Supabase
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    if (exercicesLoading) return;
    if (!exerciceId || !selectedEntrepriseId) { setAccounts([]); setBalanceRows([]); setLines([]); setPhysicalAssets([]); setPhysicalInventoryRows([]); setInventoryValidation(null); setLoading(false); return; }

    setLoading(true);
    setNotice('');
    setInventoryValidation(null);
    const selected = exercises.find((e) => e.id === exerciceId);
    let active = true;

    Promise.all([
      supabase
        .from('comptes_comptables')
        .select('id,entreprise_id,numero,libelle,classe,nature,actif,compte_parent_id,parent_compte_id,solde_ouverture_debit,solde_ouverture_credit,devise')
        .eq('entreprise_id', selectedEntrepriseId)
        .order('numero'),
      supabase
        .rpc('get_trial_balance_company_scoped', {
          p_company_id: selectedEntrepriseId,
          p_fiscal_year_id: exerciceId,
          p_date_from: selected?.date_debut,
          p_date_to: cutoffDate || selected?.date_fin,
        }),
      supabase
        .from('lignes_ecritures')
        .select('compte_id,debit,credit,ecritures_comptables!ligne_ecriture_company_fk!inner(entreprise_id,exercice_id,date_ecriture,statut)')
        .eq('ecritures_comptables.entreprise_id', selectedEntrepriseId)
        .eq('ecritures_comptables.exercice_id', exerciceId)
        .eq('ecritures_comptables.statut', 'VALIDEE')
        .gte('ecritures_comptables.date_ecriture', selected?.date_debut)
        .lte('ecritures_comptables.date_ecriture', cutoffDate || selected?.date_fin),
      supabase
        .from('immobilisations')
        .select('*')
        .eq('entreprise_id', selectedEntrepriseId)
        .eq('exercice_id', exerciceId)
        .order('code'),
      supabase
        .from('inventaire_physique')
        .select('*')
        .eq('entreprise_id', selectedEntrepriseId)
        .eq('exercice_id', exerciceId)
        .order('code'),
      supabase.from('inventaire_physique_validations').select('valide_le,valide_par').eq('exercice_id', exerciceId).maybeSingle(),
      supabase
        .from('parametres_entreprise')
        .select('*')
        .eq('entreprise_id', selectedEntrepriseId)
        .maybeSingle(),
    ])
      .then(([acRes, tbRes, lnRes, immoRes, physicalRes, validationRes, compRes]) => {
        if (!active) return;
        if (acRes.error || tbRes.error || lnRes.error || physicalRes.error || validationRes.error) {
          const err = acRes.error || tbRes.error || lnRes.error || physicalRes.error || validationRes.error;
          setNotice(`Impossible de charger le livre d'inventaire : ${err.message}`);
          setLoading(false);
          return;
        }

        setAccounts(acRes.data || []);
        setBalanceRows(tbRes.data || []);
        setLines(lnRes.data || []);
        setPhysicalAssets((immoRes.data || []).filter((asset) => !selected || asset.date_acquisition <= selected.date_fin));
        setPhysicalInventoryRows(physicalRes.data || []);
        setInventoryValidation(validationRes?.data || null);
        if (compRes?.data) {
          setCompany(compRes.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setNotice(`Erreur inattendue : ${err.message}`);
        setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey, exerciceId, exercicesLoading, exercises, selectedEntrepriseId, cutoffDate]);

  const selectedExercice = useMemo(
    () => exercises.find((e) => e.id === exerciceId) || null,
    [exercises, exerciceId]
  );

  // La date d'arrêté suit l'exercice choisi dans la topbar
  useEffect(() => {
    if (!selectedExercice) return;
    setCutoffDate(selectedExercice.date_fin || new Date().toISOString().slice(0, 10));
  }, [selectedExercice]);

  // Le même RPC que la Balance fournit les soldes d'ouverture, mouvements et soldes finaux.
  // Le Grand Livre reste la source détaillée des lignes qui composent chaque total.
  const resultNet = useMemo(() => {
    return balanceRows.reduce((total, row) => {
      const code = String(row.account_code || '').replace(/\D/g, '');
      if (code.startsWith('6')) return total - Number(row.period_debit || 0) + Number(row.period_credit || 0);
      if (code.startsWith('7')) return total + Number(row.period_credit || 0) - Number(row.period_debit || 0);
      return total;
    }, 0);
  }, [balanceRows]);

  const lineAuditByAccount = useMemo(() => {
    const map = new Map();
    lines.forEach((line) => {
      const current = map.get(line.compte_id) || { debit: 0, credit: 0, count: 0 };
      current.debit += Number(line.debit || 0);
      current.credit += Number(line.credit || 0);
      current.count += 1;
      map.set(line.compte_id, current);
    });
    return map;
  }, [lines]);

  // Données dynamiques calculées pour l'inventaire
  const inventoryAccounts = useMemo(() => {
    const trialBalanceById = new Map(balanceRows.map((row) => [row.account_id, row]));
    const childIdsByParent = new Map();
    accounts.forEach((account) => {
      const parentId = account.parent_compte_id;
      if (parentId) childIdsByParent.set(parentId, [...(childIdsByParent.get(parentId) || []), account.id]);
    });
    return accounts.filter(isPatrimonialAccount).map((acc) => {
      const row = trialBalanceById.get(acc.id);
      const classification = classifyInventoryAccount(acc);
      const signed = Number(row?.signed_closing_balance || 0);
      const openingSigned = Number(row?.opening_debit || 0) - Number(row?.opening_credit || 0);
      const contra = isContraAssetAccount(acc);
      const children = childIdsByParent.get(acc.id) || [];
      const hasActiveChildren = children.some((id) => Number(trialBalanceById.get(id)?.signed_closing_balance || 0) !== 0);
      const parentAndChildActivity = signed !== 0 && hasActiveChildren;
      const duplicateOpening = Boolean(row?.possible_duplicate_opening);
      const atypical = hasAtypicalInventoryBalance(acc, signed);
      const lineAudit = lineAuditByAccount.get(acc.id) || { debit: 0, credit: 0, count: 0 };
      const closingFromLedgerLines = openingSigned + lineAudit.debit - lineAudit.credit;
      const rpcLineMismatch = Math.abs(lineAudit.debit - Number(row?.period_debit || 0)) > 0.01
        || Math.abs(lineAudit.credit - Number(row?.period_credit || 0)) > 0.01
        || Math.abs(closingFromLedgerLines - signed) > 0.01;
      return {
        ...acc,
        ...classification,
        isAmortOuDeprec: contra,
        openingSigned,
        openingDebit: Number(row?.opening_debit || 0),
        openingCredit: Number(row?.opening_credit || 0),
        periodDebit: Number(row?.period_debit || 0),
        periodCredit: Number(row?.period_credit || 0),
        sourceLineDebit: lineAudit.debit,
        sourceLineCredit: lineAudit.credit,
        sourceLineCount: lineAudit.count,
        rpcLineMismatch,
        balanceDebit: Number(row?.closing_debit || 0),
        balanceCredit: Number(row?.closing_credit || 0),
        balanceBrute: contra ? 0 : Number(row?.closing_debit || 0),
        amortDeprec: contra ? Number(row?.closing_credit || 0) : 0,
        balanceNette: signed,
        hasActivity: Boolean(row?.has_activity),
        hasAtypicalBalance: atypical,
        possibleDuplicateOpening: duplicateOpening,
        hasActiveChildren,
        parentAndChildActivity,
        hasAnomaly: atypical || duplicateOpening || rpcLineMismatch || row?.is_active === false || parentAndChildActivity,
      };
    });
  }, [accounts, balanceRows, lineAuditByAccount]);

  // Données dynamiques calculées pour les immobilisations physiques
  const computedAssets = useMemo(() => {
    const targetDate = cutoffDate ? new Date(cutoffDate) : new Date();
    return physicalAssets.map((asset) => {
      const dep = computeDepreciation(asset, targetDate);
      return {
        ...asset,
        ...dep,
      };
    });
  }, [physicalAssets, cutoffDate]);

  // Totaux patrimoniaux
  const totals = useMemo(() => calculateInventoryStatement(inventoryAccounts, resultNet), [inventoryAccounts, resultNet]);
  const physicalTotals = useMemo(() => calculatePhysicalInventoryTotals(physicalInventoryRows), [physicalInventoryRows]);
  const openingControl = useMemo(() => {
    const debit = balanceRows.reduce((sum, row) => sum + Number(row.opening_debit || 0), 0);
    const credit = balanceRows.reduce((sum, row) => sum + Number(row.opening_credit || 0), 0);
    const target = inventoryAccounts.find((row) => String(row.numero).replace(/\D/g, '') === '10221');
    return { debit, credit, gap: debit - credit, account: target || null };
  }, [balanceRows, inventoryAccounts]);

  const filteredAccounts = useMemo(() => {
    return inventoryAccounts.filter((acc) => {
      if (activeTab === 'ACTIF_IMMO' && acc.category !== 'ACTIF_IMMO') return false;
      if (activeTab === 'STOCKS' && acc.category !== 'STOCKS') return false;
      if (activeTab === 'CREANCES' && acc.category !== 'CREANCES') return false;
      if (activeTab === 'TRESORERIE' && acc.category !== 'TRESORERIE') return false;
      if (activeTab === 'CAPITAUX_PROPRES' && acc.category !== 'CAPITAUX_PROPRES') return false;
      if (activeTab === 'DETTES_COURT_TERME' && acc.category !== 'DETTES_COURT_TERME') return false;
      if (activeTab === 'DETTES_FINANCIERES' && acc.category !== 'DETTES_FINANCIERES') return false;
      if (!showAllAccounts && Number(acc.balanceNette || 0) === 0 && !acc.hasAnomaly) return false;
      if (anomaliesOnly && !acc.hasAnomaly) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNum = (acc.numero || '').toLowerCase().includes(term);
        const matchLib = (acc.libelle || '').toLowerCase().includes(term);
        if (!matchNum && !matchLib) return false;
      }

      return true;
    });
  }, [inventoryAccounts, activeTab, searchTerm, showAllAccounts, anomaliesOnly]);

  const groupedSections = useMemo(() => {
    const map = {};
    filteredAccounts.forEach((acc) => {
      const section = acc.sectionName;
      if (!map[section]) {
        map[section] = [];
      }
      map[section].push(acc);
    });
    return map;
  }, [filteredAccounts]);

  const filteredTotals = useMemo(() => {
    return {
      brut: filteredAccounts.reduce((acc, a) => acc + Number(a.balanceBrute || 0), 0),
      amort: filteredAccounts.reduce((acc, a) => acc + Number(a.amortDeprec || 0), 0),
      net: filteredAccounts.reduce((acc, a) => acc + Number(a.balanceNette || 0), 0),
    };
  }, [filteredAccounts]);

  const handleExportXLSX = () => {
    exportLivreInventaireExcel({
      rows: filteredAccounts,
      statementTotals: totals,
      inventoryItems: physicalInventoryRows,
      totals: filteredTotals,
      exercice: selectedExercice,
      cutoffDate,
      devise,
      inventoryValidated: Boolean(inventoryValidation),
    });
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportLivreInventairePDF({
        rows: filteredAccounts,
        statementTotals: totals,
        inventoryItems: physicalInventoryRows,
        totals: filteredTotals,
        exercice: selectedExercice,
        cutoffDate,
        devise,
        inventoryValidated: Boolean(inventoryValidation),
      });
    } catch (err) {
      console.error('Erreur export PDF livre inventaire:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const companyName = company?.raison_sociale || 'Entreprise';
  const companyJuridique = company?.forme_juridique || '';

  return (
    <div className="page-content livre-inventaire-page">
      {/* En-tête de la page */}
      <div className="page-header livre-header no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ClipboardList className="text-teal" size={24} />
            <h1 className="page-title" style={{ margin: 0 }}>Livre d'inventaire</h1>
            {selectedExercice && (
              <Badge variant={selectedExercice.statut === 'OUVERT' ? 'success' : 'neutral'}>
                Exercice {selectedExercice.code || selectedExercice.annee} · {selectedExercice.statut === 'OUVERT' ? 'ouvert' : 'clôturé'}
              </Badge>
            )}
            <Badge variant={inventoryValidation ? 'success' : 'warning'}>{inventoryValidation ? 'Inventaire physique arrêté' : 'Inventaire physique non arrêté'}</Badge>
          </div>
          <p className="page-subtitle">
            État descriptif et estimatif des éléments d'actif et de passif du patrimoine · AUDCIF art. 19-20 (OHADA)
          </p>
        </div>

        <div className="livre-actions" style={{ display: 'flex', gap: '8px' }}>
          <Button icon={RefreshCw} variant="outline" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            Actualiser
          </Button>
          {canExport && <Button variant="secondary" icon={Printer} onClick={() => setShowPDFPreview(true)} disabled={filteredAccounts.length === 0}>
            Imprimer (PDF)
          </Button>}
          {canExport && <Button variant="primary" icon={Download} onClick={handleExportXLSX} disabled={filteredAccounts.length === 0}>
            Exporter Excel
          </Button>}
        </div>
      </div>

      {notice && (
        <div className="message error no-print" role="alert" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* Barre d'outils et de filtres */}
      <Card className="livre-toolbar no-print" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="grid grid-3" style={{ gap: '16px', alignItems: 'flex-end' }}>

          <Input
            label="Date de situation"
            type="date"
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
          />

          <div style={{ position: 'relative' }}>
            <Input
              label="Rechercher un élément"
              placeholder="N° de compte, libellé..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="inventory-presentation-toggle">
          <span>Présentation :</span>
          <Button variant={viewMode === 'SIMPLE' ? 'primary' : 'outline'} onClick={() => setViewMode('SIMPLE')}>Synthèse</Button>
          <Button variant={viewMode === 'OFFICIAL' ? 'primary' : 'outline'} onClick={() => setViewMode('OFFICIAL')}>Détail réglementaire</Button>
          {viewMode === 'SIMPLE' && <small>Les comptes correcteurs (28, 29, 39, 49, 59) restent inclus dans les soldes nets et les exports détaillés.</small>}
        </div>

        {/* Navigation par onglets */}
        <div className="livre-tabs" style={{ display: 'flex', gap: '8px', marginTop: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'ALL', label: 'Vue Complète Patrimoine', icon: Layers },
            { id: 'ACTIF_IMMO', label: 'Actif Immobilisé (Cl. 2)', icon: Building2 },
            { id: 'STOCKS', label: 'Stocks & En-cours (Cl. 3)', icon: Package },
            { id: 'CREANCES', label: 'Créances & Tiers (Cl. 4)', icon: Users },
            { id: 'TRESORERIE', label: 'Trésorerie (Cl. 5)', icon: Wallet },
            { id: 'CAPITAUX_PROPRES', label: 'Capitaux Propres (Cl. 1)', icon: ShieldCheck },
            { id: 'DETTES_FINANCIERES', label: 'Dettes financières', icon: Users },
            { id: 'DETTES_COURT_TERME', label: 'Dettes circulantes (Cl. 4 & 5)', icon: Users },
            { id: 'PHYSIQUE', label: 'Registre des Biens physiques', icon: ClipboardList },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: isSel ? '1px solid var(--color-primary, #0d9488)' : '1px solid var(--color-border, #e2e8f0)',
                  backgroundColor: isSel ? 'rgba(13, 148, 136, 0.1)' : 'var(--color-surface, #fff)',
                  color: isSel ? 'var(--color-primary, #0d9488)' : 'var(--color-text, #334155)',
                  fontWeight: isSel ? 600 : 400,
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="inventory-filter-options">
          <label><input type="checkbox" checked={showAllAccounts} onChange={(event) => setShowAllAccounts(event.target.checked)} /> Afficher aussi les comptes sans solde</label>
          <label><input type="checkbox" checked={anomaliesOnly} onChange={(event) => setAnomaliesOnly(event.target.checked)} /> Afficher uniquement les anomalies</label>
          <span>Les soldes affichés proviennent du RPC utilisé par la Balance; chaque ligne est une écriture validée de l’entreprise et de l’exercice sélectionnés.</span>
        </div>
      </Card>

      {/* Cartes KPIs Synthèse patrimoniale */}
      <div className="cr-kpis" style={{ marginBottom: '24px' }}>
          <Card>
            <span className="ledger-summary-label">Actif brut débiteur · provisoire</span>
            <strong>{money(totals.actifBrut)} {devise}</strong>
            <small style={{ color: 'var(--color-muted)' }}>Σ soldes débiteurs des actifs, hors correcteurs. À contrôler avec {money(totals.actifAmort)} {devise} de soldes correcteurs créditeurs.</small>
          </Card>

        {viewMode !== 'SIMPLE' && <Card>
            <span className="ledger-summary-label">Comptes correcteurs créditeurs</span>
          <strong style={{ color: '#e11d48' }}>- {money(totals.actifAmort)} {devise}</strong>
            <small style={{ color: 'var(--color-muted)' }}>Amortissements et dépréciations (classes 28, 29, 39, 49, 59)</small>
        </Card>}

        <Card>
            <span className="ledger-summary-label">Actif net comptable · provisoire</span>
          <strong style={{ color: '#0d9488' }}>{money(totals.actifNet)} {devise}</strong>
            <small style={{ color: 'var(--color-muted)' }}>Actif brut + soldes signés des correcteurs et autres comptes d’actif; un crédit n’est pas converti en actif.</small>
        </Card>

        <Card>
            <span className="ledger-summary-label">Dettes nettes · provisoire</span>
          <strong style={{ color: '#d97706' }}>{money(totals.dettesTotal)} {devise}</strong>
            <small style={{ color: 'var(--color-muted)' }}>Σ opposé des soldes signés des dettes financières, tiers et trésorerie passive.</small>
        </Card>

        <Card>
            <span className="ledger-summary-label">Capitaux propres avec résultat · provisoire</span>
            <strong style={{ color: '#7c3aed' }}>{money(totals.capitauxPropres)} {devise}</strong>
          <small>Soldes créditeurs de classe 1, à-nouveaux du compte 12 et résultat recalculé des classes 6–7.</small>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            {Math.abs(totals.ecartComptable) < 0.01 ? (
              <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={12} /> Écart actif / passif nul
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <AlertTriangle size={12} /> Écart comptable actif / passif: {money(totals.ecartComptable)} {devise}
              </span>
            )}
          </div>
        </Card>
        <Card>
          <span className="ledger-summary-label">Écart inventaire physique</span>
          <strong style={{ color: !physicalTotals.recensementEffectue || Math.abs(physicalTotals.ecartValeur) < 0.01 ? 'var(--color-text)' : '#b91c1c' }}>{physicalTotals.recensementEffectue ? `${money(physicalTotals.ecartValeur)} ${devise}` : 'Non déterminé'}</strong>
          <small style={{ color: 'var(--color-muted)' }}>{physicalTotals.lignesRecensees} ligne(s) recensée(s) sur {physicalInventoryRows.length}. L’écart actif/passif est indépendant.</small>
        </Card>
      </div>
      <Card className="inventory-opening-audit">
        <strong>Contrôle des à-nouveaux</strong>
        <p>Total débit d’ouverture : {money(openingControl.debit)} · Total crédit d’ouverture : {money(openingControl.credit)} · Écart : {money(openingControl.gap)} {devise}</p>
        <p>Compte 10221 « argent de » : ouverture débit {money(openingControl.account?.openingDebit || 0)} · ouverture crédit {money(openingControl.account?.openingCredit || 0)} {devise}. L’écart d’ouverture doit être recherché dans la reprise des soldes et les écritures sources ; aucune écriture d’équilibrage n’est créée ici.</p>
        {(Math.abs(openingControl.gap) >= 0.01 || Math.abs(totals.ecartComptable) >= 0.01 || inventoryAccounts.some((account) => account.hasAnomaly)) && <p role="status"><AlertTriangle size={14} /> Synthèse provisoire : au moins un contrôle comptable reste à expliquer ou régulariser. Les montants affichés ne constituent pas des valeurs définitives.</p>}
      </Card>

      {/* Entête d'impression légale */}
      <div className="print-only-header" style={{ display: 'none', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>{companyName} {companyJuridique}</h2>
            <p style={{ margin: 0, fontSize: '12px' }}>Système Comptable SYSCOHADA · Registre Obligatoire</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>LIVRE D'INVENTAIRE ANNUEL</h3>
            <p style={{ margin: 0, fontSize: '12px' }}>
              Exercice : {selectedExercice?.code || selectedExercice?.annee || '—'} · Arrêté au {cutoffDate || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Contenu : Onglet PHYSIQUE vs Onglet COMPTABLE */}
      {activeTab === 'PHYSIQUE' ? (
        <>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                Inventaire physique des immobilisations & matériels
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>
                {computedAssets.length} actif(s) physique(s) répertorié(s) au registre des immobilisations
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="balance-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Code Bien</th>
                  <th>Désignation de l'immobilisation</th>
                  <th>Catégorie</th>
                  <th>Date Acq.</th>
                  <th className="text-right">Valeur Brute ({devise})</th>
                  <th className="text-right">Amort. Cumulé</th>
                  <th className="text-right">Valeur Nette (VNC)</th>
                  <th className="text-center">Statut</th>
                </tr>
              </thead>
              <tbody>
                {computedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>
                      Aucune immobilisation physique enregistrée dans le registre pour le moment.
                    </td>
                  </tr>
                ) : (
                  computedAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="account-cell" style={{ fontWeight: 600 }}>{asset.code}</td>
                      <td>{asset.designation}</td>
                      <td><Badge variant="neutral">{asset.categorie || 'Général'}</Badge></td>
                      <td>{asset.date_acquisition ? new Date(asset.date_acquisition).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="text-right">{money(asset.valeur_brute)}</td>
                      <td className="text-right" style={{ color: '#e11d48' }}>{money(asset.amortCumule)}</td>
                      <td className="text-right" style={{ fontWeight: 600, color: '#0d9488' }}>{money(asset.vnc)}</td>
                      <td className="text-center">
                        <Badge variant={asset.statut === 'EN_SERVICE' ? 'success' : 'warning'}>
                          {asset.statut || 'En service'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {computedAssets.length > 0 && (
                <tfoot>
                  <tr className="balance-total-row">
                    <td colSpan={4}>TOTAL INVENTAIRE PHYSIQUE DES ACTIFS</td>
                    <td className="text-right">
                      {money(computedAssets.reduce((s, a) => s + Number(a.valeur_brute || 0), 0))}
                    </td>
                    <td className="text-right">
                      {money(computedAssets.reduce((s, a) => s + (a.amortCumule || 0), 0))}
                    </td>
                    <td className="text-right">
                      {money(computedAssets.reduce((s, a) => s + (a.vnc || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
        <Card style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Comptage physique des stocks et biens</h3>
          <p className="page-subtitle">Quantités, emplacements et valeurs constatées. Les écarts sont présentés pour contrôle et ne génèrent aucune écriture automatique.</p>
          <div className="table-responsive"><table className="balance-table"><thead><tr><th>Code</th><th>Désignation</th><th>Compte/catégorie</th><th>Emplacement</th><th>Qté comptable</th><th>Qté constatée</th><th>Écart quantité</th><th>Valeur comptable</th><th>Valeur constatée</th><th>Écart valeur</th></tr></thead><tbody>
            {physicalInventoryRows.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.designation}</td><td>{row.categorie || '—'}</td><td>{row.emplacement_physique || '—'}</td><td>{row.quantite_theorique} {row.unite || ''}</td><td>{row.quantite_reelle} {row.unite || ''}</td><td style={{ color: Number(row.ecart_quantite) === 0 ? undefined : '#b91c1c' }}>{row.ecart_quantite} {row.unite || ''}</td><td>{money(row.valeur_comptable)} {devise}</td><td>{money(row.valeur_constatee)} {devise}</td><td style={{ color: Number(row.ecart_valeur) === 0 ? undefined : '#b91c1c' }}>{money(row.ecart_valeur)} {devise}</td></tr>)}
            {!physicalInventoryRows.length && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20 }}>Aucun comptage physique valorisé pour cet exercice. Appliquez la migration 20261109_inventory_valuation puis saisissez les quantités et valeurs.</td></tr>}
          </tbody></table></div>
        </Card>
        </>
      ) : (
        <section className="inventory-overview">
          <div className="inventory-overview-heading">
            <div><h3>État récapitulatif des éléments du patrimoine</h3><p>{filteredAccounts.length} compte(s) avec solde à la date du {cutoffDate || '—'} · Balance de vérification du même exercice</p></div>
            <Button variant="outline" icon={Object.keys(expandedSections).length && Object.values(expandedSections).every(Boolean) ? ChevronUp : ChevronDown} onClick={() => {
              const expanded = Object.keys(groupedSections).length > 0 && Object.keys(groupedSections).every((key) => expandedSections[key]);
              setExpandedSections(Object.fromEntries(Object.keys(groupedSections).map((key) => [key, !expanded])));
            }}>{Object.keys(groupedSections).length > 0 && Object.keys(groupedSections).every((key) => expandedSections[key]) ? 'Tout réduire' : 'Tout développer'}</Button>
          </div>
          <div className="inventory-section-grid">
            {Object.entries(groupedSections).map(([sectionTitle, sectionAccounts]) => {
              const expanded = Boolean(expandedSections[sectionTitle]);
              const debit = sectionAccounts.reduce((sum, account) => sum + Number(account.balanceDebit || 0), 0);
              const credit = sectionAccounts.reduce((sum, account) => sum + Number(account.balanceCredit || 0), 0);
              const net = sectionAccounts.reduce((sum, account) => sum + Number(account.balanceNette || 0), 0);
              return <Card key={sectionTitle} className="inventory-section-card">
                <div className="inventory-section-title"><div><h4>{sectionTitle}</h4><span>{sectionAccounts.length} compte(s) · {money(debit)} D / {money(credit)} C {devise}</span></div>
                  <Button variant="outline" icon={expanded ? ChevronUp : ChevronDown} onClick={() => setExpandedSections((state) => ({ ...state, [sectionTitle]: !state[sectionTitle] }))}>{expanded ? 'Réduire' : 'Voir plus'}</Button>
                </div>
                <div className="inventory-section-metrics"><div><span>Total débit</span><strong>{money(debit)} {devise}</strong></div><div><span>Total crédit</span><strong>{money(credit)} {devise}</strong></div><div className={net >= 0 ? 'is-positive' : 'is-negative'}><span>Solde signé</span><strong>{net > 0 ? '+' : ''}{money(net)} {devise}</strong></div></div>
                {expanded && <div className="inventory-account-grid">
                  {sectionAccounts.filter((account) => viewMode === 'OFFICIAL' || !account.isAmortOuDeprec).map((account) => <article key={account.id} className={`inventory-account-item${account.hasAnomaly ? ' has-anomaly' : ''}`}>
                    <header><strong>{account.numero}</strong><span>{account.libelle}</span></header>
                    <div className="inventory-account-values"><span>Débit<strong>{dash(account.balanceDebit)}</strong></span><span>Crédit<strong>{dash(account.balanceCredit)}</strong></span><span>Net signé<strong>{account.balanceNette > 0 ? '+' : ''}{dash(account.balanceNette)}</strong></span></div>
                    <small className="inventory-account-source">Ouverture D {dash(account.openingDebit)} / C {dash(account.openingCredit)} · {account.sourceLineCount} ligne(s) validée(s) · Mouvements D {dash(account.sourceLineDebit)} / C {dash(account.sourceLineCredit)}</small>
                    {account.hasAnomaly && <p className="inventory-anomaly"><AlertTriangle size={13}/>{account.rpcLineMismatch ? 'Les mouvements ne concordent pas avec la Balance' : account.possibleDuplicateOpening ? 'Ouverture possiblement doublée' : account.parentAndChildActivity ? 'Compte parent et sous-compte ont tous deux un solde; vérifier les lignes directes' : 'Solde inhabituel pour la nature du compte'}</p>}
                  </article>)}
                  {viewMode === 'SIMPLE' && sectionAccounts.some((account) => account.isAmortOuDeprec) && <p className="inventory-hidden-contra">Les comptes d’amortissement et de dépréciation sont masqués dans cette vue, mais leur solde reste déduit de l’actif net.</p>}
                </div>}
                {expanded && <footer className="inventory-section-total"><b>Sous-total {sectionTitle}</b><span>Débit {money(debit)}</span><span>Crédit {money(credit)}</span><strong>Solde signé {money(net)} {devise}</strong></footer>}
              </Card>;
            })}
          </div>
        </section>
      )}

      <Card style={{ marginTop: '24px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.05em' }}>État de l’inventaire annuel</h4>
        <p className="page-subtitle" style={{ margin: 0 }}>
          Exercice {selectedExercice?.code || selectedExercice?.annee || '—'} ({selectedExercice?.statut || 'statut inconnu'}) · situation comptable au {cutoffDate || '—'}.
          {inventoryValidation ? `Inventaire physique validé le ${new Date(inventoryValidation.valide_le).toLocaleDateString('fr-FR')}.` : 'Inventaire physique non arrêté. Aucune attestation définitive n’est générée avant validation explicite.'}
        </p>
        <div className="inventory-financial-links">
          <strong>États financiers liés à cet exercice</strong>
          <a href="/bilan">Ouvrir le bilan</a>
          <a href="/compte-resultat">Ouvrir le compte de résultat</a>
          <span>Les montants doivent être arrêtés et validés depuis leurs pages avant certification annuelle.</span>
        </div>
      </Card>

      {showPDFPreview && canExport && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Livre d'inventaire du patrimoine"
          subtitle={`Exercice : ${selectedExercice?.code || ''} — Date de situation : ${cutoffDate || '—'} — ${inventoryValidation ? 'Inventaire arrêté' : 'Inventaire non arrêté'}`}
          filename={`Livre_Inventaire_${selectedExercice?.code || 'exercice'}`}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <LivreInventairePDFDocument
              rows={filteredAccounts}
              statementTotals={totals}
              inventoryItems={physicalInventoryRows}
              totals={filteredTotals}
              exercice={selectedExercice}
              cutoffDate={cutoffDate}
              devise={devise}
              inventoryValidated={Boolean(inventoryValidation)}
              orientation={orientation}
            />
          )}
        />
      )}
    </div>
  );
}

export default function LivreInventaire() {
  const { can } = useAuth();
  if (can('STOCK_INVENTORY') && !can('COMPTA_READ')) return <PhysicalInventoryBook />;
  return <AccountingLivreInventaire />;
}
