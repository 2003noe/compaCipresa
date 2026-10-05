import { pdf, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/* ─── Styles partagés ─────────────────────────────────────────────────
   Utilisés par GenericTablePDF. Tu peux les surcharger via `styleOverrides`.
─────────────────────────────────────────────────────────────────────── */
const baseStyles = StyleSheet.create({
  page:    { padding: 30, fontSize: 9, fontFamily: 'Helvetica' },
  title:   { fontSize: 16, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  sub:     { fontSize: 10, marginBottom: 16, color: '#555' },
  table:   { width: '100%' },
  thead:   { flexDirection: 'row', backgroundColor: '#1e40af', borderRadius: 3 },
  th:      { flex: 1, padding: '6 4', fontFamily: 'Helvetica-Bold', color: '#fff' },
  thRight: { flex: 1, padding: '6 4', fontFamily: 'Helvetica-Bold', color: '#fff', textAlign: 'right' },
  row:     { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0' },
  rowAlt:  { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  td:      { flex: 1, padding: '5 4' },
  tdRight: { flex: 1, padding: '5 4', textAlign: 'right' },
  footer:  { marginTop: 16, fontSize: 8, color: '#888', textAlign: 'center' },
});

/* ─── Composant PDF générique ─────────────────────────────────────────
   Rendu d'un tableau quelconque en PDF.

   Props :
   - title       {string}   Titre affiché en haut du document
   - subtitle    {string}   Sous-titre (ex : date d'export automatique)
   - columns     {Array}    [{ key, label, align? }]
   - rows        {Array}    Tableau de données
   - footerText  {string}   Texte de pied de page (défaut : "<n> ligne(s)")
   - orientation {string}   'landscape' | 'portrait' (défaut : 'landscape')
   - size        {string}   Format de page PDF (défaut : 'A4')
─────────────────────────────────────────────────────────────────────── */
export function GenericTablePDF({
  title,
  subtitle,
  columns,
  rows,
  footerText,
  orientation = 'landscape',
  size = 'A4',
}) {
  const date = new Date().toLocaleDateString('fr-FR');
  const footer = footerText ?? `${rows.length} ligne${rows.length !== 1 ? 's' : ''} — compaCipresa`;

  return (
    <Document>
      <Page size={size} orientation={orientation} style={baseStyles.page}>
        <Text style={baseStyles.title}>{title}</Text>
        <Text style={baseStyles.sub}>{subtitle ?? `Exporté le ${date}`}</Text>

        <View style={baseStyles.table}>
          {/* En-tête */}
          <View style={baseStyles.thead}>
            {columns.map(c => (
              <Text
                key={c.key}
                style={c.align === 'right' ? baseStyles.thRight : baseStyles.th}
              >
                {c.label}
              </Text>
            ))}
          </View>

          {/* Corps */}
          {rows.map((row, i) => (
            <View
              key={row.id ?? i}
              style={i % 2 === 0 ? baseStyles.row : baseStyles.rowAlt}
            >
              {columns.map(c => (
                <Text
                  key={c.key}
                  style={c.align === 'right' ? baseStyles.tdRight : baseStyles.td}
                >
                  {row[c.key] ?? ''}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text style={baseStyles.footer}>{footer}</Text>
      </Page>
    </Document>
  );
}

/* ─── Fonction de téléchargement ──────────────────────────────────────
   Génère le blob PDF et déclenche le téléchargement sans bloquer l'UI.

   @param {Object}  options
   @param {string}  options.filename    - Nom du fichier sans extension
   @param {Object}  options.document    - Élément React PDF à rendre (JSX)
   @returns {Promise<void>}

   @example
   await downloadPDF({
     filename: 'plan_comptable',
     document: <GenericTablePDF title="Plan Comptable" columns={COLUMNS} rows={rows} />,
   });
─────────────────────────────────────────────────────────────────────── */
export async function downloadPDF({ filename, document: doc }) {
  const blob = await pdf(doc).toBlob();
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `${filename}.pdf`,
  });
  a.click();
  URL.revokeObjectURL(url);
}
