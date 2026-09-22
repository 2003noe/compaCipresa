const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const addMonths = (date, n) => { const d = new Date(date); d.setMonth(d.getMonth() + n); return d; };
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const fmt = (d) => d.toISOString().slice(0, 10);

// La clôture CIPRESA est mensuelle (cf. classeur : "Clôture mensuelle").
export function genererPeriodesMensuelles(exercice) {
  if (!exercice?.date_debut || !exercice?.date_fin) return [];
  const start = new Date(exercice.date_debut);
  const end = new Date(exercice.date_fin);
  const periods = [];
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const debut = cursor < start ? start : cursor;
    const finMois = endOfMonth(cursor);
    const fin = finMois > end ? end : finMois;
    periods.push({ debut: fmt(debut), fin: fmt(fin), libelle: `${MONTHS_FR[cursor.getMonth()]} ${cursor.getFullYear()}` });
    cursor = addMonths(cursor, 1);
  }
  return periods;
}

export const STATUT_LABEL = { OUVERTE: 'Ouverte', CONTROLES_EN_COURS: 'Contrôles en cours', PRE_CLOTURE: 'Pré-clôture', CLOTUREE: 'Clôturée' };
export const STATUT_TONE = { OUVERTE: 'neutral', CONTROLES_EN_COURS: 'warning', PRE_CLOTURE: 'warning', CLOTUREE: 'success' };
export const CONTROLE_STATUT_LABEL = { A_FAIRE: 'À faire', FAIT: 'Fait', NON_APPLICABLE: 'Non applicable' };

export const dateFr = (v) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
