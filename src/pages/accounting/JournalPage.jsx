// src/pages/accounting/JournalPage.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Trash2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const ATTACHMENT_BUCKET = 'pieces-justificatives';
const PAGE_SIZE = 25;       // lignes affichées par page (écritures validées)
const FETCH_BATCH = 1000;   // taille d'un lot Supabase (limite PostgREST par défaut)
const MAX_ROWS = 5000;      // garde-fou : au-delà, on invite à affiner les filtres

const money = (v) => Number(v || 0).toLocaleString('fr-FR');

const isImage = (piece) =>
  (piece.type || '').startsWith('image/') || /\.(png|jpe?g)$/i.test(piece.reference || piece.fichier_url || '');

// ---------------------------------------------------------------------------
// Aperçu cliquable d'une pièce justificative
// ---------------------------------------------------------------------------
function PieceThumb({ piece, url }) {
  const open = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={!url}
      title={piece.reference || 'Ouvrir la pièce'}
      style={{
        width: 44,
        height: 44,
        borderRadius: 8,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        cursor: url ? 'pointer' : 'not-allowed',
        background: '#f9fafb',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      {url && isImage(piece) ? (
        <img src={url} alt={piece.reference || 'Justificatif'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <>
          <FileText size={18} color="#e11d48" />
          <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280' }}>PDF</span>
        </>
      )}
    </button>
  );
}

function PiecesCell({ pieces, urls }) {
  if (!pieces.length) return <span className="page-subtitle">—</span>;
  const visible = pieces.slice(0, 3);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {visible.map((p) => (
        <PieceThumb key={p.id} piece={p} url={urls[p.fichier_url]} />
      ))}
      {pieces.length > visible.length && (
        <span className="page-subtitle">+{pieces.length - visible.length}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function JournalPage() {
  const nav = useNavigate();

  // Données
  const [rowsValidees, setRowsValidees] = useState([]);
  const [rowsBrouillons, setRowsBrouillons] = useState([]);
  const [pieceUrls, setPieceUrls] = useState({});
  const requestedPaths = useRef(new Set());

  // Référentiels
  const [exercices, setExercices] = useState([]);
  const [journaux, setJournaux] = useState([]);
  const [filtersReady, setFiltersReady] = useState(false);

  // Filtres
  const [exerciceId, setExerciceId] = useState('');
  const [journalId, setJournalId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [order, setOrder] = useState('desc'); // desc = plus récentes d'abord
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  // États UI
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  // 1. Référentiels (exercices + journaux) ; exercice ouvert sélectionné par défaut
  useEffect(() => {
    if (!supabaseConfigured) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,statut').order('annee', { ascending: false }),
      supabase.from('journaux').select('id,code,libelle').order('code'),
    ]).then(([ex, jr]) => {
      if (!active) return;
      if (ex.error) setError(`Impossible de charger les exercices : ${ex.error.message}`);
      if (jr.error) setError(`Impossible de charger les journaux : ${jr.error.message}`);
      const exList = ex.data || [];
      setExercices(exList);
      setJournaux(jr.data || []);
      const defaultEx = exList.find((e) => e.statut === 'OUVERT') || exList[0];
      if (defaultEx) setExerciceId(defaultEx.id);
      setFiltersReady(true);
    });
    return () => { active = false; };
  }, []);

  // 2. Écritures (rechargées à chaque changement de filtre serveur)
  useEffect(() => {
    if (!filtersReady || !supabaseConfigured) return undefined;
    let active = true;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const all = [];
        let reachedLimit = false;

        for (let from = 0; from < MAX_ROWS; from += FETCH_BATCH) {
          let q = supabase
            .from('ecritures_comptables')
            .select('id,numero,date_ecriture,libelle,reference_piece,statut,journaux(code),lignes_ecritures(debit,credit),pieces_comptables(id,type,reference,fichier_url)')
            .order('date_ecriture', { ascending: order === 'asc' })
            .order('numero', { ascending: order === 'asc' })
            .range(from, from + FETCH_BATCH - 1);

          if (exerciceId) q = q.eq('exercice_id', exerciceId);
          if (journalId) q = q.eq('journal_id', journalId);
          if (dateFrom) q = q.gte('date_ecriture', dateFrom);
          if (dateTo) q = q.lte('date_ecriture', dateTo);

          const { data, error: err } = await q;
          if (err) throw err;
          all.push(...(data || []));
          if ((data || []).length < FETCH_BATCH) break;
          if (from + FETCH_BATCH >= MAX_ROWS) reachedLimit = true;
        }

        if (!active) return;

        const validees = [];
        const brouillons = [];

        all.forEach((entry) => {
          const lignes = entry.lignes_ecritures || [];
          const debit = lignes.reduce((acc, l) => acc + Number(l.debit || 0), 0);
          const credit = lignes.reduce((acc, l) => acc + Number(l.credit || 0), 0);
          const validee = entry.statut === 'VALIDEE';

          const row = {
            id: entry.id,
            date: entry.date_ecriture,
            journal: entry.journaux?.code || '—',
            ref: entry.reference_piece || entry.numero,
            description: entry.libelle,
            debitValue: debit,
            creditValue: credit,
            status: validee ? 'Validée' : 'Brouillon',
            statusTone: validee ? 'success' : 'warning',
            pieces: entry.pieces_comptables || [],
          };

          (validee ? validees : brouillons).push(row);
        });

        setRowsValidees(validees);
        setRowsBrouillons(brouillons);
        setTruncated(reachedLimit);
        setPage(1);
      } catch (err) {
        if (active) setError(`Impossible de charger le journal : ${err.message}`);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [filtersReady, exerciceId, journalId, dateFrom, dateTo, order]);

  // 3. Filtrage texte (côté client) + totaux sur TOUTES les écritures filtrées
  const matches = (row) =>
    `${row.ref} ${row.description}`.toLowerCase().includes(query.toLowerCase());

  const filteredValidees = useMemo(() => rowsValidees.filter(matches), [rowsValidees, query]);
  const filteredBrouillons = useMemo(() => rowsBrouillons.filter(matches), [rowsBrouillons, query]);

  const sumOf = (rows) => rows.reduce(
    (acc, r) => ({ debit: acc.debit + r.debitValue, credit: acc.credit + r.creditValue }),
    { debit: 0, credit: 0 },
  );
  const totalsValidees = useMemo(() => sumOf(filteredValidees), [filteredValidees]);
  const totalsBrouillons = useMemo(() => sumOf(filteredBrouillons), [filteredBrouillons]);
  const equilibre = Math.abs(totalsValidees.debit - totalsValidees.credit) < 0.005;

  // 4. Pagination des écritures validées
  const totalPages = Math.max(1, Math.ceil(filteredValidees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageValidees = useMemo(
    () => filteredValidees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredValidees, currentPage],
  );

  useEffect(() => { setPage(1); }, [query]);

  // 5. URLs signées uniquement pour les pièces visibles à l'écran
  const visiblePaths = useMemo(
    () => [...new Set(
      [...pageValidees, ...filteredBrouillons]
        .flatMap((r) => r.pieces.map((p) => p.fichier_url))
        .filter(Boolean),
    )],
    [pageValidees, filteredBrouillons],
  );

  useEffect(() => {
    const missing = visiblePaths.filter((p) => !requestedPaths.current.has(p));
    if (!missing.length) return;
    missing.forEach((p) => requestedPaths.current.add(p));
    supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrls(missing, 3600)
      .then(({ data }) => {
        setPieceUrls((prev) => {
          const next = { ...prev };
          (data || []).forEach((s) => { if (s.signedUrl) next[s.path] = s.signedUrl; });
          return next;
        });
      });
  }, [visiblePaths]);

  // Actions
  const handleContinuer = (id) => nav(`/nouvelle-ecriture?edit=${id}`);

  const handleSupprimer = async (row) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette écriture en brouillon ?')) return;

    setDeleting(row.id);
    setError('');
    setNotice('');

    try {
      const paths = row.pieces.map((p) => p.fichier_url).filter(Boolean);
      if (paths.length) await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);

      const piecesRes = await supabase.from('pieces_comptables').delete().eq('ecriture_id', row.id);
      if (piecesRes.error) throw piecesRes.error;

      const lignesRes = await supabase.from('lignes_ecritures').delete().eq('ecriture_id', row.id);
      if (lignesRes.error) throw lignesRes.error;

      const { error: err } = await supabase.from('ecritures_comptables').delete().eq('id', row.id);
      if (err) throw err;

      setRowsBrouillons((prev) => prev.filter((r) => r.id !== row.id));
      setNotice('Écriture supprimée avec succès.');
    } catch (err) {
      setError(`Erreur lors de la suppression : ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const filtersActive = Boolean(journalId || dateFrom || dateTo || query || order !== 'desc');
  const resetFilters = () => {
    setJournalId('');
    setDateFrom('');
    setDateTo('');
    setQuery('');
    setOrder('desc');
  };

  // Rendu des tableaux
  const renderHead = (withActions) => (
    <thead>
      <tr>
        <th>Date</th>
        <th>Journal</th>
        <th>Référence</th>
        <th>Description</th>
        <th className="text-right">Débit</th>
        <th className="text-right">Crédit</th>
        <th>Justificatif</th>
        <th>Statut</th>
        {withActions && <th style={{ width: '200px' }}>Actions</th>}
      </tr>
    </thead>
  );

  const renderCells = (row) => (
    <>
      <td>{row.date ? new Date(row.date).toLocaleDateString('fr-FR') : '—'}</td>
      <td><Badge tone="neutral">{row.journal}</Badge></td>
      <td className="account-cell">{row.ref}</td>
      <td>{row.description}</td>
      <td className="text-right">{money(row.debitValue)} FCFA</td>
      <td className="text-right">{money(row.creditValue)} FCFA</td>
      <td><PiecesCell pieces={row.pieces} urls={pieceUrls} /></td>
      <td><Badge tone={row.statusTone}>{row.status}</Badge></td>
    </>
  );

  const renderFoot = (count, totals, withActions, controle) => (
    <tfoot>
      <tr style={{ fontWeight: 700, borderTop: '2px solid #e5e7eb' }}>
        <td colSpan={4}>Total ({count} écriture{count > 1 ? 's' : ''})</td>
        <td className="text-right">{money(totals.debit)} FCFA</td>
        <td className="text-right">{money(totals.credit)} FCFA</td>
        <td colSpan={withActions ? 3 : 2}>
          {controle && (
            equilibre
              ? <Badge tone="success">Équilibré ✓</Badge>
              : <Badge tone="danger">Écart : {money(Math.abs(totals.debit - totals.credit))} FCFA</Badge>
          )}
        </td>
      </tr>
    </tfoot>
  );

  const exerciceLabel = (e) => `${e.code || e.annee}${e.statut === 'OUVERT' ? ' (ouvert)' : ''}`;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journal comptable</h1>
          <p className="page-subtitle">Consultez et gérez les écritures comptables</p>
        </div>
        <Button onClick={() => nav('/nouvelle-ecriture')}>+ Nouvelle écriture</Button>
      </div>

      {notice && <div className="message success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}
      {error && <div className="message error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
      {truncated && (
        <div className="message error" role="alert" style={{ marginBottom: '16px' }}>
          Affichage limité aux {MAX_ROWS} premières écritures : affinez les filtres pour voir le reste.
        </div>
      )}

      {/* Filtres */}
      <Card style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ minWidth: 170 }}>
            <Select label="Exercice" value={exerciceId} onChange={(e) => setExerciceId(e.target.value)}>
              <option value="">Tous les exercices</option>
              {exercices.map((e) => <option key={e.id} value={e.id}>{exerciceLabel(e)}</option>)}
            </Select>
          </div>
          <div style={{ minWidth: 200 }}>
            <Select label="Journal" value={journalId} onChange={(e) => setJournalId(e.target.value)}>
              <option value="">Tous les journaux</option>
              {journaux.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>)}
            </Select>
          </div>
          <label className="field" style={{ minWidth: 150 }}>
            <span className="field-label">Du</span>
            <input type="date" className="input" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="field" style={{ minWidth: 150 }}>
            <span className="field-label">Au</span>
            <input type="date" className="input" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <div style={{ minWidth: 190 }}>
            <Select label="Ordre" value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">Plus récentes d'abord</option>
              <option value="asc">Chronologique (anciennes d'abord)</option>
            </Select>
          </div>
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span className="field-label">Recherche</span>
            <input
              type="text"
              placeholder="Référence ou description..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input"
            />
          </label>
          {filtersActive && (
            <Button variant="secondary" size="sm" onClick={resetFilters}>Réinitialiser</Button>
          )}
        </div>
      </Card>

      {/* SECTION 1 : ÉCRITURES VALIDÉES (en haut) */}
      <Card style={{ marginBottom: '32px' }}>
        <div className="card-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 className="section-title">Écritures validées</h2>
            <p className="page-subtitle">{filteredValidees.length} écriture(s) comptabilisée(s)</p>
          </div>
        </div>

        {loading ? (
          <p className="page-subtitle">Chargement...</p>
        ) : filteredValidees.length === 0 ? (
          <p className="page-subtitle">Aucune écriture validée pour ces filtres.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="balance-table">
                {renderHead(false)}
                <tbody>
                  {pageValidees.map((row) => (
                    <tr key={row.id}>{renderCells(row)}</tr>
                  ))}
                </tbody>
                {renderFoot(filteredValidees.length, totalsValidees, false, true)}
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'flex-end', marginTop: 16 }}>
                <span className="page-subtitle">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredValidees.length)} sur {filteredValidees.length}
                </span>
                <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Précédent</Button>
                <span className="page-subtitle">Page {currentPage} / {totalPages}</span>
                <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Suivant</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* SECTION 2 : BROUILLONS (en bas) */}
      {rowsBrouillons.length > 0 && (
        <Card>
          <div className="card-heading" style={{ marginBottom: '16px' }}>
            <div>
              <h2 className="section-title">Écritures en brouillon</h2>
              <p className="page-subtitle">{filteredBrouillons.length} écriture(s) en attente de validation</p>
            </div>
          </div>

          {filteredBrouillons.length === 0 ? (
            <p className="page-subtitle">Aucun brouillon pour ces filtres.</p>
          ) : (
            <div className="table-wrap">
              <table className="balance-table">
                {renderHead(true)}
                <tbody>
                  {filteredBrouillons.map((row) => (
                    <tr key={row.id} style={{ opacity: deleting === row.id ? 0.6 : 1 }}>
                      {renderCells(row)}
                      <td style={{ display: 'flex', gap: '8px' }}>
                        <Button
                          icon={Edit2}
                          size="sm"
                          variant="primary"
                          onClick={() => handleContinuer(row.id)}
                          disabled={deleting === row.id}
                        >
                          Continuer
                        </Button>
                        <Button
                          icon={Trash2}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSupprimer(row)}
                          disabled={deleting === row.id}
                          style={{ color: '#e11d48' }}
                        >
                          Supprimer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {renderFoot(filteredBrouillons.length, totalsBrouillons, true, false)}
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}