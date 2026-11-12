import { useState } from 'react';
import Card from '../../components/ui/Card';
import EntrepriseTab from './tabs/EntrepriseTab';
import ExercicesTab from './tabs/ExercicesTab';
import JournauxTab from './tabs/JournauxTab';
import UtilisateursTab from './tabs/UtilisateursTab';
import IntegrationsTab from './tabs/IntegrationsTab';
import SecuriteTab from './tabs/SecuriteTab';
import AmortissementsTab from './tabs/AmortissementsTab';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { key: 'entreprise',      label: 'Entreprise',       Comp: EntrepriseTab },
  { key: 'exercices',       label: 'Exercices',         Comp: ExercicesTab },
  { key: 'journaux',        label: 'Journaux',          Comp: JournauxTab },
  { key: 'amortissements',  label: 'Amortissements',   Comp: AmortissementsTab },
  { key: 'utilisateurs',    label: 'Utilisateurs',      Comp: UtilisateursTab },
  { key: 'integrations',    label: 'Intégrations',      Comp: IntegrationsTab },
  { key: 'securite',        label: 'Sécurité',          Comp: SecuriteTab },
];

export default function Settings() {
  const { can, hasRole } = useAuth();
  const [active, setActive] = useState('entreprise');

  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'utilisateurs') return can('CONFIG_USERS');
    if (['entreprise', 'journaux', 'amortissements'].includes(tab.key))
      return can('CONFIG_COMPANY') || can('COMPTA_READ');
    if (['integrations', 'securite'].includes(tab.key)) return can('CONFIG_COMPANY');
    return can('COMPTA_READ') || can('COMPTA_EXERCISE_EDIT') || hasRole('ADMIN');
  });

  const safeActive = visibleTabs.some((tab) => tab.key === active)
    ? active
    : (visibleTabs[0]?.key || 'exercices');
  const Active = visibleTabs.find((t) => t.key === safeActive)?.Comp || ExercicesTab;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <p className="page-subtitle">Un environnement comptable adapté à votre entreprise.</p>
        </div>
      </div>

      {/* Navigation horizontale sur mobile */}
      <div className="params-tabs-mobile">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`params-tab-pill ${safeActive === t.key ? 'active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="params-layout">
        {/* Navigation latérale (desktop) */}
        <Card className="params-nav params-nav-desktop">
          <div className="params-nav-section-label">VOTRE ESPACE</div>
          {visibleTabs.slice(0, 4).map((t) => (
            <button
              key={t.key}
              type="button"
              className={`params-nav-item ${safeActive === t.key ? 'active' : ''}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
          <div className="params-nav-section-label" style={{ marginTop: 12 }}>CONFIGURATION</div>
          {visibleTabs.slice(4).map((t) => (
            <button
              key={t.key}
              type="button"
              className={`params-nav-item ${safeActive === t.key ? 'active' : ''}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
            </button>
          ))}
          <p className="page-subtitle" style={{ fontSize: 11, margin: '12px 10px 0', lineHeight: 1.4 }}>
            Les réglages s'appliquent à l'entreprise active.
          </p>
        </Card>

        {/* Contenu de l'onglet */}
        <Card className="params-content-card">
          <Active />
        </Card>
      </div>
    </div>
  );
}
