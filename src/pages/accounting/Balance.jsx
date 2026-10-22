import { useEffect, useMemo, useState, Fragment } from 'react';
import { Printer, Download } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { exportBalanceExcel, exportBalancePDF, BalancePDFDocument, PDFPreviewModal } from '../../lib/generateFile';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));
const classNumber = (classe) => {
  const match = /classe\s*(\d+)/i.exec(classe || '');
  return match ? Number(match[1]) : 99;
};

export default function Balance() {
  const navigate = useNavigate();
  const { selectedExercice, selectedExerciceId: exerciceId, loading: exercicesLoading } = useExercice();
  const { selectedEntrepriseId } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [movementsByAccount, setMovementsByAccount] = useState({});
  const [classFilter, setClassFilter] = useState('Toutes classes');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [companyName, setCompanyName] = useState('CIPRESA SARL');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    if (exercicesLoading) return;
    if (!exerciceId || !selectedExercice || !selectedEntrepriseId) { setAccounts([]); setMovementsByAccount({}); setLoading(false); return; }
    setLoading(true);
    setAccounts([]);
    setMovementsByAccount({});
    setNotice('');
    let active = true;

    Promise.all([
      supabase.from('parametres_entreprise').select('*').eq('entreprise_id', selectedEntrepriseId).maybeSingle(),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,solde_ouverture_debit,solde_ouverture_credit').eq('exercice_id', exerciceId).order('numero'),
      supabase.rpc('soldes_comptes_exercice', {
        p_exercice_id: exerciceId,
        p_date_debut: selectedExercice.date_debut,
        p_date_fin: selectedExercice.date_fin,
      }),
    ]).then(([paramRes, acRes, mvRes]) => {
      if (!active) return;
      if (paramRes.data?.raison_sociale || paramRes.data?.nom_entreprise) {
        setCompanyName((paramRes.data.raison_sociale || paramRes.data.nom_entreprise).toUpperCase());
      } else if (paramRes.data?.nom) {
        setCompanyName(paramRes.data.nom.toUpperCase());
      }

      if (acRes.error || mvRes.error) {
        setNotice(`Impossible de charger la balance : ${(acRes.error || mvRes.error).message}`);
        setLoading(false);
        return;
      }
      setAccounts(acRes.data || []);

      const grouped = {};
      (mvRes.data || []).forEach((account) => {
        grouped[`${account.compte_id}__${exerciceId}`] = {
          openingNet: Number(account.ouverture || 0) + Number(account.anterieur || 0),
          debit: Number(account.periode_debit || 0),
          credit: Number(account.periode_credit || 0),
          closingNet: Number(account.solde_fin || 0),
        };
      });
      setMovementsByAccount(grouped);
      setLoading(false);
    });
    return () => { active = false; };
  }, [exercicesLoading, exerciceId, selectedExercice, selectedEntrepriseId]);

  const classOptions = useMemo(() => ['Toutes classes', ...new Set(accounts.map((a) => a.classe))].sort((a, b) => (a === 'Toutes classes' ? -1 : classNumber(a) - classNumber(b))), [accounts]);

  const rows = useMemo(() => accounts
    .filter((a) => classFilter === 'Toutes classes' || a.classe === classFilter)
    .map((a) => {
      const mvt = movementsByAccount[`${a.id}__${exerciceId}`] || { debit: 0, credit: 0 };
      const openingNet = mvt.openingNet ?? (Number(a.solde_ouverture_debit || 0) - Number(a.solde_ouverture_credit || 0));
      const closingNet = mvt.closingNet ?? openingNet + mvt.debit - mvt.credit;
      return {
        ...a,
        openingDebit: Math.max(openingNet, 0),
        openingCredit: Math.max(-openingNet, 0),
        mvtDebit: mvt.debit,
        mvtCredit: mvt.credit,
        closingDebit: closingNet >= 0 ? closingNet : 0,
        closingCredit: closingNet < 0 ? Math.abs(closingNet) : 0,
      };
    }), [accounts, movementsByAccount, exerciceId, classFilter]);

  // Contrôles de cohérence globaux, indépendants du filtre de classe affiché.
  const integrity = useMemo(() => {
    const totals = accounts.reduce((acc, account) => {
      const movement = movementsByAccount[`${account.id}__${exerciceId}`] || { debit: 0, credit: 0 };
      const openingNet = movement.openingNet ?? (Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0));
      const closingNet = movement.closingNet ?? openingNet + movement.debit - movement.credit;
      acc.openingDebit += Math.max(openingNet, 0);
      acc.openingCredit += Math.max(-openingNet, 0);
      acc.movementDebit += movement.debit;
      acc.movementCredit += movement.credit;
      acc.closingDebit += Math.max(closingNet, 0);
      acc.closingCredit += Math.max(-closingNet, 0);
      return acc;
    }, { openingDebit: 0, openingCredit: 0, movementDebit: 0, movementCredit: 0, closingDebit: 0, closingCredit: 0 });
    const balanced = (debit, credit) => Math.abs(debit - credit) < 0.01;
    return {
      ...totals,
      openingBalanced: balanced(totals.openingDebit, totals.openingCredit),
      movementsBalanced: balanced(totals.movementDebit, totals.movementCredit),
      closingBalanced: balanced(totals.closingDebit, totals.closingCredit),
    };
  }, [accounts, movementsByAccount, exerciceId]);

  const groups = useMemo(() => {
    const byClass = {};
    rows.forEach((row) => { (byClass[row.classe] = byClass[row.classe] || []).push(row); });
    return Object.entries(byClass).sort(([a], [b]) => classNumber(a) - classNumber(b));
  }, [rows]);

  const sumCol = (list, key) => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);
  const grandTotal = ['openingDebit', 'openingCredit', 'mvtDebit', 'mvtCredit', 'closingDebit', 'closingCredit']
    .reduce((acc, key) => ({ ...acc, [key]: sumCol(rows, key) }), {});

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportBalancePDF({
        groups,
        grandTotal,
        exercice: selectedExercice,
        integrity,
      });
    } catch (err) {
      console.error('Erreur export PDF balance:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportExcel = () => {
    exportBalanceExcel({
      groups,
      grandTotal,
      exercice: selectedExercice,
      integrity,
    });
  };

  return (
    <div className="page-content balance-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Balance générale des comptes</h1>
          <p className="page-subtitle">Vue synthétique des soldes des comptes{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" icon={Printer} onClick={() => setShowPDFPreview(true)} disabled={loading || rows.length === 0}>
            Imprimer (PDF)
          </Button>
          <Button variant="primary" icon={Download} onClick={handleExportExcel} disabled={loading || rows.length === 0}>
            Exporter Excel
          </Button>
        </div>
      </div>

      <Card className="ledger-toolbar no-print">
        <div className="field"><span className="field-label">Exercice actif</span><div className="input" aria-live="polite">{selectedExercice?.code || (exercicesLoading ? 'Chargement…' : 'Aucun exercice')}</div></div>
        <Select label="Filtrer" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
      </Card>

      {!loading && accounts.length > 0 && (
        <div className={`message ${integrity.openingBalanced && integrity.movementsBalanced && integrity.closingBalanced ? 'success' : 'error'} no-print`} role="status">
          <strong>Contrôle de cohérence global (toutes classes) :</strong>{' '}
          {integrity.openingBalanced ? 'à-nouveaux équilibrés' : `écart des à-nouveaux : ${money(Math.abs(integrity.openingDebit - integrity.openingCredit))} FCFA`}
          {' · '}
          {integrity.movementsBalanced ? 'mouvements équilibrés' : `écart des mouvements : ${money(Math.abs(integrity.movementDebit - integrity.movementCredit))} FCFA`}
          {' · '}
          {integrity.closingBalanced ? 'soldes de clôture équilibrés' : `écart de clôture : ${money(Math.abs(integrity.closingDebit - integrity.closingCredit))} FCFA`}
        </div>
      )}

      {notice && <div className="message error no-print" role="alert">{notice}</div>}

      {!loading && (
        <Card className="balance-table-card">
          {/* En-tête visible à l'impression uniquement */}
          <div className="print-only-header" style={{ display: 'none', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>{companyName}</h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: 'bold' }}>
                  BALANCE GÉNÉRALE DES COMPTES — {selectedExercice ? `${selectedExercice.code} (${selectedExercice.annee})` : ''}
                </p>
                {classFilter !== 'Toutes classes' && (
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px' }}>Filtre : {classFilter}</p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '11px' }}>
                <p style={{ margin: 0 }}>Date d'édition : {new Date().toLocaleDateString('fr-FR')}</p>
                <p style={{ margin: 0 }}>Devise : FCFA (XAF)</p>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="balance-table">
              <thead>
                <tr>
                  <th rowSpan={2}>N° Compte</th>
                  <th rowSpan={2}>Libellé du compte</th>
                  <th colSpan={2} className="text-center">Solde Ouverture</th>
                  <th colSpan={2} className="text-center">Mouvements</th>
                  <th colSpan={2} className="text-center">Solde Clôture</th>
                </tr>
                <tr>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                  <th className="text-right">Débit</th><th className="text-right">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([classe, list]) => (
                  <Fragment key={classe}>
                    <tr className="balance-class-row" key={`h-${classe}`}><td colSpan={8}>{classe}</td></tr>
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td className="account-cell"><button type="button" className="report-account-link" title="Ouvrir le grand livre de ce compte" onClick={() => navigate(`/grand-livre?compte=${encodeURIComponent(r.id)}`)}>{r.numero}</button></td>
                        <td>{r.libelle}</td>
                        <td className="text-right">{dash(r.openingDebit)}</td>
                        <td className="text-right">{dash(r.openingCredit)}</td>
                        <td className="text-right">{money(r.mvtDebit)}</td>
                        <td className="text-right">{money(r.mvtCredit)}</td>
                        <td className="text-right">{dash(r.closingDebit)}</td>
                        <td className="text-right">{dash(r.closingCredit)}</td>
                      </tr>
                    ))}
                    <tr className="balance-subtotal-row" key={`s-${classe}`}>
                      <td colSpan={2}>Sous-total {classe.split(' - ')[0]}</td>
                      <td className="text-right">{dash(sumCol(list, 'openingDebit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'openingCredit'))}</td>
                      <td className="text-right">{money(sumCol(list, 'mvtDebit'))}</td>
                      <td className="text-right">{money(sumCol(list, 'mvtCredit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'closingDebit'))}</td>
                      <td className="text-right">{dash(sumCol(list, 'closingCredit'))}</td>
                    </tr>
                  </Fragment>
                ))}
                {groups.length === 0 && <tr><td colSpan={8}>Aucun compte pour ce filtre.</td></tr>}
                <tr className="balance-total-row">
                  <td colSpan={2}>Total général</td>
                  <td className="text-right">{money(grandTotal.openingDebit)}</td>
                  <td className="text-right">{money(grandTotal.openingCredit)}</td>
                  <td className="text-right">{money(grandTotal.mvtDebit)}</td>
                  <td className="text-right">{money(grandTotal.mvtCredit)}</td>
                  <td className="text-right">{money(grandTotal.closingDebit)}</td>
                  <td className="text-right">{money(grandTotal.closingCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Styles d'impression dédiés A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          .no-print { display: none !important; }
          body { background: #fff !important; margin: 0; padding: 0; }
          .balance-page { margin: 0; padding: 0; }
          .balance-table-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
          .print-only-header { display: block !important; }
          .balance-table { width: 100% !important; border: 1px solid #000 !important; }
          .balance-table th, .balance-table td { border-color: #000 !important; padding: 4px 6px !important; font-size: 10px !important; }
          .balance-class-row td { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; font-weight: bold !important; }
          .balance-subtotal-row td { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; font-weight: bold !important; }
          .balance-total-row td { background-color: #ecfdf5 !important; -webkit-print-color-adjust: exact; font-weight: bold !important; color: #000 !important; border-top: 2px solid #000 !important; }
          tr { page-break-inside: avoid !important; }
        }
      `}</style>

      {showPDFPreview && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Balance générale des comptes"
          subtitle={`Exercice : ${selectedExercice?.code || ''}`}
          filename={`Balance_Generale_${selectedExercice?.code || 'exercice'}`}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <BalancePDFDocument
              groups={groups}
              grandTotal={grandTotal}
              exercice={selectedExercice}
              integrity={integrity}
              orientation={orientation}
            />
          )}
        />
      )}
    </div>
  );
}
