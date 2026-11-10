import { useEffect, useMemo, useState } from 'react';
import {
  Printer,
  Download,
  TrendingDown,
  TrendingUp,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import {
  exportCompteResultatExcel,
  CompteResultatPDFDocument,
  PDFPreviewModal,
} from '../../lib/generateFile';

const money = (v) => Math.round(Number(v || 0)).toLocaleString('fr-FR');
const fmt = (v) => {
  const n = Math.round(Number(v || 0));
  if (n === 0) return '-';
  const txt = Math.abs(n).toLocaleString('fr-FR');
  return n < 0 ? `(${txt})` : txt;
};
const frDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '');

function classifyAccount(acc) {
  const num = String(acc.numero || '').trim();
  const nature = acc.nature;

  const isCharge =
    nature === 'CHARGE' ||
    num.startsWith('6') ||
    ['81', '83', '85', '87', '89'].some((p) => num.startsWith(p));
  const isProduit =
    nature === 'PRODUIT' ||
    num.startsWith('7') ||
    ['82', '84', '86', '88'].some((p) => num.startsWith(p));

  if (isCharge) {
    if (num.startsWith('89')) {
      return { side: 'CHARGE', groupKey: 'impot', groupLabel: 'Impôts sur le résultat' };
    }
    if (num.startsWith('67') || num.startsWith('686')) {
      return { side: 'CHARGE', groupKey: 'fin', groupLabel: 'Charges financières' };
    }
    if (
      num.startsWith('69') ||
      num.startsWith('687') ||
      ['81', '83', '85', '87'].some((p) => num.startsWith(p))
    ) {
      return { side: 'CHARGE', groupKey: 'hao', groupLabel: 'Charges H.A.O.' };
    }
    return { side: 'CHARGE', groupKey: 'exploit', groupLabel: "Charges d'exploitation" };
  }

  if (isProduit) {
    if (num.startsWith('77') || num.startsWith('786') || num.startsWith('76')) {
      return { side: 'PRODUIT', groupKey: 'fin', groupLabel: 'Produits financiers' };
    }
    if (
      num.startsWith('79') ||
      num.startsWith('787') ||
      ['82', '84', '86', '88'].some((p) => num.startsWith(p))
    ) {
      return { side: 'PRODUIT', groupKey: 'hao', groupLabel: 'Produits H.A.O.' };
    }
    return { side: 'PRODUIT', groupKey: 'exploit', groupLabel: "Produits d'exploitation" };
  }

  return null;
}

