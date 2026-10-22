import React from 'react';
import { pdf, Document, Page, Text, View, Image, StyleSheet, Svg, Path } from '@react-pdf/renderer';
import { CIPRESA_LOGO_MORE_BASE64 } from './banner.js';

export const DEFAULT_FOOTER_TEXT = "généré part l'application de comptabilité de CIpressa consulting";

/* ─── Styles de base pour les documents PDF ────────────────────────── */
const baseStyles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 36,
    paddingHorizontal: 24,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  bannerContainer: {
    width: '100%',
    height: 48,
    backgroundColor: '#0a7526',
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: '#0a7526',
  },
  bannerLogoBox: {
    backgroundColor: '#ffffff',
    height: '100%',
    width: '32%',
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLogoImg: {
    height: 42,
    width: '94%',
    objectFit: 'contain',
  },
  bannerTextBox: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 16,
  },
  bannerMainText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bannerSubText: {
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 1,
    textTransform: 'uppercase',
  },
  headerBox: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#166534',
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 7.5,
    color: '#475569',
    marginTop: 2,
  },
  metaRight: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'right',
  },
  table: {
    width: '100%',
    marginTop: 4,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#166534',
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  th: {
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    fontSize: 7.5,
  },
  thRight: {
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    fontSize: 7.5,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff',
  },
  rowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    backgroundColor: '#f8fafc',
  },
  td: {
    fontSize: 7.5,
    color: '#334155',
  },
  tdRight: {
    fontSize: 7.5,
    color: '#334155',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderTopWidth: 1,
    borderTopColor: '#94a3b8',
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontFamily: 'Helvetica-Bold',
  },
  totalCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  totalCellRight: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 24,
    right: 24,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Oblique',
    color: '#64748b',
  },
  pageNumber: {
    fontSize: 7,
    color: '#64748b',
  },
});

