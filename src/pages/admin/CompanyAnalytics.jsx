import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Building2, RefreshCw, Users, UserCheck } from 'lucide-react';
import Card from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const formatDate = (value) => new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(value));

export default function CompanyAnalytics() {
  const { companies, selectedEntrepriseId, switchEntreprise } = useAuth();
  const navigate = useNavigate();
  const canView = companies.some((company) => company.roles?.some((role) => role.code === 'ADMIN'));
  const adminCompanies = companies.filter((company) => company.roles?.some((role) => role.code === 'ADMIN'));
  const [companyStats, setCompanyStats] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [managingCompanyId, setManagingCompanyId] = useState('');

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [statsResult, eventsResult] = await Promise.all([
      supabase.rpc('admin_company_analytics'),
      supabase.rpc('admin_company_activity', { p_limit: 80 }),
    ]);
    const loadError = statsResult.error || eventsResult.error;
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
      setCompanyStats(statsResult.data || []);
      setEvents(eventsResult.data || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) loadData(true);
  }, [canView, loadData]);

  useEffect(() => {
    if (!canView || !companyStats.length) return undefined;
    const channels = companyStats.map((company) => supabase
      .channel(`admin-activity-${company.entreprise_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'activity_events',
        filter: `entreprise_id=eq.${company.entreprise_id}`,
      }, () => loadData(false))
      .subscribe());
    return () => { channels.forEach((channel) => supabase.removeChannel(channel)); };
  }, [canView, companyStats, loadData]);

  const totals = useMemo(() => companyStats.reduce((result, company) => ({
    users: result.users + Number(company.utilisateurs || 0),
    active: result.active + Number(company.utilisateurs_actifs || 0),
  }), { users: 0, active: 0 }), [companyStats]);
  const maxUsers = Math.max(1, ...companyStats.map((company) => Number(company.utilisateurs || 0)));

  const manageCompanyUsers = async (companyId) => {
    setManagingCompanyId(companyId);
    const { error: switchError } = await switchEntreprise(companyId);
    setManagingCompanyId('');
    if (switchError) {
      setError(`Impossible de sélectionner l’entreprise : ${switchError.message}`);
      return;
    }
    navigate('/configuration');
  };

  if (!canView) return <Navigate to="/dashboard" replace />;

  return (
    <div className="page-content company-analytics-page">
      <header className="page-header company-analytics-header">
        <div>
          <span className="analytics-eyebrow">ESPACE ADMINISTRATEUR</span>
          <h1 className="page-title"><Building2 size={25} /> Vue des entreprises</h1>
          <p className="page-subtitle">Pilotez vos équipes et suivez l’activité des entreprises que vous administrez.</p>
        </div>
        <div className="analytics-header-actions">
          <button className="manage-users-primary" type="button" disabled={Boolean(managingCompanyId)} onClick={() => manageCompanyUsers((adminCompanies.find((company) => company.id === selectedEntrepriseId) || adminCompanies[0]).id)}>
            <Users size={16} /> Gérer les utilisateurs <ArrowUpRight size={15} />
          </button>
          <button className="analytics-refresh" type="button" onClick={() => loadData(true)} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} /> Actualiser
          </button>
        </div>
      </header>

      {error && <div className="message error" role="alert">Impossible de charger les statistiques : {error}</div>}

      <section className="analytics-kpis" aria-label="Statistiques globales">
        <Card className="analytics-kpi"><span className="analytics-kpi-icon"><Building2 size={18} /></span><div><small>Entreprises administrées</small><strong>{companyStats.length}</strong></div></Card>
        <Card className="analytics-kpi"><span className="analytics-kpi-icon"><Users size={18} /></span><div><small>Associations utilisateur-entreprise</small><strong>{totals.users}</strong></div></Card>
        <Card className="analytics-kpi"><span className="analytics-kpi-icon"><UserCheck size={18} /></span><div><small>Utilisateurs actifs associés</small><strong>{totals.active}</strong></div></Card>
      </section>

      <Card className="analytics-company-card">
        <div className="analytics-section-heading">
          <div><h2>Utilisateurs par entreprise</h2><p>Répartition des utilisateurs actifs et désactivés, avec les rôles présents dans chaque entreprise.</p></div>
          {lastUpdated && <small>Mis à jour à {lastUpdated.toLocaleTimeString('fr-FR')}</small>}
        </div>
        {loading && !companyStats.length ? <p className="page-subtitle">Chargement des entreprises…</p> : companyStats.length ? (
          <div className="company-stats-list">
            {companyStats.map((company) => {
              const users = Number(company.utilisateurs || 0);
              const active = Number(company.utilisateurs_actifs || 0);
              const pct = users ? Math.round((active / users) * 100) : 0;
              return (
                <article className="company-stat-row" key={company.entreprise_id}>
                  <div className="company-stat-title">
                    <div><strong>{company.entreprise_nom}</strong><span>{users} utilisateur{users > 1 ? 's' : ''}</span></div>
                    <button type="button" className="manage-company-users" disabled={managingCompanyId === company.entreprise_id} onClick={() => manageCompanyUsers(company.entreprise_id)}>
                      <Users size={14} /> {managingCompanyId === company.entreprise_id ? 'Ouverture…' : 'Gérer les utilisateurs'} <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="company-bar-track" role="img" aria-label={`${active} actifs sur ${users} utilisateurs`}>
                    <div className="company-bar-active" style={{ width: `${(users / maxUsers) * 100}%` }}>
                      <i style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="company-stat-meta"><span>{active} actifs · {Math.max(0, users - active)} désactivés</span><span>{pct}% actifs</span></div>
                  <div className="company-role-list">
                    {(company.roles || []).map((role) => (
                      <span key={role.code} className="company-role-chip">{role.nom}: {role.utilisateurs}</span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="page-subtitle">Aucune entreprise administrée n’est disponible.</p>}
        <div className="company-chart-legend"><span><i className="legend-active" /> Utilisateurs actifs</span><span><i className="legend-inactive" /> Utilisateurs désactivés</span></div>
      </Card>

      <Card className="analytics-activity-card">
        <div className="analytics-section-heading">
          <div><h2><Activity size={19} /> Activité en direct</h2><p>Consultations de pages, sans contenu saisi ni données comptables.</p></div>
          <span className="live-status"><i /> En direct</span>
        </div>
        {!events.length ? <p className="page-subtitle">Aucune activité enregistrée pour le moment. Les visites de pages apparaîtront ici.</p> : (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead><tr><th>Heure</th><th>Entreprise</th><th>Utilisateur</th><th>Page consultée</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id}>
                  <td>{formatDate(event.created_at)}</td>
                  <td>{event.entreprise_nom}</td>
                  <td>{event.utilisateur}</td>
                  <td><code>{event.page_path}</code></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
