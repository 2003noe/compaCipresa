import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, ShieldAlert, Loader2, LogOut, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import '../styles/accessGuard.css';

function BrandHeader() {
  return (
    <header className="access-guard-brand">
      <img src="/images/logo.png" alt="Logo CIPRESA" className="access-guard-logo" />
      <div className="access-guard-brand-text">
        <strong>CIPRESA</strong>
        <small>Consulting SARL · ERP OHADA</small>
      </div>
    </header>
  );
}

export default function ProtectedRoute({ children }) {
  const { session, profile, roles, companies, loading, accessLoading, accessError, signOut } = useAuth();

  // Écran 1 : Chargement initial de la session
  if (loading) {
    return (
      <div className="access-guard-screen" role="status" aria-live="polite">
        <div className="access-guard-container">
          <BrandHeader />
          <main className="access-guard-card">
            <div className="access-guard-icon-wrapper is-loading" aria-hidden="true">
              <span className="access-guard-pulse-ring" />
              <Loader2 size={30} className="access-guard-spin" />
            </div>

            <h1 className="access-guard-title">Chargement de votre espace</h1>
            <p className="access-guard-subtitle">
              Connexion sécurisée et initialisation de l’environnement comptable…
            </p>

            <div className="access-guard-progress-track" aria-hidden="true">
              <div className="access-guard-progress-bar" />
            </div>

            <div className="access-guard-steps">
              <div className="access-guard-step-item is-active">
                <span className="access-guard-step-icon active">
                  <Clock size={15} className="access-guard-spin" />
                </span>
                <span className="access-guard-step-text">Initialisation de la session</span>
                <span className="access-guard-step-tag">En cours</span>
              </div>
              <div className="access-guard-step-item">
                <span className="access-guard-step-icon pending">
                  <Clock size={15} />
                </span>
                <span className="access-guard-step-text">Contrôle des habilitations</span>
                <span className="access-guard-step-tag">En attente</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Redirection si non authentifié
  if (!session) {
    return <Navigate to="/connexion" replace />;
  }

  // Écran 2 : Vérification des accès, profils, entreprises et permissions
  if (accessLoading) {
    return (
      <div className="access-guard-screen" role="status" aria-live="polite">
        <div className="access-guard-container">
          <BrandHeader />
          <main className="access-guard-card">
            <div className="access-guard-icon-wrapper is-checking" aria-hidden="true">
              <span className="access-guard-pulse-ring" />
              <ShieldCheck size={32} className="access-guard-shield-pulse" />
            </div>

            <h1 className="access-guard-title">Vérification des accès</h1>
            <p className="access-guard-subtitle">
              Contrôle de vos habilitations et configuration de votre entreprise…
            </p>

            <div className="access-guard-progress-track" aria-hidden="true">
              <div className="access-guard-progress-bar" />
            </div>

            <div className="access-guard-steps">
              <div className="access-guard-step-item">
                <span className="access-guard-step-icon done">
                  <CheckCircle2 size={15} />
                </span>
                <span className="access-guard-step-text">Session utilisateur active</span>
                <span className="access-guard-step-tag">Validé</span>
              </div>
              <div className="access-guard-step-item is-active">
                <span className="access-guard-step-icon active">
                  <Clock size={15} className="access-guard-spin" />
                </span>
                <span className="access-guard-step-text">Rôles, entreprise &amp; plan comptable</span>
                <span className="access-guard-step-tag">Vérification…</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Écran 3 : Accès indisponible / bloqué / sans entreprise / sans rôle
  if (accessError || !profile || profile.actif === false || !roles.length) {
    const message = accessError || !profile
      ? "Votre profil n'est pas accessible avec les policies de sécurité actuelles."
      : profile.actif === false
        ? 'Votre compte utilisateur a été désactivé par un administrateur.'
        : !companies.length
          ? 'Votre compte attend son rattachement à une entreprise. Demandez à l’administrateur de vous ajouter dans Configuration, puis reconnectez-vous.'
          : "Aucun rôle comptable n'est associé à votre compte. Contactez un administrateur.";

    const handleReload = () => {
      window.location.reload();
    };

    return (
      <div className="access-guard-screen" role="alert" aria-live="assertive">
        <div className="access-guard-container">
          <BrandHeader />
          <main className="access-guard-card">
            <div className="access-guard-icon-wrapper is-error" aria-hidden="true">
              <ShieldAlert size={32} />
            </div>

            <h1 className="access-guard-title">Accès indisponible</h1>
            <p className="access-guard-subtitle">
              Une restriction de sécurité empêche l’accès à votre espace comptable.
            </p>

            <div className="access-guard-alert-box">
              <ShieldAlert size={18} className="access-guard-alert-icon" aria-hidden="true" />
              <div className="access-guard-alert-content">
                <p>{message}</p>
              </div>
            </div>

            <div className="access-guard-actions">
              <button
                type="button"
                className="access-guard-btn access-guard-btn-secondary"
                onClick={handleReload}
                title="Tenter de recharger la page"
              >
                <RefreshCw size={15} />
                Actualiser
              </button>
              <button
                type="button"
                className="access-guard-btn access-guard-btn-primary"
                onClick={signOut}
                title="Se déconnecter de la session courante"
              >
                <LogOut size={15} />
                Déconnexion
              </button>
            </div>

            <p className="access-guard-help">
              Besoin d’aide ? Contactez l’administrateur de votre entreprise CIPRESA.
            </p>
          </main>
        </div>
      </div>
    );
  }

  return children;
}