/* ─── Composant Pied de page standard ──────────────────────────────── */
export function CipresaFooter({ footerText = DEFAULT_FOOTER_TEXT }) {
  return (
    <View style={baseStyles.footer} fixed>
      <Text style={baseStyles.footerText}>{footerText}</Text>
      <Text
        style={baseStyles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

/* ─── Composant Bannière Graphique CIPRESA (Logo + Forme + Texte) ──── */
export function CipresaBanner() {
  return (
    <View style={baseStyles.bannerContainer}>
      {/* Partie gauche blanche avec le logo */}
      <View style={baseStyles.bannerLogoBox}>
        <Image src={CIPRESA_LOGO_MORE_BASE64} style={baseStyles.bannerLogoImg} />
      </View>

      {/* Partie droite verte avec le texte officiel */}
      <View style={baseStyles.bannerTextBox}>
        <Text style={baseStyles.bannerMainText}>CIPRESA</Text>
        <Text style={baseStyles.bannerSubText}>CONSULTING SARL</Text>
      </View>
    </View>
  );
}

/* ─── Composant En-tête avec Bannière ──────────────────────────────── */
export function CipresaBannerHeader({ title, subtitle, date = '' }) {
  const printDate = date || new Date().toLocaleDateString('fr-FR');
  return (
    <View fixed>
      <CipresaBanner />
      <View style={baseStyles.headerBox}>
        <View>
          <Text style={baseStyles.title}>{title}</Text>
          {subtitle ? <Text style={baseStyles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Text style={baseStyles.metaRight}>Date de tirage : {printDate}</Text>
      </View>
    </View>
  );
}

/* ─── Composant PDF Générique de Table ─────────────────────────────── */
export function GenericTablePDF({
  title,
  subtitle,
  columns = [],
  rows = [],
  totals = null,
  footerText = DEFAULT_FOOTER_TEXT,
  orientation = 'landscape',
  size = 'A4',
}) {
  return (
    <Document>
      <Page size={size} orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader title={title} subtitle={subtitle} />

        <View style={baseStyles.table}>
          {/* Header */}
          <View style={baseStyles.thead}>
            {columns.map((c) => (
              <Text
                key={c.key}
                style={[
                  c.align === 'right' ? baseStyles.thRight : baseStyles.th,
                  c.width ? { width: c.width } : { flex: c.flex || 1 },
                ]}
              >
                {c.label}
              </Text>
            ))}
          </View>

          {/* Body */}
          {rows.map((row, i) => (
            <View key={row.id ?? i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              {columns.map((c) => (
                <Text
                  key={c.key}
                  style={[
                    c.align === 'right' ? baseStyles.tdRight : baseStyles.td,
                    c.width ? { width: c.width } : { flex: c.flex || 1 },
                  ]}
                >
                  {row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : ''}
                </Text>
              ))}
            </View>
          ))}

          {/* Totals */}
          {totals && (
            <View style={baseStyles.totalRow}>
              {columns.map((c, idx) => (
                <Text
                  key={c.key}
                  style={[
                    c.align === 'right' ? baseStyles.totalCellRight : baseStyles.totalCell,
                    c.width ? { width: c.width } : { flex: c.flex || 1 },
                  ]}
                >
                  {idx === 0 ? 'TOTAL' : totals[c.key] ?? ''}
                </Text>
              ))}
            </View>
          )}
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* Document du plan comptable : tableaux classés en deux colonnes. */
export function ChartOfAccountsPDF({
  groups = [],
  title = 'Plan comptable général & sectoriel',
  subtitle = '',
  footerText = DEFAULT_FOOTER_TEXT,
  orientation = 'landscape',
  size = 'A4',
}) {
  const left = groups.filter((group) => group.column === 'left');
  const right = groups.filter((group) => group.column === 'right');
  const columns = [left, right];
  const styles = StyleSheet.create({
    columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    column: { flex: 1, gap: 10 },
    card: { borderWidth: 0.6, borderColor: '#d6e5dc', borderRadius: 4, overflow: 'hidden' },
    cardTitle: { paddingVertical: 5, paddingHorizontal: 6, backgroundColor: '#24664e', color: '#ffffff', fontSize: 7.4, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
    classTotals: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 5, backgroundColor: '#f0f7f2', borderBottomWidth: 0.4, borderBottomColor: '#d6e5dc' },
    totalLabel: { fontSize: 5.5, color: '#748278' },
    totalValue: { marginTop: 1.5, fontSize: 6.2, fontFamily: 'Helvetica-Bold', color: '#26372e', textAlign: 'right' },
    tableHead: { flexDirection: 'row', backgroundColor: '#e9f4ec', paddingVertical: 4, paddingHorizontal: 4 },
    headNumber: { width: '14%', fontSize: 6.1, fontFamily: 'Helvetica-Bold', color: '#315643' },
    headLabel: { width: '42%', fontSize: 6.1, fontFamily: 'Helvetica-Bold', color: '#315643' },
    headNumeric: { width: '14%', fontSize: 5.8, fontFamily: 'Helvetica-Bold', color: '#315643', textAlign: 'right' },
    headDifference: { width: '16%', fontSize: 5.6, fontFamily: 'Helvetica-Bold', color: '#315643', textAlign: 'right' },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.35, borderBottomColor: '#e7ece8' },
    rowAlt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.35, borderBottomColor: '#e7ece8', backgroundColor: '#f8faf8' },
    number: { width: '14%', fontSize: 6.1, fontFamily: 'Helvetica-Bold', color: '#315643' },
    label: { width: '42%', fontSize: 6.1, lineHeight: 1.2, color: '#26372e' },
    numeric: { width: '14%', fontSize: 5.8, color: '#26372e', textAlign: 'right' },
    difference: { width: '16%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
    differenceText: { fontSize: 5.8, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
    balanced: { width: '16%', fontSize: 5.4, color: '#748278', textAlign: 'right' },
    note: { marginTop: 1.5, fontSize: 4.8, lineHeight: 1.15, color: '#748278', fontFamily: 'Helvetica-Oblique' },
    empty: { padding: 6, fontSize: 6.3, color: '#748278', fontFamily: 'Helvetica-Oblique' },
  });
  // Helvetica standard does not contain the narrow no-break space used by
  // fr-FR locale formatting; replace it with an ordinary space in the PDF.
  const money = (value) => Math.round(Number(value || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const Arrow = ({ value }) => {
    const color = Number(value) > 0 ? '#168653' : '#c33b36';
    const path = Number(value) > 0 ? 'M6 10V2 M2.5 5.5L6 2l3.5 3.5' : 'M6 2v8 M2.5 6.5L6 10l3.5-3.5';
    return <Svg width={7} height={9} viewBox="0 0 12 12"><Path d={path} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  };

  return (
    <Document>
      <Page size={size} orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader title={title} subtitle={subtitle} />
        <View style={styles.columns}>
          {columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map((group) => (
                <View key={group.key} style={styles.card} wrap={false}>
                  <Text style={styles.cardTitle}>{group.title}</Text>
                  <View style={styles.classTotals}>
                    <View><Text style={styles.totalLabel}>DÉBIT CLASSE</Text><Text style={styles.totalValue}>{money(group.totalDebit)}</Text></View>
                    <View><Text style={styles.totalLabel}>CRÉDIT CLASSE</Text><Text style={styles.totalValue}>{money(group.totalCredit)}</Text></View>
                    <View><Text style={[styles.totalLabel, { textAlign: 'right' }]}>DIFFÉRENCE</Text><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>{Number(group.difference) !== 0 && <Arrow value={group.difference} />}<Text style={[styles.totalValue, { color: Number(group.difference) > 0 ? '#168653' : Number(group.difference) < 0 ? '#c33b36' : '#748278' }]}>{Number(group.difference) === 0 ? 'Équilibré' : `${Number(group.difference) > 0 ? '+' : '−'}${money(Math.abs(group.difference))}`}</Text></View></View>
                  </View>
                  <View style={styles.tableHead}>
                    <Text style={styles.headNumber}>Compte</Text>
                    <Text style={styles.headLabel}>Intitulé du compte</Text>
                    <Text style={styles.headNumeric}>Débit</Text>
                    <Text style={styles.headNumeric}>Crédit</Text>
                    <Text style={styles.headDifference}>Différence</Text>
                  </View>
                  {group.rows.length ? group.rows.map((account, index) => (
                    <View key={account.id || account.numero} style={index % 2 ? styles.rowAlt : styles.row}>
                      <Text style={styles.number}>{account.numero}</Text>
                      <View style={{ width: '42%' }}>
                        <Text style={styles.label}>{account.libelle || 'Compte sans libellé'}</Text>
                        {account.notes ? <Text style={styles.note}>{account.notes}</Text> : null}
                      </View>
                      <Text style={styles.numeric}>{money(account.debit)}</Text>
                      <Text style={styles.numeric}>{money(account.credit)}</Text>
                      {Number(account.difference) === 0
                        ? <Text style={styles.balanced}>Équilibré</Text>
                        : <View style={styles.difference}><Arrow value={account.difference} /><Text style={[styles.differenceText, { color: Number(account.difference) > 0 ? '#168653' : '#c33b36' }]}>{Number(account.difference) > 0 ? '+' : '−'}{money(Math.abs(account.difference))}</Text></View>}
                    </View>
                  )) : <Text style={styles.empty}>Aucun compte dans cette classe.</Text>}
                </View>
              ))}
            </View>
          ))}
        </View>
        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Journal Comptable ─────────────────────────────── */
export function JournalPDFDocument({
  rows = [],
  totals = {},
  exercice = null,
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exLabel = exercice?.code || exercice?.annee || '';
  const subtitle = exLabel ? `Exercice : ${exLabel} — Système SYSCOHADA` : 'Système Comptable SYSCOHADA';
  const fmtNum = (v) => Number(v || 0).toLocaleString('fr-FR');
  const isPortrait = orientation === 'portrait';

  const wDate = isPortrait ? '13%' : '10%';
  const wJournal = isPortrait ? '9%' : '8%';
  const wRef = isPortrait ? '15%' : '14%';
  const wLib = isPortrait ? '33%' : '38%';
  const wDebit = isPortrait ? '15%' : '15%';
  const wCredit = isPortrait ? '15%' : '15%';

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader title="JOURNAL COMPTABLE" subtitle={subtitle} />

        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: wDate }]}>Date</Text>
            <Text style={[baseStyles.th, { width: wJournal }]}>Journal</Text>
            <Text style={[baseStyles.th, { width: wRef }]}>Référence</Text>
            <Text style={[baseStyles.th, { width: wLib }]}>Libellé / Description</Text>
            <Text style={[baseStyles.thRight, { width: wDebit }]}>Débit (FCFA)</Text>
            <Text style={[baseStyles.thRight, { width: wCredit }]}>Crédit (FCFA)</Text>
          </View>

          {rows.map((r, i) => (
            <View key={r.id ?? i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              <Text style={[baseStyles.td, { width: wDate }]}>
                {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'}
              </Text>
              <Text style={[baseStyles.td, { width: wJournal }]}>{r.journal || ''}</Text>
              <Text style={[baseStyles.td, { width: wRef, fontFamily: 'Helvetica-Bold' }]}>{r.ref || ''}</Text>
              <Text style={[baseStyles.td, { width: wLib }]}>{r.description || ''}</Text>
              <Text style={[baseStyles.tdRight, { width: wDebit }]}>{fmtNum(r.debitValue)}</Text>
              <Text style={[baseStyles.tdRight, { width: wCredit }]}>{fmtNum(r.creditValue)}</Text>
            </View>
          ))}

          <View style={baseStyles.totalRow}>
            <Text style={[baseStyles.totalCell, { width: isPortrait ? '70%' : '70%' }]}>
              TOTAL ({rows.length} écriture{rows.length > 1 ? 's' : ''})
              {totals?.debit === totals?.credit ? '  —  Équilibré ✓' : '  —  Écart détecté'}
            </Text>
            <Text style={[baseStyles.totalCellRight, { width: wDebit }]}>{fmtNum(totals?.debit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wCredit }]}>{fmtNum(totals?.credit)}</Text>
          </View>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Balance Générale ──────────────────────────────── */
export function BalancePDFDocument({
  groups = [],
  grandTotal = {},
  exercice = null,
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || 'Exercice';
  const isPortrait = orientation === 'portrait';
  const fmtNum = (v) => {
    const n = Number(v || 0);
    return n === 0 ? '-' : n.toLocaleString('fr-FR');
  };
  const sumCol = (list, key) => list.reduce((acc, r) => acc + Number(r[key] || 0), 0);

  const wNum = isPortrait ? '12%' : '10%';
  const wLib = isPortrait ? '24%' : '24%';
  const wNumCol = isPortrait ? '10.6%' : '11%';
  const fSize = isPortrait ? 6.8 : 7.5;

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="BALANCE GÉNÉRALE DES COMPTES"
          subtitle={`Exercice : ${exCode} — Vue synthétique des soldes`}
        />

        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: wNum, fontSize: fSize }]}>N° Compte</Text>
            <Text style={[baseStyles.th, { width: wLib, fontSize: fSize }]}>Libellé du compte</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Ouv. Débit</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Ouv. Crédit</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Mvt Débit</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Mvt Crédit</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Solde Débit</Text>
            <Text style={[baseStyles.thRight, { width: wNumCol, fontSize: fSize }]}>Solde Crédit</Text>
          </View>

          {groups.map(([classe, list]) => (
            <React.Fragment key={classe}>
              <View style={{ backgroundColor: '#e2e8f0', padding: '3 4', marginTop: 2 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: fSize, color: '#0f172a' }}>{classe}</Text>
              </View>

              {list.map((r, i) => (
                <View key={r.numero || i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
                  <Text style={[baseStyles.td, { width: wNum, fontFamily: 'Helvetica-Bold', fontSize: fSize }]}>{r.numero}</Text>
                  <Text style={[baseStyles.td, { width: wLib, fontSize: fSize }]}>{r.libelle}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.openingDebit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.openingCredit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.mvtDebit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.mvtCredit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.closingDebit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(r.closingCredit)}</Text>
                </View>
              ))}

              <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '3 4', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
                <Text style={[baseStyles.totalCell, { width: isPortrait ? '36%' : '34%', fontSize: fSize }]}>Sous-total {classe.split(' - ')[0]}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'openingDebit'))}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'openingCredit'))}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'mvtDebit'))}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'mvtCredit'))}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'closingDebit'))}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(sumCol(list, 'closingCredit'))}</Text>
              </View>
            </React.Fragment>
          ))}

          {/* Total Général */}
          <View style={[baseStyles.totalRow, { backgroundColor: '#cbd5e1', marginTop: 4 }]}>
            <Text style={[baseStyles.totalCell, { width: isPortrait ? '36%' : '34%', fontSize: fSize }]}>TOTAL GÉNÉRAL</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.openingDebit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.openingCredit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.mvtDebit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.mvtCredit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.closingDebit)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wNumCol, fontSize: fSize }]}>{fmtNum(grandTotal.closingCredit)}</Text>
          </View>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Grand-Livre ───────────────────────────────────── */
