import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Phone, UserRound, ChevronDown } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'Comptable', password: '', confirmPassword: '' });

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      window.alert('Les mots de passe ne correspondent pas.');
      return;
    }

    // Store only non-sensitive account information for this frontend prototype.
    localStorage.setItem('cipresaRegisteredUser', JSON.stringify({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      role: form.role
    }));

    nav('/connexion', { replace: true, state: { registered: true, registeredEmail: form.email } });
  };

  return (
    <AuthLayout title="Créer un compte" subtitle="Rejoignez CIPRESA Comptabilité" showPreviewSidebar>
      <form onSubmit={handleSubmit}>
        <div className="auth-form-grid">
          <Input icon={UserRound} label="Nom complet" placeholder="Koffi Kouamé" required value={form.fullName} onChange={update('fullName')} />
          <Input icon={Mail} label="Email professionnel" type="email" placeholder="comptable@cipresa.ci" required value={form.email} onChange={update('email')} />
          <Input icon={Phone} label="Téléphone" placeholder="+225 07 00 00 00 00" required value={form.phone} onChange={update('phone')} />
          <div className="field">
            <label className="field-label">Poste / Fonction</label>
            <div className="select-like"><span>{form.role}</span><ChevronDown size={14} /></div>
          </div>
          <PasswordField label="Mot de passe" value={form.password} onChange={update('password')} />
          <PasswordField label="Confirmer le mot de passe" value={form.confirmPassword} onChange={update('confirmPassword')} />
        </div>
        <div className="password-strength"><i/><i/><i/><i/><span>Fort</span></div>
        <label className="terms-label"><input type="checkbox" required /><span>J'accepte les conditions d'utilisation et la politique de confidentialité de CIPRESA Consulting SARL</span></label>
        <Button type="submit" className="w-full auth-submit">Créer mon compte</Button>
      </form>
      <div className="auth-divider" />
      <div className="auth-footer">Déjà un compte ? <Link to="/connexion">Se connecter</Link></div>
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange }) {
  return <Input icon={Lock} label={label} type="password" placeholder="••••••••••••" suffix={<span>Afficher</span>} required value={value} onChange={onChange} />;
}
