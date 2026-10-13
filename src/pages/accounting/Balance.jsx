import { useEffect, useMemo, useState, Fragment } from 'react';
import { Printer, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');
const dash = (v) => (Number(v || 0) === 0 ? '-' : money(v));
const classNumber = (classe) => {
  const match = /classe\s*(\d+)/i.exec(classe || '');
  return match ? Number(match[1]) : 99;
};

export default function Balance() {
  const { selectedExercice, selectedExerciceId: exerciceId, loading: exercicesLoading } = useExercice();
  const [accounts, setAccounts] = useState([]);
  const [movementsByAccount, setMovementsByAccount] = useState({});
  const [classFilter, setClassFilter] = useState('Toutes classes');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [companyName, setCompanyName] = useState('CIPRESA SARL');

  useEffect(() => {
    if (!supabaseConfigured) { setNotice("Supabase n'est pas configuré."); setLoading(false); return; }
    if (exercicesLoading) return;
    if (!exerciceId || !selectedExercice) { setAccounts([]); setMovementsByAccount({}); setLoading(false); return; }
    setLoading(true);
    setAccounts([]);
    setMovementsByAccount({});
    setNotice('');
    let active = true;

    Promise.all([
      supabase.from('parametres_entreprise').select('*').limit(1).maybeSingle(),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,solde_ouverture_debit,solde_ouverture_credit').eq('exercice_id', exerciceId).order('numero'),
      supabase.from('lignes_ecritures').select('compte_id,debit,credit,ecritures_comptables!inner(exercice_id,date_ecriture,statut)').eq('ecritures_comptables.exercice_id', exerciceId).gte('ecritures_comptables.date_ecriture', selectedExercice.date_debut).lte('ecritures_comptables.date_ecriture', selectedExercice.date_fin),
    ]).then(([paramRes, acRes, mvRes]) => {
      if (!active) return;
      if (paramRes.data?.nom_entreprise) {
        setCompanyName(paramRes.data.nom_entreprise.toUpperCase());
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
      (mvRes.data || []).forEach((line) => {
        if (line.ecritures_comptables?.statut !== 'VALIDEE') return;
        const key = `${line.compte_id}__${exerciceId}`;
        if (!grouped[key]) grouped[key] = { debit: 0, credit: 0 };
        grouped[key].debit += Number(line.debit || 0);
        grouped[key].credit += Number(line.credit || 0);
      });
      setMovementsByAccount(grouped);
      setLoading(false);
    });
    return () => { active = false; };
  }, [exercicesLoading, exerciceId, selectedExercice]);

  const classOptions = useMemo(() => ['Toutes classes', ...new Set(accounts.map((a) => a.classe))].sort((a, b) => (a === 'Toutes classes' ? -1 : classNumber(a) - classNumber(b))), [accounts]);

  const rows = useMemo(() => accounts
    .filter((a) => classFilter === 'Toutes classes' || a.classe === classFilter)
    .map((a) => {
      const mvt = movementsByAccount[`${a.id}__${exerciceId}`] || { debit: 0, credit: 0 };
      const openingNet = Number(a.solde_ouverture_debit || 0) - Number(a.solde_ouverture_credit || 0);
      const closingNet = openingNet + mvt.debit - mvt.credit;
      return {
        ...a,
        openingDebit: a.solde_ouverture_debit,
        openingCredit: a.solde_ouverture_credit,
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
      const openingNet = Number(account.solde_ouverture_debit || 0) - Number(account.solde_ouverture_credit || 0);
      const closingNet = openingNet + movement.debit - movement.credit;
      acc.openingDebit += Number(account.solde_ouverture_debit || 0);
      acc.openingCredit += Number(account.solde_ouverture_credit || 0);
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

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const exportData = [];

    groups.forEach(([classe, list]) => {
      list.forEach((r) => {
        exportData.push({
          'Classe': classe,
          'N° Compte': r.numero,
          'Libellé du compte': r.libelle,
          'Solde Ouverture Débit': Number(r.openingDebit || 0),
          'Solde Ouverture Crédit': Number(r.openingCredit || 0),
          'Mouvements Débit': Number(r.mvtDebit || 0),
          'Mouvements Crédit': Number(r.mvtCredit || 0),
          'Solde Clôture Débit': Number(r.closingDebit || 0),
          'Solde Clôture Crédit': Number(r.closingCredit || 0),
        });
      });

      // Ligne de sous-total par classe
      exportData.push({
        'Classe': classe,
        'N° Compte': `Sous-total ${classe.split(' - ')[0]}`,
        'Libellé du compte': '',
        'Solde Ouverture Débit': sumCol(list, 'openingDebit'),
        'Solde Ouverture Crédit': sumCol(list, 'openingCredit'),
        'Mouvements Débit': sumCol(list, 'mvtDebit'),
        'Mouvements Crédit': sumCol(list, 'mvtCredit'),
        'Solde Clôture Débit': sumCol(list, 'closingDebit'),
        'Solde Clôture Crédit': sumCol(list, 'closingCredit'),
      });
    });

    // Ligne de Total Général
    exportData.push({
      'Classe': '',
      'N° Compte': 'Total général',
      'Libellé du compte': '',
      'Solde Ouverture Débit': grandTotal.openingDebit,
      'Solde Ouverture Crédit': grandTotal.openingCredit,
      'Mouvements Débit': grandTotal.mvtDebit,
      'Mouvements Crédit': grandTotal.mvtCredit,
      'Solde Clôture Débit': grandTotal.closingDebit,
      'Solde Clôture Crédit': grandTotal.closingCredit,
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Ajustement de la largeur des colonnes Excel
    worksheet['!cols'] = [
      { wch: 25 }, // Classe
      { wch: 15 }, // N° Compte
      { wch: 35 }, // Libellé
      { wch: 18 }, // Solde Ouv Débit
      { wch: 18 }, // Solde Ouv Crédit
      { wch: 18 }, // Mvt Débit
      { wch: 18 }, // Mvt Crédit
      { wch: 18 }, // Solde Clot Débit
      { wch: 18 }, // Solde Clot Crédit
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Générale');

    const exCode = selectedExercice?.code || 'Exercice';
    const fileName = `Balance_Generale_${exCode}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="page-content balance-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Balance générale des comptes</h1>
          <p className="page-subtitle">Vue synthétique des soldes des comptes{loading ? ' · Chargement…' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" icon={Printer} onClick={handlePrint} disabled={loading || rows.length === 0}>
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
                        <td className="account-cell">{r.numero}</td>
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
    </div>
  );
}