export function GrandLivrePDFDocument({
  ledgerData = { accounts: [], globalDebitSum: 0, globalCreditSum: 0, globalNetBalance: 0 },
  exercice = null,
  periodStart = '',
  periodEnd = '',
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exLabel = exercice?.code || exercice?.annee || '';
  const isPortrait = orientation === 'portrait';
  const fmtNum = (v) => {
    const n = Number(v || 0);
    return n === 0 ? '-' : n.toLocaleString('fr-FR');
  };
  const fmtSolde = (v) => {
    const n = Number(v || 0);
    if (Math.abs(n) < 0.01) return '0';
    return n > 0 ? `${fmtNum(n)} D` : `${fmtNum(Math.abs(n))} C`;
  };

  const wDate = isPortrait ? '12%' : '10%';
  const wCj = isPortrait ? '7%' : '6%';
  const wPiece = isPortrait ? '13%' : '12%';
  const wLib = isPortrait ? '32%' : '38%';
  const wDebit = isPortrait ? '12%' : '11%';
  const wCredit = isPortrait ? '12%' : '11%';
  const wSolde = isPortrait ? '12%' : '12%';
  const wLabelTotal = isPortrait ? '64%' : '66%';

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="GRAND-LIVRE DES COMPTES"
          subtitle={`Exercice : ${exLabel} — Période du ${periodStart || '—'} au ${periodEnd || '—'} — Tenue de compte : FCFA`}
        />

        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: wDate }]}>Date</Text>
            <Text style={[baseStyles.th, { width: wCj }]}>C.j</Text>
            <Text style={[baseStyles.th, { width: wPiece }]}>N° Pièce</Text>
            <Text style={[baseStyles.th, { width: wLib }]}>Libellé de l'écriture</Text>
            <Text style={[baseStyles.thRight, { width: wDebit }]}>Débit</Text>
            <Text style={[baseStyles.thRight, { width: wCredit }]}>Crédit</Text>
            <Text style={[baseStyles.thRight, { width: wSolde }]}>Solde</Text>
          </View>

          {ledgerData.accounts.map(({ account, rows, totalDebit, totalCredit, finalBalance }) => (
            <React.Fragment key={account.id || account.numero}>
              {/* Account Header */}
              <View style={{ backgroundColor: '#e2e8f0', padding: '3 4', marginTop: 4 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#166534' }}>
                  {account.numero} — {account.libelle}
                </Text>
              </View>

              {rows.map((r, i) => (
                <View key={i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
                  <Text style={[baseStyles.td, { width: wDate }]}>{r.dateShort}</Text>
                  <Text style={[baseStyles.td, { width: wCj }]}>{r.journal}</Text>
                  <Text style={[baseStyles.td, { width: wPiece }]}>{r.piece}</Text>
                  <Text style={[baseStyles.td, { width: wLib }]}>{r.libelle}</Text>
                  <Text style={[baseStyles.tdRight, { width: wDebit }]}>{fmtNum(r.debit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wCredit }]}>{fmtNum(r.credit)}</Text>
                  <Text style={[baseStyles.tdRight, { width: wSolde, fontFamily: 'Helvetica-Bold' }]}>
                    {fmtSolde(r.runningBalance)}
                  </Text>
                </View>
              ))}

              {/* Account Total */}
              <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '3 4', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' }}>
                <Text style={[baseStyles.totalCell, { width: wLabelTotal }]}>Total compte {account.numero}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wDebit }]}>{fmtNum(totalDebit)}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wCredit }]}>{fmtNum(totalCredit)}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wSolde }]}>{fmtSolde(finalBalance)}</Text>
              </View>
            </React.Fragment>
          ))}

          {/* Global Total */}
          <View style={[baseStyles.totalRow, { backgroundColor: '#cbd5e1', marginTop: 6 }]}>
            <Text style={[baseStyles.totalCell, { width: wLabelTotal }]}>TOTAL GÉNÉRAL DU GRAND-LIVRE</Text>
            <Text style={[baseStyles.totalCellRight, { width: wDebit }]}>{fmtNum(ledgerData.globalDebitSum)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wCredit }]}>{fmtNum(ledgerData.globalCreditSum)}</Text>
            <Text style={[baseStyles.totalCellRight, { width: wSolde }]}>{fmtSolde(ledgerData.globalNetBalance)}</Text>
          </View>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Bilan Comptable (SYSCOHADA) ────────────────────── */
