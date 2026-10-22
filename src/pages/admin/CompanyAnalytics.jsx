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
  const [eventStats, setEventStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [managingCompanyId, setManagingCompanyId] = useState('');

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    const [statsResult, eventsResult, eventStatsResult] = await Promise.all([
      supabase.rpc('admin_company_analytics'),
      supabase.rpc('admin_company_event_feed', { p_limit: 100 }),
      supabase.rpc('admin_company_event_stats', { p_days: 14 }),
    ]);
    const loadError = statsResult.error || eventsResult.error || eventStatsResult.error;
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
      setCompanyStats(statsResult.data || []);
      setEvents(eventsResult.data || []);
      setEventStats(eventStatsResult.data || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) loadData(true);
  }, [canView, loadData]);

  const adminCompanyIds = useMemo(
    () => companyStats.map((company) => company.entreprise_id).sort(),
    [companyStats],
  );
  const adminCompanyKey = adminCompanyIds.join(',');

  useEffect(() => {
    if (!canView || !adminCompanyIds.length) return undefined;
    const channels = adminCompanyIds.flatMap((companyId) => ['activity_events', 'audit_events'].map((table) => supabase
      .channel(`admin-${table}-${companyId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table,
        filter: `entreprise_id=eq.${companyId}`,
      }, () => loadData(false))
      .subscribe()));
    return () => { channels.forEach((channel) => supabase.removeChannel(channel)); };
  }, [canView, adminCompanyKey, loadData]);

  const totals = useMemo(() => companyStats.reduce((result, company) => ({
    users: result.users + Number(company.utilisateurs || 0),
    active: result.active + Number(company.utilisateurs_actifs || 0),
  }), { users: 0, active: 0 }), [companyStats]);
  const maxUsers = Math.max(1, ...companyStats.map((company) => Number(company.utilisateurs || 0)));
  const eventTotals = useMemo(() => eventStats.reduce((total, day) => ({
    visits: total.visits + Number(day.visites || 0),
    actions: total.actions + Number(day.actions || 0),
  }), { visits: 0, actions: 0 }), [eventStats]);
  const chartData = useMemo(() => {
    const byDate = new Map(eventStats.map((day) => [String(day.jour).slice(0, 10), day]));
    const days = [];
    for (let offset = 13; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      days.push(byDate.get(key) || { jour: key, visites: 0, actions: 0 });
    }
    return days;
  }, [eventStats]);
  const chartMax = Math.max(1, ...chartData.map((day) => Number(day.visites || 0) + Number(day.actions || 0)));
  const chartWidth = 840;
  const chartHeight = 190;
  const chartBaseY = 150;
  const chartTopY = 16;
  const chartUsableHeight = chartBaseY - chartTopY;
  const chartSlot = chartWidth / chartData.length;
  const barWidth = Math.min(27, chartSlot * 0.54);

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

      <Card className="analytics-trend-card">
        <div className="analytics-section-heading">
          <div><h2><Activity size={19} /> Activité des 14 derniers jours</h2><p>Visites de pages et opérations métier dans vos entreprises administrées.</p></div>
          <div className="trend-total"><strong>{eventTotals.visits + eventTotals.actions}</strong><span>événements</span></div>
        </div>
        <div className="trend-chart-wrap">
          <>
            <svg className="trend-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Graphique des visites et actions des quatorze derniers jours">
              {[0, 0.5, 1].map((fraction) => {
                const y = chartBaseY - chartUsableHeight * fraction;
                return <g key={fraction}><line x1="0" x2={chartWidth} y1={y} y2={y} className="trend-gridline" /><text x="2" y={y - 4} className="trend-axis-label">{Math.round(chartMax * fraction)}</text></g>;
              })}
              {chartData.map((day, index) => {
                const visits = Number(day.visites || 0);
                const actions = Number(day.actions || 0);
                const visitsHeight = (visits / chartMax) * chartUsableHeight;
                const actionsHeight = (actions / chartMax) * chartUsableHeight;
                const x = index * chartSlot + (chartSlot - barWidth) / 2;
                const label = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(`${day.jour}T12:00:00`));
                return <g key={day.jour}>
                  <title>{`${label} : ${visits} visite(s), ${actions} action(s)`}</title>
                  <rect x={x} y={chartBaseY - visitsHeight} width={barWidth} height={Math.max(visitsHeight, visits ? 2 : 0)} rx="4" className="trend-bar-visits" />
                  <rect x={x} y={chartBaseY - visitsHeight - actionsHeight} width={barWidth} height={Math.max(actionsHeight, actions ? 2 : 0)} rx="4" className="trend-bar-actions" />
                  <text x={x + barWidth / 2} y="174" textAnchor="middle" className="trend-day-label">{label}</text>
                </g>;
              })}
            </svg>
            {!loading && eventTotals.visits + eventTotals.actions === 0 && (
              <p className="trend-empty-state">Le graphique est prêt. Aucune activité n’a encore été enregistrée sur les 14 derniers jours.</p>
            )}
          </>
        </div>
        <div className="company-chart-legend trend-legend"><span><i className="legend-visits" /> Visites de pages ({eventTotals.visits})</span><span><i className="legend-actions" /> Actions métier ({eventTotals.actions})</span></div>
      </Card>

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
          <div><h2><Activity size={19} /> Journal d’activité en direct</h2><p>Visites et actions métier ; aucune valeur comptable n’est copiée dans ce journal.</p></div>
          <span className="live-status"><i /> En direct</span>
        </div>
        {!events.length ? <p className="page-subtitle">Aucune activité enregistrée pour le moment. Les visites de pages apparaîtront ici.</p> : (
          <div className="activity-table-wrap">
            <table className="activity-table">
              <thead><tr><th>Heure</th><th>Entreprise</th><th>Utilisateur</th><th>Événement</th><th>Détail</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.event_id}>
                  <td>{formatDate(event.created_at)}</td>
                  <td>{event.entreprise_nom}</td>
                  <td>{event.utilisateur}</td>
                  <td><span className={`activity-category ${event.categorie === 'VISITE' ? 'visit' : event.categorie === 'ACCÈS' ? 'access' : 'accounting'}`}>{event.categorie}</span> {event.libelle}</td>
                  <td>{event.detail ? <code>{event.detail}</code> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
