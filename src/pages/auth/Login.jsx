import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) nav('/dashboard', { replace: true });
  }, [loading, session, nav]);

  useEffect(() => {
    const stateEmail = location.state?.registeredEmail || '';
    if (stateEmail) setEmail(stateEmail);
    setMessage(location.state?.registered ? 'Compte créé avec succès. Vous pouvez maintenant vous connecter.' : location.state?.loggedOut ? 'Vous avez été déconnecté avec succès.' : '');
    if (location.state) window.history.replaceState({}, document.title);
  }, [location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: signInError } = await signIn(email, password);
    setSubmitting(false);
    if (signInError) { setError(signInError.message); return; }
    nav('/dashboard', { replace: true });
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace comptable.">
      {message && <div className="auth-success" role="status">{message}</div>}
      {error && <div className="message error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <Input icon={Mail} label="Email professionnel" type="email" placeholder="comptable@cipresa.ci" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input icon={Lock} label="Mot de passe" type="password" placeholder="••••••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} suffix={<span>Afficher</span>} />
        <div className="auth-row">
          <label className="check-label"><input type="checkbox" /> <span>Se souvenir de moi</span></label>
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>
        <Button type="submit" disabled={submitting} className="w-full auth-submit">{submitting ? 'Connexion…' : 'Se connecter'}</Button>
      </form>
      <div className="auth-divider" />
      <div className="auth-footer">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></div>
    </AuthLayout>
  );
}
