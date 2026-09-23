import { useState } from 'react';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Toggle from '../../../components/ui/Toggle';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';

export default function SecuriteTab() {
  const { session } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [pwd, setPwd] = useState(''); const [pwd2, setPwd2] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const changePwd = async () => {
    setError(''); setNotice('');
    if (pwd.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (pwd !== pwd2) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setPwd(''); setPwd2(''); setNotice('Mot de passe mis à jour.');
  };

  return (
    <div>
      <h2 className="params-content-title">Sécurité</h2>

      <div className="form-section precise-section">
        <h2>Apparence</h2>
        <div className="settings-row">
          <div><h2>Mode sombre</h2><p>Basculer l'interface entre thème clair et sombre.</p></div>
          <Toggle label={theme === 'dark' ? 'Activé' : 'Désactivé'} checked={theme === 'dark'} onChange={toggleTheme} />
        </div>
      </div>

      <div className="form-section precise-section">
        <h2>Compte</h2>
        <Input label="E-mail" value={session?.user?.email || ''} readOnly />
      </div>

      <div className="form-section precise-section">
        <h2>Changer le mot de passe</h2>
        <div className="grid grid-2">
          <Input label="Nouveau mot de passe" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          <Input label="Confirmer le mot de passe" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
        </div>
        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}
        <div className="form-actions left-actions">
          <Button disabled={saving} onClick={changePwd}>{saving ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}</Button>
        </div>
      </div>
    </div>
  );
}