export default function CompteResultat() {
  const { selectedExerciceId: exerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const { selectedEntrepriseId, can } = useAuth();
  const canExport = can('COMPTA_EXPORT');

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [companyName, setCompanyName] = useState('CIPRESA');
  const [devise, setDevise] = useState('FCFA');
  const [hideZero, setHideZero] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  // Charger les paramètres entreprise
  useEffect(() => {
    if (!supabaseConfigured || !selectedEntrepriseId) return;
    let active = true;
    supabase
      .from('parametres_entreprise')
      .select('raison_sociale, nom_entreprise, devise')
      .eq('entreprise_id', selectedEntrepriseId)
      .maybeSingle()
      .then((res) => {
        if (!active || !res.data) return;
        setCompanyName(res.data.raison_sociale || res.data.nom_entreprise || 'CIPRESA');
        if (res.data.devise) setDevise(res.data.devise);
      });
    return () => {
      active = false;
    };
  }, [selectedEntrepriseId]);

  // Charger la balance pour le compte de résultat
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }
    if (exercicesLoading) return;
    if (!exerciceId || !selectedEntrepriseId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotice('');
    let active = true;

    supabase
      .rpc('get_trial_balance_company_scoped', {
        p_company_id: selectedEntrepriseId,
        p_fiscal_year_id: exerciceId,
        p_date_from: selectedExercice?.date_debut,
        p_date_to: selectedExercice?.date_fin,
      })
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setNotice(`Impossible de charger le compte de résultat : ${result.error.message}`);
          setLoading(false);
          return;
        }

        const rawRows = result.data || [];
        const resultRows = rawRows
          .map((row) => {
            const num = String(row.account_code || '').trim();
            const nat = row.nature;
            const isGestion =
              ['CHARGE', 'PRODUIT'].includes(nat) ||
              num.startsWith('6') ||
              num.startsWith('7') ||
              num.startsWith('8');

            if (!isGestion) return null;

            return {
              id: row.account_id,
              numero: num,
              libelle: row.account_name,
              nature: nat,
              debit: Number(row.period_debit || 0),
              credit: Number(row.period_credit || 0),
            };
          })
          .filter(Boolean);

        setAccounts(resultRows);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    exerciceId,
    exercicesLoading,
    selectedEntrepriseId,
    selectedExercice?.date_debut,
    selectedExercice?.date_fin,
  ]);

  // Traitement et classification des comptes
  const calculation = useMemo(() => {
    const normSearch = searchTerm.trim().toLowerCase();

    // Associer la classification et la valeur nette
    const allItems = accounts
      .map((acc) => {
        const info = classifyAccount(acc);
        if (!info) return null;

        const debit = Number(acc.debit || 0);
        const credit = Number(acc.credit || 0);
        // Pour les charges : Débit - Crédit
        // Pour les produits : Crédit - Débit
        const val = info.side === 'CHARGE' ? debit - credit : credit - debit;

        return {
          ...acc,
          side: info.side,
          groupKey: info.groupKey,
          groupLabel: info.groupLabel,
          value: val,
        };
      })
      .filter(Boolean);

    // Totaux globaux (calculés sur TOUTES les écritures, non altérés par la recherche)
    let totalCharges = 0;
    let totalProduits = 0;
    let totalChargesExploit = 0;
    let totalChargesFin = 0;
    let totalChargesHao = 0;
    let totalChargesImpot = 0;
    let totalProduitsExploit = 0;
    let totalProduitsFin = 0;
    let totalProduitsHao = 0;
    let achats60 = 0;

    allItems.forEach((r) => {
      if (r.side === 'CHARGE') {
        totalCharges += r.value;
        if (r.groupKey === 'impot') totalChargesImpot += r.value;
        else if (r.groupKey === 'fin') totalChargesFin += r.value;
        else if (r.groupKey === 'hao') totalChargesHao += r.value;
        else {
          totalChargesExploit += r.value;
          if (r.numero.startsWith('60')) achats60 += r.value;
        }
      } else if (r.side === 'PRODUIT') {
        totalProduits += r.value;
        if (r.groupKey === 'fin') totalProduitsFin += r.value;
        else if (r.groupKey === 'hao') totalProduitsHao += r.value;
        else totalProduitsExploit += r.value;
      }
    });

    const resultatExploit = totalProduitsExploit - totalChargesExploit;
    const resultatFinancier = totalProduitsFin - totalChargesFin;
    const resultatHao = totalProduitsHao - totalChargesHao;
    const resultatNet = totalProduits - totalCharges;
    const margeBrute =
      totalProduitsExploit > 0
        ? ((totalProduitsExploit - achats60) / totalProduitsExploit) * 100
        : null;

    // Filtrage pour l'affichage (recherche & solde non nul)
    const displayedItems = allItems.filter((r) => {
      if (hideZero && Math.abs(r.value) < 0.005) return false;
      if (normSearch) {
        const matchNum = r.numero.toLowerCase().includes(normSearch);
        const matchLib = (r.libelle || '').toLowerCase().includes(normSearch);
        return matchNum || matchLib;
      }
      return true;
    });

    // Regroupement pour l'affichage
    const chargesExploitItems = displayedItems.filter(
      (r) => r.side === 'CHARGE' && r.groupKey === 'exploit',
    );
    const chargesFinItems = displayedItems.filter(
      (r) => r.side === 'CHARGE' && r.groupKey === 'fin',
    );
    const chargesHaoItems = displayedItems.filter(
      (r) => r.side === 'CHARGE' && r.groupKey === 'hao',
    );
    const chargesImpotItems = displayedItems.filter(
      (r) => r.side === 'CHARGE' && r.groupKey === 'impot',
    );

    const produitsExploitItems = displayedItems.filter(
      (r) => r.side === 'PRODUIT' && r.groupKey === 'exploit',
    );
    const produitsFinItems = displayedItems.filter(
      (r) => r.side === 'PRODUIT' && r.groupKey === 'fin',
    );
    const produitsHaoItems = displayedItems.filter(
      (r) => r.side === 'PRODUIT' && r.groupKey === 'hao',
    );

    // Structure des groupes
    const chargesGroups = [
      {
        key: 'exploit',
        label: "Charge d'exploitation",
        items: chargesExploitItems,
        total: totalChargesExploit,
      },
      {
        key: 'fin',
        label: 'Charge financière',
        items: chargesFinItems,
        total: totalChargesFin,
      },
      {
        key: 'hao',
        label: 'Charge H.A.O.',
        items: chargesHaoItems,
        total: totalChargesHao,
      },
      ...(chargesImpotItems.length > 0 || totalChargesImpot !== 0
        ? [
            {
              key: 'impot',
              label: 'Impôts sur le résultat',
              items: chargesImpotItems,
              total: totalChargesImpot,
            },
          ]
        : []),
    ];

    const produitsGroups = [
      {
        key: 'exploit',
        label: "Produit d'exploitation",
        items: produitsExploitItems,
        total: totalProduitsExploit,
      },
      {
        key: 'fin',
        label: 'Produit financier',
        items: produitsFinItems,
        total: totalProduitsFin,
      },
      {
        key: 'hao',
        label: 'Produit H.A.O.',
        items: produitsHaoItems,
        total: totalProduitsHao,
      },
    ];

    return {
      chargesGroups,
      produitsGroups,
      totalCharges,
      totalProduits,
      resultatExploit,
      resultatFinancier,
      resultatHao,
      resultatNet,
      margeBrute,
      totalCount: allItems.length,
      displayedCount: displayedItems.length,
    };
  }, [accounts, hideZero, searchTerm]);

  const handleExportExcel = () => {
    exportCompteResultatExcel({
      chargesGroups: calculation.chargesGroups,
      produitsGroups: calculation.produitsGroups,
      totalCharges: calculation.totalCharges,
      totalProduits: calculation.totalProduits,
      resultatNet: calculation.resultatNet,
      exercice: selectedExercice,
      filename: `Compte_de_Resultat_${selectedExercice?.code || 'exercice'}`,
    });
  };

  const isProvisoire = selectedExercice && !selectedExercice.cloture;

  return (
    <div className="page-content">
      {/* 1. En-tête de page */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Compte de résultat</h1>
          <p className="page-subtitle">
            Performance de l'exercice · Charges et Produits (SYSCOHADA)
            {loading ? ' · Chargement…' : ''}
          </p>
        </div>
        <div className="page-header-actions">
          {canExport && (
            <Button
              variant="secondary"
              icon={Printer}
              onClick={() => setShowPDFPreview(true)}
              disabled={loading || accounts.length === 0}
            >
              Imprimer (PDF)
            </Button>
          )}
          {canExport && (
            <Button
              variant="primary"
              icon={Download}
              onClick={handleExportExcel}
              disabled={loading || accounts.length === 0}
            >
              Exporter Excel
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <div className="message error" role="alert">
          {notice}
        </div>
      )}

      {isProvisoire && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#fffbeb',
            color: '#92400e',
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #fde68a',
            marginBottom: '16px',
          }}
        >
          <Info size={18} />
          <span>
            Situation provisoire : l'exercice {selectedExercice?.code} est en cours. Les montants
            reflètent les écritures validées au {frDate(selectedExercice?.date_fin)}.
          </span>
        </div>
      )}

      {!loading && selectedExercice && (
        <div className="cr-container">
          {/* 2. KPIs synthétiques */}
          <div className="cr-kpis no-print">
            <Card>
              <span className="ledger-summary-label">Total Charges</span>
              <strong style={{ color: '#be123c' }}>
                {money(calculation.totalCharges)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>
                  {devise}
                </span>
              </strong>
              <small>Dépenses et coûts de l'exercice</small>
            </Card>

            <Card>
              <span className="ledger-summary-label">Total Produits</span>
              <strong style={{ color: '#047857' }}>
                {money(calculation.totalProduits)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>
                  {devise}
                </span>
              </strong>
              <small>Chiffre d'affaires et revenus</small>
            </Card>

            <Card>
              <span className="ledger-summary-label">Résultat Net</span>
              <strong
                className={
                  calculation.resultatNet >= 0 ? 'positive' : 'report-delta-negative'
                }
              >
                {calculation.resultatNet >= 0 ? '+' : ''}
                {money(calculation.resultatNet)}{' '}
                <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--color-muted)' }}>
                  {devise}
                </span>
              </strong>
              <small>
                {calculation.resultatNet >= 0
                  ? "Bénéfice final de l'exercice"
                  : "Perte nette de l'exercice"}
              </small>
            </Card>
          </div>

          {/* 3. Barre d'outils et filtres */}
          <Card className="cr-toolbar no-print">
            <div className="cr-toolbar-filters">
              <input
                type="text"
                className="cr-search-input"
                placeholder="Filtrer par compte ou libellé…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <label className="cr-toggle-label">
                <input
                  type="checkbox"
                  checked={hideZero}
                  onChange={(e) => setHideZero(e.target.checked)}
                />
                Masquer les comptes à solde nul
              </label>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
              Exercice {selectedExercice?.code} ({frDate(selectedExercice?.date_debut)} – {frDate(selectedExercice?.date_fin)})
            </div>
          </Card>

          {/* 4. Tableaux 2 Colonnes : CHARGES (Gauche) | PRODUITS (Droite) */}
          <div className="cr-columns-grid">
            {/* Colonne GAUCHE : CHARGES */}
            <div className="cr-column-wrapper">
              <Card className="cr-column-card">
                <div className="cr-column-header charges">
                  <h2>
                    <TrendingDown size={18} /> Charges
                  </h2>
                </div>

                <div className="cr-column-content">
                  {calculation.chargesGroups.map((group) => (
                    <div key={group.key} className="cr-group-section">
                      <div className="cr-group-header charges">
                        <span>{group.label}</span>
                      </div>

                      {group.items.length === 0 ? (
                        <div className="cr-empty-group-text">
                          Aucun compte mouvementé dans cette catégorie
                        </div>
                      ) : (
                        <table className="cr-table">
                          <thead>
                            <tr>
                              <th style={{ width: '80px' }}>Compte</th>
                              <th>Libellé</th>
                              <th className="text-right" style={{ width: '130px' }}>
                                Montant ({devise})
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr key={item.id}>
                                <td className="cr-account-code">{item.numero}</td>
                                <td>{item.libelle}</td>
                                <td className="text-right font-mono">{fmt(item.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Sous-total du groupe */}
                      <div className="cr-subtotal-row">
                        <table className="cr-table">
                          <tbody>
                            <tr>
                              <td colSpan={2} style={{ fontWeight: 700 }}>
                                Total {group.label}
                              </td>
                              <td
                                className="text-right font-mono"
                                style={{ width: '130px', fontWeight: 700 }}
                              >
                                {money(group.total)} {devise}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Case Total Charges (sous la colonne Charges, comme sur le schéma) */}
              <div className="cr-column-total-box charges">
                <span className="total-label">Total Charges</span>
                <span className="total-amount">
                  {money(calculation.totalCharges)} {devise}
                </span>
              </div>
            </div>

            {/* Colonne DROITE : PRODUITS */}
            <div className="cr-column-wrapper">
              <Card className="cr-column-card">
                <div className="cr-column-header produits">
                  <h2>
                    <TrendingUp size={18} /> Produits
                  </h2>
                </div>

                <div className="cr-column-content">
                  {calculation.produitsGroups.map((group) => (
                    <div key={group.key} className="cr-group-section">
                      <div className="cr-group-header produits">
                        <span>{group.label}</span>
                      </div>

                      {group.items.length === 0 ? (
                        <div className="cr-empty-group-text">
                          Aucun compte mouvementé dans cette catégorie
                        </div>
                      ) : (
                        <table className="cr-table">
                          <thead>
                            <tr>
                              <th style={{ width: '80px' }}>Compte</th>
                              <th>Libellé</th>
                              <th className="text-right" style={{ width: '130px' }}>
                                Montant ({devise})
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr key={item.id}>
                                <td className="cr-account-code">{item.numero}</td>
                                <td>{item.libelle}</td>
                                <td className="text-right font-mono">{fmt(item.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {/* Sous-total du groupe */}
                      <div className="cr-subtotal-row">
                        <table className="cr-table">
                          <tbody>
                            <tr>
                              <td colSpan={2} style={{ fontWeight: 700 }}>
                                Total {group.label}
                              </td>
                              <td
                                className="text-right font-mono"
                                style={{ width: '130px', fontWeight: 700 }}
                              >
                                {money(group.total)} {devise}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Case Total Produits (sous la colonne Produits, comme sur le schéma) */}
              <div className="cr-column-total-box produits">
                <span className="total-label">Total Produits</span>
                <span className="total-amount">
                  {money(calculation.totalProduits)} {devise}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Case Total général : Résultat Net (pleine largeur en bas, comme sur le schéma) */}
          <div
            className={`cr-grand-total-card ${
              calculation.resultatNet >= 0 ? 'benefice' : 'perte'
            }`}
          >
            <div className="cr-grand-total-main">
              <div className="cr-grand-total-title-wrap">
                <span className="cr-grand-total-badge">
                  {calculation.resultatNet >= 0 ? 'Bénéfice' : 'Perte'}
                </span>
                <h3 className="cr-grand-total-title">
                  {calculation.resultatNet >= 0
                    ? "RÉSULTAT NET : BÉNÉFICE DE L'EXERCICE"
                    : "RÉSULTAT NET : PERTE DE L'EXERCICE"}
                </h3>
              </div>
              <div className="cr-grand-total-amount">
                {calculation.resultatNet >= 0 ? '+' : ''}
                {money(calculation.resultatNet)} {devise}
              </div>
            </div>

            <div className="cr-grand-total-formula">
              <span>
                Total Produits : <strong>{money(calculation.totalProduits)} {devise}</strong>
              </span>
              <span>−</span>
              <span>
                Total Charges : <strong>{money(calculation.totalCharges)} {devise}</strong>
              </span>
              <span>=</span>
              <span>
                {calculation.resultatNet >= 0 ? 'Bénéfice net dégagé' : 'Perte nette constatée'} :{' '}
                <strong>
                  {money(Math.abs(calculation.resultatNet))} {devise}
                </strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Aperçu PDF */}
      {showPDFPreview && canExport && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Compte de résultat (SYSCOHADA)"
          subtitle={`Exercice : ${selectedExercice?.code || ''}`}
          filename={`Compte_Resultat_${selectedExercice?.code || 'exercice'}`}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <CompteResultatPDFDocument
              chargesGroups={calculation.chargesGroups}
              produitsGroups={calculation.produitsGroups}
              totalCharges={calculation.totalCharges}
              totalProduits={calculation.totalProduits}
              resultatNet={calculation.resultatNet}
              exercice={selectedExercice}
              orientation={orientation}
            />
          )}
        />
      )}
    </div>
  );
}
