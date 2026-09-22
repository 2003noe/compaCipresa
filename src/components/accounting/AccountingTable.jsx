import Card from '../ui/Card';
import Table from '../ui/Table';
import Badge from '../ui/Badge';

export default function AccountingTable({ title = 'Écritures récentes', subtitle = 'Dernières opérations comptabilisées', rows = [], onSeeAll }) {
  const columns = [
    { key: 'date', label: 'Date' }, { key: 'ref', label: 'Référence' }, { key: 'description', label: 'Libellé' },
    { key: 'debit', label: 'Débit', align: 'right' }, { key: 'credit', label: 'Crédit', align: 'right' }, { key: 'status', label: 'Statut' },
  ];
  return (
    <Card className="table-card">
      <div className="card-heading">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        {onSeeAll && <button className="text-button" onClick={onSeeAll} type="button">Voir tout →</button>}
      </div>
      <Table columns={columns} rows={rows} renderCell={(r, k) => (k === 'status' ? <Badge tone={r.statusTone}>{r[k]}</Badge> : r[k])} />
      {rows.length === 0 && <p className="page-subtitle">Aucune écriture pour le moment.</p>}
    </Card>
  );
}
