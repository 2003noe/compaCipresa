import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, List, BookOpen, Book, Scale, FileText, PieChart, Wallet, ClipboardList, Building2, Lock, Settings, LogOut, UserRound, CircleHelp, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PERMISSIONS, canAccessRoute } from '../../lib/rbac';

const items = [
  ['/dashboard', 'Tableau de bord', Home, ROUTE_PERMISSIONS.dashboard], ['/plan-comptable', 'Plan comptable', List, ROUTE_PERMISSIONS.chart], ['/journal', 'Journal', BookOpen, ROUTE_PERMISSIONS.journal],
  ['/grand-livre', 'Grand livre', Book, ROUTE_PERMISSIONS.ledger], ['/balance', 'Balance', Scale, ROUTE_PERMISSIONS.reports], ['/bilan', 'Bilan', FileText, ROUTE_PERMISSIONS.reports],
  ['/compte-resultat', 'Compte de résultat', PieChart, ROUTE_PERMISSIONS.reports], ['/tresorerie', 'Trésorerie', Wallet, ROUTE_PERMISSIONS.treasury],
  ['/livre-inventaire', "Livre d'inventaire", ClipboardList, ROUTE_PERMISSIONS.inventory], ['/immobilisations', 'Immobilisations', Building2, ROUTE_PERMISSIONS.assets],
  ['/sync-ventes', 'Synchro Ventes', RefreshCw, ROUTE_PERMISSIONS.sales],
  ['/clotures', 'Clôtures', Lock, ROUTE_PERMISSIONS.closures], ['/parametres', 'Paramètres', Settings, ROUTE_PERMISSIONS.settings]
];

export default function Sidebar({ isOpen, onClose }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { profile, roles, signOut, can, hasRole } = useAuth();
  const activeAccess = { can, hasRole };
  const canViewCompanyAnalytics = canAccessRoute(ROUTE_PERMISSIONS.analytics, activeAccess);

  const userName = profile ? ([profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Utilisateur') : 'Utilisateur';
  const userRole = roles?.[0]?.nom || 'Rôle non défini';

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/connexion', { replace: true, state: { loggedOut: true } });
  };

  // Ferme la sidebar mobile lors d'un clic sur un lien
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-mobile-open' : ''}`} style={{ height: '100vh', position: 'fixed' }}>
      {/* Bouton de fermeture mobile */}
      <button
        type="button"
        className="sidebar-close-btn"
        onClick={onClose}
        aria-label="Fermer le menu"
      >
        <X size={18} />
      </button>

      <div>
        <div className="brand">
          <img src="/images/logo.png" alt="Logo" className="brand-image" style={{ width: '2rem', height: '2rem', objectFit: 'cover' }} />
          <div className="brand-text"><strong>CIPRESA</strong><small>Consulting SARL</small></div>
        </div>
        <div className="sidebar-divider" />
        <nav>
          {items.filter(([, , , access]) => canAccessRoute(access, activeAccess)).map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} /><span className="nav-label">{label}</span>{label === 'Tableau de bord' && <i />}
            </NavLink>
          ))}
          {canViewCompanyAnalytics && (
            <NavLink to="/administration/entreprises" onClick={handleNavClick} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Building2 size={16} /><span className="nav-label">Vue entreprises</span>
            </NavLink>
          )}
        </nav>
      </div>

      <div className="user-menu" ref={menuRef}>
        {menuOpen && (
          <div className="user-dropdown" role="menu">
            <NavLink className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} onClick={() => { navigate('/faq'); handleNavClick(); }}>
              <CircleHelp size={16} /><span className="nav-label">FAQ &amp; Aide</span>
            </NavLink>

            <button type="button" className="user-dropdown-item" onClick={() => { navigate('/profil'); handleNavClick(); }}>
              <UserRound size={15} /> <span>Mon profil</span>
            </button>
            <button type="button" className="user-dropdown-item logout" onClick={handleLogout}>
              <LogOut size={15} /> <span>Déconnexion</span>
            </button>
          </div>
        )}
        <button type="button" className="user-footer user-footer-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
          {profile?.photo_url ? <img src={profile.photo_url} alt={userName} className="avatar" style={{ objectFit: 'cover' }} /> : <div className="avatar">{userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>}
          <div className="user-meta"><strong>{userName}</strong><small>{userRole}</small></div>
        </button>
      </div>
    </aside>
  );
}
