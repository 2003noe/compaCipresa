import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Phone, UserRound } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const nav = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    const [prenom, ...rest] = form.fullName.trim().split(/\s+/);
    const nom = rest.join(' ') || prenom;

    setSubmitting(true);
    const { error: signUpError } = await signUp({ email: form.email, password: form.password, nom, prenom, telephone: form.phone });
    setSubmitting(false);

    if (signUpError) { setError(signUpError.message); return; }

    nav('/connexion', { replace: true, state: { registered: true, registeredEmail: form.email } });
  };

  return (
    <AuthLayout title="Créer un compte" subtitle="Rejoignez CIPRESA Comptabilité" showPreviewSidebar>
      {error && <div className="message error" role="alert">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="auth-form-grid">
          <Input icon={UserRound} label="Nom complet" placeholder="Koffi Kouamé" required value={form.fullName} onChange={update('fullName')} />
          <Input icon={Mail} label="Email professionnel" type="email" placeholder="comptable@cipresa.ci" required value={form.email} onChange={update('email')} />
          <Input icon={Phone} label="Téléphone" placeholder="+225 07 00 00 00 00" value={form.phone} onChange={update('phone')} />
          <PasswordField label="Mot de passe" value={form.password} onChange={update('password')} />
          <PasswordField label="Confirmer le mot de passe" value={form.confirmPassword} onChange={update('confirmPassword')} />
        </div>
        <label className="terms-label"><input type="checkbox" required /><span>J'accepte les conditions d'utilisation et la politique de confidentialité de CIPRESA Consulting SARL</span></label>
        <Button type="submit" disabled={submitting} className="w-full auth-submit">{submitting ? 'Création…' : 'Créer mon compte'}</Button>
      </form>
      <div className="auth-divider" />
      <div className="auth-footer">Déjà un compte ? <Link to="/connexion">Se connecter</Link></div>
      <p className="auth-subtitle" style={{ marginTop: 12, fontSize: 12 }}>Le rôle (Comptable, Gérant…) est attribué par un administrateur après l'inscription.</p>
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange }) {
  return <Input icon={Lock} label={label} type="password" placeholder="••••••••••••" suffix={<span>Afficher</span>} required value={value} onChange={onChange} minLength={6} />;
}
