const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const fmt = (d) => d.toISOString().slice(0, 10);

// Génère les périodes (mensuelles ou trimestrielles) couvertes par un exercice comptable.
export function genererPeriodes(exercice, periodicite) {
  if (!exercice?.date_debut || !exercice?.date_fin) return [];
  const start = new Date(exercice.date_debut);
  const end = new Date(exercice.date_fin);
  const periods = [];

  if (periodicite === 'MENSUELLE') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const debut = cursor < start ? start : cursor;
      const finMois = endOfMonth(cursor);
      const fin = finMois > end ? end : finMois;
      periods.push({ debut: fmt(debut), fin: fmt(fin), libelle: `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}` });
      cursor = addMonths(cursor, 1);
    }
  } else {
    let cursor = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
    while (cursor <= end) {
      const finQ = endOfMonth(addMonths(cursor, 2));
      const debut = cursor < start ? start : cursor;
      const fin = finQ > end ? end : finQ;
      const numTrimestre = Math.floor(cursor.getMonth() / 3) + 1;
      periods.push({ debut: fmt(debut), fin: fmt(fin), libelle: `T${numTrimestre} ${cursor.getFullYear()}` });
      cursor = addMonths(cursor, 3);
    }
  }
  return periods;
}

// Calcule une date d'échéance à partir d'une règle (décalage en jours depuis la fin de
// période pour la TVA, ou date fixe mois/jour pour les autres obligations).
export function calculerEcheance(periodeFin, regle) {
  if (!regle) return null;
  if (regle.decalage_jours != null && periodeFin) {
    const d = new Date(periodeFin);
    d.setDate(d.getDate() + regle.decalage_jours);
    return fmt(d);
  }
  if (regle.mois_fixe && regle.jour_fixe) {
    const year = periodeFin ? new Date(periodeFin).getFullYear() : new Date().getFullYear();
    let d = new Date(year, regle.mois_fixe - 1, regle.jour_fixe);
    if (!periodeFin && d < new Date()) d = new Date(year + 1, regle.mois_fixe - 1, regle.jour_fixe);
    return fmt(d);
  }
  return null;
}

export const STATUT_LABEL = { BROUILLON: 'Brouillon', EN_ATTENTE: 'En attente', DECLAREE: 'Déclarée', PAYEE: 'Payée' };
export const STATUT_TONE = { BROUILLON: 'warning', EN_ATTENTE: 'neutral', DECLAREE: 'success', PAYEE: 'success' };
export const PERIODICITE_LABEL = { MENSUELLE: 'Mensuel', TRIMESTRIELLE: 'Trimestriel' };

export const money = (v) => Number(v || 0).toLocaleString('fr-FR');
export const dateFr = (v) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
