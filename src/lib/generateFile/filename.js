// src/lib/generateFile/filename.js

/**
 * Construit la nomenclature standardisée exigée pour tous les fichiers PDF :
 * "nom-du-compte_code-de-l'exercice_date-du-jour"
 *
 * @param {string} accountName - Nom du compte ou de l'état (ex: "Grand-Livre", "Compte-5211-Banque", "Journal", "Bilan-Comptable", etc.)
 * @param {string|object} [exercice] - Code de l'exercice ou objet exercice (ex: "1-2026" ou { code: "1-2026" })
 * @param {string|Date} [date] - Date du jour (par défaut : date du jour YYYY-MM-DD)
 * @returns {string} - Nom de fichier standardisé sans extension .pdf
 */
export function buildPdfFilename(accountName = 'Document', exercice = null, date = null) {
  // 1. Nom du compte ou de l'état (mots séparés par des tirets, caractères illégaux retirés)
  const cleanAccount = String(accountName || 'Document')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-');

  // 2. Code de l'exercice
  const rawCode = typeof exercice === 'string'
    ? exercice
    : (exercice?.code || exercice?.annee || 'exercice');
  const cleanCode = String(rawCode)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-');

  // 3. Date du jour au format ISO YYYY-MM-DD
  let dateStr = '';
  if (date instanceof Date) {
    dateStr = date.toISOString().slice(0, 10);
  } else if (typeof date === 'string' && date.trim()) {
    dateStr = date.trim().slice(0, 10);
  } else {
    dateStr = new Date().toISOString().slice(0, 10);
  }

  return `${cleanAccount}_${cleanCode}_${dateStr}`;
}

