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
  Layers,
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Search,
  ShieldCheck,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  Scale
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import FinancialTabs from '../../components/accounting/FinancialTabs';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { confirmAction, toast } from '../../lib/notifications';
import { computeDepreciation } from '../../lib/depreciation';
import { exportLivreInventaireExcel, exportLivreInventairePDF, LivreInventairePDFDocument, PDFPreviewModal, buildPdfFilename } from '../../lib/generateFile';
import { calculateInventoryStatement, calculatePhysicalInventoryTotals, classifyInventoryAccount, hasAtypicalInventoryBalance, isContraAssetAccount, isPatrimonialAccount } from '../../lib/accounting/inventoryStatement';
import './LivreInventaire.css';

const money = (v) => {
  const n = Math.round(Number(v || 0));
  return n.toLocaleString('fr-FR');
};

const formatQty = (v, unit = '') => {
  const n = Number(v || 0);
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} ${unit || ''}`.trim();
};

const emptyFormState = {
  id: null,
  code: '',
  designation: '',
  compte_reference: '',
  categorie: 'Stocks de marchandises',
  quantite_reelle: '',
  quantite_theorique: '',
  unite: 'Unité(s)',
  cout_unitaire: '',
  emplacement_physique: '',
  etat_physique: 'Bon état',
  date_inventaire: new Date().toISOString().slice(0, 10),
  observation: '',
};

export default function LivreInventaire() {
  const { exercices: exercises, selectedExerciceId: exerciceId, loading: exercicesLoading } = useExercice();
  const { selectedEntrepriseId, can, hasRole } = useAuth();

  const canEdit = can('STOCK_INVENTORY') || can('COMPTA_CREATE') || hasRole('ADMIN') || hasRole('GERANT') || hasRole('COMPTABLE');
  const canExport = can('COMPTA_EXPORT') || can('COMPTA_READ') || hasRole('ADMIN') || hasRole('GERANT') || hasRole('COMPTABLE');
  const physicalOnly = can('STOCK_INVENTORY') && !can('COMPTA_READ');

  // Données de base
  const [accounts, setAccounts] = useState([]);
  const [balanceRows, setBalanceRows] = useState([]);
  const [lines, setLines] = useState([]);
  const [physicalAssets, setPhysicalAssets] = useState([]);
  const [physicalInventoryRows, setPhysicalInventoryRows] = useState([]);
  const [inventoryValidation, setInventoryValidation] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  // Filtres et affichage
  const [activeMainTab, setActiveMainTab] = useState('PHYSIQUE'); // 'PHYSIQUE' ou 'PATRIMOINE'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TOUT');
  const [cutoffDate, setCutoffDate] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(emptyFormState);
  const [savingItem, setSavingItem] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const devise = 'FCFA';

  // 1. Chargement des données
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    if (exercicesLoading) return;
    if (!exerciceId || !selectedEntrepriseId) {
      setAccounts([]);
      setBalanceRows([]);
      setLines([]);
      setPhysicalAssets([]);
      setPhysicalInventoryRows([]);
      setInventoryValidation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice('');
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
      supabase
        .from('inventaire_physique_validations')
        .select('valide_le,valide_par')
        .eq('exercice_id', exerciceId)
        .maybeSingle(),
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
        if (compRes?.data) setCompany(compRes.data);
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

  useEffect(() => {
    if (!selectedExercice) return;
    setCutoffDate(selectedExercice.date_fin || new Date().toISOString().slice(0, 10));
  }, [selectedExercice]);

  // 2. Calculs comptables réglementaires
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

  // Totaux globaux
  const totals = useMemo(() => calculateInventoryStatement(inventoryAccounts, resultNet), [inventoryAccounts, resultNet]);
  const physicalTotals = useMemo(() => calculatePhysicalInventoryTotals(physicalInventoryRows), [physicalInventoryRows]);

  const openingControl = useMemo(() => {
    const debit = balanceRows.reduce((sum, row) => sum + Number(row.opening_debit || 0), 0);
    const credit = balanceRows.reduce((sum, row) => sum + Number(row.opening_credit || 0), 0);
    return { debit, credit, gap: debit - credit };
  }, [balanceRows]);

  // 3. Regroupement patrimonial épuré par grandes masses
  const patrimonialSections = useMemo(() => {
    const sectionsConfig = [
      { id: 'ACTIF_IMMO', title: 'Actif Immobilisé', classeLabel: 'Classe 2 — Biens durables', icon: Building2 },
      { id: 'STOCKS', title: 'Stocks & En-cours', classeLabel: 'Classe 3 — Marchandises, matières, produits', icon: Package },
      { id: 'CREANCES', title: 'Créances & Tiers débiteurs', classeLabel: 'Classe 4 — Clients, avances, tiers', icon: Layers },
      { id: 'TRESORERIE', title: 'Disponibilités & Trésorerie', classeLabel: 'Classe 5 — Banques, caisses', icon: DollarSign },
      { id: 'CAPITAUX_PROPRES', title: 'Capitaux Propres & Résultat', classeLabel: 'Classe 1 — Ressources stables', icon: ShieldCheck },
      { id: 'DETTES', title: 'Dettes Financières & Circulantes', classeLabel: 'Classes 1, 4 & 5 — Emprunts, fournisseurs', icon: Scale },
    ];

    return sectionsConfig.map((sec) => {
      let secAccounts = [];
      if (sec.id === 'ACTIF_IMMO') secAccounts = inventoryAccounts.filter((a) => a.category === 'ACTIF_IMMO');
      else if (sec.id === 'STOCKS') secAccounts = inventoryAccounts.filter((a) => a.category === 'STOCKS');
      else if (sec.id === 'CREANCES') secAccounts = inventoryAccounts.filter((a) => a.category === 'CREANCES');
      else if (sec.id === 'TRESORERIE') secAccounts = inventoryAccounts.filter((a) => a.category === 'TRESORERIE');
      else if (sec.id === 'CAPITAUX_PROPRES') secAccounts = inventoryAccounts.filter((a) => a.category === 'CAPITAUX_PROPRES');
      else if (sec.id === 'DETTES') secAccounts = inventoryAccounts.filter((a) => a.category === 'DETTES_COURT_TERME' || a.category === 'DETTES_FINANCIERES');

      const activeAccounts = secAccounts.filter((a) => a.hasActivity || a.balanceNette !== 0 || a.hasAnomaly);
      const totalBrut = secAccounts.reduce((sum, a) => sum + Number(a.balanceBrute || 0), 0);
      const totalAmort = secAccounts.reduce((sum, a) => sum + Number(a.amortDeprec || 0), 0);
      const totalNet = secAccounts.reduce((sum, a) => sum + Number(a.balanceNette || 0), 0);
      const anomaliesCount = secAccounts.filter((a) => a.hasAnomaly).length;

      return {
        ...sec,
        accounts: secAccounts,
        activeAccounts,
        totalBrut,
        totalAmort,
        totalNet,
        anomaliesCount,
      };
    });
  }, [inventoryAccounts]);

  // 4. Filtrage des articles de l'inventaire physique
  const filteredPhysicalRows = useMemo(() => {
    return physicalInventoryRows.filter((r) => {
      if (selectedCategory !== 'TOUT') {
        const cat = (r.categorie || '').toLowerCase();
        if (!cat.includes(selectedCategory.toLowerCase())) return false;
      }
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        const code = (r.code || '').toLowerCase();
        const desig = (r.designation || '').toLowerCase();
        const place = (r.emplacement_physique || '').toLowerCase();
        const cat = (r.categorie || '').toLowerCase();
        if (!code.includes(t) && !desig.includes(t) && !place.includes(t) && !cat.includes(t)) {
          return false;
        }
      }
      return true;
    });
  }, [physicalInventoryRows, selectedCategory, searchTerm]);

  // Catégories uniques pour le filtre
  const availableCategories = useMemo(() => {
    const set = new Set();
    physicalInventoryRows.forEach((r) => {
      if (r.categorie) {
        const clean = r.categorie.replace(/^\d{3,8}\s*·\s*/, '').trim();
        if (clean) set.add(clean);
      }
    });
    return ['TOUT', ...Array.from(set)];
  }, [physicalInventoryRows]);

  // Extraction propre du compte de référence rattaché à une ligne d'inventaire
  const getAccountReference = (row) => {
    const match = (row.categorie || '').match(/^(\d{3,8})\b/);
    if (match) return match[1];
    const obsMatch = (row.observation || '').match(/Compte\s*:\s*(\d{3,8})/);
    if (obsMatch) return obsMatch[1];
    return null;
  };

  // Liste des comptes éligibles pour le select du formulaire (Classes 2 et 3 en tête)
  const eligibleAccounts = useMemo(() => {
    return accounts
      .filter((a) => isPatrimonialAccount(a))
      .sort((a, b) => {
        const isPriorityA = String(a.numero).startsWith('3') || String(a.numero).startsWith('2');
        const isPriorityB = String(b.numero).startsWith('3') || String(b.numero).startsWith('2');
        if (isPriorityA && !isPriorityB) return -1;
        if (!isPriorityA && isPriorityB) return 1;
        return String(a.numero).localeCompare(String(b.numero));
      });
  }, [accounts]);

  // 5. Actions sur le formulaire
  const handleOpenCreateForm = () => {
    setFormData({
      ...emptyFormState,
      date_inventaire: cutoffDate || new Date().toISOString().slice(0, 10),
    });
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item) => {
    const match = (item.categorie || '').match(/^(\d{3,8})\s*·\s*(.*)$/);
    const compteRef = match ? match[1] : (getAccountReference(item) || '');
    const cleanCat = match ? match[2] : (item.categorie || '');

    setFormData({
      id: item.id,
      code: item.code || '',
      designation: item.designation || '',
      compte_reference: compteRef,
      categorie: cleanCat || 'Stocks de marchandises',
      quantite_reelle: item.quantite_reelle ?? '',
      quantite_theorique: item.quantite_theorique ?? '',
      unite: item.unite || 'Unité(s)',
      cout_unitaire: item.cout_unitaire ?? '',
      emplacement_physique: item.emplacement_physique || '',
      etat_physique: item.etat_physique || 'Bon état',
      date_inventaire: item.date_inventaire || new Date().toISOString().slice(0, 10),
      observation: item.observation || '',
    });
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!selectedExerciceId) {
      toast.error('Aucun exercice actif sélectionné');
      return;
    }
    if (!formData.code.trim() || !formData.designation.trim()) {
      toast.error('Le code et la désignation sont requis');
      return;
    }

    setSavingItem(true);
    try {
      const qteReelle = Number(formData.quantite_reelle || 0);
      const qteTheo = formData.quantite_theorique === '' ? qteReelle : Number(formData.quantite_theorique || 0);
      const pu = Number(formData.cout_unitaire || 0);
      const valComptable = qteTheo * pu;

      const catLabel = formData.compte_reference
        ? `${formData.compte_reference} · ${formData.categorie || 'Inventaire'}`
        : (formData.categorie || 'Inventaire');

      const payload = {
        code: formData.code.trim(),
        designation: formData.designation.trim(),
        categorie: catLabel,
        etat_physique: formData.etat_physique || 'Bon état',
        emplacement_physique: formData.emplacement_physique?.trim() || '',
        unite: formData.unite || 'Unité(s)',
        quantite_theorique: qteTheo,
        quantite_reelle: qteReelle,
        cout_unitaire: pu,
        valeur_comptable: valComptable,
        recensement_effectue: true,
        date_inventaire: formData.date_inventaire || new Date().toISOString().slice(0, 10),
        observation: formData.observation?.trim() || '',
        exercice_id: selectedExerciceId,
      };

      if (formData.id) {
        const { error } = await supabase
          .from('inventaire_physique')
          .update(payload)
          .eq('id', formData.id);
        if (error) throw error;
        toast.success('Article mis à jour', formData.designation);
      } else {
        const { error } = await supabase
          .from('inventaire_physique')
          .insert(payload);
        if (error) throw error;
        toast.success('Nouvel article inventorié', formData.designation);
      }

      // Rechargement immédiat
      const { data: updatedRows } = await supabase
        .from('inventaire_physique')
        .select('*')
        .eq('entreprise_id', selectedEntrepriseId)
        .eq('exercice_id', selectedExerciceId)
        .order('code');
      setPhysicalInventoryRows(updatedRows || []);

      setIsFormOpen(false);
      setFormData(emptyFormState);
    } catch (err) {
      console.error('Erreur sauvegarde inventaire:', err);
      toast.error('Erreur de sauvegarde', err.message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item) => {
    if (!canEdit) return;
    const ok = await confirmAction({
      title: 'Supprimer cet article ?',
      text: `Êtes-vous sûr de vouloir retirer « ${item.code} - ${item.designation} » de l'inventaire ?`,
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('inventaire_physique')
        .delete()
        .eq('id', item.id);
      if (error) throw error;

      setPhysicalInventoryRows((prev) => prev.filter((r) => r.id !== item.id));
      setSelectedItem(null);
      toast.success('Article supprimé du livre d\'inventaire');
    } catch (err) {
      toast.error('Suppression impossible', err.message);
    }
  };

  const handleFinalizeInventory = async () => {
    if (!canEdit) return;
    const ok = await confirmAction({
      title: 'Arrêter et valider l’inventaire ?',
      text: 'Cette action fige le recensement physique pour cet exercice. Les lignes ne pourront plus être modifiées.',
      confirmText: 'Arrêter l’inventaire',
    });
    if (!ok) return;

    try {
      const { error } = await supabase.rpc('valider_inventaire_physique', { p_exercice_id: selectedExerciceId });
      if (error) throw error;

      const { data } = await supabase
        .from('inventaire_physique_validations')
        .select('valide_le,valide_par')
        .eq('exercice_id', selectedExerciceId)
        .maybeSingle();
      setInventoryValidation(data || null);
      toast.success('Inventaire physique arrêté avec succès');
    } catch (err) {
      toast.error('Validation impossible', err.message);
    }
  };

  // 6. Exports
  const handleExportXLSX = () => {
    exportLivreInventaireExcel({
      rows: inventoryAccounts,
      statementTotals: totals,
      inventoryItems: physicalInventoryRows,
      totals: { brut: totals.actifBrut, amort: totals.actifAmort, net: totals.actifNet },
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
        rows: inventoryAccounts,
        statementTotals: totals,
        inventoryItems: physicalInventoryRows,
        totals: { brut: totals.actifBrut, amort: totals.actifAmort, net: totals.actifNet },
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

  // Calculs dynamiques pour le formulaire ouvert
  const liveValeurConstatee = Number(formData.quantite_reelle || 0) * Number(formData.cout_unitaire || 0);
  const liveQteTheo = formData.quantite_theorique === '' ? Number(formData.quantite_reelle || 0) : Number(formData.quantite_theorique || 0);
  const liveEcartQte = Number(formData.quantite_reelle || 0) - liveQteTheo;
  const liveEcartValeur = liveEcartQte * Number(formData.cout_unitaire || 0);

  return (
    <div className="page-content livre-inventaire-page">
      {/* ── EN-TÊTE ÉPURÉ DE LA PAGE ── */}
      <div className="page-header livre-header no-print">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <ClipboardList className="text-teal" size={24} />
            <h1 className="page-title" style={{ margin: 0 }}>Livre d'inventaire</h1>
            {selectedExercice && (
              <Badge tone={selectedExercice.statut === 'OUVERT' ? 'success' : 'neutral'}>
                Exercice {selectedExercice.code || selectedExercice.annee}
              </Badge>
            )}
            <Badge tone={inventoryValidation ? 'success' : 'warning'}>
              {inventoryValidation ? 'Inventaire arrêté' : 'Recensement en cours'}
            </Badge>
          </div>
          <p className="page-subtitle">
            Recensement physique des stocks, matériels et synthèse patrimoniale SYSCOHADA · Situation au {cutoffDate || '—'}
          </p>
        </div>

        <div className="livre-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canEdit && (
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleOpenCreateForm}
              disabled={Boolean(inventoryValidation)}
              title="Ajouter un nouvel article recensé"
            >
              + Nouvel article
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => window.print()}
              disabled={loading}
              title="Imprimer directement"
            >
              Imprimer
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => setShowPDFPreview(true)}
              disabled={loading}
              title="Aperçu et export PDF"
            >
              PDF
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              icon={Download}
              onClick={handleExportXLSX}
              disabled={loading}
              title="Télécharger sous Excel (.xlsx)"
            >
              Excel
            </Button>
          )}
          <Button
            variant="outline"
            icon={ShieldCheck}
            onClick={() => setShowAuditModal(true)}
            title="Consulter les contrôles d'équilibre et les à-nouveaux"
          >
            Audit
          </Button>
          <Button
            icon={RefreshCw}
            variant="outline"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            title="Rafraîchir les données"
          />
        </div>
      </div>

      <FinancialTabs />

      {notice && (
        <div className="message error no-print" role="alert" style={{ marginBottom: '16px' }}>
          {notice}
        </div>
      )}

      {/* ── BANDEAU KPI MINIMALISTE (4 chiffres clés seulement, sans longs textes) ── */}
      <div className="cr-kpis no-print" style={{ marginBottom: '20px' }}>
        <Card className="livre-kpi-card">
          <span className="ledger-summary-label">Valeur totale inventoriée</span>
          <strong style={{ color: '#166534', fontSize: '20px' }}>
            {money(physicalTotals.valeurConstatee)} {devise}
          </strong>
          <small>{physicalTotals.lignesRecensees} article(s) recensé(s)</small>
        </Card>

        <Card className="livre-kpi-card">
          <span className="ledger-summary-label">Actif net patrimonial</span>
          <strong style={{ color: 'var(--color-primary, #275a43)', fontSize: '20px' }}>
            {money(totals.actifNet)} {devise}
          </strong>
          <small>Total net des classes 2 à 5</small>
        </Card>

        <Card className="livre-kpi-card">
          <span className="ledger-summary-label">Écart d'inventaire physique</span>
          <strong style={{ color: Math.abs(physicalTotals.ecartValeur) < 0.01 ? '#15803d' : '#b91c1c', fontSize: '20px' }}>
            {physicalTotals.recensementEffectue ? `${money(physicalTotals.ecartValeur)} ${devise}` : 'En cours'}
          </strong>
          <small>
            {Math.abs(physicalTotals.ecartValeur) < 0.01 ? '✓ Conforme (aucun écart)' : '⚠ Écart de valorisation'}
          </small>
        </Card>

        <Card className="livre-kpi-card">
          <span className="ledger-summary-label">Arrêté de clôture</span>
          <div style={{ marginTop: '4px' }}>
            {inventoryValidation ? (
              <Badge tone="success">
                Validé le {new Date(inventoryValidation.valide_le).toLocaleDateString('fr-FR')}
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleFinalizeInventory}
                disabled={!canEdit || physicalInventoryRows.length === 0}
              >
                Arrêter l'inventaire
              </Button>
            )}
          </div>
          <small>
            {inventoryValidation ? 'Registres verrouillés' : `${physicalInventoryRows.length} ligne(s) au total`}
          </small>
        </Card>
      </div>

      {/* ── BARRE DE CONTRÔLE COMPACTE (Recherche & Sélecteur d'onglets) ── */}
      <Card className="no-print" style={{ marginBottom: '20px', padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          
          {/* 2 Onglets Principaux */}
          <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveMainTab('PHYSIQUE')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeMainTab === 'PHYSIQUE' ? '#ffffff' : 'transparent',
                color: activeMainTab === 'PHYSIQUE' ? '#166534' : '#64748b',
                fontWeight: activeMainTab === 'PHYSIQUE' ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeMainTab === 'PHYSIQUE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Package size={16} />
              <span>Articles & Stocks inventoriés ({physicalInventoryRows.length})</span>
            </button>

            {!physicalOnly && (
              <button
                type="button"
                onClick={() => setActiveMainTab('PATRIMOINE')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeMainTab === 'PATRIMOINE' ? '#ffffff' : 'transparent',
                  color: activeMainTab === 'PATRIMOINE' ? '#166534' : '#64748b',
                  fontWeight: activeMainTab === 'PATRIMOINE' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: activeMainTab === 'PATRIMOINE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Layers size={16} />
                <span>Synthèse Patrimoniale SYSCOHADA</span>
              </button>
            )}
          </div>

          {/* Outils de recherche et filtre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', minWidth: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Rechercher code, désignation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  width: '100%',
                }}
              />
            </div>

            {activeMainTab === 'PHYSIQUE' && availableCategories.length > 2 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input select"
                style={{ padding: '6px 10px', fontSize: '12px', maxWidth: '200px' }}
              >
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'TOUT' ? 'Toutes les catégories' : c}
                  </option>
                ))}
              </select>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' }}>
              <Calendar size={13} />
              <input
                type="date"
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '5px 8px', fontSize: '12px' }}
                title="Date de situation"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* ── CONTENU PRINCIPAL : VUE 1 (ARTICLES PHYSIQUES INVENTORIÉS) ── */}
      {activeMainTab === 'PHYSIQUE' && (
        <Card className="livre-screen-card">
          <div className="card-heading" style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Registre physique des stocks & matériels</h2>
              <p className="page-subtitle" style={{ margin: '2px 0 0' }}>
                {filteredPhysicalRows.length} article(s) affiché(s) · Clic sur un article pour afficher sa fiche complète
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="balance-table livre-compact-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Code</th>
                  <th style={{ width: '30%' }}>Désignation de l'article</th>
                  <th style={{ width: '12%' }}>Compte réf.</th>
                  <th className="text-right" style={{ width: '14%' }}>Quantité</th>
                  <th className="text-right" style={{ width: '14%' }}>Prix unitaire</th>
                  <th className="text-right" style={{ width: '18%' }}>Valeur totale ({devise})</th>
                  <th className="text-center" style={{ width: '10%' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredPhysicalRows.map((row) => {
                  const compteRef = getAccountReference(row);
                  const isConforme = Number(row.ecart_quantite || 0) === 0;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedItem(row)}
                      className="clickable-row livre-item-row"
                      title="Cliquer pour voir la fiche détaillée de l'article"
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="account-cell font-mono" style={{ fontWeight: 700, color: '#166534' }}>
                        {row.code}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {row.designation}
                        {row.emplacement_physique && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                            📍 {row.emplacement_physique}
                          </span>
                        )}
                      </td>
                      <td>
                        {compteRef ? (
                          <Badge tone="neutral" className="font-mono">
                            {compteRef}
                          </Badge>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 600 }}>
                        {formatQty(row.quantite_reelle, row.unite)}
                      </td>
                      <td className="text-right font-mono">
                        {money(row.cout_unitaire)}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 700, color: '#15803d' }}>
                        {money(row.valeur_constatee)}
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isConforme ? (
                          <Badge tone="success">Conforme ✓</Badge>
                        ) : Number(row.ecart_quantite) > 0 ? (
                          <Badge tone="info">+{row.ecart_quantite}</Badge>
                        ) : (
                          <Badge tone="danger">{row.ecart_quantite}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredPhysicalRows.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                      {loading ? (
                        'Chargement des articles en cours…'
                      ) : (
                        <div>
                          <p style={{ margin: '0 0 10px', fontSize: '14px' }}>Aucun article trouvé dans l'inventaire pour cet exercice.</p>
                          {canEdit && (
                            <Button size="sm" variant="primary" icon={Plus} onClick={handleOpenCreateForm}>
                              Ajouter un premier article
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredPhysicalRows.length > 0 && (
                <tfoot>
                  <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                    <td colSpan={3}>
                      TOTAL INVENTAIRE ({filteredPhysicalRows.length} article{filteredPhysicalRows.length > 1 ? 's' : ''})
                    </td>
                    <td className="text-right font-mono">
                      {formatQty(filteredPhysicalRows.reduce((s, r) => s + Number(r.quantite_reelle || 0), 0))}
                    </td>
                    <td className="text-right">—</td>
                    <td className="text-right font-mono" style={{ color: '#166534', fontSize: '14px' }}>
                      {money(filteredPhysicalRows.reduce((s, r) => s + Number(r.valeur_constatee || 0), 0))} {devise}
                    </td>
                    <td className="text-center">
                      {Math.abs(physicalTotals.ecartValeur) < 0.01 ? (
                        <span style={{ color: '#15803d', fontSize: '11px' }}>Équilibré</span>
                      ) : (
                        <span style={{ color: '#b91c1c', fontSize: '11px' }}>Écart: {money(physicalTotals.ecartValeur)}</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* ── CONTENU PRINCIPAL : VUE 2 (SYNTHÈSE PATRIMONIALE COMPTABLE) ── */}
      {activeMainTab === 'PATRIMOINE' && (
        <Card className="livre-screen-card">
          <div className="card-heading" style={{ marginBottom: '14px' }}>
            <div>
              <h2 className="section-title" style={{ margin: 0 }}>Synthèse générale des masses patrimoniales</h2>
              <p className="page-subtitle" style={{ margin: '2px 0 0' }}>
                Classification SYSCOHADA · Clic sur un poste pour consulter la liste détaillée des comptes rattachés
              </p>
            </div>
          </div>

          <div className="table-wrap">
            <table className="balance-table">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Masse Patrimoniale</th>
                  <th style={{ width: '12%' }}>Comptes</th>
                  <th className="text-right" style={{ width: '16%' }}>Valeur Brute ({devise})</th>
                  <th className="text-right" style={{ width: '16%' }}>Amort. / Dépréc.</th>
                  <th className="text-right" style={{ width: '16%' }}>Valeur Nette ({devise})</th>
                  <th className="text-center" style={{ width: '5%' }}>Détail</th>
                </tr>
              </thead>
              <tbody>
                {patrimonialSections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <tr
                      key={sec.id}
                      onClick={() => setSelectedSection(sec)}
                      className="clickable-row"
                      style={{ cursor: 'pointer' }}
                      title="Cliquer pour afficher les comptes de cette section"
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ padding: '6px', background: '#eef7f2', borderRadius: '6px', color: '#166534' }}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <strong style={{ display: 'block', color: '#0f172a' }}>{sec.title}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>{sec.classeLabel}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="neutral">{sec.activeAccounts.length} compte(s)</Badge>
                      </td>
                      <td className="text-right font-mono">{money(sec.totalBrut)}</td>
                      <td className="text-right font-mono" style={{ color: sec.totalAmort > 0 ? '#b91c1c' : undefined }}>
                        {sec.totalAmort > 0 ? `- ${money(sec.totalAmort)}` : '—'}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 700, color: '#166534' }}>
                        {money(sec.totalNet)}
                      </td>
                      <td className="text-center">
                        <ChevronRight size={16} color="#94a3b8" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={2}>ACTIF NET DU PATRIMOINE (Total Classes 2 à 5)</td>
                  <td className="text-right font-mono">{money(totals.actifBrut)}</td>
                  <td className="text-right font-mono" style={{ color: '#b91c1c' }}>- {money(totals.actifAmort)}</td>
                  <td className="text-right font-mono" style={{ color: '#166534', fontSize: '14px' }}>
                    {money(totals.actifNet)} {devise}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── MODALE 1 : FORMULAIRE D'ENREGISTREMENT D'UN ARTICLE ── */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={() => !savingItem && setIsFormOpen(false)}
          title={formData.id ? "Modifier l'article inventorié" : "Enregistrement d'un article d'inventaire"}
          subtitle="Saisie des quantités, du compte de référence et du prix unitaire"
          icon={Package}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
              <Button
                variant="secondary"
                onClick={() => setIsFormOpen(false)}
                disabled={savingItem}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveItem}
                disabled={savingItem}
              >
                {savingItem ? 'Enregistrement…' : (formData.id ? 'Mettre à jour' : 'Enregistrer dans l’inventaire')}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveItem} className="livre-form-grid">
            {/* Compte de référence */}
            <div className="form-group full-width">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Compte comptable de référence (SYSCOHADA)
              </label>
              <select
                className="input select"
                value={formData.compte_reference}
                onChange={(e) => {
                  const val = e.target.value;
                  let autoCat = formData.categorie;
                  if (val.startsWith('31')) autoCat = 'Stocks de marchandises';
                  else if (val.startsWith('32')) autoCat = 'Matières premières';
                  else if (val.startsWith('33')) autoCat = 'Produits en cours';
                  else if (val.startsWith('36') || val.startsWith('37')) autoCat = 'Produits finis';
                  else if (val.startsWith('24')) autoCat = 'Matériel & outillage';
                  else if (val.startsWith('22')) autoCat = 'Bâtiments & agencements';
                  setFormData({ ...formData, compte_reference: val, categorie: autoCat });
                }}
                style={{ width: '100%' }}
              >
                <option value="">-- Aucun compte sélectionné (ou libre) --</option>
                {eligibleAccounts.map((acc) => (
                  <option key={acc.id} value={acc.numero}>
                    {acc.numero} — {acc.libelle} ({acc.classe})
                  </option>
                ))}
              </select>
              <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '3px' }}>
                Associe cet article physique au compte patrimonial correspondant (Stocks cl. 3 ou Immobilisations cl. 2).
              </small>
            </div>

            {/* Code & Désignation */}
            <div className="form-group">
              <Input
                label="Code / Référence article *"
                required
                placeholder="Ex: STK-001, RIZ-50KG"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>

            <div className="form-group">
              <Input
                label="Désignation du bien / article *"
                required
                placeholder="Ex: Riz blanc parfumé Sac 50kg"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>

            {/* Catégorie & Unité */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Catégorie
              </label>
              <input
                type="text"
                className="input"
                placeholder="Ex: Stocks, Matériel..."
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Unité de mesure
              </label>
              <select
                className="input select"
                value={formData.unite}
                onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
              >
                <option value="Unité(s)">Unité(s)</option>
                <option value="Sac(s)">Sac(s)</option>
                <option value="Kg">Kg</option>
                <option value="Tonne(s)">Tonne(s)</option>
                <option value="Litre(s)">Litre(s)</option>
                <option value="Carton(s)">Carton(s)</option>
                <option value="Mètre(s)">Mètre(s)</option>
                <option value="Lot(s)">Lot(s)</option>
              </select>
            </div>

            {/* Quantités : Constatée vs Théorique */}
            <div className="form-group">
              <Input
                label="Quantité constatée (physique) *"
                type="number"
                step="any"
                min="0"
                required
                placeholder="0"
                value={formData.quantite_reelle}
                onChange={(e) => setFormData({ ...formData, quantite_reelle: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '11px' }}>Comptage réel sur le terrain</small>
            </div>

            <div className="form-group">
              <Input
                label="Quantité comptable (théorique)"
                type="number"
                step="any"
                min="0"
                placeholder="Identique si vide"
                value={formData.quantite_theorique}
                onChange={(e) => setFormData({ ...formData, quantite_theorique: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '11px' }}>Solde attendu selon les fiches</small>
            </div>

            {/* Prix unitaire */}
            <div className="form-group">
              <Input
                label="Prix unitaire d'inventaire (FCFA) *"
                type="number"
                step="any"
                min="0"
                required
                placeholder="0"
                value={formData.cout_unitaire}
                onChange={(e) => setFormData({ ...formData, cout_unitaire: e.target.value })}
              />
              <small style={{ color: '#64748b', fontSize: '11px' }}>Coût moyen unitaire pondéré ou prix d'achat</small>
            </div>

            {/* Emplacement */}
            <div className="form-group">
              <Input
                label="Emplacement / Dépôt"
                placeholder="Ex: Magasin Central, Hangar A"
                value={formData.emplacement_physique}
                onChange={(e) => setFormData({ ...formData, emplacement_physique: e.target.value })}
              />
            </div>

            {/* État physique & Date */}
            <div className="form-group">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                État physique
              </label>
              <select
                className="input select"
                value={formData.etat_physique}
                onChange={(e) => setFormData({ ...formData, etat_physique: e.target.value })}
              >
                <option value="Neuf / Excellent">Neuf / Excellent</option>
                <option value="Bon état">Bon état</option>
                <option value="Passable">Passable</option>
                <option value="Dégradé / Usagé">Dégradé / Usagé</option>
                <option value="Obsolète">Obsolète</option>
                <option value="À rebuter / Réformer">À rebuter / Réformer</option>
              </select>
            </div>

            <div className="form-group">
              <Input
                label="Date de recensement"
                type="date"
                value={formData.date_inventaire}
                onChange={(e) => setFormData({ ...formData, date_inventaire: e.target.value })}
              />
            </div>

            {/* Observations */}
            <div className="form-group full-width">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Observations / Remarques
              </label>
              <textarea
                className="input"
                rows={2}
                placeholder="Numéro de lot, état de conservation, justification d'écart éventuel..."
                value={formData.observation}
                onChange={(e) => setFormData({ ...formData, observation: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            {/* Bandeau de synthèse automatique calculée en temps réel */}
            <div className="full-width" style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>
                    Valeur constatée calculée :
                  </span>
                  <strong style={{ fontSize: '16px', display: 'block', color: '#15803d' }}>
                    {money(liveValeurConstatee)} {devise}
                  </strong>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#475569', display: 'block' }}>
                    Écart quantité : <strong>{liveEcartQte > 0 ? `+${liveEcartQte}` : liveEcartQte} {formData.unite}</strong>
                  </span>
                  <span style={{ fontSize: '11px', color: liveEcartValeur === 0 ? '#15803d' : '#b91c1c', fontWeight: 600 }}>
                    Écart valorisé : {money(liveEcartValeur)} {devise}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODALE 2 : DÉTAIL COMPLET AU CLIC SUR UN ARTICLE INVENTORIÉ ── */}
      {selectedItem && (
        <Modal
          isOpen={Boolean(selectedItem)}
          onClose={() => setSelectedItem(null)}
          title="Fiche détaillée de l'article"
          subtitle={`${selectedItem.code} — ${selectedItem.designation}`}
          icon={Package}
          size="lg"
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                {canEdit && !inventoryValidation && (
                  <Button
                    variant="outline"
                    icon={Trash2}
                    onClick={() => handleDeleteItem(selectedItem)}
                    style={{ color: '#e11d48', borderColor: '#fca5a5' }}
                  >
                    Supprimer
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="secondary" onClick={() => setSelectedItem(null)}>
                  Fermer
                </Button>
                {canEdit && !inventoryValidation && (
                  <Button
                    variant="primary"
                    icon={Edit2}
                    onClick={() => handleOpenEditForm(selectedItem)}
                  >
                    Modifier
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Code article</span>
              <span className="detail-value font-mono" style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
                {selectedItem.code}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Compte de référence rattaché</span>
              <span className="detail-value font-mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                {getAccountReference(selectedItem) || 'Non spécifié'}
              </span>
            </div>

            <div className="detail-item full-width">
              <span className="detail-label">Désignation complète</span>
              <span className="detail-value" style={{ fontWeight: 600, fontSize: '14px' }}>
                {selectedItem.designation}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Catégorie</span>
              <span className="detail-value">
                {selectedItem.categorie?.replace(/^\d{3,8}\s*·\s*/, '') || 'Général'}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">Emplacement physique</span>
              <span className="detail-value">
                {selectedItem.emplacement_physique ? `📍 ${selectedItem.emplacement_physique}` : 'Non spécifié'}
              </span>
            </div>

            <div className="detail-item">
              <span className="detail-label">État physique constaté</span>
              <div>
                <Badge tone={selectedItem.etat_physique === 'Neuf / Excellent' || selectedItem.etat_physique === 'Bon état' ? 'success' : 'warning'}>
                  {selectedItem.etat_physique || 'Bon état'}
                </Badge>
              </div>
            </div>

            <div className="detail-item">
              <span className="detail-label">Date du recensement</span>
              <span className="detail-value">
                {selectedItem.date_inventaire ? new Date(selectedItem.date_inventaire).toLocaleDateString('fr-FR') : '—'}
              </span>
            </div>

            {/* Comparatif chiffré des quantités et valorisations */}
            <div className="detail-item full-width" style={{ marginTop: '10px' }}>
              <span className="detail-label" style={{ marginBottom: '8px', display: 'block', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                Tableau comparatif Quantités & Valorisations
              </span>

              <div className="table-wrap">
                <table className="balance-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Élément</th>
                      <th className="text-right">Comptable (Théorique)</th>
                      <th className="text-right">Physique (Constaté)</th>
                      <th className="text-right">Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Quantité</td>
                      <td className="text-right font-mono">
                        {formatQty(selectedItem.quantite_theorique, selectedItem.unite)}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 700 }}>
                        {formatQty(selectedItem.quantite_reelle, selectedItem.unite)}
                      </td>
                      <td className="text-right font-mono" style={{ fontWeight: 700, color: Number(selectedItem.ecart_quantite || 0) === 0 ? '#15803d' : '#b91c1c' }}>
                        {formatQty(selectedItem.ecart_quantite, selectedItem.unite)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Prix unitaire d'inventaire</td>
                      <td className="text-right font-mono">{money(selectedItem.cout_unitaire)} FCFA</td>
                      <td className="text-right font-mono">{money(selectedItem.cout_unitaire)} FCFA</td>
                      <td className="text-right font-mono">—</td>
                    </tr>
                    <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                      <td style={{ color: '#166534' }}>Valorisation totale</td>
                      <td className="text-right font-mono">{money(selectedItem.valeur_comptable)} FCFA</td>
                      <td className="text-right font-mono" style={{ color: '#15803d', fontSize: '13px' }}>
                        {money(selectedItem.valeur_constatee)} FCFA
                      </td>
                      <td className="text-right font-mono" style={{ color: Number(selectedItem.ecart_valeur || 0) === 0 ? '#15803d' : '#b91c1c' }}>
                        {money(selectedItem.ecart_valeur)} FCFA
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {selectedItem.observation && (
              <div className="detail-item full-width">
                <span className="detail-label">Observations & Remarques</span>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#334155', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {selectedItem.observation}
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODALE 3 : DÉTAIL D'UNE MASSE PATRIMONIALE COMPTABLE ── */}
      {selectedSection && (
        <Modal
          isOpen={Boolean(selectedSection)}
          onClose={() => setSelectedSection(null)}
          title={`Détail : ${selectedSection.title}`}
          subtitle={`${selectedSection.activeAccounts.length} compte(s) avec activité · ${selectedSection.classeLabel}`}
          icon={Layers}
          size="xl"
          footer={
            <Button variant="secondary" onClick={() => setSelectedSection(null)}>
              Fermer
            </Button>
          }
        >
          <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1, padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Valeur Brute Totale</span>
              <strong style={{ fontSize: '16px', display: 'block', marginTop: '2px' }}>{money(selectedSection.totalBrut)} {devise}</strong>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase' }}>Amort. & Dépréciations</span>
              <strong style={{ fontSize: '16px', display: 'block', marginTop: '2px', color: '#b91c1c' }}>- {money(selectedSection.totalAmort)} {devise}</strong>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '11px', color: '#166534', textTransform: 'uppercase' }}>Valeur Nette du Poste</span>
              <strong style={{ fontSize: '16px', display: 'block', marginTop: '2px', color: '#15803d' }}>{money(selectedSection.totalNet)} {devise}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table className="balance-table" style={{ fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>N° Compte</th>
                  <th style={{ width: '32%' }}>Intitulé du compte</th>
                  <th className="text-right" style={{ width: '14%' }}>Ouverture Net</th>
                  <th className="text-right" style={{ width: '14%' }}>Mvts Débit</th>
                  <th className="text-right" style={{ width: '14%' }}>Mvts Crédit</th>
                  <th className="text-right" style={{ width: '14%' }}>Solde Net</th>
                </tr>
              </thead>
              <tbody>
                {selectedSection.activeAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td className="account-cell font-mono" style={{ fontWeight: 700, color: '#166534' }}>
                      {acc.numero}
                    </td>
                    <td>
                      {acc.libelle}
                      {acc.hasAnomaly && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#b91c1c', fontWeight: 600 }}>
                          ⚠ Anomalie ou solde inhabituel
                        </span>
                      )}
                    </td>
                    <td className="text-right font-mono">{money(acc.openingSigned)}</td>
                    <td className="text-right font-mono">{money(acc.periodDebit)}</td>
                    <td className="text-right font-mono">{money(acc.periodCredit)}</td>
                    <td className="text-right font-mono" style={{ fontWeight: 700, color: acc.balanceNette >= 0 ? '#166534' : '#b91c1c' }}>
                      {money(acc.balanceNette)}
                    </td>
                  </tr>
                ))}
                {selectedSection.activeAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                      Aucun compte avec mouvement ou solde pour cet exercice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* ── MODALE 4 : CONTRÔLES D'ÉQUILIBRE ET AUDIT DES À-NOUVEAUX ── */}
      {showAuditModal && (
        <Modal
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          title="Diagnostic & Contrôles d'Audit Patrimonial"
          subtitle="Vérifications d'intégrité selon les normes AUDCIF / SYSCOHADA"
          icon={ShieldCheck}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setShowAuditModal(false)}>
              Fermer
            </Button>
          }
        >
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#166534' }}>1. Contrôle des Soldes d'Ouverture (À-Nouveaux)</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                <span>Total Débit d'ouverture :</span>
                <strong className="font-mono">{money(openingControl.debit)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                <span>Total Crédit d'ouverture :</span>
                <strong className="font-mono">{money(openingControl.credit)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '6px 0 0', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <span>Écart d'ouverture :</span>
                <strong style={{ color: Math.abs(openingControl.gap) < 0.01 ? '#15803d' : '#b91c1c' }}>
                  {Math.abs(openingControl.gap) < 0.01 ? '✓ 0 FCFA (Équilibré)' : `${money(openingControl.gap)} FCFA`}
                </strong>
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#166534' }}>2. Équilibre Comptable Actif / Passif</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                <span>Total Actif Net :</span>
                <strong className="font-mono">{money(totals.actifNet)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '4px 0' }}>
                <span>Total Passif Net (Capitaux + Dettes) :</span>
                <strong className="font-mono">{money(totals.passifTotal)} FCFA</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', margin: '6px 0 0', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                <span>Écart comptable Actif / Passif :</span>
                <strong style={{ color: Math.abs(totals.ecartComptable) < 0.01 ? '#15803d' : '#b91c1c' }}>
                  {Math.abs(totals.ecartComptable) < 0.01 ? '✓ 0 FCFA (Équilibre exact)' : `${money(totals.ecartComptable)} FCFA`}
                </strong>
              </div>
            </div>

            <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#f8fafc' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#166534' }}>3. Réconciliation Physique vs Comptable</h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569' }}>
                {physicalInventoryRows.length} article(s) enregistré(s) dans le registre physique.
                {physicalTotals.recensementEffectue ? (
                  <span> Écart net de recensement : <strong style={{ color: Math.abs(physicalTotals.ecartValeur) < 0.01 ? '#15803d' : '#b91c1c' }}>{money(physicalTotals.ecartValeur)} FCFA</strong>.</span>
                ) : (
                  <span> Le recensement n'est pas encore totalement arrêté.</span>
                )}
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODALE 5 : PRÉVISUALISATION PDF DU LIVRE D'INVENTAIRE ── */}
      {showPDFPreview && canExport && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Livre d'inventaire du patrimoine"
          subtitle={`Exercice : ${selectedExercice?.code || ''} — Date d'arrêté : ${cutoffDate || '—'} — ${inventoryValidation ? 'Inventaire arrêté' : 'Recensement en cours'}`}
          filename={buildPdfFilename('Livre-Inventaire', selectedExercice)}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <LivreInventairePDFDocument
              rows={inventoryAccounts}
              statementTotals={totals}
              inventoryItems={physicalInventoryRows}
              totals={{ brut: totals.actifBrut, amort: totals.actifAmort, net: totals.actifNet }}
              exercice={selectedExercice}
              cutoffDate={cutoffDate}
              devise={devise}
              inventoryValidated={Boolean(inventoryValidation)}
              orientation={orientation}
            />
          )}
        />
      )}

      {/* ── DOCUMENT POUR IMPRESSION DIRECTE NAVIGATEUR (@media print) ── */}
      <div className="livre-print-document" style={{ display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #166534', paddingBottom: '10px', marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#166534' }}>
              {company?.raison_sociale || 'CIPRESA CONSULTING SARL'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#64748b' }}>
              LIVRE D'INVENTAIRE ANNUEL · SYSCOHADA / AUDCIF
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px' }}>
            <p style={{ margin: 0 }}><strong>Exercice :</strong> {selectedExercice?.code || selectedExercice?.annee || '—'}</p>
            <p style={{ margin: '2px 0 0' }}><strong>Date d'arrêté :</strong> {cutoffDate || '—'}</p>
            <p style={{ margin: '2px 0 0' }}>Tiré le : {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        {/* Section 1 : Articles physiques */}
        <h3 style={{ fontSize: '12px', color: '#166534', margin: '0 0 6px' }}>
          I. REGISTRE PHYSIQUE DES ARTICLES & BIENS RECENSÉS ({physicalInventoryRows.length} articles)
        </h3>
        <table className="livre-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ backgroundColor: '#275a43', color: '#ffffff' }}>
              <th style={{ padding: '4px', border: '1px solid #166534', width: '12%' }}>Code</th>
              <th style={{ padding: '4px', border: '1px solid #166534', width: '30%' }}>Désignation</th>
              <th style={{ padding: '4px', border: '1px solid #166534', width: '12%' }}>Compte réf.</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '12%' }}>Qté constatée</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '14%' }}>Prix unitaire</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '20%' }}>Valeur totale (FCFA)</th>
            </tr>
          </thead>
          <tbody>
            {physicalInventoryRows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', fontWeight: 700 }}>{r.code}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>{r.designation}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1' }}>{getAccountReference(r) || '—'}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatQty(r.quantite_reelle, r.unite)}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{money(r.cout_unitaire)}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{money(r.valeur_constatee)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700 }}>
              <td colSpan={5} style={{ padding: '4px' }}>TOTAL VALEUR INVENTORIÉE PHYSIQUE</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{money(physicalTotals.valeurConstatee)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        {/* Section 2 : Synthèse patrimoniale */}
        <h3 style={{ fontSize: '12px', color: '#166534', margin: '0 0 6px' }}>
          II. SYNTHÈSE DES MASSES PATRIMONIALES (CLASSES 1 À 5)
        </h3>
        <table className="livre-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ backgroundColor: '#275a43', color: '#ffffff' }}>
              <th style={{ padding: '4px', border: '1px solid #166534', width: '40%' }}>Masse patrimoniale</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '20%' }}>Valeur Brute</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '20%' }}>Amort. / Dépréc.</th>
              <th style={{ padding: '4px', border: '1px solid #166534', textAlign: 'right', width: '20%' }}>Valeur Nette</th>
            </tr>
          </thead>
          <tbody>
            {patrimonialSections.map((sec) => (
              <tr key={sec.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{sec.title}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{money(sec.totalBrut)}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{sec.totalAmort > 0 ? `- ${money(sec.totalAmort)}` : '—'}</td>
                <td style={{ padding: '3px 4px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700 }}>{money(sec.totalNet)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700 }}>
              <td style={{ padding: '4px' }}>ACTIF NET TOTAL DU PATRIMOINE</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{money(totals.actifBrut)}</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>- {money(totals.actifAmort)}</td>
              <td style={{ padding: '4px', textAlign: 'right' }}>{money(totals.actifNet)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        {/* Visas obligatoires */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', pageBreakInside: 'avoid' }}>
          <div style={{ width: '30%', border: '1px solid #94a3b8', padding: '8px', borderRadius: '4px', textAlign: 'center', minHeight: '65px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '9px', color: '#166534' }}>Le Responsable d'Inventaire</p>
            <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b' }}>Visa & Date</p>
          </div>
          <div style={{ width: '30%', border: '1px solid #94a3b8', padding: '8px', borderRadius: '4px', textAlign: 'center', minHeight: '65px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '9px', color: '#166534' }}>Le Chef Comptable</p>
            <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b' }}>Visa & Certification</p>
          </div>
          <div style={{ width: '30%', border: '1px solid #94a3b8', padding: '8px', borderRadius: '4px', textAlign: 'center', minHeight: '65px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '9px', color: '#166534' }}>La Direction Générale</p>
            <p style={{ margin: '2px 0 0', fontSize: '8px', color: '#64748b' }}>Arrêté & Cachet</p>
          </div>
        </div>
      </div>

      {/* ── STYLES D'IMPRESSION A4 PAYSAGE ── */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body, #root, .app-layout, .main-content, .page-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .no-print, .sidebar, header, .app-header, nav, .livre-actions, .livre-tabs, .cr-kpis {
            display: none !important;
          }
          .livre-screen-card {
            display: none !important;
          }
          .livre-print-document {
            display: block !important;
          }
          .livre-print-table {
            width: 100% !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .livre-print-table th {
            background-color: #275a43 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr {
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>
    </div>
  );
}
