const CONTRA_ASSET_PREFIXES = ['28', '29', '39', '49', '59'];
const isCode = (code, prefixes) => prefixes.some((prefix) => code.startsWith(prefix));

export function isContraAssetAccount(account) {
  return isCode(String(account?.numero || '').replace(/\D/g, ''), CONTRA_ASSET_PREFIXES);
}

export function isPatrimonialAccount(account) {
  const code = String(account?.numero || '').replace(/\D/g, '');
  const nature = String(account?.nature || '').toUpperCase();
  return /^[1-5]/.test(code) && !['CHARGE', 'PRODUIT'].includes(nature);
}

// La catégorie découle de la nomenclature et de la nature comptable, jamais du signe du solde.
export function classifyInventoryAccount(account) {
  const code = String(account?.numero || '').replace(/\D/g, '');
  const nature = String(account?.nature || '').toUpperCase();
  if (!/^[1-5]/.test(code) || ['CHARGE', 'PRODUIT'].includes(nature)) return { category: 'AUTRE', sectionName: 'Comptes hors patrimoine' };
  if (code.startsWith('1')) {
    if (/^1[6-9]/.test(code)) return { category: 'DETTES_FINANCIERES', sectionName: 'Dettes financières (classe 1)' };
    return { category: 'CAPITAUX_PROPRES', sectionName: 'Capitaux propres (classe 1)' };
  }
  if (code.startsWith('2')) return { category: 'ACTIF_IMMO', sectionName: 'Actif immobilisé (classe 2)' };
  if (code.startsWith('3')) return { category: 'STOCKS', sectionName: 'Stocks et en-cours (classe 3)' };
  if (code.startsWith('4')) {
    if (code.startsWith('49')) return { category: 'CREANCES', sectionName: 'Créances et débiteurs (classe 4)' };
    if (/^40/.test(code) || /^4[23]/.test(code) || /^445[34]/.test(code) || /^419/.test(code)) {
      return { category: 'DETTES_COURT_TERME', sectionName: 'Dettes et tiers (classe 4)' };
    }
    if (/^41/.test(code) || /^445[12]/.test(code)) return { category: 'CREANCES', sectionName: 'Créances et débiteurs (classe 4)' };
    return nature === 'PASSIF'
      ? { category: 'DETTES_COURT_TERME', sectionName: 'Dettes et tiers (classe 4)' }
      : { category: 'CREANCES', sectionName: 'Créances et débiteurs (classe 4)' };
  }
  if (code.startsWith('5')) {
    if (code.startsWith('56')) return { category: 'DETTES_COURT_TERME', sectionName: 'Dettes de trésorerie (classe 5)' };
    return { category: 'TRESORERIE', sectionName: 'Trésorerie et disponibilités (classe 5)' };
  }
  return { category: 'AUTRE', sectionName: 'Comptes hors patrimoine' };
}

export function hasAtypicalInventoryBalance(account, signedBalance) {
  const category = classifyInventoryAccount(account).category;
  const balance = Number(signedBalance || 0);
  if (balance === 0 || category === 'AUTRE') return false;
  const contra = isContraAssetAccount(account);
  const expectsDebit = ['ACTIF_IMMO', 'STOCKS', 'CREANCES', 'TRESORERIE'].includes(category) && !contra;
  return expectsDebit ? balance < 0 : balance > 0;
}

export function calculateInventoryStatement(rows, resultNet = 0) {
  const assets = new Set(['ACTIF_IMMO', 'STOCKS', 'CREANCES', 'TRESORERIE']);
  let actifBrut = 0;
  let actifAmort = 0;
  let actifNet = 0;
  let dettesTotal = 0;
  let capitauxPropres = 0;
  rows.forEach((row) => {
    const balance = Number(row.balanceNette || 0);
    const code = String(row.numero || '').replace(/\D/g, '');
    if (assets.has(row.category)) {
      actifNet += balance;
      if (isContraAssetAccount(row)) actifAmort += Math.max(-balance, 0);
      else actifBrut += Math.max(balance, 0);
    } else if (['DETTES_FINANCIERES', 'DETTES_COURT_TERME'].includes(row.category)) {
      dettesTotal += -balance; // un solde débiteur diminue le passif et reste négatif ici
    } else if (row.category === 'CAPITAUX_PROPRES') {
      // Le compte 12 est remplacé par le résultat recalculé depuis les classes 6 et 7.
      if (/^12/.test(code)) capitauxPropres += -Number(row.openingSigned || 0);
      else capitauxPropres += -balance;
    }
  });
  capitauxPropres += Number(resultNet || 0);
  const passifTotal = dettesTotal + capitauxPropres;
  return {
    actifBrut,
    actifAmort,
    actifNet,
    dettesTotal,
    capitauxPropres,
    passifTotal,
    resultatNet: Number(resultNet || 0),
    ecartComptable: actifNet - passifTotal,
    hasData: rows.some((row) => Number(row.balanceNette || 0) !== 0),
    hasAnomalies: rows.some((row) => row.hasAnomaly),
  };
}

export function calculatePhysicalInventoryTotals(rows) {
  const counted = rows.filter((row) => row.recensement_effectue === true);
  return counted.reduce((totals, row) => {
    totals.ecartQuantite += Number(row.ecart_quantite || 0);
    totals.valeurComptable += Number(row.valeur_comptable || 0);
    totals.valeurConstatee += Number(row.valeur_constatee || 0);
    totals.ecartValeur += Number(row.ecart_valeur || 0);
    return totals;
  }, { recensementEffectue: counted.length > 0, lignesRecensees: counted.length, ecartQuantite: 0, valeurComptable: 0, valeurConstatee: 0, ecartValeur: 0 });
}
