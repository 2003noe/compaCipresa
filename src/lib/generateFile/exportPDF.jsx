import React from 'react';
import { pdf, Document, Page, Text, View, Image, StyleSheet, Svg, Path, Circle, Rect, Line, G } from '@react-pdf/renderer';
import { CIPRESA_LOGO_MORE_BASE64 } from './banner.js';
import { buildPdfFilename } from './filename.js';

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
  const subtitle = exLabel
    ? `Exercice : ${exLabel} — Système Comptable SYSCOHADA — Tenue de compte : FCFA`
    : 'Système Comptable SYSCOHADA — Tenue de compte : FCFA';
  const fmtNum = (v) => Number(v || 0).toLocaleString('fr-FR');
  const isBalanced = Math.abs(Number(totals?.debit || 0) - Number(totals?.credit || 0)) < 0.01;
  const isPortrait = orientation === 'portrait';
  const hasDetailedLines = rows.some((r) => r.lignes && r.lignes.length > 0);

  const wDate = isPortrait ? '13%' : '10%';
  const wJournal = isPortrait ? '9%' : '8%';
  const wRef = isPortrait ? '15%' : '14%';
  const wLib = isPortrait ? '33%' : '38%';
  const wDebit = isPortrait ? '15%' : '15%';
  const wCredit = isPortrait ? '15%' : '15%';

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader title="JOURNAL COMPTABLE GÉNÉRAL" subtitle={subtitle} />

        <View style={baseStyles.table}>
          {hasDetailedLines ? (
            <>
              <View style={baseStyles.thead}>
                <Text style={[baseStyles.th, { width: isPortrait ? '16%' : '14%' }]}>N° Compte</Text>
                <Text style={[baseStyles.th, { width: isPortrait ? '26%' : '28%' }]}>Intitulé du compte</Text>
                <Text style={[baseStyles.th, { width: isPortrait ? '34%' : '38%' }]}>Libellé de l'opération / ligne</Text>
                <Text style={[baseStyles.thRight, { width: isPortrait ? '12%' : '10%' }]}>Débit (FCFA)</Text>
                <Text style={[baseStyles.thRight, { width: isPortrait ? '12%' : '10%' }]}>Crédit (FCFA)</Text>
              </View>

              {rows.map((r, i) => (
                <View
                  key={r.id ?? i}
                  wrap={false}
                  style={{
                    marginTop: 3,
                    marginBottom: 2,
                    borderWidth: 0.5,
                    borderColor: '#cbd5e1',
                    borderRadius: 2,
                  }}
                >
                  {/* Bandeau d'en-tête de la pièce */}
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#e9f4ec',
                      padding: '3 5',
                      borderBottomWidth: 0.5,
                      borderBottomColor: '#cbd5e1',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#166534', width: '18%' }}>
                      {r.date ? new Date(r.date).toLocaleDateString('fr-FR') : '—'} · Jnl: {r.journal || '—'}
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#0f172a', width: '22%' }}>
                      N° Pièce : {r.ref || '—'}
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica', fontSize: 7.5, color: '#334155', width: '42%' }}>
                      {r.description || ''}
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#166534', width: '18%', textAlign: 'right' }}>
                      Mvt : {fmtNum(r.debitValue)} FCFA
                    </Text>
                  </View>

                  {/* Lignes d'imputation comptable */}
                  {(r.lignes && r.lignes.length > 0 ? r.lignes : [
                    { accountNumber: '—', accountLabel: '—', description: r.description, debit: r.debitValue, credit: r.creditValue },
                  ]).map((l, li) => (
                    <View
                      key={l.id || li}
                      style={[
                        li % 2 === 0 ? baseStyles.row : baseStyles.rowAlt,
                        { padding: '2 5' },
                      ]}
                    >
                      <Text style={[baseStyles.td, { width: isPortrait ? '16%' : '14%', fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#1e293b' }]}>
                        {l.accountNumber || '—'}
                      </Text>
                      <Text style={[baseStyles.td, { width: isPortrait ? '26%' : '28%', fontSize: 7 }]}>
                        {l.accountLabel || '—'}
                      </Text>
                      <Text style={[baseStyles.td, { width: isPortrait ? '34%' : '38%', fontSize: 7, color: '#475569' }]}>
                        {l.description || r.description || ''}
                      </Text>
                      <Text style={[baseStyles.tdRight, { width: isPortrait ? '12%' : '10%', fontSize: 7 }]}>
                        {l.debit > 0 ? fmtNum(l.debit) : '-'}
                      </Text>
                      <Text style={[baseStyles.tdRight, { width: isPortrait ? '12%' : '10%', fontSize: 7 }]}>
                        {l.credit > 0 ? fmtNum(l.credit) : '-'}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}

              <View style={[baseStyles.totalRow, { backgroundColor: '#cbd5e1', marginTop: 4 }]}>
                <Text style={[baseStyles.totalCell, { width: isPortrait ? '76%' : '80%' }]}>
                  TOTAL GÉNÉRAL ({rows.length} écriture{rows.length > 1 ? 's' : ''})
                  {isBalanced ? '  —  ✓ Conforme SYSCOHADA (Équilibré)' : '  —  ⚠ Écart détecté'}
                </Text>
                <Text style={[baseStyles.totalCellRight, { width: isPortrait ? '12%' : '10%' }]}>
                  {fmtNum(totals?.debit)}
                </Text>
                <Text style={[baseStyles.totalCellRight, { width: isPortrait ? '12%' : '10%' }]}>
                  {fmtNum(totals?.credit)}
                </Text>
              </View>
            </>
          ) : (
            <>
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
                  {isBalanced ? '  —  Équilibré ✓' : '  —  Écart détecté'}
                </Text>
                <Text style={[baseStyles.totalCellRight, { width: wDebit }]}>{fmtNum(totals?.debit)}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wCredit }]}>{fmtNum(totals?.credit)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Contrôle de conformité SYSCOHADA */}
        <View
          style={{
            marginTop: 6,
            padding: '4 8',
            backgroundColor: isBalanced ? '#ecfdf5' : '#fef2f2',
            borderWidth: 0.5,
            borderColor: isBalanced ? '#10b981' : '#ef4444',
            borderRadius: 2,
          }}
        >
          <Text
            style={{
              fontSize: 7,
              fontFamily: 'Helvetica-Bold',
              color: isBalanced ? '#15803d' : '#b91c1c',
            }}
          >
            Contrôle SYSCOHADA : {isBalanced
              ? `Total Débit (${fmtNum(totals?.debit)}) = Total Crédit (${fmtNum(totals?.credit)}) · Journal Rigoureusement Équilibré ✓`
              : `Attention : Écart détecté de ${fmtNum(Math.abs(Number(totals?.debit || 0) - Number(totals?.credit || 0)))} FCFA`}
          </Text>
        </View>

        {/* Signatures & Visas */}
        <View
          wrap={false}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingHorizontal: 10,
          }}
        >
          <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#166534' }}>Le Responsable Comptable</Text>
            <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 2 }}>Visa & Mention « Bon pour enregistrement »</Text>
          </View>
          <View style={{ width: '45%', borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 4, alignItems: 'center' }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#166534' }}>La Direction Générale</Text>
            <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 2 }}>Signature & Cachet de l'entreprise</Text>
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
  integrity = null,
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

        {integrity && (
          <View style={{ marginTop: 6, padding: '4 6', backgroundColor: integrity.openingBalanced && integrity.movementsBalanced && integrity.closingBalanced ? '#ecfdf5' : '#fef2f2', borderWidth: 0.5, borderColor: integrity.openingBalanced && integrity.movementsBalanced && integrity.closingBalanced ? '#10b981' : '#ef4444', borderRadius: 2 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: integrity.openingBalanced && integrity.movementsBalanced && integrity.closingBalanced ? '#15803d' : '#b91c1c' }}>
              Contrôles : à-nouveaux {integrity.openingBalanced ? 'équilibrés' : 'déséquilibrés'} · mouvements {integrity.movementsBalanced ? 'équilibrés' : 'déséquilibrés'} · clôture {integrity.closingBalanced ? 'équilibrée' : 'déséquilibrée'}
            </Text>
          </View>
        )}

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
  bilanN1 = null,
  exerciceN1 = null,
  orientation = 'landscape',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || '';
  const exN1Code = exerciceN1?.code || exerciceN1?.annee || '';
  const showN1 = Boolean(exerciceN1 && bilanN1);
  const isPortrait = orientation === 'portrait';
  const fmt = (v) => {
    const n = Math.round(Number(v || 0));
    if (n === 0) return '-';
    const txt = Math.abs(n).toLocaleString('fr-FR');
    return n < 0 ? `(${txt})` : txt;
  };

  const changeText = (current, previous) => {
    const delta = Number(current || 0) - Number(previous || 0);
    if (Math.abs(delta) < 1) return '—';
    const pct = Number(previous) ? `${(delta / Math.abs(Number(previous)) * 100).toFixed(1)}%` : 'Nouveau';
    return `${delta > 0 ? '+' : '−'}${Math.abs(delta).toLocaleString('fr-FR')} (${pct})`;
  };
  const renderSectionSide = (title, rows, totalVal, totalVal1) => (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      <View style={{ backgroundColor: '#166534', padding: '4 6', borderRadius: 2, marginBottom: 2 }}>
        <Text style={{ color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8 }}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: '#e9f4ec', padding: '3 4' }}>
        <Text style={{ width: showN1 ? '15%' : '22%', fontSize: 6, fontFamily: 'Helvetica-Bold' }}>Compte</Text>
        <Text style={{ flex: 1, fontSize: 6, fontFamily: 'Helvetica-Bold' }}>Intitulé</Text>
        <Text style={{ width: showN1 ? '13%' : '18%', textAlign: 'right', fontSize: 6, fontFamily: 'Helvetica-Bold' }}>{exCode}</Text>
        {showN1 && <Text style={{ width: '13%', textAlign: 'right', fontSize: 6, fontFamily: 'Helvetica-Bold' }}>{exN1Code}</Text>}
        {showN1 && <Text style={{ width: '22%', textAlign: 'right', fontSize: 6, fontFamily: 'Helvetica-Bold' }}>Écart / %</Text>}
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
              <Text style={{ width: showN1 ? '13%' : '18%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 7 }}>{fmt(r.val)}</Text>
              {showN1 && <Text style={{ width: '13%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 7 }}>{fmt(r.val1)}</Text>}
              {showN1 && <Text style={{ width: '22%', textAlign: 'right', fontSize: 5.5 }}>{changeText(r.val, r.val1)}</Text>}
            </View>
          );
        }
        return (
          <View key={i} style={{ flexDirection: 'row', padding: '2 4', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' }}>
            <Text style={{ width: showN1 ? '15%' : '22%', fontSize: 6.5, color: '#475569' }}>{r.num || ''}</Text>
            <Text style={{ flex: 1, fontSize: 6.5 }}>{r.label}</Text>
            <Text style={{ width: showN1 ? '13%' : '18%', fontSize: 6.5, textAlign: 'right' }}>{fmt(r.val)}</Text>
            {showN1 && <Text style={{ width: '13%', fontSize: 6.5, textAlign: 'right' }}>{fmt(r.val1)}</Text>}
            {showN1 && <Text style={{ width: '22%', fontSize: 5.5, textAlign: 'right' }}>{changeText(r.val, r.val1)}</Text>}
          </View>
        );
      })}
      {totalVal !== undefined && (
        <View style={{ flexDirection: 'row', backgroundColor: '#cbd5e1', padding: '4 4', marginTop: 4 }}>
          <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>TOTAL {title}</Text>
          <Text style={{ width: showN1 ? '13%' : '18%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>{fmt(totalVal)}</Text>
          {showN1 && <Text style={{ width: '13%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 7.5 }}>{fmt(totalVal1)}</Text>}
          {showN1 && <Text style={{ width: '22%', textAlign: 'right', fontSize: 5.5 }}>{changeText(totalVal, totalVal1)}</Text>}
        </View>
      )}
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="BILAN COMPTABLE (SYSCOHADA)"
          subtitle={`Exercice : ${exCode}${showN1 ? ` — Comparaison : ${exN1Code}` : ''} — Situation patrimoniale`}
        />

        <View style={{ flexDirection: isPortrait ? 'column' : 'row', marginTop: 4, gap: isPortrait ? 10 : 0 }}>
          {renderSectionSide('ACTIF', actifRows, bilan?.totals?.actif, bilanN1?.totals?.actif)}
          {renderSectionSide('PASSIF', passifRows, bilan?.totals?.passif, bilanN1?.totals?.passif)}
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
  statementTotals = null,
  inventoryItems = [],
  totals = null,
  exercice = null,
  cutoffDate = '',
  devise = 'FCFA',
  inventoryValidated = false,
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
  const fmtQty = (v) => Number(v || 0) === 0 ? '-' : Number(v).toLocaleString('fr-FR', { maximumFractionDigits: 3 });

  const wNum = isPortrait ? '12%' : '9%';
  const wLib = isPortrait ? '25%' : '25%';
  const wSec = isPortrait ? '16%' : '18%';
  const wDebit = isPortrait ? '12%' : '12%';
  const wCredit = isPortrait ? '12%' : '12%';
  const wNet = isPortrait ? '13%' : '14%';
  const wAudit = isPortrait ? '10%' : '10%';
  const sections = new Map();
  rows.forEach((row) => {
    const title = row.sectionName || 'Autres comptes';
    if (!sections.has(title)) sections.set(title, []);
    sections.get(title).push(row);
  });

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="LIVRE D'INVENTAIRE — ÉTAT PROVISOIRE"
          subtitle={`Exercice : ${exCode} — Date de situation : ${dateStr} — ${inventoryValidated ? 'Inventaire physique arrêté' : 'Inventaire physique non arrêté'} — FCFA (XAF) · BEAC`}
        />

        {statementTotals && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {[
            ['Actif net', statementTotals.actifNet], ['Dettes nettes', statementTotals.dettesTotal],
            ['Capitaux propres + résultat', statementTotals.capitauxPropres], ['Résultat de la période', statementTotals.resultatNet],
            ['Écart comptable actif-passif', statementTotals.ecartComptable],
          ].map(([label, value]) => <View key={label} style={{ width: '19%', padding: 5, backgroundColor: '#f1f5f9', borderRadius: 3 }}>
            <Text style={{ fontSize: 6, color: '#475569' }}>{label}</Text>
            <Text style={{ marginTop: 2, fontSize: 8, fontFamily: 'Helvetica-Bold' }}>{fmt(value)} {devise}</Text>
          </View>)}
        </View>}

        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: wNum }]}>N° Compte</Text>
            <Text style={[baseStyles.th, { width: wLib }]}>Libellé du compte</Text>
            <Text style={[baseStyles.th, { width: wSec }]}>Section OHADA</Text>
            <Text style={[baseStyles.thRight, { width: wDebit }]}>Débit clôture</Text>
            <Text style={[baseStyles.thRight, { width: wCredit }]}>Crédit clôture</Text>
            <Text style={[baseStyles.thRight, { width: wNet }]}>Solde signé</Text>
            <Text style={[baseStyles.th, { width: wAudit }]}>Contrôle</Text>
          </View>

          {[...sections.entries()].map(([title, sectionRows]) => {
            const debit = sectionRows.reduce((sum, row) => sum + Number(row.balanceDebit || 0), 0);
            const credit = sectionRows.reduce((sum, row) => sum + Number(row.balanceCredit || 0), 0);
            return <View key={title}>
              <View style={{ padding: 4, marginTop: 3, backgroundColor: '#e8f3ec' }}><Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#14532d' }}>{title.toLocaleUpperCase('fr-FR')} · {sectionRows.length} compte(s)</Text></View>
              {sectionRows.map((r, i) => <View key={r.id || r.numero || i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
                <Text style={[baseStyles.td, { width: wNum, fontFamily: 'Helvetica-Bold' }]}>{r.numero}</Text>
                <Text style={[baseStyles.td, { width: wLib }]}>{r.libelle}</Text>
                <Text style={[baseStyles.td, { width: wSec }]}>{r.sectionName || ''}</Text>
                <Text style={[baseStyles.tdRight, { width: wDebit }]}>{fmt(r.balanceDebit)}</Text>
                <Text style={[baseStyles.tdRight, { width: wCredit }]}>{fmt(r.balanceCredit)}</Text>
                <Text style={[baseStyles.tdRight, { width: wNet, fontFamily: 'Helvetica-Bold' }]}>{fmt(r.balanceNette)}</Text>
                <Text style={[baseStyles.td, { width: wAudit }]}>{r.rpcLineMismatch ? 'Écart GL' : r.hasAnomaly ? 'À vérifier' : 'OK'}</Text>
              </View>)}
              <View style={baseStyles.totalRow}>
                <Text style={[baseStyles.totalCell, { width: '52%' }]}>SOUS-TOTAL · {title}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wDebit }]}>{fmt(debit)}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wCredit }]}>{fmt(credit)}</Text>
                <Text style={[baseStyles.totalCellRight, { width: wNet }]}>{fmt(debit - credit)}</Text>
                <Text style={[baseStyles.totalCell, { width: wAudit }]} />
              </View>
            </View>;
          })}
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
      <Page size="A4" orientation="landscape" style={baseStyles.page}>
        <CipresaBannerHeader title={`INVENTAIRE PHYSIQUE — ${inventoryValidated ? 'ARRÊTÉ' : 'ÉTAT PROVISOIRE'}`} subtitle={`Exercice : ${exCode} — Date de situation : ${dateStr} — ${inventoryValidated ? 'Validé' : 'Non validé'} — FCFA (XAF) · BEAC`} />
        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            {['Code', 'Désignation', 'Catégorie / emplacement', 'Qté théorique', 'Qté réelle', 'Écart quantité', 'Valeur comptable', 'Valeur constatée', 'Écart valeur'].map((label, index) => <Text key={label} style={[index > 2 ? baseStyles.thRight : baseStyles.th, { width: ['8%','20%','19%','9%','9%','9%','9%','9%','8%'][index] }]}>{label}</Text>)}
          </View>
          {inventoryItems.length ? inventoryItems.map((item, index) => <View key={item.id || index} style={index % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
            <Text style={[baseStyles.td,{width:'8%'}]}>{item.code || '—'}</Text><Text style={[baseStyles.td,{width:'20%'}]}>{item.designation || ''}</Text><Text style={[baseStyles.td,{width:'19%'}]}>{[item.categorie,item.emplacement_physique].filter(Boolean).join(' · ') || '—'}</Text>
            <Text style={[baseStyles.tdRight,{width:'9%'}]}>{item.recensement_effectue ? `${fmtQty(item.quantite_theorique)} ${item.unite || ''}` : 'Non déterminé'}</Text><Text style={[baseStyles.tdRight,{width:'9%'}]}>{item.recensement_effectue ? `${fmtQty(item.quantite_reelle)} ${item.unite || ''}` : 'Non déterminé'}</Text><Text style={[baseStyles.tdRight,{width:'9%'}]}>{item.recensement_effectue ? `${fmtQty(item.ecart_quantite)} ${item.unite || ''}` : 'Non déterminé'}</Text>
            <Text style={[baseStyles.tdRight,{width:'9%'}]}>{item.recensement_effectue ? fmt(item.valeur_comptable) : 'Non déterminé'}</Text><Text style={[baseStyles.tdRight,{width:'9%'}]}>{item.recensement_effectue ? fmt(item.valeur_constatee) : 'Non déterminé'}</Text><Text style={[baseStyles.tdRight,{width:'8%'}]}>{item.recensement_effectue ? fmt(item.ecart_valeur) : 'Non déterminé'}</Text>
          </View>) : <Text style={{ padding: 10, fontSize: 9 }}>Aucun comptage physique détaillé n’a été saisi.</Text>}
        </View>
        <Text style={{ marginTop: 8, fontSize: 7, color: '#475569' }}>L’écart d’inventaire physique compare valeur constatée et valeur comptable uniquement pour les lignes recensées. Il est distinct de l’écart comptable actif/passif et ne produit pas d’écriture de régularisation.</Text>
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
  const filename = options.filename || buildPdfFilename('Journal', options.exercice);
  await downloadPDF({
    filename,
    document: <JournalPDFDocument {...options} />,
  });
}

