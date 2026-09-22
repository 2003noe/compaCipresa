import Card from '../ui/Card';

export default function ChartCard({ title = 'Évolution de la trésorerie', subtitle = 'Encaissements et décaissements sur les 12 derniers mois', data = [], onSelectRange }) {
  const maxFlow = Math.max(1, ...data.flatMap((b) => [b.entrees, b.sorties]));
  return (
    <Card className="chart-card">
      <div className="card-heading">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {onSelectRange && <select className="mini-select" onChange={(e) => onSelectRange(e.target.value)}><option value="12">12 derniers mois</option><option value="6">6 derniers mois</option></select>}
      </div>
      <div className="flow-chart">
        {data.map((b) => (
          <div className="flow-bar-group" key={b.key}>
            <div className="flow-bars">
              <div className="flow-bar entree" style={{ height: `${(b.entrees / maxFlow) * 100}%` }} title={`Entrées : ${Number(b.entrees).toLocaleString('fr-FR')} FCFA`} />
              <div className="flow-bar sortie" style={{ height: `${(b.sorties / maxFlow) * 100}%` }} title={`Sorties : ${Number(b.sorties).toLocaleString('fr-FR')} FCFA`} />
            </div>
            <span>{b.label}</span>
          </div>
        ))}
        {data.length === 0 && <p className="page-subtitle">Aucun mouvement validé pour le moment.</p>}
      </div>
      <div className="flow-legend"><span><i className="dot entree" /> Entrées</span><span><i className="dot sortie" /> Sorties</span></div>
    </Card>
  );
}
