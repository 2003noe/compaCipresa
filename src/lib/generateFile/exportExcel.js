// src/lib/generateFile/exportExcel.js
import * as XLSX from 'xlsx';

export const DEFAULT_FOOTER_TEXT = "généré part l'application de comptabilité de CIpressa consulting";
const COMPANY_NAME = 'CIPRESA CONSULTING SARL';
const COMPANY_SUBTITLE = 'Cabinet International de Prestation de Services Agricoles';

/**
 * Calcule automatiquement la largeur des colonnes pour une feuille XLSX
 */
function autoFitColumns(aoa) {
  const colWidths = [];
  aoa.forEach((row) => {
    row.forEach((cell, colIdx) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      colWidths[colIdx] = Math.max(colWidths[colIdx] || 10, Math.min(len + 3, 50));
    });
  });
  return colWidths.map((wch) => ({ wch }));
}

/**
 * Exporte un tableau générique vers Excel avec en-tête et pied de page CIPRESA
 */
export function exportToExcel({
  rows = [],
  columns = [],
  filename = 'export',
  sheet = 'Données',
  title = '',
  subtitle = '',
  totals = null,
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
  ];

  if (title) aoa.push([title]);
  if (subtitle) aoa.push([subtitle]);
  aoa.push([`Exporté le ${new Date().toLocaleDateString('fr-FR')}`]);
  aoa.push([]); // Ligne vide

  // En-têtes de colonnes
  const headers = columns.map((c) => c.label || c.key);
  aoa.push(headers);

  // Lignes de données
  rows.forEach((row) => {
    aoa.push(columns.map((col) => row[col.key] ?? ''));
  });

  // Ligne de totaux optionnelle
  if (totals) {
    const totalRow = columns.map((col, idx) => {
      if (idx === 0) return 'TOTAL';
      return totals[col.key] ?? '';
    });
    aoa.push(totalRow);
  }

  // Pied de page
  aoa.push([]);
  aoa.push([footerText]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Journal Comptable
 */
export function exportJournalExcel({ rows = [], totals = {}, exercice = null, filename = 'Journal_comptable' }) {
  const exerciceLabel = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['JOURNAL COMPTABLE'],
    [exerciceLabel ? `Exercice : ${exerciceLabel} — Date d'exportation : ${dateStr}` : `Date d'exportation : ${dateStr}`],
    [],
    ['Date', 'Journal', 'Référence', 'Description', 'Débit (FCFA)', 'Crédit (FCFA)', 'Statut'],
  ];

  rows.forEach((r) => {
    aoa.push([
      r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—',
      r.journal || '',
      r.ref || '',
      r.description || '',
      Number(r.debitValue || 0),
      Number(r.creditValue || 0),
      r.status || '',
    ]);
  });

  aoa.push([
    '',
    '',
    '',
    `TOTAL (${rows.length} écriture${rows.length > 1 ? 's' : ''})`,
    Number(totals?.debit || 0),
    Number(totals?.credit || 0),
    totals?.debit === totals?.credit ? 'Équilibré ✓' : 'Écart détecté',
  ]);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Journal');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié à la Balance Générale des Comptes
 */
export function exportBalanceExcel({ groups = [], grandTotal = {}, exercice = null, filename = 'Balance_Generale' }) {
  const exCode = exercice?.code || exercice?.annee || 'Exercice';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['BALANCE GÉNÉRALE DES COMPTES'],
    [`Exercice : ${exCode} — Date de tirage : ${dateStr}`],
    [],
    [
      'Classe',
      'N° Compte',
      'Libellé du compte',
      'Solde Ouverture Débit',
      'Solde Ouverture Crédit',
      'Mouvements Débit',
      'Mouvements Crédit',
      'Solde Clôture Débit',
      'Solde Clôture Crédit',
    ],
  ];

  const sumCol = (list, key) => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);

  groups.forEach(([classe, list]) => {
    list.forEach((r) => {
      aoa.push([
        classe,
        r.numero || '',
        r.libelle || '',
        Number(r.openingDebit || 0),
        Number(r.openingCredit || 0),
        Number(r.mvtDebit || 0),
        Number(r.mvtCredit || 0),
        Number(r.closingDebit || 0),
        Number(r.closingCredit || 0),
      ]);
    });

    // Ligne sous-total de classe
    aoa.push([
      classe,
      `Sous-total ${classe.split(' - ')[0]}`,
      '',
      sumCol(list, 'openingDebit'),
      sumCol(list, 'openingCredit'),
      sumCol(list, 'mvtDebit'),
      sumCol(list, 'mvtCredit'),
      sumCol(list, 'closingDebit'),
      sumCol(list, 'closingCredit'),
    ]);
  });

  // Ligne de Total Général
  aoa.push([
    '',
    'TOTAL GÉNÉRAL',
    '',
    Number(grandTotal?.openingDebit || 0),
    Number(grandTotal?.openingCredit || 0),
    Number(grandTotal?.mvtDebit || 0),
    Number(grandTotal?.mvtCredit || 0),
    Number(grandTotal?.closingDebit || 0),
    Number(grandTotal?.closingCredit || 0),
  ]);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Balance Générale');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Grand Livre des Comptes
 */
export function exportGrandLivreExcel({
  ledgerData = { accounts: [], globalDebitSum: 0, globalCreditSum: 0, globalNetBalance: 0 },
  exercice = null,
  periodStart = '',
  periodEnd = '',
  filename = 'Grand_Livre',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['GRAND-LIVRE DES COMPTES'],
    [
      `Exercice : ${exCode || 'En cours'} — Période : ${periodStart || '—'} au ${periodEnd || '—'} — Date de tirage : ${dateStr}`,
    ],
    [],
    ['Date', 'C.j', 'N° pièce', 'Libellé écriture', 'Let', 'Mouvement Débit', 'Mouvement Crédit', 'Solde progressif'],
  ];

  (ledgerData.accounts || []).forEach(({ account, rows, totalDebit, totalCredit, finalBalance }) => {
    // En-tête de compte
    aoa.push([`COMPTE : ${account.numero} - ${account.libelle}`, '', '', '', '', '', '', '']);

    rows.forEach((r) => {
      aoa.push([
        r.dateShort || '',
        r.journal || '',
        r.piece || '',
        r.libelle || '',
        r.lettrage || '',
        Number(r.debit || 0),
        Number(r.credit || 0),
        Number(r.runningBalance || 0),
      ]);
    });

    // Ligne sous-total du compte
    aoa.push([
      `Total compte ${account.numero}`,
      '',
      '',
      '',
      '',
      Number(totalDebit || 0),
      Number(totalCredit || 0),
      Number(finalBalance || 0),
    ]);
    aoa.push([]); // Ligne de séparation
  });

  // Total général
  aoa.push([
    'TOTAL GÉNÉRAL',
    '',
    '',
    '',
    '',
    Number(ledgerData.globalDebitSum || 0),
    Number(ledgerData.globalCreditSum || 0),
    Number(ledgerData.globalNetBalance || 0),
  ]);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Grand Livre');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Bilan Comptable (SYSCOHADA)
 */
export function exportBilanExcel({
  actifRows = [],
  passifRows = [],
  bilan = null,
  exercice = null,
  filename = 'Bilan_Comptable',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['BILAN COMPTABLE (SYSCOHADA)'],
    [`Exercice : ${exCode} — Date : ${dateStr}`],
    [],
    ['SECTION / ÉLÉMENT', 'N° Compte', 'Intitulé', 'Montant Net (FCFA)'],
  ];

  aoa.push(['--- ACTIF ---', '', '', '']);
  actifRows.forEach((r) => {
    if (r.isSection) {
      aoa.push([r.label, '', '', '']);
    } else if (r.isSubtotal) {
      aoa.push(['', '', r.label, Number(r.val || 0)]);
    } else {
      aoa.push(['', r.num || '', r.label || '', Number(r.val || 0)]);
    }
  });

  if (bilan?.totals) {
    aoa.push(['TOTAL ACTIF', '', '', Number(bilan.totals.totalActif || 0)]);
  }

  aoa.push([]);
  aoa.push(['--- PASSIF ---', '', '', '']);
  passifRows.forEach((r) => {
    if (r.isSection) {
      aoa.push([r.label, '', '', '']);
    } else if (r.isSubtotal) {
      aoa.push(['', '', r.label, Number(r.val || 0)]);
    } else {
      aoa.push(['', r.num || '', r.label || '', Number(r.val || 0)]);
    }
  });

  if (bilan?.totals) {
    aoa.push(['TOTAL PASSIF', '', '', Number(bilan.totals.totalPassif || 0)]);
    aoa.push([
      'CONTRÔLE ÉQUILIBRE',
      '',
      '',
      Math.abs(bilan.ecart || 0) < 1 ? 'Équilibré ✓' : `Écart : ${Number(bilan.ecart || 0)} FCFA`,
    ]);
  }

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bilan');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Suivi de Trésorerie
 */
export function exportTresorerieExcel({
  soldeBanque = 0,
  soldeCaisse = 0,
  disponibilites = 0,
  accounts = [],
  movements = [],
  monthlyFlows = [],
  exercice = null,
  filename = 'Suivi_Tresorerie',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['SUIVI DE TRÉSORERIE'],
    [`Exercice : ${exCode} — Date : ${dateStr}`],
    [],
    ['SYNTHÈSE DES DISPONIBILITÉS'],
    ['Solde Banque global', Number(soldeBanque)],
    ['Solde Caisse principale', Number(soldeCaisse)],
    ['Disponibilités totales', Number(disponibilites)],
    [],
    ['COMPTES DE TRÉSORERIE'],
    ['N° Compte', 'Libellé', 'Nature', 'Solde (FCFA)'],
  ];

  accounts.forEach((a) => {
    aoa.push([a.numero || '', a.libelle || '', a.caisse ? 'Caisse' : 'Banque', Number(a.balance || 0)]);
  });

  aoa.push([]);
  aoa.push(['FLUX DE TRÉSORERIE MENSUELS']);
  aoa.push(['Mois', 'Entrées (FCFA)', 'Sorties (FCFA)', 'Solde Net (FCFA)']);
  monthlyFlows.forEach((m) => {
    aoa.push([m.label, Number(m.entrees || 0), Number(m.sorties || 0), Number((m.entrees || 0) - (m.sorties || 0))]);
  });

  aoa.push([]);
  aoa.push(['DERNIERS MOUVEMENTS DE TRÉSORERIE']);
  aoa.push(['Date', 'Type', 'Libellé', 'Compte', 'Montant (FCFA)']);
  movements.forEach((m) => {
    aoa.push([
      m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '',
      m.type || '',
      m.libelle || '',
      m.compte || '',
      Number(m.montant || 0),
    ]);
  });

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trésorerie');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Livre d'Inventaire
 */
export function exportLivreInventaireExcel({
  rows = [],
  totals = null,
  exercice = null,
  cutoffDate = '',
  devise = 'FCFA',
  filename = 'Livre_Inventaire',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = cutoffDate || new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ["LIVRE D'INVENTAIRE DU PATRIMOINE (AUDCIF art. 19-20 OHADA)"],
    [`Exercice : ${exCode} — Date d'arrêté : ${dateStr}`],
    [],
    [
      'N° Compte',
      'Libellé du compte',
      'Section OHADA',
      `Valeur Brute (${devise})`,
      `Amort. / Dépréc. (${devise})`,
      `Valeur Nette N (${devise})`,
      `Valeur N-1 (${devise})`,
      `Variation (${devise})`,
    ],
  ];

  rows.forEach((a) => {
    aoa.push([
      a.numero || '',
      a.libelle || '',
      a.sectionName || '',
      Number(a.balanceBrute || 0),
      Number(a.amortDeprec || 0),
      Number(a.balanceNette || 0),
      a.balancePrecedente !== undefined && a.balancePrecedente !== null ? Number(a.balancePrecedente) : '',
      a.variation !== undefined && a.variation !== null ? Number(a.variation) : '',
    ]);
  });

  if (totals) {
    aoa.push([
      'TOTAL',
      '',
      '',
      Number(totals.brut || 0),
      Number(totals.amort || 0),
      Number(totals.net || 0),
      totals.prec !== undefined ? Number(totals.prec) : '',
      totals.var !== undefined ? Number(totals.var) : '',
    ]);
  }

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Livre d'inventaire");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
