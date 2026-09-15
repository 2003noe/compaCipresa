import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Leaf, Home, List, BookOpen, Book, Scale, FileText, PieChart, Wallet, Link as LinkIcon, Percent, Building2, Lock, Settings, LogOut, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const items = [
  ['/dashboard', 'Tableau de bord', Home], ['/plan-comptable', 'Plan comptable', List], ['/journal', 'Journal', BookOpen],
  ['/grand-livre', 'Grand livre', Book], ['/balance', 'Balance', Scale], ['/bilan', 'Bilan', FileText],
  ['/compte-resultat', 'Compte de résultat', PieChart], ['/tresorerie', 'Trésorerie', Wallet], ['/rapprochement', 'Rapprochement', LinkIcon],
  ['/tva-taxes', 'TVA & Taxes', Percent], ['/immobilisations', 'Immobilisations', Building2], ['/clotures', 'Clôtures', Lock], ['/parametres', 'Paramètres', Settings]
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const { profile, roles, signOut } = useAuth();

  const userName = profile ? ([profile.prenom, profile.nom].filter(Boolean).join(' ') || 'Utilisateur') : 'Utilisateur';
  const userRole = roles?.[0]?.nom || 'Rôle non défini';

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/connexion', { replace: true, state: { loggedOut: true } });
  };

  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <div className="brand-logo"><Leaf size={16} /></div>
          <div className="brand-text"><strong>CIPRESA</strong><small>Consulting SARL</small></div>
        </div>
        <div className="sidebar-divider" />
        <nav>
          {items.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} /><span className="nav-label">{label}</span>{label === 'Tableau de bord' && <i />}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="user-menu" ref={menuRef}>
        {isOpen && (
          <div className="user-dropdown" role="menu">
            <button type="button" className="user-dropdown-item" onClick={() => navigate('/profil')}>
              <UserRound size={15} /> <span>Mon profil</span>
            </button>
            <button type="button" className="user-dropdown-item logout" onClick={handleLogout}>
              <LogOut size={15} /> <span>Déconnexion</span>
            </button>
          </div>
        )}
        <button type="button" className="user-footer user-footer-button" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
          <div className="avatar">{userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div>
          <div className="user-meta"><strong>{userName}</strong><small>{userRole}</small></div>
        </button>
      </div>
    </aside>
  );
}
