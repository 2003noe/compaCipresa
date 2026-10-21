import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const ROLE_ORDER = ['ADMIN', 'GERANT', 'COMPTABLE', 'CONSULTANT', 'MAGASINIER', 'AGENT_COMMERCIAL'];

export default function Configuration() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [pendingRoleByUser, setPendingRoleByUser] = useState({});

  const load = async () => {
    if (!supabaseConfigured || !isAdmin) { setLoading(false); return; }
    setLoading(true);
    setError('');

    const [profilesRes, userRolesRes, rolesRes] = await Promise.all([
      supabase.from('profiles').select('id,nom,prenom,telephone,actif,created_at').order('created_at'),
      supabase.from('user_roles').select('user_id,role_id,role:roles(id,code,nom)'),
      supabase.from('roles').select('id,code,nom,description').order('nom'),
    ]);

    if (profilesRes.error || userRolesRes.error || rolesRes.error) {
      setError((profilesRes.error || userRolesRes.error || rolesRes.error).message);
      setLoading(false);
      return;
    }

    setUsers(profilesRes.data || []);
    setUserRoles(userRolesRes.data || []);
    setAllRoles(rolesRes.data || []);

    const roleIds = (rolesRes.data || []).map((r) => r.id);
    if (roleIds.length) {
      const { data: rp, error: rpErr } = await supabase.from('role_permissions').select('role_id,permission:permissions(code,nom,description)').in('role_id', roleIds);
      if (rpErr) { setError(rpErr.message); setLoading(false); return; }
      const grouped = {};
      (rp || []).forEach(({ role_id, permission }) => {
        if (!permission?.code) return;
        (grouped[role_id] = grouped[role_id] || []).push(permission);
      });
      setRolePermissions(grouped);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const rolesForUser = (userId) => userRoles.filter((r) => r.user_id === userId && r.role);

  const toggleActif = async (user) => {
    const label = user.actif ? 'désactiver' : 'activer';
    if (!window.confirm(`Confirmer : ${label} le compte de ${user.prenom || 'cet utilisateur'} ?`)) return;
    setSavingUserId(user.id);
    setNotice(''); setError('');
    const { error: updErr } = await supabase.from('profiles').update({ actif: !user.actif }).eq('id', user.id);
    setSavingUserId(null);
    if (updErr) { setError(updErr.message); return; }
    setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, actif: !u.actif } : u)));
    setNotice(`Compte ${label === 'activer' ? 'activé' : 'désactivé'}.`);
  };

  const assignRole = async (userId) => {
    const roleId = pendingRoleByUser[userId];
    if (!roleId) return;
    const role = allRoles.find((r) => r.id === roleId);
    if (!window.confirm(`Attribuer le rôle ${role?.nom || ''} à cet utilisateur ?`)) return;
    setSavingUserId(userId);
    setNotice(''); setError('');
    const { error: insErr } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId });
    setSavingUserId(null);
    if (insErr) { setError(`Attribution refusée : ${insErr.message}`); return; }
    setUserRoles((cur) => [...cur, { user_id: userId, role_id: roleId, role }]);
    setPendingRoleByUser((cur) => ({ ...cur, [userId]: '' }));
    setNotice(`Rôle ${role?.nom || ''} attribué.`);
  };

  const revokeRole = async (userId, roleId, roleName) => {
    if (!window.confirm(`Retirer le rôle ${roleName} à cet utilisateur ?`)) return;
    setSavingUserId(userId);
    setNotice(''); setError('');
    const { error: delErr } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId);
    setSavingUserId(null);
    if (delErr) { setError(`Révocation refusée : ${delErr.message}`); return; }
    setUserRoles((cur) => cur.filter((r) => !(r.user_id === userId && r.role_id === roleId)));
    setNotice(`Rôle ${roleName} retiré.`);
  };

  const sortedRoles = useMemo(() => [...allRoles].sort((a, b) => ROLE_ORDER.indexOf(a.code) - ROLE_ORDER.indexOf(b.code)), [allRoles]);

  if (!isAdmin) {
    return (
      <div className="page-content">
        <div className="page-header"><div><h1 className="page-title">Configuration</h1></div></div>
        <div className="message error" role="alert">Cette page est réservée aux administrateurs.</div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuration</h1>
          <p className="page-subtitle">Gérez les utilisateurs et leurs rôles{loading ? ' · Chargement…' : ''}</p>
        </div>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}
      {notice && <div className="message success" role="status">{notice}</div>}

      <Card>
        <h2 className="bilan-side-title">Utilisateurs &amp; rôles</h2>
        <div className="table-wrap">
          <table className="balance-table">
            <thead><tr><th>Utilisateur</th><th>Contact</th><th>Rôles</th><th>Ajouter un rôle</th><th>Statut</th></tr></thead>
            <tbody>
              {users.map((user) => {
                const assigned = rolesForUser(user.id);
                const assignedIds = assigned.map((r) => r.role_id);
                const assignable = allRoles.filter((r) => !assignedIds.includes(r.id));
                return (
                  <tr key={user.id}>
                    <td><strong>{`${user.prenom || ''} ${user.nom || ''}`.trim() || 'Profil sans nom'}</strong></td>
                    <td>{user.telephone || '—'}</td>
                    <td>
                      <div className="config-role-badges">
                        {assigned.map((r) => (
                          <button key={r.role_id} type="button" className="badge-pill danger config-role-badge" title="Retirer ce rôle" onClick={() => revokeRole(user.id, r.role_id, r.role.nom)}>
                            {r.role.nom} ×
                          </button>
                        ))}
                        {assigned.length === 0 && <span className="page-subtitle">Aucun rôle</span>}
                      </div>
                    </td>
                    <td>
                      <div className="config-add-role">
                        <select className="input select" value={pendingRoleByUser[user.id] || ''} onChange={(e) => setPendingRoleByUser((cur) => ({ ...cur, [user.id]: e.target.value }))} disabled={assignable.length === 0}>
                          <option value="">{assignable.length === 0 ? 'Tous les rôles attribués' : 'Choisir un rôle'}</option>
                          {assignable.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                        </select>
                        <Button size="sm" variant="secondary" disabled={!pendingRoleByUser[user.id] || savingUserId === user.id} onClick={() => assignRole(user.id)}>Attribuer</Button>
                      </div>
                    </td>
                    <td>
                      <button type="button" className={`badge-pill ${user.actif ? 'success' : 'danger'}`} disabled={savingUserId === user.id} onClick={() => toggleActif(user)} style={{ cursor: 'pointer', border: 'none' }}>
                        {user.actif ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && !loading && <tr><td colSpan={5}>Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="bilan-side-title"><ShieldCheck size={15} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Privilèges par rôle</h2>
        <div className="config-role-grid">
          {sortedRoles.map((role) => (
            <div className="config-role-card" key={role.id}>
              <div className="config-role-card-head"><span className="account-cell">{role.code}</span><strong>{role.nom}</strong></div>
              <p className="page-subtitle">{role.description || 'Aucune description'}</p>
              <div className="config-permission-list">
                {(rolePermissions[role.id] || []).length
                  ? rolePermissions[role.id].map((p) => <span key={p.code} title={p.description} className="config-permission-chip">{p.nom}</span>)
                  : <span className="page-subtitle">Aucun privilège enregistré.</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
