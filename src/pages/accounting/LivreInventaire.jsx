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
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { computeDepreciation } from '../../lib/depreciation';

export default function LivreInventaire() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
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

  const devise = company?.devise || 'FCFA';

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

    setLoading(true);
    setNotice('');

    Promise.all([
      supabase
        .from('exercices_comptables')
        .select('id,code,annee,date_debut,date_fin,statut')
        .order('annee', { ascending: false }),
      supabase
        .from('comptes_comptables')
        .select('id,numero,libelle,classe,nature,solde_ouverture_debit,solde_ouverture_credit,devise')
        .order('numero'),
      supabase
        .from('lignes_ecritures')
        .select('compte_id,debit,credit,ecritures_comptables(exercice_id,date_ecriture,statut)'),
      supabase
        .from('immobilisations')
        .select('*')
        .order('code'),
      supabase
        .from('parametres_entreprise')
        .select('*')
        .limit(1)
        .maybeSingle(),
    ])
      .then(([exRes, acRes, lnRes, immoRes, compRes]) => {
        if (exRes.error || acRes.error || lnRes.error) {
          const err = exRes.error || acRes.error || lnRes.error;
          setNotice(`Impossible de charger le livre d'inventaire : ${err.message}`);
          setLoading(false);
          return;
        }

        const exList = exRes.data || [];
        setExercises(exList);

        const currentEx = exList.find((e) => e.statut === 'OUVERT') || exList[0];
        if (currentEx) {
          setExerciceId(currentEx.id);
          setCutoffDate(currentEx.date_fin || new Date().toISOString().slice(0, 10));
        }

        setAccounts(acRes.data || []);
        setLines((lnRes.data || []).filter((l) => l.ecritures_comptables?.statut === 'VALIDEE'));
        setPhysicalAssets(immoRes.data || []);
        if (compRes?.data) {
          setCompany(compRes.data);
        }
        setLoading(false);
      })
      .catch((err) => {
        setNotice(`Erreur inattendue : ${err.message}`);
        setLoading(false);
      });
  }, [refreshKey]);

  const selectedExercice = useMemo(
    () => exercises.find((e) => e.id === exerciceId) || null,
    [exercises, exerciceId]
  );

  const previousExercice = useMemo(() => {
    if (!selectedExercice?.annee) return null;
    return exercises.find((e) => e.annee === selectedExercice.annee - 1) || null;
  }, [exercises, selectedExercice]);

  const handleExerciceChange = (newId) => {
    setExerciceId(newId);
    const ex = exercises.find((e) => e.id === newId);
    if (ex?.date_fin) {
      setCutoffDate(ex.date_fin);
    }
  };

  // Calcul du solde d'un compte à la date d'arrêté
  const getAccountBalanceAsOf = (account, dateLimit) => {
    if (!dateLimit) return { debit: 0, credit: 0, solde: 0 };
    const baseDebit = Number(account.solde_ouverture_debit || 0);
    const baseCredit = Number(account.solde_ouverture_credit || 0);

    const mvt = lines.filter(
      (l) => l.compte_id === account.id && l.ecritures_comptables?.date_ecriture <= dateLimit
    );

    const debitMvt = mvt.reduce((acc, l) => acc + Number(l.debit || 0), 0);
    const creditMvt = mvt.reduce((acc, l) => acc + Number(l.credit || 0), 0);

    const totalDebit = baseDebit + debitMvt;
    const totalCredit = baseCredit + creditMvt;
    const solde = totalDebit - totalCredit;

    return { debit: totalDebit, credit: totalCredit, solde };
  };

  // Résultat net dynamique de l'exercice (Comptes de produits classe 7 - Comptes de charges classe 6)
  const resultNet = useMemo(() => {
    if (!selectedExercice) return 0;
    let produits = 0;
    let charges = 0;
    accounts.forEach((a) => {
      const net = lines
        .filter(
          (l) =>
            l.compte_id === a.id &&
            l.ecritures_comptables?.date_ecriture >= selectedExercice.date_debut &&
            l.ecritures_comptables?.date_ecriture <= (cutoffDate || selectedExercice.date_fin)
        )
        .reduce((acc, l) => acc + Number(l.debit || 0) - Number(l.credit || 0), 0);

      if (a.nature === 'CHARGE' || a.numero?.startsWith('6')) charges += net;
      if (a.nature === 'PRODUIT' || a.numero?.startsWith('7')) produits += -net;
    });
    return produits - charges;
  }, [accounts, lines, selectedExercice, cutoffDate]);

  // Données dynamiques calculées pour l'inventaire
  const inventoryAccounts = useMemo(() => {
    return accounts.map((acc) => {
      const current = getAccountBalanceAsOf(acc, cutoffDate || selectedExercice?.date_fin);
      const prev = previousExercice ? getAccountBalanceAsOf(acc, previousExercice.date_fin) : null;

      const num = acc.numero || '';
      let category = 'AUTRE';
      let sectionName = 'Autres comptes';
      let isAmortOuDeprec = false;

      if (num.startsWith('28') || num.startsWith('29') || num.startsWith('39') || num.startsWith('49') || num.startsWith('59')) {
        isAmortOuDeprec = true;
      }

      if (num.startsWith('2')) {
        category = 'ACTIF_IMMO';
        sectionName = 'Actif Immobilisé (Classe 2)';
      } else if (num.startsWith('3')) {
        category = 'STOCKS';
        sectionName = 'Stocks et En-cours (Classe 3)';
      } else if (num.startsWith('4')) {
        if (['41', '42', '43', '44', '46', '47', '48'].some((p) => num.startsWith(p)) && current.solde >= 0) {
          category = 'CREANCES';
          sectionName = 'Créances et Débiteurs (Classe 4)';
        } else {
          category = 'DETTES_COURT_TERME';
          sectionName = 'Dettes circulantes & Tiers (Classe 4)';
        }
      } else if (num.startsWith('5')) {
        if (current.solde >= 0) {
          category = 'TRESORERIE';
          sectionName = 'Trésorerie et Disponibilités (Classe 5)';
        } else {
          category = 'DETTES_COURT_TERME';
          sectionName = 'Découverts & Trésorerie Passif (Classe 5)';
        }
      } else if (num.startsWith('1')) {
        category = 'CAPITAUX_PROPRES';
        sectionName = 'Capitaux Propres & Dettes Financières (Classe 1)';
      }

      const brut = Math.abs(current.solde);
      const amort = isAmortOuDeprec ? Math.abs(current.solde) : 0;
      const variation = prev !== null ? current.solde - prev.solde : null;

      return {
        ...acc,
        category,
        sectionName,
        isAmortOuDeprec,
        balanceBrute: brut,
        amortDeprec: amort,
        balanceNette: current.solde,
        balancePrecedente: prev ? prev.solde : null,
        variation,
      };
    });
  }, [accounts, lines, cutoffDate, selectedExercice, previousExercice]);

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
  const totals = useMemo(() => {
    let actifBrut = 0;
    let actifAmort = 0;
    let passifTotal = 0;
    let dettesTotal = 0;
    let capitauxPropres = 0;

    inventoryAccounts.forEach((acc) => {
      const num = acc.numero || '';
      const solde = acc.balanceNette;

      if (['2', '3', '4', '5'].some((p) => num.startsWith(p)) && (acc.nature === 'ACTIF' || acc.nature === 'TRESORERIE' || solde > 0)) {
        if (acc.isAmortOuDeprec) {
          actifAmort += Math.abs(solde);
        } else {
          actifBrut += Math.abs(solde);
        }
      }

      if (num.startsWith('1') || (acc.nature === 'PASSIF' && solde < 0)) {
        if (['10', '11', '12', '13', '14', '15'].some((p) => num.startsWith(p))) {
          capitauxPropres += Math.abs(solde);
        } else {
          dettesTotal += Math.abs(solde);
        }
        passifTotal += Math.abs(solde);
      } else if (['4', '5'].some((p) => num.startsWith(p)) && solde < 0) {
        dettesTotal += Math.abs(solde);
        passifTotal += Math.abs(solde);
      }
    });

    capitauxPropres += resultNet;
    passifTotal += resultNet;

    const actifNet = Math.max(0, actifBrut - actifAmort);
    const situationNette = actifNet - dettesTotal;
    const ecartEquilibre = Math.abs(actifNet - passifTotal);

    return {
      actifBrut,
      actifAmort,
      actifNet,
      passifTotal,
      dettesTotal,
      capitauxPropres,
      situationNette,
      ecartEquilibre,
    };
  }, [inventoryAccounts, resultNet]);

  const filteredAccounts = useMemo(() => {
    return inventoryAccounts.filter((acc) => {
      if (activeTab === 'ACTIF_IMMO' && acc.category !== 'ACTIF_IMMO') return false;
      if (activeTab === 'STOCKS' && acc.category !== 'STOCKS') return false;
      if (activeTab === 'CREANCES' && acc.category !== 'CREANCES') return false;
      if (activeTab === 'TRESORERIE' && acc.category !== 'TRESORERIE') return false;
      if (activeTab === 'CAPITAUX_PROPRES' && acc.category !== 'CAPITAUX_PROPRES') return false;
      if (activeTab === 'DETTES_COURT_TERME' && acc.category !== 'DETTES_COURT_TERME') return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNum = (acc.numero || '').toLowerCase().includes(term);
        const matchLib = (acc.libelle || '').toLowerCase().includes(term);
        if (!matchNum && !matchLib) return false;
      }

      return true;
    });
  }, [inventoryAccounts, activeTab, searchTerm]);

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

  const handleExportXLSX = () => {
    const dataToExport = filteredAccounts.map((a) => ({
      'N° Compte': a.numero,
      'Libellé du compte': a.libelle,
      'Section OHADA': a.sectionName,
      [`Valeur Brute (${devise})`]: a.balanceBrute,
      [`Amort. / Dépréc. (${devise})`]: a.amortDeprec,
      [`Valeur Nette N (${devise})`]: a.balanceNette,
      [`Valeur N-1 (${devise})`]: a.balancePrecedente ?? '',
      [`Variation (${devise})`]: a.variation ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Livre d'inventaire");

    const fileName = `Livre_Inventaire_${selectedExercice?.code || 'Exercice'}_${cutoffDate || 'cloture'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handlePrint = () => {
    window.print();
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
                Exercice {selectedExercice.code || selectedExercice.annee} ({selectedExercice.statut})
              </Badge>
            )}
          </div>
          <p className="page-subtitle">
            État descriptif et estimatif des éléments d'actif et de passif du patrimoine · AUDCIF art. 19-20 (OHADA)
          </p>
        </div>

        <div className="livre-actions" style={{ display: 'flex', gap: '8px' }}>
          <Button icon={RefreshCw} variant="outline" onClick={() => setRefreshKey((k) => k + 1)} disabled={loading}>
            Actualiser
          </Button>
          <Button icon={Download} variant="outline" onClick={handleExportXLSX} disabled={filteredAccounts.length === 0}>
            Exporter Excel
          </Button>
          <Button icon={Printer} onClick={handlePrint}>
            Imprimer / PDF
          </Button>
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
          <Select
            label="Exercice comptable"
            value={exerciceId}
            onChange={(e) => handleExerciceChange(e.target.value)}
          >
            {exercises.length === 0 && <option value="">Aucun exercice disponible</option>}
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code || e.annee} ({e.statut}) — du {e.date_debut} au {e.date_fin}
              </option>
            ))}
          </Select>

          <Input
            label="Date d'arrêté d'inventaire"
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

        {/* Navigation par onglets */}
        <div className="livre-tabs" style={{ display: 'flex', gap: '8px', marginTop: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[
            { id: 'ALL', label: 'Vue Complète Patrimoine', icon: Layers },
            { id: 'ACTIF_IMMO', label: 'Actif Immobilisé (Cl. 2)', icon: Building2 },
            { id: 'STOCKS', label: 'Stocks & En-cours (Cl. 3)', icon: Package },
            { id: 'CREANCES', label: 'Créances & Tiers (Cl. 4)', icon: Users },
            { id: 'TRESORERIE', label: 'Trésorerie (Cl. 5)', icon: Wallet },
            { id: 'CAPITAUX_PROPRES', label: 'Capitaux Propres (Cl. 1)', icon: ShieldCheck },
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
      </Card>

      {/* Cartes KPIs Synthèse patrimoniale */}
      <div className="cr-kpis" style={{ marginBottom: '24px' }}>
        <Card>
          <span className="ledger-summary-label">Actif Brut</span>
          <strong>{money(totals.actifBrut)} {devise}</strong>
          <small style={{ color: 'var(--color-muted)' }}>Valeur totale des biens & créances</small>
        </Card>

        <Card>
          <span className="ledger-summary-label">Amort. & Dépréciations</span>
          <strong style={{ color: '#e11d48' }}>- {money(totals.actifAmort)} {devise}</strong>
          <small style={{ color: 'var(--color-muted)' }}>Pertes de valeur cumulées</small>
        </Card>

        <Card>
          <span className="ledger-summary-label">Actif Net (Patrimoine réel)</span>
          <strong style={{ color: '#0d9488' }}>{money(totals.actifNet)} {devise}</strong>
          <small style={{ color: 'var(--color-muted)' }}>Total Actif Net de clôture</small>
        </Card>

        <Card>
          <span className="ledger-summary-label">Dettes Externes</span>
          <strong style={{ color: '#d97706' }}>{money(totals.dettesTotal)} {devise}</strong>
          <small style={{ color: 'var(--color-muted)' }}>Emprunts + Dettes fournisseurs & fiscales</small>
        </Card>

        <Card>
          <span className="ledger-summary-label">Situation Nette / Capitaux</span>
          <strong style={{ color: '#7c3aed' }}>{money(totals.situationNette)} {devise}</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            {totals.ecartEquilibre < 100 ? (
              <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <CheckCircle2 size={12} /> Équilibre conforme
              </span>
            ) : (
              <span style={{ fontSize: '11px', color: '#d97706', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <AlertTriangle size={12} /> Écart inventaire: {money(totals.ecartEquilibre)} {devise}
              </span>
            )}
          </div>
        </Card>
      </div>

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
      ) : (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                État récapitulatif des éléments du Patrimoine (Actif & Passif)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-muted)' }}>
                {filteredAccounts.length} compte(s) répertorié(s) à la date d'inventaire ({cutoffDate || 'clôture'})
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table className="balance-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>N° Compte</th>
                  <th>Intitulé de l'élément / Rubrique</th>
                  <th className="text-right" style={{ width: '140px' }}>Valeur Brute ({devise})</th>
                  <th className="text-right" style={{ width: '140px' }}>Amort. & Dépréc.</th>
                  <th className="text-right" style={{ width: '140px' }}>Valeur Nette N</th>
                  {previousExercice && (
                    <th className="text-right" style={{ width: '130px' }}>Valeur N-1</th>
                  )}
                  {previousExercice && (
                    <th className="text-right" style={{ width: '130px' }}>Variation N / N-1</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={previousExercice ? 7 : 5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-muted)' }}>
                      Aucun compte correspondant aux filtres sélectionnés.
                    </td>
                  </tr>
                ) : (
                  Object.entries(groupedSections).map(([sectionTitle, sectionAccounts]) => {
                    const subBrut = sectionAccounts.reduce((s, a) => s + a.balanceBrute, 0);
                    const subAmort = sectionAccounts.reduce((s, a) => s + a.amortDeprec, 0);
                    const subNet = sectionAccounts.reduce((s, a) => s + a.balanceNette, 0);
                    const subN1 = sectionAccounts.reduce((s, a) => s + (a.balancePrecedente || 0), 0);
                    const subVar = subNet - subN1;

                    return (
                      <tbody key={sectionTitle}>
                        <tr className="balance-class-row">
                          <td colSpan={previousExercice ? 7 : 5}>
                            {sectionTitle} ({sectionAccounts.length} élément{sectionAccounts.length > 1 ? 's' : ''})
                          </td>
                        </tr>
                        {sectionAccounts.map((acc) => (
                          <tr key={acc.id}>
                            <td className="account-cell" style={{ fontWeight: 600 }}>{acc.numero}</td>
                            <td>{acc.libelle}</td>
                            <td className="text-right">{dash(acc.balanceBrute)}</td>
                            <td className="text-right" style={{ color: acc.amortDeprec > 0 ? '#e11d48' : undefined }}>
                              {dash(acc.amortDeprec)}
                            </td>
                            <td className="text-right" style={{ fontWeight: 600 }}>
                              {dash(acc.balanceNette)}
                            </td>
                            {previousExercice && (
                              <td className="text-right" style={{ color: 'var(--color-muted)' }}>
                                {dash(acc.balancePrecedente)}
                              </td>
                            )}
                            {previousExercice && (
                              <td className="text-right" style={{ color: acc.variation > 0 ? '#0d9488' : acc.variation < 0 ? '#e11d48' : undefined }}>
                                {dash(acc.variation)}
                              </td>
                            )}
                          </tr>
                        ))}
                        <tr className="balance-subtotal-row">
                          <td colSpan={2} style={{ paddingLeft: '24px' }}>
                            Sous-total {sectionTitle}
                          </td>
                          <td className="text-right">{dash(subBrut)}</td>
                          <td className="text-right" style={{ color: subAmort > 0 ? '#e11d48' : undefined }}>
                            {dash(subAmort)}
                          </td>
                          <td className="text-right" style={{ fontWeight: 700 }}>{dash(subNet)}</td>
                          {previousExercice && (
                            <td className="text-right">{dash(subN1)}</td>
                          )}
                          {previousExercice && (
                            <td className="text-right" style={{ fontWeight: 600 }}>{dash(subVar)}</td>
                          )}
                        </tr>
                      </tbody>
                    );
                  })
                )}
              </tbody>
              {filteredAccounts.length > 0 && activeTab === 'ALL' && (
                <tfoot>
                  <tr className="balance-total-row">
                    <td colSpan={2}>RÉCAPITULATIF PATRIMONIAL GLOBAL (ACTIF NET / PASSIF)</td>
                    <td className="text-right">{money(totals.actifBrut)}</td>
                    <td className="text-right" style={{ color: '#e11d48' }}>- {money(totals.actifAmort)}</td>
                    <td className="text-right" style={{ fontSize: '14px', fontWeight: 800 }}>{money(totals.actifNet)}</td>
                    {previousExercice && <td></td>}
                    {previousExercice && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>
      )}

      {/* Visas légaux de certification (OHADA AUDCIF Art. 20) */}
      <Card style={{ marginTop: '24px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--color-muted)' }}>
          Attestation de l'arrêté d'inventaire (SYSCOHADA)
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
          Nous soussignés, certifions que le présent livre d'inventaire, arrêté au{' '}
          <strong>{cutoffDate ? new Date(cutoffDate).toLocaleDateString('fr-FR') : 'clôture'}</strong>, reflète fidèlement
          l'intégralité des existants d'actifs et de passifs de l'entité <strong>{companyName} {companyJuridique}</strong>, conformément aux dispositions
          des articles 17 à 20 de l'Acte Uniforme relatif au Droit Comptable et à l'Information Financière (AUDCIF).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginTop: '16px' }}>
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-muted)' }}>
              Le Responsable de l'Inventaire
            </span>
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', color: 'var(--color-muted)', fontStyle: 'italic', fontSize: '12px' }}>
              Signature & Date :
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-muted)' }}>
              Le Chef Comptable / Expert-Comptable
            </span>
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', color: 'var(--color-muted)', fontStyle: 'italic', fontSize: '12px' }}>
              Signature & Date :
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--color-muted)' }}>
              La Direction Générale
            </span>
            <div style={{ height: '48px', display: 'flex', alignItems: 'center', color: 'var(--color-muted)', fontStyle: 'italic', fontSize: '12px' }}>
              Visa d'approbation :
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
