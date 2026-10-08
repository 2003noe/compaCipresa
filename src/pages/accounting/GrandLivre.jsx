import React, { useEffect, useMemo, useState } from 'react';
import { Printer, RefreshCw, Filter, Search, Download } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const formatMoney = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (isNaN(num) || num === 0) return '';
  if (num < 0) return `- ${Math.abs(num).toLocaleString('fr-FR')}`;
  return num.toLocaleString('fr-FR');
};

const formatSolde = (val) => {
  const num = Number(val || 0);
  if (num === 0) return '0';
  if (num < 0) return `- ${Math.abs(num).toLocaleString('fr-FR')}`;
  return num.toLocaleString('fr-FR');
};

const formatDateShort = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
};

const formatDateFull = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

const classNumber = (classeStr) => {
  const match = /classe\s*(\d+)/i.exec(classeStr || '');
  if (match) return Number(match[1]);
  const firstDigit = (classeStr || '').trim()[0];
  if (/\d/.test(firstDigit)) return Number(firstDigit);
  return 99;
};

export default function GrandLivre() {
  const [companyName, setCompanyName] = useState('CIPRESA SARL');
  const [devise, setDevise] = useState('CFA');
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [periodStart, setPeriodStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(`${new Date().getFullYear()}-12-31`);
  
  const [accounts, setAccounts] = useState([]);
  const [rawLines, setRawLines] = useState([]);
  
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [selectedClasse, setSelectedClasse] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [printDate] = useState(new Date());

  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from('parametres_entreprise').select('*').limit(1).maybeSingle(),
      supabase.from('exercices_comptables').select('id,code,annee,statut,date_debut,date_fin').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,solde_ouverture_debit,solde_ouverture_credit,devise').order('numero'),
      supabase.from('lignes_ecritures').select('id,compte_id,debit,credit,ecritures_comptables(id,date_ecriture,numero,statut,libelle,exercice_id,journaux(code))'),
    ]).then(([paramRes, exRes, acRes, lineRes]) => {
      if (paramRes.data?.nom_entreprise) {
        setCompanyName(paramRes.data.nom_entreprise.toUpperCase());
      } else if (paramRes.data?.nom) {
        setCompanyName(paramRes.data.nom.toUpperCase());
      }

      if (exRes.error || acRes.error || lineRes.error) {
        setNotice(`Erreur : ${(exRes.error || acRes.error || lineRes.error).message}`);
        setLoading(false);
        return;
      }

      const exList = exRes.data || [];
      setExercises(exList);
      const activeEx = exList.find((e) => e.statut === 'OUVERT') || exList[0];
      if (activeEx) {
        setExerciceId(activeEx.id);
        if (activeEx.date_debut) setPeriodStart(activeEx.date_debut);
        if (activeEx.date_fin) setPeriodEnd(activeEx.date_fin);
      }

      setAccounts(acRes.data || []);
      setRawLines(lineRes.data || []);
      setLoading(false);
    });
  }, []);

  const handleExerciseChange = (e) => {
    const id = e.target.value;
    setExerciceId(id);
    const ex = exercises.find((item) => item.id === id);
    if (ex) {
      if (ex.date_debut) setPeriodStart(ex.date_debut);
      if (ex.date_fin) setPeriodEnd(ex.date_fin);
    }
  };

  const classesList = useMemo(() => {
    const set = new Set(accounts.map((a) => a.classe).filter(Boolean));
    return Array.from(set).sort((a, b) => classNumber(a) - classNumber(b));
  }, [accounts]);

  // Compute transactions and totals per account
  const ledgerData = useMemo(() => {
    const accMap = {};

    accounts.forEach((acc) => {
      const initDebit = Number(acc.solde_ouverture_debit || 0);
      const initCredit = Number(acc.solde_ouverture_credit || 0);

      accMap[acc.id] = {
        account: acc,
        initialDebit: initDebit,
        initialCredit: initCredit,
        beforeDebit: 0,
        beforeCredit: 0,
        movements: [],
      };
    });

    rawLines.forEach((line) => {
      const ecrit = line.ecritures_comptables;
      if (!ecrit || ecrit.statut !== 'VALIDEE') return;
      if (exerciceId && ecrit.exercice_id !== exerciceId) return;

      const accObj = accMap[line.compte_id];
      if (!accObj) return;

      const dateStr = ecrit.date_ecriture;
      const debitVal = Number(line.debit || 0);
      const creditVal = Number(line.credit || 0);

      if (dateStr < periodStart) {
        accObj.beforeDebit += debitVal;
        accObj.beforeCredit += creditVal;
      } else if (dateStr <= periodEnd) {
        accObj.movements.push({
          id: line.id,
          date: dateStr,
          journal: ecrit.journaux?.code || 'OD',
          piece: ecrit.numero || '1',
          libelle: ecrit.libelle || '—',
          debit: debitVal,
          credit: creditVal,
        });
      }
    });

    const resultList = [];
    let globalDebitSum = 0;
    let globalCreditSum = 0;

    accounts.forEach((acc) => {
      const accObj = accMap[acc.id];
      if (!accObj) return;

      // Filter by selection criteria
      if (selectedAccountId !== 'ALL' && acc.id !== selectedAccountId) return;
      if (selectedClasse !== 'ALL' && acc.classe !== selectedClasse) return;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = acc.numero.toLowerCase().includes(q);
        const matchLib = acc.libelle.toLowerCase().includes(q);
        if (!matchNum && !matchLib) return;
      }

      // Calculate starting balance
      const startDebit = accObj.initialDebit + accObj.beforeDebit;
      const startCredit = accObj.initialCredit + accObj.beforeCredit;
      const startNet = startDebit - startCredit;

      // Sort movements chronologically
      accObj.movements.sort((a, b) => a.date.localeCompare(b.date));

      // Build movement rows with running balance
      let runningBalance = startNet;
      let accountTotalDebit = 0;
      let accountTotalCredit = 0;

      const rows = [];

      // Add Bilan d'ouverture line if starting balance is not 0
      if (startNet !== 0 || accObj.movements.length === 0) {
        const openingDebit = startNet > 0 ? startNet : 0;
        const openingCredit = startNet < 0 ? Math.abs(startNet) : 0;

        accountTotalDebit += openingDebit;
        accountTotalCredit += openingCredit;

        rows.push({
          isOpening: true,
          dateShort: formatDateShort(periodStart),
          journal: 'JOD',
          piece: '1',
          libelle: "Bilan d'ouverture",
          lettrage: '',
          debit: openingDebit,
          credit: openingCredit,
          runningBalance: runningBalance,
        });
      }

      accObj.movements.forEach((m) => {
        runningBalance += m.debit - m.credit;
        accountTotalDebit += m.debit;
        accountTotalCredit += m.credit;

        rows.push({
          isOpening: false,
          dateShort: formatDateShort(m.date),
          journal: m.journal,
          piece: m.piece,
          libelle: m.libelle,
          lettrage: '',
          debit: m.debit,
          credit: m.credit,
          runningBalance: runningBalance,
        });
      });

      // Keep accounts that have movements or non-zero balance
      if (rows.length > 0 || startNet !== 0) {
        globalDebitSum += accountTotalDebit;
        globalCreditSum += accountTotalCredit;

        resultList.push({
          account: acc,
          rows: rows,
          totalDebit: accountTotalDebit,
          totalCredit: accountTotalCredit,
          finalBalance: runningBalance,
        });
      }
    });

    const globalNetBalance = globalDebitSum - globalCreditSum;

    return {
      accounts: resultList,
      globalDebitSum,
      globalCreditSum,
      globalNetBalance,
    };
  }, [accounts, rawLines, exerciceId, periodStart, periodEnd, selectedAccountId, selectedClasse, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content sage-grand-livre-page">
      {/* Control Toolbar (Hidden when printing) */}
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Grand-livre des comptes</h1>
          <p className="page-subtitle">Format réglementaire SYSCOHADA / Sage 100 Comptabilité</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button icon={Printer} onClick={handlePrint}>
            Imprimer le Grand-Livre
          </Button>
        </div>
      </div>

      <Card className="ledger-toolbar no-print" style={{ marginBottom: '20px' }}>
        <div className="grid grid-4" style={{ gap: '12px' }}>
          <Select label="Exercice comptable" value={exerciceId} onChange={handleExerciseChange}>
            {exercises.length === 0 && <option value="">Aucun exercice</option>}
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} ({e.annee})
              </option>
            ))}
          </Select>
          <Input label="Période du" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="au" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <Select label="Filtrer par classe" value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)}>
            <option value="ALL">Toutes les classes</option>
            {classesList.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-2" style={{ marginTop: '12px', gap: '12px' }}>
          <Select label="Compte spécifique" value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
            <option value="ALL">Tous les comptes</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.numero} - {a.libelle}
              </option>
            ))}
          </Select>
          <Input
            label="Rechercher écriture / compte"
            placeholder="N° compte ou libellé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </Card>

      {notice && <div className="message error no-print">{notice}</div>}

      {/* SAGE 100 / SYSCOHADA GRAND-LIVRE DOCUMENT CONTAINER */}
      <div className="sage-gl-document">
        {/* Document Header Box */}
        <div className="sage-gl-header-box">
          <div className="sage-gl-header-row top-row">
            <div className="company-name">{companyName}</div>
            <div className="document-title-center">
              <h2>Grand-livre des comptes</h2>
              <div className="sub-type">Complet</div>
            </div>
            <div className="period-info">
              <div>Période du &nbsp; <strong>{formatDateFull(periodStart)}</strong></div>
              <div>au &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>{formatDateFull(periodEnd)}</strong></div>
              <div>Tenue de compte : <strong>{devise}</strong></div>
            </div>
          </div>

          <div className="sage-gl-header-row sub-row">
            <div>Sage 100 Comptabilité 15.01</div>
            <div>
              Date de tirage &nbsp; {printDate.toLocaleDateString('fr-FR')} &nbsp;&nbsp;&nbsp;&nbsp; à &nbsp; {printDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div>Page : 1</div>
          </div>
        </div>

        {/* Main Document Table */}
        <table className="sage-gl-table">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-cj">C.j</th>
              <th className="col-piece">N° pièce</th>
              <th className="col-libelle">Libellé écriture</th>
              <th className="col-let">Let</th>
              <th className="col-debit">Mouvement débit</th>
              <th className="col-credit">Mouvement crédit</th>
              <th className="col-solde">Solde progressif</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center" style={{ padding: '40px' }}>
                  Chargement des données du Grand-Livre...
                </td>
              </tr>
            ) : ledgerData.accounts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center" style={{ padding: '40px' }}>
                  Aucune écriture trouvée pour les critères de recherche.
                </td>
              </tr>
            ) : (
              ledgerData.accounts.map(({ account, rows, totalDebit, totalCredit, finalBalance }) => (
                <React.Fragment key={account.id}>
                  {/* Account Header Line */}
                  <tr className="sage-gl-account-header-row">
                    <td colSpan={8} className="sage-gl-account-header-cell">
                      <span className="acc-num">{account.numero}</span>
                      <span className="acc-label">{account.libelle}</span>
                    </td>
                  </tr>

                  {/* Transaction Lines */}
                  {rows.map((r, idx) => (
                    <tr key={idx} className="sage-gl-entry-row">
                      <td className="col-date">{r.dateShort}</td>
                      <td className="col-cj">{r.journal}</td>
                      <td className="col-piece">{r.piece}</td>
                      <td className="col-libelle">{r.libelle}</td>
                      <td className="col-let">{r.lettrage}</td>
                      <td className="col-debit">{formatMoney(r.debit)}</td>
                      <td className="col-credit">{formatMoney(r.credit)}</td>
                      <td className="col-solde">{formatSolde(r.runningBalance)}</td>
                    </tr>
                  ))}

                  {/* Account Subtotal Line */}
                  <tr className="sage-gl-account-total-row">
                    <td colSpan={5} className="sage-gl-total-label-cell">
                      Total compte {account.numero} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; du {formatDateShort(periodStart)} &nbsp;&nbsp;&nbsp;&nbsp; au {formatDateShort(periodEnd)}
                    </td>
                    <td className="col-debit">{formatMoney(totalDebit)}</td>
                    <td className="col-credit">{formatMoney(totalCredit)}</td>
                    <td className="col-solde">{formatSolde(finalBalance)}</td>
                  </tr>
                </React.Fragment>
              ))
            )}

            {/* Document Grand Total / A Reporter Line */}
            {ledgerData.accounts.length > 0 && (
              <tr className="sage-gl-grand-total-row">
                <td colSpan={5} className="sage-gl-reporter-cell">
                  A reporter
                </td>
                <td className="col-debit">{formatMoney(ledgerData.globalDebitSum)}</td>
                <td className="col-credit">{formatMoney(ledgerData.globalCreditSum)}</td>
                <td className="col-solde">{formatSolde(ledgerData.globalNetBalance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Embedded CSS for Exact Sage 100 Pixel-Perfect Styling & Print Layout */}
      {/* Embedded CSS matching CompaCipresa Design System & Print Layout */}
      <style>{`
        .sage-grand-livre-page {
          font-family: inherit;
          color: var(--color-text, #0f172a);
        }

        .sage-gl-document {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-lg, 12px);
          padding: 16px;
          margin: 0 auto;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          max-width: 100%;
        }

        .sage-gl-header-box {
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: 8px;
          margin-bottom: 16px;
          overflow: hidden;
          background: var(--color-surface-muted, #f8fafc);
        }

        .sage-gl-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
        }

        .sage-gl-header-row.top-row {
          border-bottom: 1px solid var(--color-border, #e2e8f0);
        }

        .sage-gl-header-row .company-name {
          font-weight: 700;
          font-size: 16px;
          color: var(--color-primary, #0d9488);
          width: 30%;
        }

        .sage-gl-header-row .document-title-center {
          text-align: center;
          width: 40%;
        }

        .sage-gl-header-row .document-title-center h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: var(--color-text, #0f172a);
        }

        .sage-gl-header-row .document-title-center .sub-type {
          font-size: 13px;
          margin-top: 2px;
          color: var(--color-muted, #64748b);
          font-weight: 500;
        }

        .sage-gl-header-row .period-info {
          font-size: 12px;
          text-align: right;
          width: 30%;
          line-height: 1.5;
          color: var(--color-text, #334155);
        }

        .sage-gl-header-row.sub-row {
          font-size: 12px;
          background: var(--color-surface, #ffffff);
          color: var(--color-muted, #64748b);
          border-top: 1px solid var(--color-border, #f1f5f9);
        }

        .sage-gl-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 13px;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: 8px;
          overflow: hidden;
        }

        .sage-gl-table th, .sage-gl-table td {
          border: 1px solid var(--color-border, #e2e8f0);
          padding: 8px 6px;
          box-sizing: border-box;
        }

        .sage-gl-table th {
          background-color: var(--color-surface-muted, #f1f5f9);
          color: var(--color-text, #0f172a);
          font-weight: 700;
          text-align: center;
          padding: 10px 6px;
        }

        .col-date { width: 9%; text-align: center; }
        .col-cj { width: 7%; text-align: center; font-weight: 600; color: var(--color-muted, #64748b); }
        .col-piece { width: 12%; text-align: center; word-break: break-all; }
        .col-libelle { width: 32%; text-align: left; word-break: break-word; }
        .col-let { width: 5%; text-align: center; }
        .col-debit { width: 11%; text-align: right; white-space: nowrap; }
        .col-credit { width: 11%; text-align: right; white-space: nowrap; }
        .col-solde { width: 13%; text-align: right; white-space: nowrap; font-weight: 600; }

        .sage-gl-account-header-row {
          background-color: rgba(13, 148, 136, 0.05);
        }

        .sage-gl-account-header-cell {
          font-weight: 700;
          font-size: 14px;
          color: var(--color-primary-dark, #0f766e);
          padding: 10px 12px !important;
          border-bottom: 1px solid var(--color-border, #e2e8f0) !important;
        }

        .sage-gl-account-header-cell .acc-num {
          display: inline-block;
          width: 110px;
          font-weight: 800;
          color: var(--color-primary, #0d9488);
        }

        .sage-gl-account-header-cell .acc-label {
          display: inline-block;
        }

        .sage-gl-entry-row td {
          padding-top: 6px;
          padding-bottom: 6px;
        }

        .sage-gl-account-total-row td {
          font-weight: 700;
          background-color: var(--color-surface-muted, #f8fafc);
          border-top: 1px solid var(--color-border, #cbd5e1) !important;
          border-bottom: 2px solid var(--color-border, #cbd5e1) !important;
          padding: 8px 10px;
        }

        .sage-gl-total-label-cell {
          text-align: left;
          padding-left: 20px !important;
          color: var(--color-text, #0f172a);
        }

        .sage-gl-grand-total-row td {
          font-weight: 800;
          font-size: 14px;
          border-top: 2px solid var(--color-primary, #0d9488) !important;
          border-bottom: 2px solid var(--color-primary, #0d9488) !important;
          background-color: #ecfdf5;
          color: #065f46;
          padding: 12px 10px;
        }

        .sage-gl-reporter-cell {
          text-align: right;
          padding-right: 20px !important;
          font-size: 14px;
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm 8mm 8mm;
          }
          html, body, #root, .app-layout, .main-content, .page-content, .sage-grand-livre-page {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .no-print, .sidebar, header, .app-header, nav {
            display: none !important;
          }
          .sage-gl-document {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .sage-gl-header-box {
            width: 100% !important;
            border: 1px solid #000000 !important;
            border-radius: 0 !important;
            margin-bottom: 8px !important;
          }
          .sage-gl-table {
            width: 100% !important;
            table-layout: fixed !important;
            border: 1px solid #000000 !important;
            border-radius: 0 !important;
          }
          .sage-gl-table th, .sage-gl-table td {
            border: 1px solid #000000 !important;
            padding: 4px 5px !important;
            font-size: 10px !important;
          }
          .sage-gl-account-header-row td {
            background-color: #f1f5f9 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sage-gl-account-total-row td, .sage-gl-grand-total-row td {
            background-color: #f8fafc !important;
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
