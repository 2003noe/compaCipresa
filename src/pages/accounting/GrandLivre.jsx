import { useEffect, useMemo, useState, Fragment } from 'react';
import { RefreshCw, Printer, Download, Filter, Eye, FileText } from 'lucide-react';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (v) => {
  const n = Number(v || 0);
  if (n === 0) return '-';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const dashZero = (v) => {
  const n = Number(v || 0);
  if (n === 0) return '0';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const classNumber = (classeStr) => {
  const match = /classe\s*(\d+)/i.exec(classeStr || '');
  if (match) return Number(match[1]);
  const firstDigit = (classeStr || '').trim()[0];
  if (/\d/.test(firstDigit)) return Number(firstDigit);
  return 99;
};

const firstDayOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
};

const lastDayOfYear = () => {
  const d = new Date();
  return `${d.getFullYear()}-12-31`;
};

export default function GrandLivre() {
  const [exercises, setExercises] = useState([]);
  const [exerciceId, setExerciceId] = useState('');
  const [periodStart, setPeriodStart] = useState(firstDayOfYear());
  const [periodEnd, setPeriodEnd] = useState(lastDayOfYear());
  const [accounts, setAccounts] = useState([]);
  const [rawLines, setRawLines] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('ALL');
  const [selectedClasse, setSelectedClasse] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('synthetic'); // 'synthetic' (Photo 1) | 'detailed' (Photo 2)
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  // Initial loading
  useEffect(() => {
    if (!supabaseConfigured) {
      setNotice("Supabase n'est pas configuré.");
      setLoading(false);
      return;
    }

    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,statut,date_debut,date_fin').order('annee', { ascending: false }),
      supabase.from('comptes_comptables').select('id,numero,libelle,classe,solde_ouverture_debit,solde_ouverture_credit,devise').order('numero'),
      supabase.from('lignes_ecritures').select('id,compte_id,debit,credit,ecritures_comptables(id,date_ecriture,numero,statut,libelle,exercice_id,journaux(code))'),
    ]).then(([exRes, acRes, lineRes]) => {
      if (exRes.error || acRes.error || lineRes.error) {
        setNotice(`Erreur chargement : ${(exRes.error || acRes.error || lineRes.error).message}`);
        setLoading(false);
        return;
      }

      setExercises(exRes.data || []);
      const activeEx = exRes.data?.find((e) => e.statut === 'OUVERT') || exRes.data?.[0];
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

  // Sync date fields when exercise changes
  const handleExerciseChange = (e) => {
    const id = e.target.value;
    setExerciceId(id);
    const ex = exercises.find((item) => item.id === id);
    if (ex) {
      if (ex.date_debut) setPeriodStart(ex.date_debut);
      if (ex.date_fin) setPeriodEnd(ex.date_fin);
    }
  };

  // List of available classes
  const classesList = useMemo(() => {
    const set = new Set(accounts.map((a) => a.classe).filter(Boolean));
    return Array.from(set).sort((a, b) => classNumber(a) - classNumber(b));
  }, [accounts]);

  // Compute calculated balances per account
  const accountDataMap = useMemo(() => {
    const map = {};

    accounts.forEach((acc) => {
      map[acc.id] = {
        account: acc,
        openingDebit: Number(acc.solde_ouverture_debit || 0),
        openingCredit: Number(acc.solde_ouverture_credit || 0),
        mvtDebit: 0,
        mvtCredit: 0,
        linesWithin: [],
      };
    });

    rawLines.forEach((line) => {
      const ecrit = line.ecritures_comptables;
      if (!ecrit || ecrit.statut !== 'VALIDEE') return;
      if (exerciceId && ecrit.exercice_id !== exerciceId) return;

      const accData = map[line.compte_id];
      if (!accData) return;

      const dateStr = ecrit.date_ecriture;
      const debitVal = Number(line.debit || 0);
      const creditVal = Number(line.credit || 0);

      if (dateStr < periodStart) {
        // Entries before period start go into opening adjustment
        accData.openingDebit += debitVal;
        accData.openingCredit += creditVal;
      } else if (dateStr <= periodEnd) {
        // Entries within period
        accData.mvtDebit += debitVal;
        accData.mvtCredit += creditVal;
        accData.linesWithin.push({
          id: line.id,
          date: dateStr,
          journal: ecrit.journaux?.code || 'OD',
          piece: ecrit.numero || '—',
          libelle: ecrit.libelle || '—',
          debit: debitVal,
          credit: creditVal,
        });
      }
    });

    // Compute net opening and net closing per account
    Object.values(map).forEach((item) => {
      // Sort lines chronologically
      item.linesWithin.sort((a, b) => a.date.localeCompare(b.date));

      const openingNet = item.openingDebit - item.openingCredit;
      item.netOpeningDebit = openingNet >= 0 ? openingNet : 0;
      item.netOpeningCredit = openingNet < 0 ? Math.abs(openingNet) : 0;

      const closingNet = openingNet + item.mvtDebit - item.mvtCredit;
      item.closingNet = closingNet;
      item.closingDebit = closingNet >= 0 ? closingNet : 0;
      item.closingCredit = closingNet < 0 ? Math.abs(closingNet) : 0;
    });

    return map;
  }, [accounts, rawLines, exerciceId, periodStart, periodEnd]);

  // Filter accounts according to selections
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (selectedAccountId !== 'ALL' && acc.id !== selectedAccountId) return false;
      if (selectedClasse !== 'ALL' && acc.classe !== selectedClasse) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = acc.numero.toLowerCase().includes(q);
        const matchLib = acc.libelle.toLowerCase().includes(q);
        if (!matchNum && !matchLib) return false;
      }
      return true;
    });
  }, [accounts, selectedAccountId, selectedClasse, searchQuery]);

  // Group filtered accounts by Classe
  const groupedByClasse = useMemo(() => {
    const groups = {};
    filteredAccounts.forEach((acc) => {
      const cls = acc.classe || 'Classe Non Spécifiée';
      if (!groups[cls]) groups[cls] = [];
      const item = accountDataMap[acc.id];
      if (item) groups[cls].push(item);
    });

    // Sort classes numerically
    const sortedKeys = Object.keys(groups).sort((a, b) => classNumber(a) - classNumber(b));
    return sortedKeys.map((clsKey) => {
      const list = groups[clsKey];

      // Calculate class subtotals
      const subtotal = list.reduce(
        (acc, curr) => ({
          openingDebit: acc.openingDebit + curr.netOpeningDebit,
          openingCredit: acc.openingCredit + curr.netOpeningCredit,
          mvtDebit: acc.mvtDebit + curr.mvtDebit,
          mvtCredit: acc.mvtCredit + curr.mvtCredit,
          closingDebit: acc.closingDebit + curr.closingDebit,
          closingCredit: acc.closingCredit + curr.closingCredit,
        }),
        { openingDebit: 0, openingCredit: 0, mvtDebit: 0, mvtCredit: 0, closingDebit: 0, closingCredit: 0 }
      );

      return {
        classeName: clsKey,
        items: list,
        subtotal,
      };
    });
  }, [filteredAccounts, accountDataMap]);

  // Calculate Grand Total across all displayed classes
  const grandTotal = useMemo(() => {
    return groupedByClasse.reduce(
      (acc, g) => ({
        openingDebit: acc.openingDebit + g.subtotal.openingDebit,
        openingCredit: acc.openingCredit + g.subtotal.openingCredit,
        mvtDebit: acc.mvtDebit + g.subtotal.mvtDebit,
        mvtCredit: acc.mvtCredit + g.subtotal.mvtCredit,
        closingDebit: acc.closingDebit + g.subtotal.closingDebit,
        closingCredit: acc.closingCredit + g.subtotal.closingCredit,
      }),
      { openingDebit: 0, openingCredit: 0, mvtDebit: 0, mvtCredit: 0, closingDebit: 0, closingCredit: 0 }
    );
  }, [groupedByClasse]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-content grand-livre-page">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Grand-livre des comptes</h1>
          <p className="page-subtitle">Grand livre des mouvements, totaux et sous-totaux par classe (SYSCOHADA)</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant={viewMode === 'synthetic' ? 'primary' : 'secondary'}
            icon={Eye}
            onClick={() => setViewMode('synthetic')}
          >
            Vue Synthétique (Soldes)
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'primary' : 'secondary'}
            icon={FileText}
            onClick={() => setViewMode('detailed')}
          >
            Vue Détaillée (Écritures)
          </Button>
          <Button variant="secondary" icon={Printer} onClick={handlePrint}>
            Imprimer
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <Card className="ledger-toolbar no-print">
        <div className="grid grid-4" style={{ gap: '12px', alignItems: 'end' }}>
          <Select label="Exercice comptable" value={exerciceId} onChange={handleExerciseChange}>
            {exercises.length === 0 && <option value="">Aucun exercice</option>}
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.code} ({e.annee})
              </option>
            ))}
          </Select>
          <Input label="Début de période" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="Fin de période" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          <Select label="Filtrer par Classe" value={selectedClasse} onChange={(e) => setSelectedClasse(e.target.value)}>
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
            label="Recherche rapide"
            placeholder="Rechercher par numéro ou libellé..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </Card>

      {notice && <div className="message error" role="alert">{notice}</div>}

      {/* Print Header */}
      <div className="print-only-header" style={{ display: 'none', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '8px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px' }}>GRAND-LIVRE DES COMPTES</h2>
            <p style={{ margin: 0, fontSize: '12px' }}>Période du {new Date(periodStart).toLocaleDateString('fr-FR')} au {new Date(periodEnd).toLocaleDateString('fr-FR')}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px' }}>
            <p style={{ margin: 0 }}>Date de tirage: {new Date().toLocaleDateString('fr-FR')}</p>
            <p style={{ margin: 0 }}>Tenue de compte: XAF</p>
          </div>
        </div>
      </div>

      {loading ? (
        <Card><p style={{ padding: '24px', textAlign: 'center' }}>Chargement du grand livre...</p></Card>
      ) : (
        <>
          {/* VUE SYNTHÉTIQUE (Image 1) */}
          {viewMode === 'synthetic' && (
            <Card className="ledger-card">
              <div className="table-wrap">
                <table className="balance-table synthetic-grand-livre">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: '120px' }}>N° COMPTE</th>
                      <th rowSpan={2}>LIBELLÉ DU COMPTE</th>
                      <th colSpan={2} className="text-center" style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>SOLDE OUVERTURE</th>
                      <th colSpan={2} className="text-center" style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>MOUVEMENTS</th>
                      <th colSpan={2} className="text-center" style={{ borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>SOLDE CLÔTURE</th>
                    </tr>
                    <tr>
                      <th className="text-right" style={{ width: '110px' }}>DÉBIT</th>
                      <th className="text-right" style={{ width: '110px' }}>CRÉDIT</th>
                      <th className="text-right" style={{ width: '110px' }}>DÉBIT</th>
                      <th className="text-right" style={{ width: '110px' }}>CRÉDIT</th>
                      <th className="text-right" style={{ width: '110px' }}>DÉBIT</th>
                      <th className="text-right" style={{ width: '110px' }}>CRÉDIT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByClasse.map((group) => (
                      <Fragment key={group.classeName}>
                        {/* Class Header Row */}
                        <tr className="balance-class-row">
                          <td colSpan={8} style={{ fontWeight: 700, backgroundColor: '#f1f5f9', color: '#0f172a', padding: '10px 12px' }}>
                            {group.classeName}
                          </td>
                        </tr>

                        {/* Account Rows */}
                        {group.items.map(({ account, netOpeningDebit, netOpeningCredit, mvtDebit, mvtCredit, closingDebit, closingCredit }) => (
                          <tr key={account.id} className="account-data-row">
                            <td className="account-cell" style={{ fontWeight: 600, color: '#0d9488' }}>
                              {account.numero}
                            </td>
                            <td>{account.libelle}</td>
                            <td className="text-right">{money(netOpeningDebit)}</td>
                            <td className="text-right">{money(netOpeningCredit)}</td>
                            <td className="text-right">{dashZero(mvtDebit)}</td>
                            <td className="text-right">{dashZero(mvtCredit)}</td>
                            <td className="text-right">{money(closingDebit)}</td>
                            <td className="text-right">{money(closingCredit)}</td>
                          </tr>
                        ))}

                        {/* Class Subtotal Row */}
                        <tr className="balance-subtotal-row" style={{ backgroundColor: '#f8fafc', fontWeight: 700, borderTop: '1px solid #cbd5e1', borderBottom: '2px solid #cbd5e1' }}>
                          <td colSpan={2} style={{ paddingLeft: '16px' }}>
                            Sous-total {group.classeName.split(' - ')[0] || group.classeName}
                          </td>
                          <td className="text-right">{money(group.subtotal.openingDebit)}</td>
                          <td className="text-right">{money(group.subtotal.openingCredit)}</td>
                          <td className="text-right">{money(group.subtotal.mvtDebit)}</td>
                          <td className="text-right">{money(group.subtotal.mvtCredit)}</td>
                          <td className="text-right">{money(group.subtotal.closingDebit)}</td>
                          <td className="text-right">{money(group.subtotal.closingCredit)}</td>
                        </tr>
                      </Fragment>
                    ))}

                    {groupedByClasse.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                          Aucun compte ne correspond aux filtres sélectionnés.
                        </td>
                      </tr>
                    )}

                    {/* Grand Total Row */}
                    {groupedByClasse.length > 0 && (
                      <tr className="balance-total-row" style={{ backgroundColor: '#ecfdf5', fontWeight: 800, fontSize: '14px', color: '#065f46', borderTop: '3px solid #059669' }}>
                        <td colSpan={2}>Total général</td>
                        <td className="text-right">{money(grandTotal.openingDebit)}</td>
                        <td className="text-right">{money(grandTotal.openingCredit)}</td>
                        <td className="text-right">{money(grandTotal.mvtDebit)}</td>
                        <td className="text-right">{money(grandTotal.mvtCredit)}</td>
                        <td className="text-right">{money(grandTotal.closingDebit)}</td>
                        <td className="text-right">{money(grandTotal.closingCredit)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* VUE DÉTAILLÉE PAR COMPTE (Image 2) */}
          {viewMode === 'detailed' && (
            <div className="detailed-ledger-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {groupedByClasse.map((group) => (
                <div key={group.classeName} className="class-section" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '16px', color: '#0f172a', margin: 0, padding: '8px 12px', background: '#e2e8f0', borderRadius: '6px', borderLeft: '4px solid #0d9488' }}>
                    {group.classeName}
                  </h3>

                  {group.items.map(({ account, netOpeningDebit, netOpeningCredit, linesWithin, mvtDebit, mvtCredit, closingNet }) => {
                    const openingNet = netOpeningDebit - netOpeningCredit;
                    let running = openingNet;

                    return (
                      <Card key={account.id} style={{ padding: '0', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                        {/* Account Header */}
                        <div style={{ background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {account.numero} &nbsp;&nbsp;&nbsp;&nbsp; {account.libelle}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            Devise: {account.devise || 'XAF'}
                          </span>
                        </div>

                        {/* Movements Table */}
                        <div className="table-wrap">
                          <table className="balance-table detailed-account-table">
                            <thead>
                              <tr style={{ background: '#ffffff', fontSize: '12px' }}>
                                <th style={{ width: '90px' }}>Date</th>
                                <th style={{ width: '60px' }}>C.j</th>
                                <th style={{ width: '100px' }}>N° pièce</th>
                                <th>Libellé écriture</th>
                                <th style={{ width: '50px', textAlign: 'center' }}>Let</th>
                                <th className="text-right" style={{ width: '120px' }}>Mouvement débit</th>
                                <th className="text-right" style={{ width: '120px' }}>Mouvement crédit</th>
                                <th className="text-right" style={{ width: '140px' }}>Solde progressif</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Opening Balance Line */}
                              <tr style={{ fontStyle: 'italic', background: '#fafafa' }}>
                                <td>{new Date(periodStart).toLocaleDateString('fr-FR')}</td>
                                <td>OD</td>
                                <td>—</td>
                                <td>Solde d'ouverture / Réouverture</td>
                                <td style={{ textAlign: 'center' }}>—</td>
                                <td className="text-right">{netOpeningDebit > 0 ? money(netOpeningDebit) : '-'}</td>
                                <td className="text-right">{netOpeningCredit > 0 ? money(netOpeningCredit) : '-'}</td>
                                <td className="text-right" style={{ fontWeight: 600 }}>
                                  {running < 0 ? `- ${money(Math.abs(running))}` : money(running)}
                                </td>
                              </tr>

                              {/* Movement Lines */}
                              {linesWithin.map((line) => {
                                running += line.debit - line.credit;
                                return (
                                  <tr key={line.id}>
                                    <td>{new Date(line.date).toLocaleDateString('fr-FR')}</td>
                                    <td>{line.journal}</td>
                                    <td>{line.piece}</td>
                                    <td>{line.libelle}</td>
                                    <td style={{ textAlign: 'center' }}>—</td>
                                    <td className="text-right">{line.debit > 0 ? money(line.debit) : '-'}</td>
                                    <td className="text-right">{line.credit > 0 ? money(line.credit) : '-'}</td>
                                    <td className="text-right" style={{ fontWeight: 600 }}>
                                      {running < 0 ? `- ${money(Math.abs(running))}` : money(running)}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Account Total Row */}
                              <tr style={{ background: '#f1f5f9', fontWeight: 700, borderTop: '2px solid #cbd5e1' }}>
                                <td colSpan={5}>
                                  Total compte {account.numero} du {new Date(periodStart).toLocaleDateString('fr-FR')} au {new Date(periodEnd).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="text-right">{money(mvtDebit)}</td>
                                <td className="text-right">{money(mvtCredit)}</td>
                                <td className="text-right" style={{ color: closingNet >= 0 ? '#0d9488' : '#b91c1c' }}>
                                  {closingNet < 0 ? `- ${money(Math.abs(closingNet))}` : money(closingNet)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ))}

              {groupedByClasse.length === 0 && (
                <Card>
                  <p style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Aucun compte ne correspond aux filtres sélectionnés.
                  </p>
                </Card>
              )}

              {/* Global Total Box for Detailed Mode */}
              {groupedByClasse.length > 0 && (
                <Card style={{ background: '#0f766e', color: '#ffffff', padding: '16px 20px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '15px', fontWeight: 700 }}>
                    <span>TOTAL GÉNÉRAL DU GRAND-LIVRE</span>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <span>Débits : {money(grandTotal.mvtDebit)} XAF</span>
                      <span>Crédits : {money(grandTotal.mvtCredit)} XAF</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
