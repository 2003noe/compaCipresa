// src/lib/generateFile/exportExcel.js
import * as XLSX from 'xlsx-js-style';

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

/** Export du plan comptable en deux colonnes de tableaux, comme la page écran. */
export function exportChartOfAccountsExcel({ groups = [], filename = 'Plan_Comptable', title = 'PLAN COMPTABLE GÉNÉRAL & SECTORIEL', subtitle = '' }) {
  const left = groups.filter((group) => group.column === 'left');
  const right = groups.filter((group) => group.column === 'right');
  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    [title],
    [subtitle],
    [`Exporté le ${new Date().toLocaleDateString('fr-FR')}`],
    [],
  ];
  const merges = [0, 1, 2, 3, 4].map((r) => ({ s: { r, c: 0 }, e: { r, c: 10 } }));
  const styles = {
    banner: { font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 14 }, fill: { fgColor: { rgb: 'FF174B38' } }, alignment: { vertical: 'center' } },
    subtitle: { font: { italic: true, color: { rgb: 'FF557064' }, sz: 10 } },
    title: { font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 12 }, fill: { fgColor: { rgb: 'FF24664E' } }, alignment: { vertical: 'center' } },
    header: { font: { bold: true, color: { rgb: 'FF315643' }, sz: 9 }, fill: { fgColor: { rgb: 'FFE9F4EC' } }, alignment: { vertical: 'center' }, border: { bottom: { style: 'thin', color: { rgb: 'FFD6E5DC' } } } },
    metric: { font: { bold: true, color: { rgb: 'FF26372E' }, sz: 9 }, fill: { fgColor: { rgb: 'FFF0F7F2' } }, alignment: { horizontal: 'right', vertical: 'center' } },
    body: { font: { color: { rgb: 'FF26372E' }, sz: 9 }, border: { bottom: { style: 'hair', color: { rgb: 'FFE7ECE8' } } }, alignment: { vertical: 'center' } },
    bodyAlt: { font: { color: { rgb: 'FF26372E' }, sz: 9 }, fill: { fgColor: { rgb: 'FFF8FAF8' } }, border: { bottom: { style: 'hair', color: { rgb: 'FFE7ECE8' } } }, alignment: { vertical: 'center' } },
    positive: { font: { bold: true, color: { rgb: 'FF168653' }, sz: 9 }, alignment: { horizontal: 'right', vertical: 'center' } },
    negative: { font: { bold: true, color: { rgb: 'FFC33B36' }, sz: 9 }, alignment: { horizontal: 'right', vertical: 'center' } },
    balanced: { font: { color: { rgb: 'FF748278' }, sz: 8 }, alignment: { horizontal: 'right', vertical: 'center' } },
  };
  const differenceText = (value) => Number(value || 0) === 0
    ? '— Équilibré'
    : `${Number(value) > 0 ? '↗ +' : '↘ −'}${Math.abs(Number(value)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;
  const differenceStyle = (value) => Number(value) > 0 ? styles.positive : Number(value) < 0 ? styles.negative : styles.balanced;
  const cellAt = (ws, row, col) => ws[XLSX.utils.encode_cell({ r: row, c: col })];

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftGroup = left[index];
    const rightGroup = right[index];
    const titleRow = aoa.length;
    aoa.push([leftGroup?.title || '', '', '', '', '', '', rightGroup?.title || '', '', '', '', '']);
    merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 4 } });
    merges.push({ s: { r: titleRow, c: 6 }, e: { r: titleRow, c: 10 } });
    const totalCells = (group) => group
      ? ['', 'TOTAL CLASSE', Number(group.totalDebit || 0), Number(group.totalCredit || 0), differenceText(group.difference)]
      : ['', '', '', '', ''];
    aoa.push([...totalCells(leftGroup), ...totalCells(rightGroup)]);
    aoa.push(['Compte', 'Intitulé du compte', 'Débit', 'Crédit', 'Différence', '', 'Compte', 'Intitulé du compte', 'Débit', 'Crédit', 'Différence']);
    const count = Math.max(leftGroup?.rows?.length || 0, rightGroup?.rows?.length || 0);
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      const accountCells = (account) => account
        ? [account.numero || '', [account.libelle || '', account.notes || ''].filter(Boolean).join('\n'), Number(account.debit || 0), Number(account.credit || 0), differenceText(account.difference)]
        : ['', '', '', '', ''];
      aoa.push([...accountCells(leftGroup?.rows?.[rowIndex]), '', ...accountCells(rightGroup?.rows?.[rowIndex])]);
    }
    aoa.push(Array(11).fill(''));
  }

  aoa.push([DEFAULT_FOOTER_TEXT]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 3 }, { wch: 12 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 20 }];
  ws['!merges'] = merges;
  for (let col = 0; col <= 10; col += 1) {
    const cell = cellAt(ws, 0, col); if (cell) cell.s = styles.banner;
    const sub = cellAt(ws, 1, col); if (sub) sub.s = styles.subtitle;
    const heading = cellAt(ws, 2, col); if (heading) heading.s = styles.title;
  }
  for (let row = 6; row < aoa.length; row += 1) {
    const isClassTitle = String(aoa[row][0] || '').startsWith('Classe') || String(aoa[row][6] || '').startsWith('Classe');
    const isHeader = aoa[row][0] === 'Compte' || aoa[row][6] === 'Compte';
    const isMetric = aoa[row][1] === 'TOTAL CLASSE' || aoa[row][7] === 'TOTAL CLASSE';
    if (isClassTitle) {
      [0, 6].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) cell.s = styles.title; });
      continue;
    }
    if (isHeader) {
      [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) cell.s = styles.header; });
      continue;
    }
    if (isMetric) {
      [0, 1, 2, 3, 4, 6, 7, 8, 9, 10].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) cell.s = styles.metric; });
      [4, 10].forEach((col) => { const group = col === 4 ? left.find((item) => item?.title === aoa[row - 1]?.[0]) : right.find((item) => item?.title === aoa[row - 1]?.[6]); const cell = cellAt(ws, row, col); if (cell && group) cell.s = differenceStyle(group.difference); });
      continue;
    }
    if (row >= aoa.length - 2) continue;
    const accountRow = row % 2 ? styles.bodyAlt : styles.body;
    [0, 1, 2, 3, 6, 7, 8, 9].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) cell.s = accountRow; });
    [2, 3, 8, 9].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) { cell.z = '#,##0;[Red](#,##0);-'; cell.s = { ...accountRow, alignment: { horizontal: 'right', vertical: 'center' } }; } });
    [4, 10].forEach((col) => { const cell = cellAt(ws, row, col); if (cell) { const txt = String(cell.v || ''); cell.s = txt.startsWith('↗') ? styles.positive : txt.startsWith('↘') ? styles.negative : styles.balanced; } });
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plan comptable');
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
export function exportBalanceExcel({ groups = [], grandTotal = {}, exercice = null, integrity = null, filename = 'Balance_Generale' }) {
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

  if (integrity) {
    aoa.push([]);
    aoa.push(['CONTRÔLES DE COHÉRENCE', '', '', '', '', '', '', '', '']);
    aoa.push(['À-nouveaux équilibrés', integrity.openingBalanced ? 'Oui' : 'Non', '', '', '', '', '', '', '']);
    aoa.push(['Mouvements équilibrés', integrity.movementsBalanced ? 'Oui' : 'Non', '', '', '', '', '', '', '']);
    aoa.push(['Soldes de clôture équilibrés', integrity.closingBalanced ? 'Oui' : 'Non', '', '', '', '', '', '', '']);
  }

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
  bilanN1 = null,
  exercice = null,
  exerciceN1 = null,
  filename = 'Bilan_Comptable',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['BILAN COMPTABLE (SYSCOHADA)'],
    [`Exercice : ${exCode}${exerciceN1 ? ` · Comparaison : ${exerciceN1.code || exerciceN1.annee}` : ''} — Date : ${dateStr}`],
    [],
    ['SECTION / ÉLÉMENT', 'N° Compte', 'Intitulé', 'Montant N (FCFA)', ...(exerciceN1 ? [`Montant ${exerciceN1.code || exerciceN1.annee} (FCFA)`, 'Écart (FCFA)', 'Écart (%)'] : [])],
  ];

  const amountColumns = (row) => [Number(row.val || 0), ...(exerciceN1 ? [Number(row.val1 || 0), Number(row.val || 0) - Number(row.val1 || 0), Number(row.val1) ? `${((Number(row.val || 0) - Number(row.val1)) / Math.abs(Number(row.val1)) * 100).toFixed(1)}%` : (Number(row.val) ? 'Nouveau' : '—')] : [])];
  const sectionRow = (label) => [label, '', '', ...Array(exerciceN1 ? 4 : 1).fill('')];

  aoa.push(sectionRow('--- ACTIF ---'));
  actifRows.forEach((r) => {
    if (r.isSection) {
      aoa.push(sectionRow(r.label));
    } else if (r.isSubtotal) {
      aoa.push(['', '', r.label, ...amountColumns(r)]);
    } else {
      aoa.push(['', r.num || '', r.label || '', ...amountColumns(r)]);
    }
  });

  if (bilan?.totals) {
    const totalRow = { val: bilan.totals.actif, val1: bilanN1?.totals?.actif };
    aoa.push(['TOTAL ACTIF', '', '', ...amountColumns(totalRow)]);
  }

  aoa.push([]);
  aoa.push(sectionRow('--- PASSIF ---'));
  passifRows.forEach((r) => {
    if (r.isSection) {
      aoa.push(sectionRow(r.label));
    } else if (r.isSubtotal) {
      aoa.push(['', '', r.label, ...amountColumns(r)]);
    } else {
      aoa.push(['', r.num || '', r.label || '', ...amountColumns(r)]);
    }
  });

  if (bilan?.totals) {
    const totalRow = { val: bilan.totals.passif, val1: bilanN1?.totals?.passif };
    aoa.push(['TOTAL PASSIF', '', '', ...amountColumns(totalRow)]);
    aoa.push([
      'CONTRÔLE ÉQUILIBRE',
      '',
      '',
      Math.abs(bilan.ecart || 0) < 1 ? 'Équilibré ✓' : `Écart : ${Number(bilan.ecart || 0)} FCFA`,
      ...(exerciceN1 ? ['', '', ''] : []),
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
