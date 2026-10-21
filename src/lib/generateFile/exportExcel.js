import * as XLSX from 'xlsx';

/**
 * Exporte un tableau de données en fichier .xlsx et le télécharge.
 *
 * @param {Object}   options
 * @param {Object[]} options.rows       - Lignes à exporter (tableaux d'objets plats)
 * @param {Array}    options.columns    - Définition des colonnes [{ key, label }]
 * @param {string}   [options.filename] - Nom du fichier sans extension (défaut : 'export')
 * @param {string}   [options.sheet]    - Nom de l'onglet Excel (défaut : 'Données')
 *
 * @example
 * exportToExcel({
 *   rows: filteredRows,
 *   columns: COLUMNS,
 *   filename: 'plan_comptable',
 *   sheet: 'Plan comptable',
 * });
 */
export function exportToExcel({ rows, columns, filename = 'export', sheet = 'Données' }) {
  // Convertit chaque ligne en objet { label: valeur } selon les colonnes fournies
  const data = rows.map(row =>
    Object.fromEntries(columns.map(col => [col.label, row[col.key] ?? '']))
  );

  const ws = XLSX.utils.json_to_sheet(data);

  // Largeur automatique des colonnes
  const colWidths = columns.map(col => ({
    wch: Math.max(
      col.label.length,
      ...rows.map(r => String(r[col.key] ?? '').length)
    ) + 2,
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
