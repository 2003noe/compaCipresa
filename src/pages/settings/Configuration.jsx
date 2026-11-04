import { useEffect, useMemo, useState } from 'react';
import { Building2, ShieldCheck, UsersRound } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { confirmAction, toast } from '../../lib/notifications';

const ROLE_ORDER = ['ADMIN', 'GERANT', 'COMPTABLE', 'CONSULTANT', 'MAGASINIER', 'AGENT_COMMERCIAL'];

export default function Configuration() {
  const { hasRole, companies, selectedEntrepriseId, selectedEntreprise } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [managedMemberships, setManagedMemberships] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [rolePermissions, setRolePermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingUserId, setSavingUserId] = useState(null);
  const [pendingRoleByUser, setPendingRoleByUser] = useState({});
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [unassignedCompanyUsers, setUnassignedCompanyUsers] = useState([]);
  const [loadingUnassignedUsers, setLoadingUnassignedUsers] = useState(false);
  const [newMemberRole, setNewMemberRole] = useState("");
  const [newMemberEntrepriseId, setNewMemberEntrepriseId] = useState(selectedEntrepriseId || "");
  const [pendingCompanyRole, setPendingCompanyRole] = useState({});
  const adminCompanies = companies.filter((company) => company.roles?.some((role) => role.code === "ADMIN"));

  useEffect(() => { if (!newMemberEntrepriseId || !adminCompanies.some((company) => company.id === newMemberEntrepriseId)) setNewMemberEntrepriseId(selectedEntrepriseId || adminCompanies[0]?.id || ""); }, [selectedEntrepriseId, companies]);

  useEffect(() => {
    setNewMemberEmail('');
    setUnassignedCompanyUsers([]);
    if (!isAdmin || !newMemberEntrepriseId) return undefined;

    let active = true;
    setLoadingUnassignedUsers(true);
    supabase.rpc('list_unassigned_company_users', { p_entreprise_id: newMemberEntrepriseId }).then(({ data, error: listError }) => {
      if (!active) return;
      if (listError) {
        setError(`Impossible de charger les comptes disponibles : ${listError.message}`);
        setUnassignedCompanyUsers([]);
      } else {
        setUnassignedCompanyUsers(data || []);
      }
      setLoadingUnassignedUsers(false);
    });

    return () => { active = false; };
  }, [isAdmin, newMemberEntrepriseId]);

  const load = async () => {
    if (!supabaseConfigured || !isAdmin || !selectedEntrepriseId) { setLoading(false); return; }
    setLoading(true);
    setError('');

    const [userRolesRes, rolesRes, managedMembershipsRes] = await Promise.all([
      supabase.from('entreprise_utilisateurs').select('entreprise_id,user_id,role_id,role:roles(id,code,nom)').eq('entreprise_id', selectedEntrepriseId),
      supabase.from('roles').select('id,code,nom,description').order('nom'),
      supabase.rpc('list_admin_company_memberships'),
    ]);

    if (userRolesRes.error || rolesRes.error || managedMembershipsRes.error) {
      setError((userRolesRes.error || rolesRes.error || managedMembershipsRes.error).message);
      setLoading(false);
      return;
    }

    const memberIds = [...new Set((userRolesRes.data || []).map((r) => r.user_id))];
    const profilesRes = memberIds.length
      ? await supabase.from('profiles').select('id,nom,prenom,telephone,actif,created_at').in('id', memberIds).order('created_at')
      : { data: [], error: null };
    if (profilesRes.error) { setError(profilesRes.error.message); setLoading(false); return; }
    setUsers(profilesRes.data || []);
    setUserRoles(userRolesRes.data || []);
    setManagedMemberships(managedMembershipsRes.data || []);
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

  useEffect(() => { load(); }, [isAdmin, selectedEntrepriseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const rolesForUser = (userId) => userRoles.filter((r) => r.user_id === userId && r.role);
  const announceSuccess = (message) => toast.success(message);

  const toggleActif = async (user) => {
    const label = user.actif ? 'désactiver' : 'activer';
    if (!await confirmAction({ title: `${label === 'activer' ? 'Activer' : 'Désactiver'} ce compte ?`, text: `Compte de ${user.prenom || 'cet utilisateur'}.`, confirmText: label === 'activer' ? 'Activer le compte' : 'Désactiver le compte', danger: label !== 'activer' })) return;
    setSavingUserId(user.id);
    setError('');
    const { error: updErr } = await supabase.from('profiles').update({ actif: !user.actif }).eq('id', user.id);
    setSavingUserId(null);
    if (updErr) { setError(updErr.message); return; }
    setUsers((cur) => cur.map((u) => (u.id === user.id ? { ...u, actif: !u.actif } : u)));
    announceSuccess(`Compte ${label === 'activer' ? 'activé' : 'désactivé'}.`);
  };

  const assignRole = async (userId) => {
    const roleId = pendingRoleByUser[userId];
    if (!roleId) return;
    const role = allRoles.find((r) => r.id === roleId);
    if (!await confirmAction({ title: 'Attribuer ce rôle ?', text: role?.nom || '', confirmText: 'Attribuer' })) return;
    setSavingUserId(userId);
    setError('');
    const { error: insErr } = await supabase.from('entreprise_utilisateurs').insert({ entreprise_id: selectedEntrepriseId, user_id: userId, role_id: roleId });
    setSavingUserId(null);
    if (insErr) { setError(`Attribution refusée : ${insErr.message}`); return; }
    setUserRoles((cur) => [...cur, { user_id: userId, role_id: roleId, role }]);
    setPendingRoleByUser((cur) => ({ ...cur, [userId]: '' }));
    announceSuccess(`Rôle ${role?.nom || ''} attribué.`);
  };

  const revokeRole = async (userId, roleId, roleName) => {
    if (!await confirmAction({ title: 'Retirer ce rôle ?', text: roleName, confirmText: 'Retirer le rôle', danger: true })) return;
    setSavingUserId(userId);
    setError('');
    const { error: delErr } = await supabase.from('entreprise_utilisateurs').delete().eq('entreprise_id', selectedEntrepriseId).eq('user_id', userId).eq('role_id', roleId);
    setSavingUserId(null);
    if (delErr) { setError(`Révocation refusée : ${delErr.message}`); return; }
    setUserRoles((cur) => cur.filter((r) => !(r.user_id === userId && r.role_id === roleId)));
    announceSuccess(`Rôle ${roleName} retiré.`);
  };

  const addCompanyRole = async (user, entrepriseId) => {
    const key = `${user.id}:${entrepriseId}`;
    const roleCode = pendingCompanyRole[key];
    if (!roleCode) return;
    const { error: addError } = await supabase.rpc('add_user_company_role', {
      p_user_id: user.id,
      p_entreprise_id: entrepriseId,
      p_role_code: roleCode,
    });
    if (addError) { setError(addError.message); return; }
    setPendingCompanyRole((current) => ({ ...current, [key]: '' }));
    announceSuccess(`Rôle ${allRoles.find((role) => role.code === roleCode)?.nom || roleCode} ajouté à ${user.prenom || user.nom || 'l’utilisateur'} dans ${adminCompanies.find((company) => company.id === entrepriseId)?.nom || 'l’entreprise'}.`);
    await load();
  };

  const removeCompanyRole = async (user, entrepriseId, role) => {
    if (!await confirmAction({ title: 'Retirer ce rôle ?', text: `${role.role_nom} · ${role.entreprise_nom}`, confirmText: 'Retirer le rôle', danger: true })) return;
    const { error: removeError } = await supabase.rpc('remove_user_company_role', {
      p_user_id: user.id,
      p_entreprise_id: entrepriseId,
      p_role_id: role.role_id,
    });
    if (removeError) { setError(removeError.message); return; }
    announceSuccess(`Rôle ${role.role_nom} retiré dans ${role.entreprise_nom}.`);
    await load();
  };

  const removeFromCompany = async (user, company, roles) => {
    if (!await confirmAction({ title: 'Retirer cet utilisateur de l’entreprise ?', text: `${user.prenom || 'Cet utilisateur'} · ${company.nom} · ${roles.length} rôle(s) seront retirés.`, confirmText: 'Retirer de l’entreprise', danger: true })) return;
    const { error: removeError } = await supabase.rpc('remove_user_from_company', {
      p_user_id: user.id,
      p_entreprise_id: company.id,
    });
    if (removeError) { setError(removeError.message); return; }
    announceSuccess(`${user.prenom || 'L’utilisateur'} a été retiré de ${company.nom}.`);
    await load();
  };

  const addExistingUser = async () => {
    if (!newMemberEmail.trim() || !newMemberRole) return;
    setSavingUserId("new"); setError("");
    const role = allRoles.find((r) => r.code === newMemberRole);
    const { error: addError } = await supabase.rpc("add_user_to_company", {
      p_email: newMemberEmail.trim(),
      p_role_code: newMemberRole,
      p_entreprise_id: newMemberEntrepriseId,
    });
    setSavingUserId(null);
    if (addError) { setError(addError.message); return; }
    const assignedEmail = newMemberEmail.trim().toLocaleLowerCase('fr');
    setUnassignedCompanyUsers((current) => current.filter((user) => user.email?.toLocaleLowerCase('fr') !== assignedEmail));
    setNewMemberEmail(""); setNewMemberRole("");
    const targetCompany = adminCompanies.find((company) => company.id === newMemberEntrepriseId);
    announceSuccess(`Utilisateur ajouté à ${targetCompany?.nom || "l’entreprise sélectionnée"} avec le rôle ${role?.nom || newMemberRole}.`);
    await load();
  };

  const sortedRoles = useMemo(() => [...allRoles].sort((a, b) => ROLE_ORDER.indexOf(a.code) - ROLE_ORDER.indexOf(b.code)), [allRoles]);

  if (!isAdmin) {
    return (
      <div className="page-content configuration-page">
        <div className="page-header"><div><h1 className="page-title">Configuration</h1></div></div>
        <div className="message error" role="alert">Cette page est réservée aux administrateurs.</div>
      </div>
    );
  }

  return (
    <div className="page-content configuration-page">
      <div className="page-header configuration-hero">
        <div>
          <span className="analytics-eyebrow">GESTION DE L’ÉQUIPE</span>
          <h1 className="page-title"><UsersRound size={25} /> Configuration</h1>
          <p className="page-subtitle">Gérez les accès, les entreprises et les rôles de votre équipe{loading ? ' · Chargement…' : ''}</p>
        </div>
        <span className="configuration-company-pill"><Building2 size={15} />{selectedEntreprise?.nom || 'Entreprise active'}</span>
      </div>

      {error && <div className="message error" role="alert">{error}</div>}

      <Card className="configuration-users-card">
        <div className="configuration-card-heading"><div className="configuration-heading-icon"><UsersRound size={19} /></div><div><h2>Utilisateurs &amp; rôles</h2><p>Associez un compte inscrit et attribuez-lui un rôle dans une entreprise.</p></div></div>
        <div className="config-add-role config-member-form">
          <select className="input select" value={newMemberEmail} onChange={(e) => setNewMemberEmail(e.target.value)} disabled={loadingUnassignedUsers || unassignedCompanyUsers.length === 0} aria-label="Compte inscrit sans rôle dans l’entreprise">
            <option value="">{loadingUnassignedUsers ? 'Chargement des comptes…' : unassignedCompanyUsers.length ? 'Choisir un compte inscrit sans rôle' : 'Aucun compte disponible pour cette entreprise'}</option>
            {unassignedCompanyUsers.map((user) => {
              const fullName = [user.prenom, user.nom].filter(Boolean).join(' ');
              return <option key={user.user_id} value={user.email}>{fullName ? `${user.email} · ${fullName}` : user.email}</option>;
            })}
          </select>
          <select className="input select" value={newMemberEntrepriseId} onChange={(e) => setNewMemberEntrepriseId(e.target.value)} disabled={adminCompanies.length === 0} aria-label="Entreprise à laquelle rattacher l’utilisateur">
            {adminCompanies.map((company) => <option key={company.id} value={company.id}>{company.nom}</option>)}
          </select>
          <select className="input select" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)}>
            <option value="">Attribuer un rôle</option>
            {sortedRoles.map((role) => <option key={role.id} value={role.code}>{role.nom}</option>)}
          </select>
          <Button size="sm" disabled={!newMemberEmail || !newMemberRole || !newMemberEntrepriseId || loadingUnassignedUsers || savingUserId === "new"} onClick={addExistingUser}>{savingUserId === "new" ? "Ajout…" : "Ajouter à l’entreprise"}</Button>
        </div>
        <p className="configuration-helper">La liste affiche les comptes inscrits et actifs qui n’ont encore aucun rôle dans l’entreprise choisie. Après l’association, l’utilisateur pourra se connecter à cette entreprise avec le rôle attribué.</p>
        <div className="table-wrap configuration-table-wrap">
          <table className="balance-table configuration-table">
            <thead><tr><th>Utilisateur</th><th>Contact</th><th>Rôles dans l’entreprise active</th><th>Autres entreprises et rôles</th><th>Ajouter un rôle ici</th><th>Statut</th></tr></thead>
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
                      <details className="config-company-memberships">
                        <summary>Gérer les entreprises ({new Set(managedMemberships.filter((membership) => membership.membre_id === user.id).map((membership) => membership.entreprise_id)).size})</summary>
                        <div className="config-company-membership-list">
                          {adminCompanies.map((company) => {
                            const companyRoles = managedMemberships.filter((membership) => membership.membre_id === user.id && membership.entreprise_id === company.id);
                            const companyRoleIds = companyRoles.map((membership) => membership.role_id);
                            const fieldKey = `${user.id}:${company.id}`;
                            const availableRoles = allRoles.filter((role) => !companyRoleIds.includes(role.id));
                            return <div key={company.id} className="config-company-membership">
                              <div className="config-company-membership-heading"><strong>{company.nom}</strong>{companyRoles.length > 0 && <button type="button" className="text-button danger-text" onClick={() => removeFromCompany(user, company, companyRoles)}>Retirer de l’entreprise</button>}</div>
                              {companyRoles.length > 0
                                ? <div className="config-role-badges">{companyRoles.map((membership) => <button key={membership.role_id} type="button" className="badge-pill danger config-role-badge" title={`Retirer le rôle ${membership.role_nom}`} onClick={() => removeCompanyRole(user, company.id, membership)}>{membership.role_nom} ×</button>)}</div>
                                : <span className="page-subtitle">Non rattaché</span>}
                              <div className="config-add-role"><select className="input select" value={pendingCompanyRole[fieldKey] || ''} onChange={(event) => setPendingCompanyRole((current) => ({ ...current, [fieldKey]: event.target.value }))} disabled={availableRoles.length === 0}><option value="">{availableRoles.length ? 'Ajouter un rôle' : 'Tous les rôles attribués'}</option>{availableRoles.map((role) => <option key={role.id} value={role.code}>{role.nom}</option>)}</select><Button size="sm" variant="secondary" disabled={!pendingCompanyRole[fieldKey]} onClick={() => addCompanyRole(user, company.id)}>Ajouter</Button></div>
                            </div>;
                          })}
                        </div>
                      </details>
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
              {users.length === 0 && !loading && <tr><td colSpan={6}>Aucun utilisateur.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="configuration-permissions-card">
        <div className="configuration-card-heading"><div className="configuration-heading-icon permission-icon"><ShieldCheck size={19} /></div><div><h2>Privilèges par rôle</h2><p>Consultez les droits associés aux différents profils.</p></div></div>
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
