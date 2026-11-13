// src/lib/generateFile/exportExcel.js
import * as XLSX from 'xlsx-js-style';
import { buildPdfFilename } from './filename';

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
 * Export Excel dédié au Journal Comptable - Format réglementaire SYSCOHADA
 */
export function exportJournalExcel({
  rows = [],
  totals = {},
  exercice = null,
  filename = '',
}) {
  const targetFilename = filename || buildPdfFilename('Journal', exercice);
  const exerciceLabel = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');
  const isBalanced = Math.abs(Number(totals?.debit || 0) - Number(totals?.credit || 0)) < 0.01;

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['JOURNAL COMPTABLE GÉNÉRAL - SYSCOHADA'],
    [
      exerciceLabel
        ? `Exercice : ${exerciceLabel} — Date d'exportation : ${dateStr} — Tenue de compte : FCFA`
        : `Date d'exportation : ${dateStr} — Tenue de compte : FCFA`,
    ],
    [],
    [
      'Date',
      'Journal',
      'N° Pièce / Réf',
      'N° Compte',
      'Intitulé du compte',
      'Libellé de l\'écriture / ligne',
      'Débit (FCFA)',
      'Crédit (FCFA)',
      'Statut',
    ],
  ];

  const headerRowIdx = 5;
  const dataStartRowIdx = 6;

  rows.forEach((r) => {
    const formattedDate = r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—';
    const journalCode = r.journal || '';
    const pieceRef = r.ref || r.numero || '';
    const statusText = r.status || 'Validée';

    if (r.lignes && r.lignes.length > 0) {
      r.lignes.forEach((l, lIdx) => {
        aoa.push([
          lIdx === 0 ? formattedDate : '',
          lIdx === 0 ? journalCode : '',
          lIdx === 0 ? pieceRef : '',
          l.accountNumber || '—',
          l.accountLabel || '—',
          l.description || r.description || '',
          Number(l.debit || 0),
          Number(l.credit || 0),
          lIdx === 0 ? statusText : '',
        ]);
      });
    } else {
      aoa.push([
        formattedDate,
        journalCode,
        pieceRef,
        '—',
        '—',
        r.description || '',
        Number(r.debitValue || 0),
        Number(r.creditValue || 0),
        statusText,
      ]);
    }
  });

  const totalRowIdx = aoa.length;
  aoa.push([
    '',
    '',
    '',
    '',
    'TOTAL GÉNÉRAL',
    `${rows.length} écriture${rows.length > 1 ? 's' : ''}`,
    Number(totals?.debit || 0),
    Number(totals?.credit || 0),
    isBalanced ? 'Équilibré ✓' : 'Écart détecté',
  ]);

  aoa.push([]);
  aoa.push(['CONTRÔLE DE COHÉRENCE SYSCOHADA', '', '', '', '', '', '', '', '']);
  aoa.push(['Total Débit', Number(totals?.debit || 0), 'FCFA', '', '', '', '', '', '']);
  aoa.push(['Total Crédit', Number(totals?.credit || 0), 'FCFA', '', '', '', '', '', '']);
  aoa.push([
    'Écart Débit - Crédit',
    Math.abs(Number(totals?.debit || 0) - Number(totals?.credit || 0)),
    isBalanced ? '✓ Journal équilibré' : '⚠ Déséquilibré',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs de colonnes optimales
  ws['!cols'] = [
    { wch: 13 }, // Date
    { wch: 10 }, // Journal
    { wch: 18 }, // N° Pièce
    { wch: 14 }, // N° Compte
    { wch: 30 }, // Intitulé
    { wch: 38 }, // Libellé
    { wch: 16 }, // Débit
    { wch: 16 }, // Crédit
    { wch: 14 }, // Statut
  ];

  // Styles enrichis xlsx-js-style
  const styles = {
    banner: {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 13 },
      fill: { fgColor: { rgb: 'FF174B38' } },
      alignment: { vertical: 'center' },
    },
    subtitle: {
      font: { italic: true, color: { rgb: 'FF557064' }, sz: 10 },
    },
    title: {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: 'FF275A43' } },
      alignment: { vertical: 'center' },
    },
    meta: {
      font: { italic: true, color: { rgb: 'FF26372E' }, sz: 9 },
    },
    header: {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 10 },
      fill: { fgColor: { rgb: 'FF275A43' } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FF174B38' } },
        bottom: { style: 'medium', color: { rgb: 'FF174B38' } },
      },
    },
    body: {
      font: { color: { rgb: 'FF1E293B' }, sz: 9 },
      border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } },
      alignment: { vertical: 'center' },
    },
    bodyAlt: {
      font: { color: { rgb: 'FF1E293B' }, sz: 9 },
      fill: { fgColor: { rgb: 'FFF8FAFC' } },
      border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } },
      alignment: { vertical: 'center' },
    },
    accountCell: {
      font: { bold: true, color: { rgb: 'FF166534' }, sz: 9 },
      border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } },
      alignment: { vertical: 'center', horizontal: 'center' },
    },
    numberCell: {
      font: { color: { rgb: 'FF0F172A' }, sz: 9 },
      border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } },
      alignment: { vertical: 'center', horizontal: 'right' },
    },
    totalRow: {
      font: { bold: true, color: { rgb: 'FF0F172A' }, sz: 10 },
      fill: { fgColor: { rgb: 'FFE9F4EC' } },
      border: {
        top: { style: 'thin', color: { rgb: 'FF275A43' } },
        bottom: { style: 'double', color: { rgb: 'FF275A43' } },
      },
      alignment: { vertical: 'center' },
    },
    totalNumberCell: {
      font: { bold: true, color: { rgb: 'FF166534' }, sz: 10 },
      fill: { fgColor: { rgb: 'FFE9F4EC' } },
      border: {
        top: { style: 'thin', color: { rgb: 'FF275A43' } },
        bottom: { style: 'double', color: { rgb: 'FF275A43' } },
      },
      alignment: { vertical: 'center', horizontal: 'right' },
    },
    controlHeader: {
      font: { bold: true, color: { rgb: 'FF174B38' }, sz: 10 },
      fill: { fgColor: { rgb: 'FFF0FDF4' } },
    },
    balanced: {
      font: { bold: true, color: { rgb: 'FF168653' }, sz: 9 },
    },
    unbalanced: {
      font: { bold: true, color: { rgb: 'FFDC2626' }, sz: 9 },
    },
  };

  const cellAt = (row, col) => ws[XLSX.utils.encode_cell({ r: row, c: col })];

  // En-têtes du haut
  for (let c = 0; c <= 8; c++) {
    const c0 = cellAt(0, c); if (c0) c0.s = styles.banner;
    const c1 = cellAt(1, c); if (c1) c1.s = styles.subtitle;
    const c2 = cellAt(2, c); if (c2) c2.s = styles.title;
    const c3 = cellAt(3, c); if (c3) c3.s = styles.meta;
    const c5 = cellAt(headerRowIdx, c); if (c5) c5.s = styles.header;
  }

  // Merges pour les titres
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } },
  ];

  // Données
  for (let r = dataStartRowIdx; r < totalRowIdx; r++) {
    const isAlt = r % 2 === 1;
    const baseStyle = isAlt ? styles.bodyAlt : styles.body;

    for (let c = 0; c <= 8; c++) {
      const cell = cellAt(r, c);
      if (!cell) continue;

      if (c === 3) {
        cell.s = styles.accountCell;
      } else if (c === 6 || c === 7) {
        cell.z = '#,##0;[Red]-#,##0;"-"';
        cell.s = { ...styles.numberCell, fill: baseStyle.fill };
      } else if (c === 0 || c === 1 || c === 2 || c === 8) {
        cell.s = { ...baseStyle, alignment: { vertical: 'center', horizontal: 'center' } };
      } else {
        cell.s = baseStyle;
      }
    }
  }

  // Ligne de total
  for (let c = 0; c <= 8; c++) {
    const cell = cellAt(totalRowIdx, c);
    if (!cell) continue;
    if (c === 6 || c === 7) {
      cell.z = '#,##0;[Red]-#,##0;"-"';
      cell.s = styles.totalNumberCell;
    } else {
      cell.s = styles.totalRow;
    }
  }

  // Contrôles
  const controlStart = totalRowIdx + 2;
  const cHead = cellAt(controlStart, 0);
  if (cHead) cHead.s = styles.controlHeader;
  const cDeb = cellAt(controlStart + 1, 1);
  if (cDeb) { cDeb.z = '#,##0'; cDeb.s = { alignment: { horizontal: 'right' } }; }
  const cCred = cellAt(controlStart + 2, 1);
  if (cCred) { cCred.z = '#,##0'; cCred.s = { alignment: { horizontal: 'right' } }; }
  const cDiff = cellAt(controlStart + 3, 1);
  if (cDiff) { cDiff.z = '#,##0'; cDiff.s = { alignment: { horizontal: 'right' } }; }
  const cStat = cellAt(controlStart + 3, 2);
  if (cStat) cStat.s = isBalanced ? styles.balanced : styles.unbalanced;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Journal comptable');
  XLSX.writeFile(wb, `${targetFilename}.xlsx`);
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
  statementTotals = null,
  inventoryItems = [],
  totals = null,
  exercice = null,
  cutoffDate = '',
  devise = 'FCFA',
  inventoryValidated = false,
  filename = 'Livre_Inventaire',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = cutoffDate || new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    [`LIVRE D'INVENTAIRE DU PATRIMOINE — ${inventoryValidated ? 'INVENTAIRE PHYSIQUE ARRÊTÉ' : 'ÉTAT PROVISOIRE'} (AUDCIF art. 19-20 OHADA)`],
    [`Exercice : ${exCode} — Date de situation : ${dateStr} — ${inventoryValidated ? 'Inventaire physique arrêté' : 'Inventaire physique non arrêté'}`],
    [],
    ['N° compte', 'Libellé', 'Rubrique', `Débit clôture (${devise})`, `Crédit clôture (${devise})`, `Solde signé (${devise})`, `Mouvements débit (${devise})`, `Mouvements crédit (${devise})`, 'Lignes validées', 'Contrôle'],
  ];

  const sectionMap = new Map();
  rows.forEach((row) => {
    const name = row.sectionName || 'Autres comptes';
    if (!sectionMap.has(name)) sectionMap.set(name, []);
    sectionMap.get(name).push(row);
  });
  sectionMap.forEach((sectionRows, sectionName) => {
    aoa.push([sectionName.toLocaleUpperCase('fr-FR')]);
    sectionRows.forEach((account) => aoa.push([
      account.numero || '', account.libelle || '', sectionName,
      Number(account.balanceDebit || 0), Number(account.balanceCredit || 0), Number(account.balanceNette || 0),
      Number(account.periodDebit || 0), Number(account.periodCredit || 0), Number(account.sourceLineCount || 0),
      account.rpcLineMismatch ? 'Écart Balance / Grand Livre' : account.hasAnomaly ? 'Solde atypique à contrôler' : 'OK',
    ]));
    const debit = sectionRows.reduce((sum, account) => sum + Number(account.balanceDebit || 0), 0);
    const credit = sectionRows.reduce((sum, account) => sum + Number(account.balanceCredit || 0), 0);
    aoa.push(['SOUS-TOTAL', sectionName, '', debit, credit, debit - credit, '', '', '', '']);
    aoa.push([]);
  });
  aoa.push(['Les comptes parents et sous-comptes sont reportés sur leurs seules lignes de mouvements; aucun solde enfant n’est réadditionné dans un parent.']);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Livre d'inventaire");

  const statementRows = [
    ['SYNTHÈSE ACTIF / PASSIF', `${exCode}`, dateStr],
    ['Actif brut débiteur', Number(statementTotals?.actifBrut || 0), devise],
    ['Comptes correcteurs créditeurs', Number(statementTotals?.actifAmort || 0), devise],
    ['Actif net signé', Number(statementTotals?.actifNet || 0), devise],
    ['Dettes nettes (un solde débiteur reste négatif)', Number(statementTotals?.dettesTotal || 0), devise],
    ['Capitaux propres et résultat', Number(statementTotals?.capitauxPropres || 0), devise],
    ['Total passif', Number(statementTotals?.passifTotal || 0), devise],
    ['Écart comptable actif - passif', Number(statementTotals?.ecartComptable || 0), devise],
    ['Écart inventaire physique', inventoryItems.some((item) => item.recensement_effectue) ? Number(inventoryItems.filter((item) => item.recensement_effectue).reduce((sum, item) => sum + Number(item.ecart_valeur || 0), 0)) : 'Non déterminé', devise],
    [], ['Résultat net calculé depuis les mouvements validés des classes 6 et 7', Number(statementTotals?.resultatNet || 0), devise],
    ['Cette synthèse est calculée à la date sélectionnée; elle ne constitue pas une certification d’inventaire arrêté.'],
  ];
  const statementWs = XLSX.utils.aoa_to_sheet(statementRows);
  statementWs['!cols'] = autoFitColumns(statementRows);
  XLSX.utils.book_append_sheet(wb, statementWs, 'Synthèse états financiers');

  const physicalRows = [
    ['Code', 'Désignation', 'Catégorie', 'État', 'Emplacement', 'Unité', 'Qté comptable', 'Qté constatée', 'Écart quantité', 'Coût unitaire', 'Valeur comptable', 'Valeur constatée', 'Écart valeur'],
    ...inventoryItems.map((item) => [item.code || '', item.designation || '', item.categorie || '', item.etat_physique || '', item.emplacement_physique || '', item.unite || '', item.recensement_effectue ? Number(item.quantite_theorique || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.quantite_reelle || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.ecart_quantite || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.cout_unitaire || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.valeur_comptable || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.valeur_constatee || 0) : 'Non déterminé', item.recensement_effectue ? Number(item.ecart_valeur || 0) : 'Non déterminé']),
  ];
  const physicalWs = XLSX.utils.aoa_to_sheet(physicalRows);
  physicalWs['!cols'] = autoFitColumns(physicalRows);
  XLSX.utils.book_append_sheet(wb, physicalWs, 'Inventaire physique');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Compte de Résultat (SYSCOHADA)
 */
