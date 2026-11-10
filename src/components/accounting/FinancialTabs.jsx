import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/balance', label: 'Balance générale' },
  { to: '/bilan', label: 'Bilan comptable' },
  { to: '/compte-resultat', label: 'Compte de résultat' },
  { to: '/livre-inventaire', label: "Livre d'inventaire" },
];

export default function FinancialTabs() {
  return (
    <nav className="financial-tabs-nav" aria-label="Rapports financiers">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `financial-tab-item ${isActive ? 'active' : ''}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

