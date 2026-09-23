import { useState } from 'react';
import Card from '../../components/ui/Card';
import EntrepriseTab from './tabs/EntrepriseTab';
import ExercicesTab from './tabs/ExercicesTab';
import JournauxTab from './tabs/JournauxTab';
import UtilisateursTab from './tabs/UtilisateursTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import SecuriteTab from './tabs/SecuriteTab';

const TABS = [
  { key: 'entreprise', label: 'Entreprise', Comp: EntrepriseTab },
  { key: 'exercices', label: 'Exercices', Comp: ExercicesTab },
  { key: 'journaux', label: 'Journaux', Comp: JournauxTab },
  { key: 'utilisateurs', label: 'Utilisateurs', Comp: UtilisateursTab },
  { key: 'integrations', label: 'Intégrations', Comp: IntegrationsTab },
  { key: 'securite', label: 'Sécurité', Comp: SecuriteTab },
];

export default function Settings() {
  const [active, setActive] = useState('entreprise');
  const Active = TABS.find((t) => t.key === active)?.Comp || EntrepriseTab;

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
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`params-nav-item ${active === t.key ? 'active' : ''}`} onClick={() => setActive(t.key)}>
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
