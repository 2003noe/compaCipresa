import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { session, profile, roles, loading, accessLoading, accessError, signOut } = useAuth();

  if (loading) {
    return (
      <div className="auth-layout">
        <main className="auth-main">
          <div className="auth-card"><p className="auth-subtitle">Chargement…</p></div>
        </main>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/connexion" replace />;
  }

  if (accessLoading) {
    return (
      <div className="auth-layout">
        <main className="auth-main">
          <div className="auth-card"><p className="auth-subtitle">Vérification des accès…</p></div>
        </main>
      </div>
    );
  }

  if (accessError || !profile || profile.actif === false || !roles.length) {
    const message = accessError || !profile
      ? "Votre profil n'est pas accessible avec les policies Supabase actuelles."
      : profile.actif === false
        ? 'Votre compte est désactivé.'
        : "Aucun rôle n'est associé à votre compte. Contactez un administrateur.";

    return (
      <div className="auth-layout">
        <main className="auth-main">
          <div className="auth-card">
            <h1>Accès indisponible</h1>
            <p className="auth-subtitle">{message}</p>
            <button type="button" className="btn btn-secondary" onClick={signOut}>Déconnexion</button>
          </div>
        </main>
      </div>
    );
  }

  return children;
}
