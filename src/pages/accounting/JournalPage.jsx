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
import { exportJournalExcel, exportJournalPDF, JournalPDFDocument, PDFPreviewModal, buildPdfFilename } from '../../lib/generateFile';

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
            .select('id,created_by,numero,date_ecriture,libelle,reference_piece,statut,journaux!ecriture_journal_company_fk(code,libelle),lignes_ecritures!ligne_ecriture_company_fk(id,libelle,debit,credit,comptes_comptables!ligne_compte_company_fk(numero,libelle)),pieces_comptables!piece_ecriture_company_fk(id,type,reference,fichier_url)')
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
          const rawLines = entry.lignes_ecritures || [];
          const lignes = rawLines.map((l) => ({
            id: l.id,
            accountNumber: l.comptes_comptables?.numero || '—',
            accountLabel: l.comptes_comptables?.libelle || '—',
            description: l.libelle || entry.libelle || '',
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          }));
          const debit = lignes.reduce((acc, l) => acc + l.debit, 0);
          const credit = lignes.reduce((acc, l) => acc + l.credit, 0);
          const validee = entry.statut === 'VALIDEE';

          const row = {
            id: entry.id,
            created_by: entry.created_by,
            date: entry.date_ecriture,
            journal: entry.journaux?.code || '—',
            journalLibelle: entry.journaux?.libelle || '',
            ref: entry.reference_piece || entry.numero,
            numero: entry.numero,
            description: entry.libelle,
            debitValue: debit,
            creditValue: credit,
            status: validee ? 'Validée' : 'Brouillon',
            statusTone: validee ? 'success' : 'warning',
            pieces: entry.pieces_comptables || [],
            lignes,
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
    exportJournalExcel({
      rows: filteredValidees,
      totals: totalsValidees,
      exercice: selectedExercice,
      filename: buildPdfFilename('Journal', selectedExercice),
    });
  };

  // Export / Impression PDF
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await exportJournalPDF({
        rows: filteredValidees,
        totals: totalsValidees,
        exercice: selectedExercice,
        filename: buildPdfFilename('Journal', selectedExercice),
      });
    } catch (err) {
      console.error('Erreur export PDF journal:', err);
    } finally {
      setExportingPDF(false);
    }
  };

  // Impression directe navigateur
  const handleDirectPrint = () => {
    window.print();
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
          {canExport && (
            <Button
              variant="secondary"
              icon={Printer}
              onClick={handleDirectPrint}
              disabled={filteredValidees.length === 0}
              title="Imprimer directement le journal comptable via le navigateur"
            >
              Imprimer
            </Button>
          )}
          {canExport && (
            <Button
              variant="secondary"
              icon={FileText}
              onClick={() => setShowPDFPreview(true)}
              disabled={filteredValidees.length === 0}
              title="Prévisualiser et exporter en PDF"
            >
              PDF
            </Button>
          )}
          {canExport && (
            <Button
              variant="primary"
              icon={Download}
              onClick={handleExportXLSX}
              disabled={filteredValidees.length === 0}
              title="Exporter les écritures validées en Excel"
            >
              Excel
            </Button>
          )}
          {canCreate && <Button onClick={() => nav('/nouvelle-ecriture')}>+ Nouvelle écriture</Button>}
        </div>
      </div>

      {/* Document complet visible uniquement à l'impression directe (window.print) */}
      <div className="journal-print-document" style={{ display: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #166534', paddingBottom: '10px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
              CIPRESA CONSULTING SARL
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#4b5563' }}>
              Cabinet International de Prestation de Services Agricoles
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
              JOURNAL COMPTABLE GÉNÉRAL
            </p>
            <p style={{ margin: 0, fontSize: '9px', color: '#64748b' }}>
              Système Comptable SYSCOHADA Révisé — Tenue de compte : FCFA
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10px', color: '#334155' }}>
            <p style={{ margin: '0 0 3px' }}><strong>Exercice :</strong> {selectedExercice?.code || selectedExercice?.annee || '—'}</p>
            <p style={{ margin: '0 0 3px' }}>
              <strong>Période :</strong> {(dateFrom || selectedExercice?.date_debut || '—')} au {(dateTo || selectedExercice?.date_fin || '—')}
            </p>
            <p style={{ margin: '0 0 3px' }}>
              <strong>Journal :</strong> {journalId ? (journaux.find((j) => j.id === journalId)?.code || 'Sélectionné') : 'Tous les journaux'}
            </p>
            <p style={{ margin: 0, color: '#64748b' }}>
              Tiré le : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Synthèse globale */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 12px', borderRadius: '4px', marginBottom: '14px', fontSize: '10px' }}>
          <div>
            <strong>Volume :</strong> {filteredValidees.length} écriture(s) validée(s)
          </div>
          <div>
            <strong>Total Débit :</strong> {money(totalsValidees.debit)} FCFA
          </div>
          <div>
            <strong>Total Crédit :</strong> {money(totalsValidees.credit)} FCFA
          </div>
          <div>
            {equilibre ? (
              <span style={{ color: '#166534', fontWeight: 'bold' }}>✓ Journal équilibré</span>
            ) : (
              <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>⚠ Écart : {money(Math.abs(totalsValidees.debit - totalsValidees.credit))} FCFA</span>
            )}
          </div>
        </div>

        {/* Tableau complet pour impression */}
        <table className="journal-print-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', marginBottom: '16px' }}>
          <thead>
            <tr style={{ backgroundColor: '#275a43', color: '#ffffff', textAlign: 'left' }}>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '10%' }}>Date</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '6%' }}>Journal</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '12%' }}>N° Pièce</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '12%' }}>Compte</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '24%' }}>Intitulé du compte</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', width: '22%' }}>Libellé de l'écriture</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', textAlign: 'right', width: '7%' }}>Débit</th>
              <th style={{ padding: '5px 6px', border: '1px solid #1e4735', textAlign: 'right', width: '7%' }}>Crédit</th>
            </tr>
          </thead>
          <tbody>
            {filteredValidees.map((row) => {
              const hasLignes = row.lignes && row.lignes.length > 0;
              if (!hasLignes) {
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>{row.date ? new Date(row.date).toLocaleDateString('fr-FR') : '—'}</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', fontWeight: 600 }}>{row.journal}</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 600 }}>{row.ref}</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>—</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>—</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>{row.description}</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{money(row.debitValue)}</td>
                    <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{money(row.creditValue)}</td>
                  </tr>
                );
              }
              return row.lignes.map((l, li) => (
                <tr key={`${row.id}-${l.id || li}`} style={{ borderBottom: li === row.lignes.length - 1 ? '1.5px solid #64748b' : '1px solid #e2e8f0', backgroundColor: li === 0 ? '#fafafa' : '#ffffff' }}>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', verticalAlign: 'top' }}>{li === 0 ? (row.date ? new Date(row.date).toLocaleDateString('fr-FR') : '—') : ''}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', verticalAlign: 'top', fontWeight: 600 }}>{li === 0 ? row.journal : ''}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', verticalAlign: 'top', fontFamily: 'monospace', fontWeight: 600 }}>{li === 0 ? row.ref : ''}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontWeight: 700, color: '#166534' }}>{l.accountNumber}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>{l.accountLabel}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1' }}>{l.description || row.description}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace' }}>{l.debit > 0 ? money(l.debit) : '—'}</td>
                  <td style={{ padding: '3px 6px', border: '1px solid #cbd5e1', textAlign: 'right', fontFamily: 'monospace' }}>{l.credit > 0 ? money(l.credit) : '—'}</td>
                </tr>
              ));
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#e2e8f0', fontWeight: 700, borderTop: '2px solid #000' }}>
              <td colSpan={6} style={{ padding: '5px 6px', border: '1px solid #94a3b8' }}>
                TOTAL GÉNÉRAL ({filteredValidees.length} écriture{filteredValidees.length > 1 ? 's' : ''})
                {equilibre ? '  —  ✓ Conforme SYSCOHADA (Équilibré)' : `  —  ⚠ Écart de ${money(Math.abs(totalsValidees.debit - totalsValidees.credit))} FCFA`}
              </td>
              <td style={{ padding: '5px 6px', border: '1px solid #94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>{money(totalsValidees.debit)}</td>
              <td style={{ padding: '5px 6px', border: '1px solid #94a3b8', textAlign: 'right', fontFamily: 'monospace' }}>{money(totalsValidees.credit)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Zone visas & signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', pageBreakInside: 'avoid' }}>
          <div style={{ width: '45%', border: '1px solid #94a3b8', padding: '10px', borderRadius: '4px', textAlign: 'center', minHeight: '70px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '10px', color: '#166534' }}>Le Responsable Comptable</p>
            <p style={{ margin: '3px 0 0', fontSize: '8px', color: '#64748b' }}>Visa & Date</p>
          </div>
          <div style={{ width: '45%', border: '1px solid #94a3b8', padding: '10px', borderRadius: '4px', textAlign: 'center', minHeight: '70px' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '10px', color: '#166534' }}>La Direction Générale</p>
            <p style={{ margin: '3px 0 0', fontSize: '8px', color: '#64748b' }}>Signature & Cachet</p>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '8px', color: '#94a3b8', marginTop: '12px' }}>
          Généré par l'application de comptabilité de CIPRESA CONSULTING — Système SYSCOHADA
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
      <Card className="journal-screen-card" style={{ marginBottom: '32px' }}>
        <div className="card-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 className="section-title">Écritures validées</h2>
            <p className="page-subtitle">{filteredValidees.length} écriture(s) comptabilisée(s)</p>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '8px' }}>
            {canExport && (
              <Button
                icon={Printer}
                variant="outline"
                size="sm"
                onClick={handleDirectPrint}
                disabled={filteredValidees.length === 0}
                title="Imprimer directement"
              >
                Imprimer
              </Button>
            )}
            {canExport && (
              <Button
                icon={FileText}
                variant="outline"
                size="sm"
                onClick={() => setShowPDFPreview(true)}
                disabled={filteredValidees.length === 0}
                title="Aperçu PDF"
              >
                PDF
              </Button>
            )}
            {canExport && (
              <Button
                icon={Download}
                variant="outline"
                size="sm"
                onClick={handleExportXLSX}
                disabled={filteredValidees.length === 0}
                title="Exporter Excel"
              >
                Excel
              </Button>
            )}
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
        <Card className="no-print">
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
          filename={buildPdfFilename('Journal', selectedExercice)}
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
            {selectedEntry.lignes && selectedEntry.lignes.length > 0 && (
              <div className="detail-item full-width" style={{ marginTop: '12px' }}>
                <span className="detail-label" style={{ marginBottom: '8px', display: 'block' }}>
                  Lignes d'imputation comptable ({selectedEntry.lignes.length})
                </span>
                <div className="table-wrap">
                  <table className="balance-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '16%' }}>Compte</th>
                        <th style={{ width: '28%' }}>Intitulé</th>
                        <th style={{ width: '28%' }}>Libellé ligne</th>
                        <th className="text-right" style={{ width: '14%' }}>Débit</th>
                        <th className="text-right" style={{ width: '14%' }}>Crédit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntry.lignes.map((l, idx) => (
                        <tr key={l.id || idx}>
                          <td className="account-cell font-mono" style={{ fontWeight: 700, color: '#166534' }}>
                            {l.accountNumber}
                          </td>
                          <td>{l.accountLabel}</td>
                          <td style={{ color: '#64748b' }}>{l.description || selectedEntry.description}</td>
                          <td className="text-right font-mono">{l.debit > 0 ? `${money(l.debit)} FCFA` : '—'}</td>
                          <td className="text-right font-mono">{l.credit > 0 ? `${money(l.credit)} FCFA` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

      {/* Styles d'impression dédiés A4 Paysage pour window.print() */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          html, body, #root, .app-layout, .main-content, .page-content {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          .no-print, .sidebar, header, .app-header, nav, .card-heading, .compact-filter-bar {
            display: none !important;
          }
          .card {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: transparent !important;
          }
          .journal-screen-card {
            display: none !important;
          }
          .journal-print-document {
            display: block !important;
          }
          .journal-print-table {
            width: 100% !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .journal-print-table th {
            background-color: #275a43 !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr {
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}</style>
    </div>
  );
}
