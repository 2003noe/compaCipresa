import { useState } from 'react';
import AuthLayout from './AuthLayout';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    const { error: resetError } = await resetPassword(email);
    setSubmitting(false);
    if (resetError) { setError(resetError.message); return; }
    setSuccess('Si cette adresse correspond à un compte, un lien de réinitialisation vient d’être envoyé.');
  };

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Recevez un lien de réinitialisation par e-mail.">
      {error && <div className="message error" role="alert">{error}</div>}
      {success && <div className="auth-success" role="status">{success}</div>}
      <form onSubmit={handleSubmit}>
        <Input label="Adresse e-mail" type="email" placeholder="comptable@cipresa.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={submitting} className="w-full">{submitting ? 'Envoi…' : 'Envoyer le lien'}</Button>
      </form>
      <div className="auth-footer"><Link to="/connexion">← Retour à la connexion</Link></div>
    </AuthLayout>
  );
}
