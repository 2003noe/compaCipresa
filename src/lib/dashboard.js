export const money = (v) => Number(v || 0).toLocaleString('fr-FR');
export const dateFr = (v) => (v ? new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Nomenclature standard SYSCOHADA (classe 6 - Charges), utilisée uniquement pour regrouper
// les comptes existants par famille — aucun compte ni montant n'est inventé.
export const CHARGE_PREFIX_LABEL = {
  60: 'Achats', 61: 'Transports', 62: 'Services extérieurs A', 63: 'Services extérieurs B',
  64: 'Impôts et taxes', 65: 'Autres charges', 66: 'Charges de personnel',
  67: 'Charges financières', 68: 'Dotations aux amortissements', 69: 'Charges HAO',
};

export const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export const DONUT_COLORS = ['#0d9488', '#14b8a6', '#5eead4', '#99f6e4', '#cbd5e1'];
