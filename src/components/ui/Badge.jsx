const styles = {
  Validée: 'success',
  Payé: 'success',
  Payée: 'success',
  Actif: 'success',
  Brouillon: 'warning',
  'Contrôles en cours': 'warning',
  'Non configuré': 'warning',
  'En attente': 'warning',
  'En retard': 'danger',
  Inactif: 'neutral',
  Clôturé: 'neutral',
  Clôturée: 'neutral',
};

export default function Badge({ children, tone, className = '' }) {
  const resolvedTone = tone || styles[children] || 'neutral';
  return (
    <span className={`badge badge-${resolvedTone} ${className}`.trim()}>
      {children}
    </span>
  );
}