export function BilanPDFDocument({
  actifRows = [],
  passifRows = [],
  bilan = null,
  exercice = null,
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const isPortrait = orientation === 'portrait';
  const fmt = (v) => {
    const n = Math.round(Number(v || 0));
    if (n === 0) return '-';
    const txt = Math.abs(n).toLocaleString('fr-FR');
    return n < 0 ? `(${txt})` : txt;
  };

  const renderSectionSide = (title, rows, totalVal) => (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      <View style={{ backgroundColor: '#166534', padding: '4 6', borderRadius: 2, marginBottom: 2 }}>
        <Text style={{ color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{title}</Text>
      </View>
      {rows.map((r, i) => {
        if (r.isSection) {
          return (
            <View key={i} style={{ backgroundColor: '#e2e8f0', padding: '3 4', marginTop: 3 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#0f172a' }}>{r.label}</Text>
            </View>
          );
        }
        if (r.isSubtotal) {
          return (
            <View key={i} style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', padding: '2.5 4', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' }}>
              <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7 }}>{r.label}</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7 }}>{fmt(r.val)}</Text>
            </View>
          );
        }
        return (
          <View key={i} style={{ flexDirection: 'row', padding: '2 4', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ width: '22%', fontSize: 6.5, color: '#475569' }}>{r.num || ''}</Text>
            <Text style={{ flex: 1, fontSize: 6.5 }}>{r.label}</Text>
            <Text style={{ fontSize: 6.5, textAlign: 'right' }}>{fmt(r.val)}</Text>
          </View>
        );
      })}
      {totalVal !== undefined && (
        <View style={{ flexDirection: 'row', backgroundColor: '#cbd5e1', padding: '4 4', marginTop: 4 }}>
          <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>TOTAL {title}</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>{fmt(totalVal)}</Text>
        </View>
      )}
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="BILAN COMPTABLE (SYSCOHADA)"
          subtitle={`Exercice : ${exCode} — Situation patrimoniale`}
        />

        <View style={{ flexDirection: isPortrait ? 'column' : 'row', marginTop: 4, gap: isPortrait ? 10 : 0 }}>
          {renderSectionSide('ACTIF', actifRows, bilan?.totals?.totalActif)}
          {renderSectionSide('PASSIF', passifRows, bilan?.totals?.totalPassif)}
        </View>

        {bilan && (
          <View style={{ marginTop: 6, padding: '4 6', backgroundColor: '#f8fafc', borderWidth: 0.5, borderColor: '#cbd5e1', borderRadius: 2 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: Math.abs(bilan.ecart || 0) < 1 ? '#15803d' : '#b91c1c' }}>
              Contrôle d'équilibre : {Math.abs(bilan.ecart || 0) < 1 ? 'Actif = Passif (Bilan équilibré ✓)' : `Écart constaté : ${fmt(bilan.ecart)} FCFA`}
            </Text>
          </View>
        )}

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Suivi de Trésorerie ────────────────────────────── */
export function TresoreriePDFDocument({
  soldeBanque = 0,
  soldeCaisse = 0,
  disponibilites = 0,
  accounts = [],
  movements = [],
  monthlyFlows = [],
  exercice = null,
  orientation = 'portrait',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const fmt = (v) => Number(v || 0).toLocaleString('fr-FR');

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader title="SUIVI DE TRÉSORERIE" subtitle={`Exercice : ${exCode} — Situation des disponibilités`} />

        {/* Cartes KPI */}
        <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 3, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 7, color: '#64748b' }}>Solde Banque global</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{fmt(soldeBanque)} FCFA</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: 8, borderRadius: 3, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 7, color: '#64748b' }}>Solde Caisse principale</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{fmt(soldeCaisse)} FCFA</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#ecfdf5', padding: 8, borderRadius: 3, borderWidth: 0.5, borderColor: '#10b981' }}>
            <Text style={{ fontSize: 7, color: '#065f46' }}>Disponibilités totales</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#047857', marginTop: 2 }}>{fmt(disponibilites)} FCFA</Text>
          </View>
        </View>

        {/* Comptes de trésorerie */}
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#166534', marginTop: 6, marginBottom: 3 }}>
          Comptes de trésorerie
        </Text>
        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: '25%' }]}>N° Compte</Text>
            <Text style={[baseStyles.th, { width: '45%' }]}>Libellé du compte</Text>
            <Text style={[baseStyles.th, { width: '15%' }]}>Nature</Text>
            <Text style={[baseStyles.thRight, { width: '15%' }]}>Solde (FCFA)</Text>
          </View>
          {accounts.map((a, i) => (
            <View key={a.id || i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              <Text style={[baseStyles.td, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>{a.numero}</Text>
              <Text style={[baseStyles.td, { width: '45%' }]}>{a.libelle}</Text>
              <Text style={[baseStyles.td, { width: '15%' }]}>{a.caisse ? 'Caisse' : 'Banque'}</Text>
              <Text style={[baseStyles.tdRight, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>{fmt(a.balance)}</Text>
            </View>
          ))}
        </View>

        {/* Derniers mouvements de trésorerie */}
        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#166534', marginTop: 10, marginBottom: 3 }}>
          Derniers mouvements de trésorerie
        </Text>
        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: '15%' }]}>Date</Text>
            <Text style={[baseStyles.th, { width: '20%' }]}>Type</Text>
            <Text style={[baseStyles.th, { width: '35%' }]}>Libellé</Text>
            <Text style={[baseStyles.th, { width: '15%' }]}>Compte</Text>
            <Text style={[baseStyles.thRight, { width: '15%' }]}>Montant (FCFA)</Text>
          </View>
          {movements.slice(0, 15).map((m, i) => (
            <View key={i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              <Text style={[baseStyles.td, { width: '15%' }]}>
                {m.date ? new Date(m.date).toLocaleDateString('fr-FR') : '—'}
              </Text>
              <Text style={[baseStyles.td, { width: '20%' }]}>{m.type}</Text>
              <Text style={[baseStyles.td, { width: '35%' }]}>{m.libelle}</Text>
              <Text style={[baseStyles.td, { width: '15%' }]}>{m.compte}</Text>
              <Text style={[baseStyles.tdRight, { width: '15%' }]}>{fmt(m.montant)}</Text>
            </View>
          ))}
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Document PDF : Livre d'Inventaire ────────────────────────────── */
export function LivreInventairePDFDocument({
  rows = [],
  totals = null,
  exercice = null,
  cutoffDate = '',
  devise = 'FCFA',
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const isPortrait = orientation === 'portrait';
  const dateStr = cutoffDate || new Date().toLocaleDateString('fr-FR');
  const fmt = (v) => {
    const n = Math.round(Number(v || 0));
    return n === 0 ? '-' : n.toLocaleString('fr-FR');
  };

  const wNum = isPortrait ? '12%' : '10%';
  const wLib = isPortrait ? '24%' : '26%';
  const wSec = isPortrait ? '16%' : '18%';
  const wBrut = isPortrait ? '12%' : '12%';
  const wAmort = isPortrait ? '12%' : '11%';
  const wNet = isPortrait ? '12%' : '12%';
  const wPrec = isPortrait ? '12%' : '11%';
  const wTotLabel = isPortrait ? '52%' : '54%';

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="LIVRE D'INVENTAIRE DU PATRIMOINE"
          subtitle={`Exercice : ${exCode} — Date d'arrêté : ${dateStr} — Réf. AUDCIF art. 19-20 (OHADA)`}
        />

        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: wNum }]}>N° Compte</Text>
            <Text style={[baseStyles.th, { width: wLib }]}>Libellé du compte</Text>
            <Text style={[baseStyles.th, { width: wSec }]}>Section OHADA</Text>
            <Text style={[baseStyles.thRight, { width: wBrut }]}>Valeur Brute</Text>
            <Text style={[baseStyles.thRight, { width: wAmort }]}>Amort./Dépréc.</Text>
            <Text style={[baseStyles.thRight, { width: wNet }]}>Valeur Nette</Text>
            <Text style={[baseStyles.thRight, { width: wPrec }]}>Valeur N-1</Text>
          </View>

          {rows.map((r, i) => (
            <View key={r.id || r.numero || i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              <Text style={[baseStyles.td, { width: wNum, fontFamily: 'Helvetica-Bold' }]}>{r.numero}</Text>
              <Text style={[baseStyles.td, { width: wLib }]}>{r.libelle}</Text>
              <Text style={[baseStyles.td, { width: wSec }]}>{r.sectionName || ''}</Text>
              <Text style={[baseStyles.tdRight, { width: wBrut }]}>{fmt(r.balanceBrute)}</Text>
              <Text style={[baseStyles.tdRight, { width: wAmort }]}>{fmt(r.amortDeprec)}</Text>
              <Text style={[baseStyles.tdRight, { width: wNet, fontFamily: 'Helvetica-Bold' }]}>{fmt(r.balanceNette)}</Text>
              <Text style={[baseStyles.tdRight, { width: wPrec }]}>{r.balancePrecedente ? fmt(r.balancePrecedente) : '-'}</Text>
            </View>
          ))}

          {totals && (
            <View style={baseStyles.totalRow}>
              <Text style={[baseStyles.totalCell, { width: wTotLabel }]}>TOTAL DU PATRIMOINE INVENTORIÉ</Text>
              <Text style={[baseStyles.totalCellRight, { width: wBrut }]}>{fmt(totals.brut)}</Text>
              <Text style={[baseStyles.totalCellRight, { width: wAmort }]}>{fmt(totals.amort)}</Text>
              <Text style={[baseStyles.totalCellRight, { width: wNet }]}>{fmt(totals.net)}</Text>
              <Text style={[baseStyles.totalCellRight, { width: wPrec }]}>{totals.prec ? fmt(totals.prec) : '-'}</Text>
            </View>
          )}
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

/* ─── Fonctions de Téléchargement PDF ──────────────────────────────── */
export async function downloadPDF({ filename = 'document', document: doc }) {
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `${filename}.pdf`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportJournalPDF(options) {
  const filename = options.filename || `Journal_comptable_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <JournalPDFDocument {...options} />,
  });
}

export async function exportBalancePDF(options) {
  const filename = options.filename || `Balance_Generale_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <BalancePDFDocument {...options} />,
  });
}

export async function exportGrandLivrePDF(options) {
  const filename = options.filename || `Grand_Livre_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <GrandLivrePDFDocument {...options} />,
  });
}

export async function exportBilanPDF(options) {
  const filename = options.filename || `Bilan_Comptable_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <BilanPDFDocument {...options} />,
  });
}

export async function exportTresoreriePDF(options) {
  const filename = options.filename || `Suivi_Tresorerie_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <TresoreriePDFDocument {...options} />,
  });
}

export async function exportLivreInventairePDF(options) {
  const filename = options.filename || `Livre_Inventaire_${options.exercice?.code || 'exercice'}`;
  await downloadPDF({
    filename,
    document: <LivreInventairePDFDocument {...options} />,
  });
}