export function exportCompteResultatExcel({
  chargesGroups = [],
  produitsGroups = [],
  totalCharges = 0,
  totalProduits = 0,
  resultatNet = 0,
  exercice = null,
  filename = 'Compte_de_Resultat',
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['COMPTE DE RÉSULTAT (SYSCOHADA)'],
    [`Exercice : ${exCode} — Date : ${dateStr}`],
    [],
  ];

  // 1. CHARGES
  aoa.push(['--- CHARGES ---', '', '']);
  aoa.push(['N° Compte', 'Libellé des comptes', 'Montant (FCFA)']);
  chargesGroups.forEach((g) => {
    aoa.push([g.label.toUpperCase(), '', '']);
    (g.items || []).forEach((item) => {
      aoa.push([item.numero || '', item.libelle || '', Number(item.value || 0)]);
    });
    aoa.push(['', `Total ${g.label}`, Number(g.total || 0)]);
    aoa.push([]);
  });
  aoa.push(['TOTAL CHARGES', '', Number(totalCharges || 0)]);
  aoa.push([]);

  // 2. PRODUITS
  aoa.push(['--- PRODUITS ---', '', '']);
  aoa.push(['N° Compte', 'Libellé des comptes', 'Montant (FCFA)']);
  produitsGroups.forEach((g) => {
    aoa.push([g.label.toUpperCase(), '', '']);
    (g.items || []).forEach((item) => {
      aoa.push([item.numero || '', item.libelle || '', Number(item.value || 0)]);
    });
    aoa.push(['', `Total ${g.label}`, Number(g.total || 0)]);
    aoa.push([]);
  });
  aoa.push(['TOTAL PRODUITS', '', Number(totalProduits || 0)]);
  aoa.push([]);

  // 3. RÉSULTAT NET
  aoa.push([
    resultatNet >= 0 ? "RÉSULTAT NET : BÉNÉFICE DE L'EXERCICE" : "RÉSULTAT NET : PERTE DE L'EXERCICE",
    '',
    Number(resultatNet || 0),
  ]);

  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = autoFitColumns(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Compte de Résultat');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Excel dédié au Registre des Immobilisations et Amortissements
 */
export function exportImmobilisationsExcel({
  assets = [],
  totals = {},
  exercice = null,
  filename = '',
}) {
  const targetFilename = filename || buildPdfFilename('Immobilisations', exercice);
  const exCode = exercice?.code || exercice?.annee || '';
  const dateStr = new Date().toLocaleDateString('fr-FR');

  const totalBrut = totals?.brut ?? assets.reduce((acc, a) => acc + Number(a.valeur_brute || 0), 0);
  const totalAmort = totals?.amort ?? assets.reduce((acc, a) => acc + Number(a.amortCumule || 0), 0);
  const totalVnc = totals?.vnc ?? (totalBrut - totalAmort);

  const aoa = [
    [COMPANY_NAME],
    [COMPANY_SUBTITLE],
    ['REGISTRE DES IMMOBILISATIONS ET AMORTISSEMENTS - SYSCOHADA'],
    [
      exCode
        ? `Exercice : ${exCode} — Date d'exportation : ${dateStr} — Tenue de compte : FCFA`
        : `Date d'exportation : ${dateStr} — Tenue de compte : FCFA`,
    ],
    [],
    [
      'Code Actif',
      'Désignation du bien',
      'Catégorie',
      'Date Acquisition',
      'Valeur Brute (FCFA)',
      'Durée (ans)',
      'Méthode',
      'Amort. Cumulé (FCFA)',
      'VNC (FCFA)',
      'Statut',
      'État physique',
      'Emplacement',
    ],
  ];

  const headerRowIdx = 5;
  const dataStartRowIdx = 6;

  assets.forEach((a) => {
    aoa.push([
      a.code || '',
      a.designation || '',
      a.categorie || '',
      a.date_acquisition ? new Date(a.date_acquisition).toLocaleDateString('fr-FR') : '—',
      Number(a.valeur_brute || 0),
      Number(a.duree_annees || 0) || '—',
      a.methode || 'LINEAIRE',
      Number(a.amortCumule || 0),
      Number(a.vnc ?? (Number(a.valeur_brute || 0) - Number(a.amortCumule || 0))),
      a.statut === 'EN_SERVICE' ? 'En service' : a.statut === 'CEDE' ? 'Cédé' : 'Réformé',
      a.etat_physique || '—',
      a.emplacement_physique || '—',
    ]);
  });

  const totalRowIdx = aoa.length;
  aoa.push([
    'TOTAL GÉNÉRAL',
    `${assets.length} immobilisation${assets.length > 1 ? 's' : ''}`,
    '',
    '',
    Number(totalBrut),
    '',
    '',
    Number(totalAmort),
    Number(totalVnc),
    '',
    '',
    '',
  ]);

  aoa.push([]);
  aoa.push(['SYNTHÈSE DU PATRIMOINE IMMOBILISÉ', '', '', '', '', '', '', '', '', '', '', '']);
  aoa.push(['Valeur Brute Totale', Number(totalBrut), 'FCFA', '', '', '', '', '', '', '', '', '']);
  aoa.push(['Amortissements Cumulés', Number(totalAmort), 'FCFA', '', '', '', '', '', '', '', '', '']);
  aoa.push(['Valeur Nette Comptable (VNC)', Number(totalVnc), 'FCFA', '', '', '', '', '', '', '', '', '']);
  aoa.push([]);
  aoa.push([DEFAULT_FOOTER_TEXT]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs de colonnes optimales
  ws['!cols'] = [
    { wch: 14 }, // Code
    { wch: 32 }, // Désignation
    { wch: 18 }, // Catégorie
    { wch: 14 }, // Date
    { wch: 18 }, // Valeur Brute
    { wch: 12 }, // Durée
    { wch: 12 }, // Méthode
    { wch: 18 }, // Amort. Cumulé
    { wch: 18 }, // VNC
    { wch: 14 }, // Statut
    { wch: 16 }, // État physique
    { wch: 18 }, // Emplacement
  ];

  // Styles enrichis xlsx-js-style
  const styles = {
    banner: { font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 13 }, fill: { fgColor: { rgb: 'FF174B38' } }, alignment: { vertical: 'center' } },
    subtitle: { font: { italic: true, color: { rgb: 'FF557064' }, sz: 10 } },
    title: { font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 }, fill: { fgColor: { rgb: 'FF275A43' } }, alignment: { vertical: 'center' } },
    meta: { font: { italic: true, color: { rgb: 'FF26372E' }, sz: 9 } },
    header: {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 10 },
      fill: { fgColor: { rgb: 'FF275A43' } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: { top: { style: 'thin', color: { rgb: 'FF174B38' } }, bottom: { style: 'medium', color: { rgb: 'FF174B38' } } },
    },
    body: { font: { color: { rgb: 'FF1E293B' }, sz: 9 }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center' } },
    bodyAlt: { font: { color: { rgb: 'FF1E293B' }, sz: 9 }, fill: { fgColor: { rgb: 'FFF8FAFC' } }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center' } },
    codeCell: { font: { bold: true, color: { rgb: 'FF166534' }, sz: 9 }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center', horizontal: 'center' } },
    numberCell: { font: { color: { rgb: 'FF0F172A' }, sz: 9 }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center', horizontal: 'right' } },
    vncCell: { font: { bold: true, color: { rgb: 'FF15803D' }, sz: 9 }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center', horizontal: 'right' } },
    amortCell: { font: { color: { rgb: 'FFB91C1C' }, sz: 9 }, border: { bottom: { style: 'thin', color: { rgb: 'FFE2E8F0' } } }, alignment: { vertical: 'center', horizontal: 'right' } },
    totalRow: {
      font: { bold: true, color: { rgb: 'FF0F172A' }, sz: 10 },
      fill: { fgColor: { rgb: 'FFE9F4EC' } },
      border: { top: { style: 'thin', color: { rgb: 'FF275A43' } }, bottom: { style: 'double', color: { rgb: 'FF275A43' } } },
      alignment: { vertical: 'center' },
    },
    totalNumberCell: {
      font: { bold: true, color: { rgb: 'FF166534' }, sz: 10 },
      fill: { fgColor: { rgb: 'FFE9F4EC' } },
      border: { top: { style: 'thin', color: { rgb: 'FF275A43' } }, bottom: { style: 'double', color: { rgb: 'FF275A43' } } },
      alignment: { vertical: 'center', horizontal: 'right' },
    },
    summaryHeader: { font: { bold: true, color: { rgb: 'FF174B38' }, sz: 10 }, fill: { fgColor: { rgb: 'FFF0FDF4' } } },
  };

  const cellAt = (row, col) => ws[XLSX.utils.encode_cell({ r: row, c: col })];

  // En-têtes du haut
  for (let c = 0; c <= 11; c++) {
    const c0 = cellAt(0, c); if (c0) c0.s = styles.banner;
    const c1 = cellAt(1, c); if (c1) c1.s = styles.subtitle;
    const c2 = cellAt(2, c); if (c2) c2.s = styles.title;
    const c3 = cellAt(3, c); if (c3) c3.s = styles.meta;
    const c5 = cellAt(headerRowIdx, c); if (c5) c5.s = styles.header;
  }

  // Merges pour les titres
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },
  ];

  // Données
  for (let r = dataStartRowIdx; r < totalRowIdx; r++) {
    const isAlt = r % 2 === 1;
    const baseStyle = isAlt ? styles.bodyAlt : styles.body;

    for (let c = 0; c <= 11; c++) {
      const cell = cellAt(r, c);
      if (!cell) continue;

      if (c === 0) {
        cell.s = styles.codeCell;
      } else if (c === 4) {
        cell.z = '#,##0;[Red]-#,##0;"-"';
        cell.s = { ...styles.numberCell, fill: baseStyle.fill };
      } else if (c === 7) {
        cell.z = '#,##0;[Red]-#,##0;"-"';
        cell.s = { ...styles.amortCell, fill: baseStyle.fill };
      } else if (c === 8) {
        cell.z = '#,##0;[Red]-#,##0;"-"';
        cell.s = { ...styles.vncCell, fill: baseStyle.fill };
      } else if (c === 3 || c === 5 || c === 6 || c === 9) {
        cell.s = { ...baseStyle, alignment: { vertical: 'center', horizontal: 'center' } };
      } else {
        cell.s = baseStyle;
      }
    }
  }

  // Ligne de total
  for (let c = 0; c <= 11; c++) {
    const cell = cellAt(totalRowIdx, c);
    if (!cell) continue;
    if (c === 4 || c === 7 || c === 8) {
      cell.z = '#,##0;[Red]-#,##0;"-"';
      cell.s = styles.totalNumberCell;
    } else {
      cell.s = styles.totalRow;
    }
  }

  // Bloc de synthèse
  const summaryStart = totalRowIdx + 2;
  const sHead = cellAt(summaryStart, 0);
  if (sHead) sHead.s = styles.summaryHeader;
  [1, 2, 3].forEach((offset) => {
    const num = cellAt(summaryStart + offset, 1);
    if (num) { num.z = '#,##0'; num.s = { alignment: { horizontal: 'right' } }; }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Immobilisations');
  XLSX.writeFile(wb, `${targetFilename}.xlsx`);
}
