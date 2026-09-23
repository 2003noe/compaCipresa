import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../context/AuthContext';

export default function UtilisateursTab() {
  const nav = useNavigate();
  const { hasRole } = useAuth();

  return (
    <div>
      <h2 className="params-content-title">Utilisateurs</h2>
      <div className="empty-state">
        <Users size={28} />
        <p>La gestion des comptes utilisateurs et l'attribution des rôles se fait sur la page Configuration.</p>
        {hasRole('ADMIN') ? (
          <Button onClick={() => nav('/configuration')}>Ouvrir la gestion des utilisateurs</Button>
        ) : (
          <p className="page-subtitle">Réservé aux administrateurs.</p>
        )}
      </div>
    </div>
  );
}