export async function exportBalancePDF(options) {
  const filename = options.filename || buildPdfFilename('Balance-Generale', options.exercice);
  await downloadPDF({
    filename,
    document: <BalancePDFDocument {...options} />,
  });
}

export async function exportGrandLivrePDF(options) {
  const filename = options.filename || buildPdfFilename(options.accountName || 'Grand-Livre', options.exercice);
  await downloadPDF({
    filename,
    document: <GrandLivrePDFDocument {...options} />,
  });
}

export async function exportBilanPDF(options) {
  const filename = options.filename || buildPdfFilename('Bilan-Comptable', options.exercice);
  await downloadPDF({
    filename,
    document: <BilanPDFDocument {...options} />,
  });
}

export async function exportTresoreriePDF(options) {
  const filename = options.filename || buildPdfFilename('Suivi-Tresorerie', options.exercice);
  await downloadPDF({
    filename,
    document: <TresoreriePDFDocument {...options} />,
  });
}

export async function exportLivreInventairePDF(options) {
  const filename = options.filename || buildPdfFilename('Livre-Inventaire', options.exercice);
  await downloadPDF({
    filename,
    document: <LivreInventairePDFDocument {...options} />,
  });
}

/* ─── Document PDF : Compte de Résultat (SYSCOHADA) ─────────────────── */
export function CompteResultatPDFDocument({
  chargesGroups = [],
  produitsGroups = [],
  totalCharges = 0,
  totalProduits = 0,
  resultatNet = 0,
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

  const renderSide = (title, groups, totalVal, isCharges) => (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      <View style={{ backgroundColor: isCharges ? '#991b1b' : '#166534', padding: '4 6', borderRadius: 2, marginBottom: 4 }}>
        <Text style={{ color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>{title.toUpperCase()}</Text>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', padding: '3 4' }}>
        <Text style={{ width: '20%', fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>Compte</Text>
        <Text style={{ flex: 1, fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>Intitulé</Text>
        <Text style={{ width: '25%', textAlign: 'right', fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>Montant (FCFA)</Text>
      </View>
      {groups.map((g, gIdx) => (
        <View key={gIdx} style={{ marginTop: 4 }}>
          <View style={{ backgroundColor: isCharges ? '#fee2e2' : '#dcfce7', padding: '3 4' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: isCharges ? '#991b1b' : '#166534' }}>
              {g.label.toUpperCase()}
            </Text>
          </View>
          {(g.items || []).length === 0 ? (
            <View style={{ padding: '2 4' }}>
              <Text style={{ fontSize: 6, color: '#64748b', fontStyle: 'italic' }}>Aucune écriture</Text>
            </View>
          ) : (
            g.items.map((item, iIdx) => (
              <View key={iIdx} style={{ flexDirection: 'row', padding: '2 4', borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                <Text style={{ width: '20%', fontSize: 6.5, color: '#475569' }}>{item.numero}</Text>
                <Text style={{ flex: 1, fontSize: 6.5 }}>{item.libelle}</Text>
                <Text style={{ width: '25%', textAlign: 'right', fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>{fmt(item.value)}</Text>
              </View>
            ))
          )}
          <View style={{ flexDirection: 'row', backgroundColor: '#f8fafc', padding: '2 4', borderTopWidth: 0.5, borderTopColor: '#cbd5e1' }}>
            <Text style={{ flex: 1, fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>Total {g.label}</Text>
            <Text style={{ width: '25%', textAlign: 'right', fontSize: 6.5, fontFamily: 'Helvetica-Bold' }}>{fmt(g.total)}</Text>
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', backgroundColor: isCharges ? '#fecaca' : '#bbf7d0', padding: '4 4', marginTop: 6, borderRadius: 2 }}>
        <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: isCharges ? '#7f1d1d' : '#14532d' }}>
          TOTAL {title.toUpperCase()}
        </Text>
        <Text style={{ width: '35%', textAlign: 'right', fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: isCharges ? '#7f1d1d' : '#14532d' }}>
          {fmt(totalVal)} FCFA
        </Text>
      </View>
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="COMPTE DE RÉSULTAT (SYSCOHADA)"
          subtitle={`Exercice : ${exCode} — Performance globale de l'exercice`}
        />

        <View style={{ flexDirection: isPortrait ? 'column' : 'row', marginTop: 6, gap: isPortrait ? 10 : 0 }}>
          {renderSide('Charges', chargesGroups, totalCharges, true)}
          {renderSide('Produits', produitsGroups, totalProduits, false)}
        </View>

        <View style={{
          marginTop: 8,
          padding: '6 8',
          backgroundColor: resultatNet >= 0 ? '#f0fdf4' : '#fef2f2',
          borderWidth: 1,
          borderColor: resultatNet >= 0 ? '#86efac' : '#fca5a5',
          borderRadius: 3,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <View>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: resultatNet >= 0 ? '#15803d' : '#b91c1c' }}>
              RÉSULTAT NET DE L'EXERCICE : {resultatNet >= 0 ? 'BÉNÉFICE NET' : 'PERTE NETTE'}
            </Text>
            <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 1 }}>
              Total Produits ({fmt(totalProduits)} FCFA) − Total Charges ({fmt(totalCharges)} FCFA)
            </Text>
          </View>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: resultatNet >= 0 ? '#15803d' : '#b91c1c' }}>
            {resultatNet >= 0 ? '+' : ''}{fmt(resultatNet)} FCFA
          </Text>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

export async function exportCompteResultatPDF(options) {
  const filename = options.filename || buildPdfFilename('Compte-de-Resultat', options.exercice);
  await downloadPDF({
    filename,
    document: <CompteResultatPDFDocument {...options} />,
  });
}

/* ─── Document PDF : Tableau de bord de gestion avec diagrammes ────── */
export function DashboardPDFDocument({
  exercice = null,
  entrepriseName = 'CIPRESA Consulting SARL',
  kpis = {},
  monthlyFlows = [],
  donutData = { items: [], total: 0 },
  recentRows = [],
  alerts = [],
  orientation = 'portrait',
  footerText = DEFAULT_FOOTER_TEXT,
}) {
  const exCode = exercice?.code || exercice?.annee || 'En cours';
  const fmt = (v) => Number(v || 0).toLocaleString('fr-FR');
  const nowStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const maxFlow = Math.max(1, ...monthlyFlows.flatMap((b) => [Number(b.entrees || 0), Number(b.sorties || 0)]));
  const totalEntrees = monthlyFlows.reduce((a, b) => a + Number(b.entrees || 0), 0);
  const totalSorties = monthlyFlows.reduce((a, b) => a + Number(b.sorties || 0), 0);
  const fluxNet = totalEntrees - totalSorties;

  const DONUT_COLORS = ['#275a43', '#3b825e', '#68aa82', '#a7d6ba', '#94a3b8'];
  const totalDonut = Number(donutData?.total || 0);
  const donutItems = donutData?.items || [];

  // Calcul des arcs pour le Donut SVG (circonférence = 2 * PI * 34 ≈ 213.63)
  const circumference = 213.63;
  let runningDash = 0;
  const donutSlices = donutItems.map((item, idx) => {
    const fraction = totalDonut > 0 ? Number(item.value || 0) / totalDonut : 0;
    const dashLength = fraction * circumference;
    const offset = -runningDash;
    runningDash += dashLength;
    return {
      label: item.label,
      value: item.value,
      pct: Math.round(fraction * 100),
      color: DONUT_COLORS[idx % DONUT_COLORS.length],
      dashArray: `${dashLength.toFixed(2)} ${(circumference - dashLength).toFixed(2)}`,
      dashOffset: offset,
    };
  });

  return (
    <Document>
      {/* ── PAGE 1 : SYNTHÈSE FINANCIÈRE & ANALYSES GRAPHIQUES ── */}
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="TABLEAU DE BORD DE GESTION"
          subtitle={`Exercice : ${exCode} — ${entrepriseName} — Synthèse et indicateurs de performance`}
          date={nowStr}
        />

        {/* 1. INDICATEURS CLÉS (5 CARTES) */}
        <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
          {/* Trésorerie */}
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: '6 7', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' }}>Trésorerie</Text>
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{fmt(kpis.tresorerie)} FCFA</Text>
            <Text style={{ fontSize: 6, color: Number(kpis.deltaTresorerieMois || 0) >= 0 ? '#15803d' : '#b91c1c', marginTop: 2 }}>
              {Number(kpis.deltaTresorerieMois || 0) >= 0 ? '+' : ''}{fmt(kpis.deltaTresorerieMois)} FCFA ce mois
            </Text>
          </View>

          {/* Chiffre d'affaires */}
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: '6 7', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' }}>Chiffre d'affaires</Text>
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{fmt(kpis.ca)} FCFA</Text>
            <Text style={{ fontSize: 6, color: '#64748b', marginTop: 2 }}>
              {kpis.caPct !== null && kpis.caPct !== undefined ? `${kpis.caPct >= 0 ? '+' : ''}${kpis.caPct.toFixed(1)}% vs N-1` : 'Exercice en cours'}
            </Text>
          </View>

          {/* Résultat net */}
          <View style={{
            flex: 1,
            backgroundColor: Number(kpis.resultatNet || 0) >= 0 ? '#ecfdf5' : '#fef2f2',
            padding: '6 7',
            borderRadius: 4,
            borderWidth: 0.5,
            borderColor: Number(kpis.resultatNet || 0) >= 0 ? '#86efac' : '#fca5a5'
          }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: Number(kpis.resultatNet || 0) >= 0 ? '#065f46' : '#991b1b', textTransform: 'uppercase' }}>Résultat net</Text>
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: Number(kpis.resultatNet || 0) >= 0 ? '#047857' : '#b91c1c', marginTop: 2 }}>{fmt(kpis.resultatNet)} FCFA</Text>
            <Text style={{ fontSize: 6, color: Number(kpis.resultatNet || 0) >= 0 ? '#15803d' : '#b91c1c', marginTop: 2 }}>
              {Number(kpis.resultatNet || 0) >= 0 ? 'Bénéfice net' : 'Perte nette'}
            </Text>
          </View>

          {/* Bilan Actif */}
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: '6 7', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' }}>Total Bilan (Actif)</Text>
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{fmt(kpis.totalActif)} FCFA</Text>
            <Text style={{ fontSize: 6, color: kpis.bilanEquilibre ? '#15803d' : '#b45309', marginTop: 2 }}>
              {kpis.bilanEquilibre ? '✓ Bilan équilibré' : `Écart : ${fmt(kpis.bilanEcart)} FCFA`}
            </Text>
          </View>

          {/* Écritures */}
          <View style={{ flex: 1, backgroundColor: '#f8fafc', padding: '6 7', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
            <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#64748b', textTransform: 'uppercase' }}>Écritures</Text>
            <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', marginTop: 2 }}>{kpis.totalEcritures || 0}</Text>
            <Text style={{ fontSize: 6, color: '#64748b', marginTop: 2 }}>{kpis.ecrituresCeMois || 0} ce mois-ci</Text>
          </View>
        </View>

        {/* 2. DIAGRAMME 1 : ÉVOLUTION DE LA TRÉSORERIE (FLUX MENSUELS) */}
        <View style={{ marginTop: 6, marginBottom: 8, padding: 8, backgroundColor: '#ffffff', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#166534', textTransform: 'uppercase' }}>
                ÉVOLUTION DE LA TRÉSORERIE (ENCAISSEMENTS & DÉCAISSEMENTS)
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 1 }}>
                Mouvements réels de trésorerie par mois sur l'exercice {exCode}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 7, height: 7, backgroundColor: '#16a34a', borderRadius: 1.5 }} />
                <Text style={{ fontSize: 6.5, color: '#334155' }}>Entrées ({fmt(totalEntrees)} FCFA)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 7, height: 7, backgroundColor: '#ef4444', borderRadius: 1.5 }} />
                <Text style={{ fontSize: 6.5, color: '#334155' }}>Sorties ({fmt(totalSorties)} FCFA)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: fluxNet >= 0 ? '#15803d' : '#b91c1c' }}>
                  Net : {fluxNet >= 0 ? '+' : ''}{fmt(fluxNet)} FCFA
                </Text>
              </View>
            </View>
          </View>

          {/* Graphique à barres groupées */}
          <View style={{
            height: 75,
            backgroundColor: '#f8fafc',
            borderRadius: 3,
            borderWidth: 0.5,
            borderColor: '#e2e8f0',
            paddingTop: 6,
            paddingHorizontal: 8,
            paddingBottom: 4,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-around',
          }}>
            {monthlyFlows.length > 0 ? (
              monthlyFlows.map((b) => {
                const hEntrees = Math.max((Number(b.entrees || 0) / maxFlow) * 52, Number(b.entrees || 0) > 0 ? 3 : 0);
                const hSorties = Math.max((Number(b.sorties || 0) / maxFlow) * 52, Number(b.sorties || 0) > 0 ? 3 : 0);
                return (
                  <View key={b.key} style={{ alignItems: 'center', width: 34 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 55 }}>
                      <View style={{ width: 8, height: hEntrees, backgroundColor: '#16a34a', borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 }} />
                      <View style={{ width: 8, height: hSorties, backgroundColor: '#ef4444', borderTopLeftRadius: 1.5, borderTopRightRadius: 1.5 }} />
                    </View>
                    <Text style={{ fontSize: 6, color: '#64748b', textAlign: 'center', marginTop: 2 }}>{b.label}</Text>
                  </View>
                );
              })
            ) : (
              <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 7, color: '#94a3b8' }}>Aucun flux de trésorerie sur la période</Text>
              </View>
            )}
          </View>
        </View>

        {/* 3. DIAGRAMME 2 : RÉPARTITION DES CHARGES D'EXPLOITATION */}
        <View style={{ marginBottom: 8, padding: 8, backgroundColor: '#ffffff', borderRadius: 4, borderWidth: 0.5, borderColor: '#cbd5e1' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <View>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#166534', textTransform: 'uppercase' }}>
                RÉPARTITION DES CHARGES D'EXPLOITATION (SYSCOHADA)
              </Text>
              <Text style={{ fontSize: 6.5, color: '#64748b', marginTop: 1 }}>
                Structure des coûts d'exploitation par nature de compte
              </Text>
            </View>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
              Total Charges : {fmt(totalDonut)} FCFA
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {/* Donut SVG vectoriel */}
            <View style={{ width: 80, height: 80, position: 'relative', justifyContent: 'center', alignItems: 'center' }}>
              <Svg viewBox="0 0 100 100" width={80} height={80}>
                <Circle cx={50} cy={50} r={34} stroke="#f1f5f9" strokeWidth={13} fill="none" />
                {totalDonut > 0 && donutSlices.map((slice, idx) => (
                  <Circle
                    key={idx}
                    cx={50}
                    cy={50}
                    r={34}
                    stroke={slice.color}
                    strokeWidth={13}
                    strokeDasharray={slice.dashArray}
                    strokeDashoffset={slice.dashOffset}
                    fill="none"
                    transform="rotate(-90 50 50)"
                  />
                ))}
              </Svg>
              <View style={{ position: 'absolute', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0f172a' }}>
                  {(totalDonut / 1000000).toFixed(1)}M
                </Text>
                <Text style={{ fontSize: 5.5, color: '#64748b' }}>FCFA</Text>
              </View>
            </View>

            {/* Tableau détaillé des catégories avec barres horizontales */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', paddingBottom: 2, marginBottom: 3 }}>
                <Text style={{ width: '42%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#475569' }}>Catégorie</Text>
                <Text style={{ width: '28%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#475569', textAlign: 'right' }}>Montant</Text>
                <Text style={{ width: '12%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#475569', textAlign: 'right' }}>Part</Text>
                <Text style={{ width: '18%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#475569', textAlign: 'center' }}>Répartition</Text>
              </View>
              {donutSlices.length > 0 ? (
                donutSlices.map((s, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: '#f1f5f9' }}>
                    <View style={{ width: '42%', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 5, height: 5, backgroundColor: s.color, borderRadius: 1 }} />
                      <Text style={{ fontSize: 6.5, color: '#1e293b' }}>{s.label}</Text>
                    </View>
                    <Text style={{ width: '28%', fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' }}>
                      {fmt(s.value)} FCFA
                    </Text>
                    <Text style={{ width: '12%', fontSize: 6.5, color: '#475569', textAlign: 'right' }}>
                      {s.pct}%
                    </Text>
                    <View style={{ width: '18%', paddingLeft: 6 }}>
                      <View style={{ height: 4, backgroundColor: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: `${s.pct}%`, height: '100%', backgroundColor: s.color, borderRadius: 2 }} />
                      </View>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 7, color: '#94a3b8', paddingVertical: 8 }}>Aucune charge d'exploitation enregistrée</Text>
              )}
            </View>
          </View>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>

      {/* ── PAGE 2 : ÉCRITURES RÉCENTES & CONTRÔLES DE GESTION ── */}
      <Page size="A4" orientation={orientation} style={baseStyles.page}>
        <CipresaBannerHeader
          title="TABLEAU DE BORD — DÉTAIL DES OPÉRATIONS & CONTRÔLES"
          subtitle={`Exercice : ${exCode} — Journal récent et alertes de gestion`}
          date={nowStr}
        />

        {/* 4. DERNIÈRES ÉCRITURES COMPTABLES */}
        <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#166534', marginTop: 4, marginBottom: 4, textTransform: 'uppercase' }}>
          DERNIÈRES ÉCRITURES ENREGISTRÉES
        </Text>
        <View style={baseStyles.table}>
          <View style={baseStyles.thead}>
            <Text style={[baseStyles.th, { width: '14%' }]}>Date</Text>
            <Text style={[baseStyles.th, { width: '18%' }]}>Réf. Pièce</Text>
            <Text style={[baseStyles.th, { width: '36%' }]}>Libellé de l'opération</Text>
            <Text style={[baseStyles.thRight, { width: '16%' }]}>Débit (FCFA)</Text>
            <Text style={[baseStyles.thRight, { width: '16%' }]}>Crédit (FCFA)</Text>
          </View>
          {recentRows.slice(0, 10).map((r, i) => (
            <View key={r.id || i} style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}>
              <Text style={[baseStyles.td, { width: '14%' }]}>{r.date}</Text>
              <Text style={[baseStyles.td, { width: '18%', fontFamily: 'Helvetica-Bold' }]}>{r.ref || '—'}</Text>
              <Text style={[baseStyles.td, { width: '36%' }]}>{r.description}</Text>
              <Text style={[baseStyles.tdRight, { width: '16%', color: '#047857' }]}>{r.debit}</Text>
              <Text style={[baseStyles.tdRight, { width: '16%', color: '#b91c1c' }]}>{r.credit}</Text>
            </View>
          ))}
          {recentRows.length === 0 && (
            <View style={baseStyles.row}>
              <Text style={[baseStyles.td, { width: '100%', textAlign: 'center', color: '#94a3b8' }]}>
                Aucune écriture enregistrée pour cet exercice.
              </Text>
            </View>
          )}
        </View>

        {/* 5. ALERTES & POINTS DE VIGILANCE */}
        <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#166534', marginTop: 14, marginBottom: 4, textTransform: 'uppercase' }}>
          ALERTES & CONTRÔLES DE CLÔTURE
        </Text>
        <View style={{ gap: 4 }}>
          {alerts.length > 0 ? (
            alerts.map((alt, idx) => (
              <View
                key={alt.key || idx}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5 8',
                  backgroundColor: alt.tone === 'warning' ? '#fffbeb' : '#f0fdf4',
                  borderWidth: 0.5,
                  borderColor: alt.tone === 'warning' ? '#fde68a' : '#bbf7d0',
                  borderRadius: 3,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 2.5,
                    backgroundColor: alt.tone === 'warning' ? '#f59e0b' : '#16a34a',
                  }}
                />
                <Text style={{ fontSize: 7, color: alt.tone === 'warning' ? '#92400e' : '#166534', flex: 1 }}>
                  {alt.text}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 7, color: '#94a3b8' }}>Aucune alerte active sur cet exercice.</Text>
          )}
        </View>

        {/* Cadre de signature & visa de conformité */}
        <View style={{
          marginTop: 20,
          borderWidth: 0.5,
          borderColor: '#cbd5e1',
          borderRadius: 4,
          padding: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <View style={{ width: '45%' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase' }}>
              Visa du Responsable Comptable
            </Text>
            <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 2 }}>Date et signature :</Text>
            <View style={{ height: 28, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' }} />
          </View>
          <View style={{ width: '45%' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#475569', textTransform: 'uppercase' }}>
              Visa de la Direction Générale
            </Text>
            <Text style={{ fontSize: 6, color: '#94a3b8', marginTop: 2 }}>Date et signature :</Text>
            <View style={{ height: 28, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' }} />
          </View>
        </View>

        <CipresaFooter footerText={footerText} />
      </Page>
    </Document>
  );
}

export async function exportDashboardPDF(options) {
  const filename = options.filename || buildPdfFilename('Tableau-de-Bord', options.exercice);
  await downloadPDF({
    filename,
    document: <DashboardPDFDocument {...options} />,
  });
}
