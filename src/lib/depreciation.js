// Calcule l'amortissement cumulé et la VNC d'une immobilisation à une date donnée.
// LINEAIRE : valeur_brute / duree_annees, au prorata du nombre d'années écoulées.
// DEGRESSIF : amortissement dégressif simplifié (taux = coefficient / durée, appliqué
// chaque année pleine sur la valeur nette restante ; la dernière année partielle est
// proratisée en linéaire). Ce n'est pas le mode dégressif fiscal français exact
// (avec bascule vers le linéaire), mais une approximation raisonnable.
// AUCUNE : jamais amorti (ex : terrains).

const DEGRESSIF_COEFFICIENTS = [
  { max: 4, coef: 1.25 },
  { max: 6, coef: 1.75 },
  { max: Infinity, coef: 2.25 },
];

const yearsBetween = (start, end) => Math.max(0, (end - start) / (365.25 * 24 * 3600 * 1000));

export function computeDepreciation(asset, asOfDate = new Date()) {
  const brute = Number(asset.valeur_brute || 0);
  const duree = Number(asset.duree_annees || 0);
  const acquisition = new Date(asset.date_acquisition);
  const elapsed = yearsBetween(acquisition, asOfDate);

  if (asset.methode === 'AUCUNE' || !duree || duree <= 0) {
    return { amortCumule: 0, vnc: brute };
  }

  if (asset.methode === 'LINEAIRE') {
    const annuelle = brute / duree;
    const amortCumule = Math.min(brute, annuelle * elapsed);
    return { amortCumule, vnc: brute - amortCumule };
  }

  // DEGRESSIF simplifié
  const coefEntry = DEGRESSIF_COEFFICIENTS.find((c) => duree <= c.max) || DEGRESSIF_COEFFICIENTS[DEGRESSIF_COEFFICIENTS.length - 1];
  const taux = Math.min(1, coefEntry.coef / duree);
  let remaining = brute;
  let fullYears = Math.floor(Math.min(elapsed, duree));
  for (let i = 0; i < fullYears; i += 1) {
    remaining -= remaining * taux;
  }
  const partialYear = Math.min(elapsed, duree) - fullYears;
  if (partialYear > 0) {
    remaining -= remaining * taux * partialYear;
  }
  const amortCumule = Math.min(brute, brute - remaining);
  return { amortCumule, vnc: brute - amortCumule };
}
