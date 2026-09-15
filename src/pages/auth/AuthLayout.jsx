import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, CircleUserRound, Home, List, BookOpen, BookMarked, Scale, FileText, PieChart, WalletCards, Link2, Percent, Building2, LockKeyhole, Settings, Leaf, Mail, Lock, Monitor } from 'lucide-react';

const navigation = [
  ['Tableau de bord', Home], ['Plan comptable', List], ['Journal', BookOpen], ['Grand livre', Monitor],
  ['Balance', Scale], ['Bilan', FileText], ['Compte de résultat', PieChart], ['Trésorerie', WalletCards],
  ['Rapprochement', Link2], ['TVA & Taxes', Percent], ['Immobilisations', Building2], ['Clôtures', LockKeyhole], ['Paramètres', Settings],
];

function Brand({ light = false }) {
  return (
    <div className={`auth-branding ${light ? 'auth-branding-light' : ''}`}>
      <div className="brand-mark"><Leaf size={17} strokeWidth={2.4} /></div>
      <div>
        <strong>CIPRESA</strong>
        <small>Consulting SARL</small>
      </div>
    </div>
  );
}

function MarketingPanel() {
  return (
    <aside className="auth-marketing">
      <Brand light />
      <div className="auth-marketing-copy">
        <h2>Gestion Comptable Professionnelle.</h2>
        <p>La solution ERP puissante et intuitive conçue spécifiquement pour la rigueur des exigences d'audits et de reporting OHADA.</p>
      </div>
      <div className="auth-marketing-footer">
        <div className="auth-metrics">
          <div><strong>100%</strong><span>Conforme SYSCOHADA</span></div>
          <div><strong>&lt; 1s</strong><span>Temps de validation</span></div>
        </div>
        <p>© 2025 CIPRESA Consulting SARL — Tous droits réservés.</p>
      </div>
    </aside>
  );
}

function PreviewSidebar() {
  const location = useLocation();
  return (
    <aside className="auth-preview-sidebar">
      <Brand light />
      <div className="preview-divider" />
      <nav>
        {navigation.map(([label, Icon]) => {
          const active = (location.pathname === '/inscription' && label === 'Journal');
          return (
            <div key={label} className={`preview-nav-item ${active ? 'active' : ''}`}>
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
              {active && <i />}
            </div>
          );
        })}
      </nav>
      <div className="preview-user">
        <div className="preview-avatar"><CircleUserRound size={22} /></div>
        <div><strong>Jean-Paul KOFFI</strong><small>Comptable Principal</small></div>
      </div>
    </aside>
  );
}

export default function AuthLayout({ title, subtitle, children, showPreviewSidebar = false }) {
  return (
    <div className={`auth-layout ${showPreviewSidebar ? 'with-preview' : ''}`}>
      <MarketingPanel />
      <main className="auth-main">
        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
        </div>
      </main>
      {showPreviewSidebar && <PreviewSidebar />}
    </div>
  );
}

export { Mail, Lock, ChevronDown };
