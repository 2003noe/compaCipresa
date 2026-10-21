import { useState } from 'react';
import Card from '../../components/ui/Card';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Plus, FileSpreadsheet, FileText, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ListPage({
  title, subtitle, columns, rows,
  primary = 'Nouvel élément',
  primaryPath,
  headerOnly = false,
  loading = false,
  notice = '',
  /* Recherche */
  searchValue = '',
  onSearchChange,
  /* Filtres */
  filters = {},
  onFilterChange,
  onFilterReset,
  activeFilterCount = 0,
  filterOptions = {},   // { class: [...], nature: [...], status: [...] }
  /* Export */
  onExportExcel,
  onExportPDF,
  exporting = false,
}) {
  const navigate = useNavigate();
  const go = () => primaryPath ? navigate(primaryPath) : null;

  const [showFilters, setShowFilters] = useState(false);

  /* Labels lisibles pour chaque clé de filtre */
  const filterLabels = { class: 'Classe', nature: 'Nature', status: 'Statut' };

  return (
    <div className="page-content">

      {/* ── En-tête ─────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          {onExportExcel && (
            <Button variant="secondary" icon={FileSpreadsheet} onClick={onExportExcel} disabled={exporting}>
              Excel
            </Button>
          )}
          {onExportPDF && (
            <Button variant="secondary" icon={exporting ? Loader2 : FileText} onClick={onExportPDF} disabled={exporting}>
              {exporting ? 'Export…' : 'PDF'}
            </Button>
          )}
          {primary && <Button icon={Plus} onClick={go}>{primary}</Button>}
        </div>
      </div>

      {/* ── Notice ──────────────────────────────────────── */}
      {notice && <p className="notice-error">{notice}</p>}

      {/* ── Corps ───────────────────────────────────────── */}
      {!headerOnly && (
        <Card>

          {/* Barre de recherche + bouton filtre */}
          <div className="list-toolbar">
            <div className="toolbar-search-wrap">
              <Search size={15} className="search-icon" />
              <input
                className="toolbar-search-input"
                placeholder="Rechercher un compte…"
                value={searchValue}
                onChange={e => onSearchChange && onSearchChange(e.target.value)}
              />
            </div>

            <div className="flex gap-2" style={{ alignItems: 'center' }}>
              <span className="toolbar-count">
                {loading ? '…' : `${rows.length} résultat${rows.length !== 1 ? 's' : ''}`}
              </span>

              {/* Bouton Filtres */}
              {Object.keys(filterOptions).length > 0 && (
                <button
                  className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
                  onClick={() => setShowFilters(v => !v)}
                >
                  <SlidersHorizontal size={14} />
                  <span>Filtres</span>
                  {activeFilterCount > 0 && (
                    <span className="filter-badge">{activeFilterCount}</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Panneau de filtres dépliable */}
          {showFilters && (
            <div className="filter-panel">
              {Object.entries(filterOptions).map(([key, options]) => (
                <div key={key} className="filter-group">
                  <label className="filter-label">{filterLabels[key] || key}</label>
                  <select
                    className="filter-select"
                    value={filters[key] || ''}
                    onChange={e => onFilterChange && onFilterChange(key, e.target.value)}
                  >
                    <option value="">Tous</option>
                    {options.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              ))}

              {activeFilterCount > 0 && (
                <button className="filter-reset-btn" onClick={() => { onFilterReset && onFilterReset(); }}>
                  <X size={13} />
                  Réinitialiser
                </button>
              )}
            </div>
          )}

          {/* Chips des filtres actifs */}
          {activeFilterCount > 0 && (
            <div className="filter-chips">
              {Object.entries(filters).map(([key, val]) =>
                val ? (
                  <span key={key} className="filter-chip">
                    {filterLabels[key] || key} : <strong>{val}</strong>
                    <button
                      className="chip-close"
                      onClick={() => onFilterChange && onFilterChange(key, '')}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ) : null
              )}
            </div>
          )}

          {/* Tableau */}
          {loading ? (
            <div className="table-loading">
              <Loader2 size={22} className="spin" />
              <span>Chargement…</span>
            </div>
          ) : (
            <Table
              columns={columns}
              rows={rows || []}
              renderCell={(r, k) =>
                ['status', 'statut'].includes(k)
                  ? <Badge>{r[k]}</Badge>
                  : r[k]
              }
            />
          )}
        </Card>
      )}
    </div>
  );
}
