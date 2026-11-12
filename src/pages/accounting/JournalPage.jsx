// src/pages/accounting/JournalPage.jsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Edit2, Trash2, FileText, Download, Printer, Search, Calendar, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useExercice } from '../../context/ExerciceContext';
import { useAuth } from '../../context/AuthContext';
import { confirmAction, toast } from '../../lib/notifications';
import { exportJournalExcel, exportJournalPDF, JournalPDFDocument, PDFPreviewModal } from '../../lib/generateFile';

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
  const { can, profile } = useAuth();
  const canCreate = can('COMPTA_CREATE');
  const canValidate = can('COMPTA_VALIDATE');
  const canExport = can('COMPTA_JOURNAL_EXPORT');

  // Données
  const [rowsValidees, setRowsValidees] = useState([]);
  const [rowsBrouillons, setRowsBrouillons] = useState([]);
  const [pieceUrls, setPieceUrls] = useState({});
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const requestedPaths = useRef(new Set());

  // Référentiels
  const { selectedExerciceId: exerciceId, selectedExercice, loading: exercicesLoading } = useExercice();
  const [journaux, setJournaux] = useState([]);
  const [filtersReady, setFiltersReady] = useState(false);

  // Filtres
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
  const [selectedEntry, setSelectedEntry] = useState(null);

  // 1. Référentiels (exercices + journaux) ; exercice ouvert sélectionné par défaut
  useEffect(() => {
    if (!supabaseConfigured) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return undefined;
    }
    let active = true;
    Promise.all([
      supabase.from('journaux').select('id,code,libelle').order('code'),
    ]).then(([jr]) => {
      if (!active) return;
      if (jr.error) setError(`Impossible de charger les journaux : ${jr.error.message}`);
      setJournaux(jr.data || []);
      setFiltersReady(true);
    });
    return () => { active = false; };
  }, []);

  // 2. Écritures (rechargées à chaque changement de filtre serveur)
  useEffect(() => {
    if (!filtersReady || exercicesLoading || !supabaseConfigured) return undefined;
    if (!exerciceId || !selectedExercice) { setRowsValidees([]); setRowsBrouillons([]); setLoading(false); return undefined; }
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
            .select('id,created_by,numero,date_ecriture,libelle,reference_piece,statut,journaux!ecriture_journal_company_fk(code),lignes_ecritures!ligne_ecriture_company_fk(debit,credit),pieces_comptables!piece_ecriture_company_fk(id,type,reference,fichier_url)')
            .order('date_ecriture', { ascending: order === 'asc' })
            .order('numero', { ascending: order === 'asc' })
            .range(from, from + FETCH_BATCH - 1);

          q = q.eq('exercice_id', exerciceId)
            .gte('date_ecriture', selectedExercice.date_debut)
            .lte('date_ecriture', selectedExercice.date_fin);
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
            created_by: entry.created_by,
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
  }, [filtersReady, exercicesLoading, exerciceId, selectedExercice, journalId, dateFrom, dateTo, order]);

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
    if (!canCreate || row.status !== 'Brouillon') return;
    if (!await confirmAction({ title: 'Supprimer ce brouillon ?', text: 'Cette action est définitive.', confirmText: 'Supprimer le brouillon', danger: true })) return;

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
      toast.success('Brouillon supprimé', 'L’écriture et ses pièces jointes ont été supprimées.');
    } catch (err) {
      setError(`Erreur lors de la suppression : ${err.message}`);
      toast.error('Suppression impossible', err.message);
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

  // Export Excel
  const handleExportXLSX = () => {
    const exerciceLabel = selectedExercice?.code || selectedExercice?.annee || 'Exercice';
    const suffix = [dateFrom, dateTo].filter(Boolean).join('_au_') || exerciceLabel;
    exportJournalExcel({
      rows: filteredValidees,
      totals: totalsValidees,
      exercice: selectedExercice,
      filename: `Journal_comptable_${suffix}`,
    });
  };

  // Export / Impression PDF
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const exerciceLabel = selectedExercice?.code || selectedExercice?.annee || 'Exercice';
      const suffix = [dateFrom, dateTo].filter(Boolean).join('_au_') || exerciceLabel;
      await exportJournalPDF({
        rows: filteredValidees,
        totals: totalsValidees,
        exercice: selectedExercice,
        filename: `Journal_comptable_${suffix}`,
      });
    } catch (err) {
      console.error('Erreur export PDF journal:', err);
    } finally {
      setExportingPDF(false);
    }
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


  return (
    <div className="page-content">
      <div className="page-header no-print">
        <div>
          <h1 className="page-title">Journal comptable</h1>
          <p className="page-subtitle">Consultez et gérez les écritures comptables</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canExport && <Button
            variant="secondary"
            icon={Printer}
            onClick={() => setShowPDFPreview(true)}
            disabled={filteredValidees.length === 0}
            title="Prévisualiser et imprimer en PDF"
          >
            Imprimer (PDF)
          </Button>}
          {canExport && <Button
            variant="primary"
            icon={Download}
            onClick={handleExportXLSX}
            disabled={filteredValidees.length === 0}
            title="Exporter les écritures validées en Excel"
          >
            Exporter Excel
          </Button>}
          {canCreate && <Button onClick={() => nav('/nouvelle-ecriture')}>+ Nouvelle écriture</Button>}
        </div>
      </div>

      {/* En-tête visible uniquement à l'impression */}
      <div className="print-only" style={{ display: 'none', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>JOURNAL COMPTABLE</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>Système Comptable SYSCOHADA</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '12px' }}>
            {selectedExercice && <p style={{ margin: 0 }}>Exercice : {selectedExercice.code || selectedExercice.annee}</p>}
            {(dateFrom || dateTo) && (
              <p style={{ margin: 0 }}>Période : {dateFrom || '…'} → {dateTo || '…'}</p>
            )}
            <p style={{ margin: 0 }}>Imprimé le : {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
        <p style={{ fontSize: '12px', margin: '0 0 8px' }}>
          {filteredValidees.length} écriture(s) validée(s) · Débit total : {money(totalsValidees.debit)} FCFA · Crédit total : {money(totalsValidees.credit)} FCFA
          {equilibre ? ' · ✓ Équilibré' : ` · ⚠ Écart : ${money(Math.abs(totalsValidees.debit - totalsValidees.credit))} FCFA`}
        </p>
      </div>

      {notice && <div className="message success" role="status" style={{ marginBottom: '16px' }}>{notice}</div>}
      {error && <div className="message error" role="alert" style={{ marginBottom: '16px' }}>{error}</div>}
      {truncated && (
        <div className="message error" role="alert" style={{ marginBottom: '16px' }}>
          Affichage limité aux {MAX_ROWS} premières écritures : affinez les filtres pour voir le reste.
        </div>
      )}

      {/* Barre de filtres compacte */}
      <div className="compact-filter-bar no-print" style={{ marginBottom: '24px' }}>
        <div className="compact-filter-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Rechercher par référence, libellé..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          className="input select compact-filter-select"
          value={journalId}
          onChange={(e) => setJournalId(e.target.value)}
          title="Filtrer par journal"
        >
          <option value="">Tous les journaux</option>
          {journaux.map((j) => (
            <option key={j.id} value={j.id}>
              {j.code} — {j.libelle}
            </option>
          ))}
        </select>

        <div className="compact-date-range">
          <Calendar size={13} />
          <span>Du</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            title="Date de début"
          />
          <span>au</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            title="Date de fin"
          />
        </div>

        <select
          className="input select compact-filter-select"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
          title="Trier les écritures"
          style={{ maxWidth: 180 }}
        >
          <option value="desc">Plus récentes d'abord</option>
          <option value="asc">Plus anciennes d'abord</option>
        </select>

        {filtersActive && (
          <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters} className="compact-filter-reset">
            Réinitialiser
          </Button>
        )}
      </div>

      {/* SECTION 1 : ÉCRITURES VALIDÉES (en haut) */}
      <Card style={{ marginBottom: '32px' }}>
        <div className="card-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 className="section-title">Écritures validées</h2>
            <p className="page-subtitle">{filteredValidees.length} écriture(s) comptabilisée(s)</p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
            {canExport && <Button
              icon={Download}
              variant="outline"
              size="sm"
              onClick={handleExportXLSX}
              disabled={filteredValidees.length === 0}
            >
              Excel
            </Button>}
            {canExport && <Button
              icon={Printer}
              variant="outline"
              size="sm"
              onClick={() => setShowPDFPreview(true)}
              disabled={filteredValidees.length === 0}
            >
              PDF
            </Button>}
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
                    <tr
                      key={row.id}
                      className="clickable-row"
                      onClick={() => setSelectedEntry(row)}
                      title="Cliquer pour afficher le détail de l'écriture"
                      style={{ cursor: 'pointer' }}
                    >
                      {renderCells(row)}
                    </tr>
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
                    <tr
                      key={row.id}
                      className="clickable-row"
                      onClick={() => setSelectedEntry(row)}
                      title="Cliquer pour afficher le détail"
                      style={{ opacity: deleting === row.id ? 0.6 : 1, cursor: 'pointer' }}
                    >
                      {renderCells(row)}
                      <td style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                        {canCreate && <Button
                          icon={Edit2}
                          size="sm"
                          variant="primary"
                          onClick={() => handleContinuer(row.id)}
                          disabled={deleting === row.id}
                        >
                          Continuer
                        </Button>}
                        {(canValidate || canCreate) && <Button size="sm" onClick={async () => { const { error } = await supabase.rpc('valider_ecriture', { p_ecriture_id: row.id }); if (error) setError(error.message); else window.location.reload(); }}>Valider</Button>}
                        {canCreate && <Button
                          icon={Trash2}
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSupprimer(row)}
                          disabled={deleting === row.id}
                          style={{ color: '#e11d48' }}
                        >
                          Supprimer
                        </Button>}
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

      {showPDFPreview && canExport && (
        <PDFPreviewModal
          isOpen={showPDFPreview}
          onClose={() => setShowPDFPreview(false)}
          title="Journal comptable"
          subtitle={`Exercice : ${selectedExercice?.code || selectedExercice?.annee || ''}`}
          filename={`Journal_comptable_${selectedExercice?.code || 'exercice'}`}
          defaultOrientation="landscape"
          renderDocument={(orientation) => (
            <JournalPDFDocument
              rows={filteredValidees}
              totals={totalsValidees}
              exercice={selectedExercice}
              orientation={orientation}
            />
          )}
        />
      )}

      {selectedEntry && (
        <Modal
          isOpen={Boolean(selectedEntry)}
          onClose={() => setSelectedEntry(null)}
          title="Fiche d'écriture comptable"
          subtitle={`Réf : ${selectedEntry.ref} — Journal : ${selectedEntry.journal}`}
          icon={FileText}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelectedEntry(null)}>
                Fermer
              </Button>
              {selectedEntry.status !== 'Validée' && canCreate && (
                <Button
                  variant="primary"
                  onClick={() => {
                    const id = selectedEntry.id;
                    setSelectedEntry(null);
                    handleContinuer(id);
                  }}
                >
                  Modifier le brouillon
                </Button>
              )}
            </>
          }
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Date d'enregistrement</span>
              <span className="detail-value">{selectedEntry.date ? new Date(selectedEntry.date).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Journal comptable</span>
              <div><Badge tone="neutral">{selectedEntry.journal}</Badge></div>
            </div>
            <div className="detail-item">
              <span className="detail-label">Référence pièce</span>
              <span className="detail-value font-mono">{selectedEntry.ref}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Statut</span>
              <div><Badge tone={selectedEntry.statusTone}>{selectedEntry.status}</Badge></div>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Libellé / Description</span>
              <span className="detail-value" style={{ fontWeight: 600 }}>{selectedEntry.description}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Montant Débit</span>
              <span className="detail-value font-mono" style={{ fontSize: '15px' }}>{money(selectedEntry.debitValue)} FCFA</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Montant Crédit</span>
              <span className="detail-value font-mono" style={{ fontSize: '15px' }}>{money(selectedEntry.creditValue)} FCFA</span>
            </div>
            {selectedEntry.pieces && selectedEntry.pieces.length > 0 && (
              <div className="detail-item full-width">
                <span className="detail-label">Pièces justificatives ({selectedEntry.pieces.length})</span>
                <div style={{ marginTop: '8px' }}>
                  <PiecesCell pieces={selectedEntry.pieces} urls={pieceUrls} />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
