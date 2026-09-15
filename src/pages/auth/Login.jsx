import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail, Lock } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function Login() {
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('cipresaRegisteredUser');
    let registeredEmail = '';
    try {
      registeredEmail = saved ? JSON.parse(saved).email || '' : '';
    } catch { /* Ignore malformed local mock data. */ }

    const stateEmail = location.state?.registeredEmail || '';
    setEmail(stateEmail || registeredEmail);
    setMessage(location.state?.registered ? 'Compte créé avec succès. Vous pouvez maintenant vous connecter.' : location.state?.loggedOut ? 'Vous avez été déconnecté avec succès.' : '');
    if (location.state) window.history.replaceState({}, document.title);
  }, [location.state]);

  const handleSubmit = (event) => {
    event.preventDefault();
    sessionStorage.setItem('cipresaAuthenticated', 'true');
    nav('/dashboard');
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace comptable.">
      {message && <div className="auth-success" role="status">{message}</div>}
      <form onSubmit={handleSubmit}>
        <Input icon={Mail} label="Email professionnel" type="email" placeholder="comptable@cipresa.ci" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input icon={Lock} label="Mot de passe" type="password" placeholder="••••••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} suffix={<span>Afficher</span>} />
        <div className="auth-row">
          <label className="check-label"><input type="checkbox" /> <span>Se souvenir de moi</span></label>
          <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
        </div>
        <Button type="submit" className="w-full auth-submit">Se connecter</Button>
      </form>
      <div className="auth-divider" />
      <div className="auth-footer">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></div>
    </AuthLayout>
  );
}
