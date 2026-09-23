export const dateFrCourt = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  if (diffJ < 7) return `il y a ${diffJ} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

export const TYPE_LABEL = {
  TVA: 'TVA', CLOTURE: 'Clôture', RAPPROCHEMENT: 'Rapprochement', ECRITURE: 'Écriture',
  SYSTEME: 'Système', UTILISATEUR: 'Utilisateur',
};
