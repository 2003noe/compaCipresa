// src/lib/bilan.js
// Logique du bilan SYSCOHADA : classement des comptes à partir de leur solde.
// Convention : solde = débit - crédit (s > 0 : solde débiteur, s < 0 : créditeur).

const num = (v) => Number(v || 0);

export const ACTIF_SECTIONS = [
  ['AI_INCORP', 'Immobilisations incorporelles'],
  ['AI_CORP', 'Immobilisations corporelles'],
  ['AI_FIN', 'Immobilisations financières'],
  ['AI_AMORT', 'Amortissements et dépréciations des immobilisations'],
];

export const GROUP_KEYS = ['AI_INCORP', 'AI_CORP', 'AI_FIN', 'AI_AMORT', 'AC', 'TA', 'CP', 'DF', 'PC', 'TP', 'NC'];

// Comptes de gestion (charges / produits) : exclus du bilan, ils forment le résultat.
export const isResultAccount = (r) =>
  ['6', '7', '8'].includes(String(r.numero || '').trim()[0]) || ['CHARGE', 'PRODUIT'].includes(r.nature);

/**
 * Classe un compte de bilan selon son numéro ET le sens de son solde.
 * - Capitaux propres / dettes : valeur exprimée en créditeur (-s), pouvant être négative
 *   (ex. report à nouveau débiteur).
 * - Tiers (classe 4) et trésorerie (classe 5) : un solde du « mauvais » côté bascule
 *   de l'autre côté du bilan (client créditeur => passif, découvert => trésorerie passif).
 * - Amortissements / dépréciations (28, 29, 39, 49, 59) : valeurs négatives dans l'actif.
 */
export function classify(row) {
  const n = String(row.numero || '').trim();
  const p2 = n.slice(0, 2);
  const s = num(row.solde_fin);
  if (Math.abs(s) < 0.005) return null;

  switch (n[0]) {
    case '1':
      return ['16', '17', '18', '19'].includes(p2)
        ? { group: 'DF', value: -s }
        : { group: 'CP', value: -s };
    case '2':
      if (['20', '21'].includes(p2)) return { group: 'AI_INCORP', value: s };
      if (['22', '23', '24', '25'].includes(p2)) return { group: 'AI_CORP', value: s };
      if (['26', '27'].includes(p2)) return { group: 'AI_FIN', value: s };
      if (['28', '29'].includes(p2)) return { group: 'AI_AMORT', value: s };
      return { group: 'NC', value: s };
    case '3':
      return { group: 'AC', value: s };
    case '4':
      if (p2 === '49') return { group: 'AC', value: s };
      return s > 0 ? { group: 'AC', value: s } : { group: 'PC', value: -s };
    case '5':
      if (p2 === '59') return { group: 'TA', value: s };
      return s > 0 ? { group: 'TA', value: s } : { group: 'TP', value: -s };
    default:
      return { group: 'NC', value: s };
  }
}

/**
 * Construit le bilan à partir des lignes retournées par soldes_comptes().
 * Retourne les comptes par groupe, les résultats et les totaux.
 */
export function buildBilan(soldes) {
  const groups = {};
  GROUP_KEYS.forEach((k) => { groups[k] = new Map(); });

  let resultatPeriode = 0;   // produits - charges de l'exercice
  let resultatAnterieur = 0; // résultats des exercices précédents non encore affectés

  (soldes || []).forEach((r) => {
    if (isResultAccount(r)) {
      resultatPeriode += num(r.periode_credit) - num(r.periode_debit);
      resultatAnterieur -= num(r.ouverture) + num(r.anterieur);
      return;
    }
    const c = classify(r);
    if (!c) return;
    groups[c.group].set(r.numero, { numero: r.numero, libelle: r.libelle, value: c.value });
  });

  const total = (k) => [...groups[k].values()].reduce((acc, x) => acc + x.value, 0);

  const totalImmo = total('AI_INCORP') + total('AI_CORP') + total('AI_FIN') + total('AI_AMORT');
  const totalAC = total('AC');
  const totalTA = total('TA');
  const totalActif = totalImmo + totalAC + totalTA;

  const totalCP = total('CP') + resultatAnterieur + resultatPeriode;
  const totalDF = total('DF');
  const totalPC = total('PC');
  const totalTP = total('TP');
  const totalPassif = totalCP + totalDF + totalPC + totalTP;

  return {
    groups,
    resultatPeriode,
    resultatAnterieur,
    totals: {
      immo: totalImmo,
      AC: totalAC,
      TA: totalTA,
      actif: totalActif,
      CP: totalCP,
      DF: totalDF,
      PC: totalPC,
      TP: totalTP,
      passif: totalPassif,
      NC: total('NC'),
      AI_INCORP: total('AI_INCORP'),
      AI_CORP: total('AI_CORP'),
      AI_FIN: total('AI_FIN'),
      AI_AMORT: total('AI_AMORT'),
    },
    ecart: totalActif - totalPassif,
  };
}

/**
 * Fusionne les comptes d'un groupe pour N et N-1 (un compte peut changer de groupe
 * d'une année à l'autre selon le sens de son solde : il apparaît alors dans les deux).
 */
export function mergeGroup(bilanN, bilanN1, key) {
  const numeros = new Set([
    ...bilanN.groups[key].keys(),
    ...(bilanN1 ? bilanN1.groups[key].keys() : []),
  ]);
  return [...numeros]
    .sort()
    .map((numero) => {
      const a = bilanN.groups[key].get(numero);
      const b = bilanN1 ? bilanN1.groups[key].get(numero) : null;
      return {
        numero,
        libelle: (a || b).libelle,
        val: a ? a.value : 0,
        val1: bilanN1 ? (b ? b.value : 0) : null,
      };
    });
}