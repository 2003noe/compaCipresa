import { useState } from 'react';
import Card from '../../components/ui/Card';
import EntrepriseTab from './tabs/EntrepriseTab';
import ExercicesTab from './tabs/ExercicesTab';
import JournauxTab from './tabs/JournauxTab';
import UtilisateursTab from './tabs/UtilisateursTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import SecuriteTab from './tabs/SecuriteTab';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { key: 'entreprise', label: 'Entreprise', Comp: EntrepriseTab },
  { key: 'exercices', label: 'Exercices', Comp: ExercicesTab },
  { key: 'journaux', label: 'Journaux', Comp: JournauxTab },
  { key: 'utilisateurs', label: 'Utilisateurs', Comp: UtilisateursTab },
  { key: 'integrations', label: 'Intégrations', Comp: IntegrationsTab },
  { key: 'securite', label: 'Sécurité', Comp: SecuriteTab },
];

export default function Settings() {
  const { can, hasRole } = useAuth();
  const [active, setActive] = useState('entreprise');
  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'utilisateurs') return can('CONFIG_USERS');
    if (['entreprise', 'journaux'].includes(tab.key)) return can('CONFIG_COMPANY') || can('COMPTA_READ');
    if (['integrations', 'securite'].includes(tab.key)) return can('CONFIG_COMPANY');
    return can('COMPTA_READ') || can('COMPTA_EXERCISE_EDIT') || hasRole('ADMIN');
  });
  const safeActive = visibleTabs.some((tab) => tab.key === active) ? active : (visibleTabs[0]?.key || 'exercices');
  const Active = visibleTabs.find((t) => t.key === safeActive)?.Comp || ExercicesTab;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Configurez votre environnement comptable</p>
        </div>
      </div>

      <div className="params-layout">
        <Card className="params-nav">
          {visibleTabs.map((t) => (
            <button key={t.key} type="button" className={`params-nav-item ${safeActive === t.key ? 'active' : ''}`} onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </Card>
        <Card>
          <Active />
        </Card>
      </div>
    </div>
  );
}
