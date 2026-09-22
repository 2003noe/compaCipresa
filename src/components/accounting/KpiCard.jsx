import Card from '../ui/Card';

export default function KpiCard({ label, value, deltaLabel, trend = 'neutral', icon: Icon, onClick }) {
  return (
    <Card className={`kpi-card ${onClick ? 'kpi-card-clickable' : ''}`} onClick={onClick}>
      <div className="kpi-head">
        <span>{label}</span>
        {Icon && <div className="kpi-icon"><Icon size={16} /></div>}
      </div>
      <strong>{value}</strong>
      {deltaLabel && (
        <div className={`kpi-change ${trend === 'up' ? 'positive' : trend === 'down' ? 'negative' : ''}`}>
          {trend === 'up' ? '↗ ' : trend === 'down' ? '↘ ' : ''}{deltaLabel}
        </div>
      )}
    </Card>
  );
}
