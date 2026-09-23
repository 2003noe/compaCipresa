import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { session, profile, roles, updateProfile } = useAuth();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ prenom: profile?.prenom || '', nom: profile?.nom || '', telephone: profile?.telephone || '', adresse: profile?.adresse || '', ville: profile?.ville || '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const userName = [form.prenom, form.nom].filter(Boolean).join(' ') || 'Utilisateur';
  const initiales = userName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    const { data, error: err } = await supabase.from('profiles').update(form).eq('id', session.user.id).select('*').single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    updateProfile(data);
    setNotice('Profil mis à jour.');
  };

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const ext = file.name.split('.').pop();
    const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: true });
    if (upErr) { setUploading(false); setError(`Envoi impossible : ${upErr.message}`); return; }
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    const { data, error: updErr } = await supabase.from('profiles').update({ photo_url: pub.publicUrl }).eq('id', session.user.id).select('*').single();
    setUploading(false);
    if (updErr) { setError(updErr.message); return; }
    updateProfile(data);
    setNotice('Photo de profil mise à jour.');
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profil utilisateur</h1>
          <p className="page-subtitle">Gérez vos informations personnelles et vos préférences</p>
        </div>
      </div>
      <Card>
        <div className="profile-head">
          <div className="avatar-upload">
            {profile?.photo_url ? <img src={profile.photo_url} alt={userName} className="avatar avatar-large" /> : <div className="avatar avatar-large">{initiales}</div>}
            <button type="button" className="avatar-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Changer la photo">
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadPhoto} />
          </div>
          <div>
            <h2>{userName}</h2>
            <p>{roles.map((r) => r.nom).join(', ') || 'Aucun rôle assigné'}</p>
          </div>
        </div>

        {error && <div className="message error" role="alert">{error}</div>}
        {notice && <div className="message success" role="status">{notice}</div>}

        <div className="grid grid-2">
          <Input label="Prénom" value={form.prenom} onChange={update('prenom')} />
          <Input label="Nom" value={form.nom} onChange={update('nom')} />
          <Input label="E-mail" value={session?.user?.email || ''} readOnly />
          <Input label="Téléphone" placeholder="+225 ..." value={form.telephone} onChange={update('telephone')} />
          <Input label="Adresse" value={form.adresse} onChange={update('adresse')} />
          <Input label="Ville" value={form.ville} onChange={update('ville')} />
        </div>
        <div className="form-actions">
          <Button disabled={saving} onClick={save}>{saving ? 'Enregistrement…' : 'Enregistrer les modifications'}</Button>
        </div>
      </Card>
    </div>
  );
}
