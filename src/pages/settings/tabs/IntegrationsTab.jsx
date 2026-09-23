import { Plug } from 'lucide-react';

export default function IntegrationsTab() {
  return (
    <div>
      <h2 className="params-content-title">Intégrations</h2>
      <div className="empty-state">
        <Plug size={28} />
        <p>Aucune intégration externe n'est connectée pour le moment (MTN/Orange Money, portail DGI, etc.).</p>
        <p className="page-subtitle">Dis-moi quel service tu veux connecter et selon quel protocole (API, import de relevé…) pour qu'on la mette en place — rien n'est câblé par défaut.</p>
      </div>
    </div>
  );
}
