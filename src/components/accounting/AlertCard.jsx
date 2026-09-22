import Card from '../ui/Card';
import { AlertCircle, AlertTriangle, Info, ChevronRight, CheckCircle2 } from 'lucide-react';

const ICONS = { danger: AlertTriangle, warning: AlertCircle, info: Info };

export default function AlertCard({ items = [] }) {
  return (
    <Card className="alerts-card">
      <div className="card-heading">
        <div><h2>Alertes &amp; tâches prioritaires</h2><p>Actions comptables et fiscales à traiter</p></div>
      </div>
      <div className="alerts-list">
        {items.map((item, i) => {
          const Icon = ICONS[item.tone] || Info;
          return (
            <button className="alert-item" key={item.key || i} onClick={item.onClick} type="button">
              <Icon size={16} />
              <span>{item.text}</span>
              {item.onClick && <ChevronRight size={14} />}
            </button>
          );
        })}
        {items.length === 0 && (
          <div className="alert-item" style={{ background: '#ecfdf5' }}>
            <CheckCircle2 size={16} color="#10b981" />
            <span>Aucune alerte — tout est à jour.</span>
          </div>
        )}
      </div>
    </Card>
  );
}
