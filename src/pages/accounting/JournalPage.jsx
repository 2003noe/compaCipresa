// src/pages/accounting/JournalPage.jsx

import { useEffect, useMemo, useState } from 'react';
import { Edit2, Trash2, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const ATTACHMENT_BUCKET = 'pieces-justificatives';

const money = (v) => Number(v || 0).toLocaleString('fr-FR');

const isImage = (piece) =>
  (piece.type || '').startsWith('image/') || /\.(png|jpe?g)$/i.test(piece.reference || piece.fichier_url || '');

// Aperçu cliquable d'une pièce justificative
function PieceThumb({ piece, url }) {
  const open = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const base = {
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
  };

  return (
    <button
      type="button"
      onClick={open}
      disabled={!url}
      title={piece.reference || 'Ouvrir la pièce'}
      style={base}
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

export default function JournalPage() {
  const nav = useNavigate();
  const [rowsValidees, setRowsValidees] = useState([]);
  const [rowsBrouillons, setRowsBrouillons] = useState([]);
  const [pieceUrls, setPieceUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deleting, setDeleting] = useState(null);

  // Charger les écritures (validées + brouillons) avec leurs pièces
  useEffect(() => {
    let active = true;

    if (!supabaseConfigured) {
      setError("Supabase n'est pas configuré.");
      setLoading(false);
      return undefined;
    }

    (async () => {
      const { data, error: err } = await supabase
        .from('ecritures_comptables')
        .select('id,numero,date_ecriture,libelle,reference_piece,statut,lignes_ecritures(debit,credit),pieces_comptables(id,type,reference,fichier_url)')
        .order('date_ecriture', { ascending: false })
        .limit(200);

      if (!active) return;

      if (err) {
        setError(`Impossible de charger le journal : ${err.message}`);
        setLoading(false);
        return;
      }

      const validees = [];
      const brouillons = [];

      (data || []).forEach((entry) => {
        const lignes = entry.lignes_ecritures || [];
        const debit = lignes.reduce((acc, l) => acc + Number(l.debit || 0), 0);
        const credit = lignes.reduce((acc, l) => acc + Number(l.credit || 0), 0);
        const validee = entry.statut === 'VALIDEE';

        const row = {
          id: entry.id,
          date: entry.date_ecriture,
          ref: entry.reference_piece || entry.numero,
          description: entry.libelle,
          debit: `${money(debit)} FCFA`,
          credit: `${money(credit)} FCFA`,
          status: validee ? 'Validée' : 'Brouillon',
          statusTone: validee ? 'success' : 'warning',
          pieces: entry.pieces_comptables || [],
        };

        (validee ? validees : brouillons).push(row);
      });

      setRowsValidees(validees);
      setRowsBrouillons(brouillons);
      setLoading(false);

      // URLs signées pour ouvrir/prévisualiser les justificatifs
      const paths = [...validees, ...brouillons]
        .flatMap((r) => r.pieces.map((p) => p.fichier_url))
        .filter(Boolean);

      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .createSignedUrls(paths, 3600);
        if (!active) return;
        const map = {};
        (signed || []).forEach((s) => {
          if (s.signedUrl) map[s.path] = s.signedUrl;
        });
        setPieceUrls(map);
      }
    })();

    return () => { active = false; };
  }, []);

  const matches = (row) =>
    `${row.ref} ${row.description}`.toLowerCase().includes(query.toLowerCase());

  const filteredValidees = useMemo(() => rowsValidees.filter(matches), [rowsValidees, query]);
  const filteredBrouillons = useMemo(() => rowsBrouillons.filter(matches), [rowsBrouillons, query]);

  // Continuer l'édition : le formulaire recharge les champs déjà saisis
  const handleContinuer = (id) => {
    nav(`/nouvelle-ecriture?edit=${id}`);
  };

  // Supprimer un brouillon (pièces, lignes, puis écriture)
  const handleSupprimer = async (row) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette écriture en brouillon ?')) {
      return;
    }

    setDeleting(row.id);
    setError('');
    setNotice('');

    try {
      const paths = row.pieces.map((p) => p.fichier_url).filter(Boolean);
      if (paths.length) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
      }

      const piecesRes = await supabase.from('pieces_comptables').delete().eq('ecriture_id', row.id);
      if (piecesRes.error) throw piecesRes.error;

      const lignesRes = await supabase.from('lignes_ecritures').delete().eq('ecriture_id', row.id);
      if (lignesRes.error) throw lignesRes.error;

      const { error: err } = await supabase
        .from('ecritures_comptables')
        .delete()
        .eq('id', row.id);
      if (err) throw err;

      setRowsBrouillons((prev) => prev.filter((r) => r.id !== row.id));
      setNotice('Écriture supprimée avec succès.');
    } catch (err) {
      setError(`Erreur lors de la suppression : ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const renderHead = (withActions) => (
    <thead>
      <tr>
        <th>Date</th>
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
      <td className="account-cell">{row.ref}</td>
      <td>{row.description}</td>
      <td className="text-right">{row.debit}</td>
      <td className="text-right">{row.credit}</td>
      <td><PiecesCell pieces={row.pieces} urls={pieceUrls} /></td>
      <td><Badge tone={row.statusTone}>{row.status}</Badge></td>
    </>
  );

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

      {/* Recherche commune aux deux sections */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Rechercher par référence ou description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      {/* SECTION 1 : ÉCRITURES VALIDÉES (en haut) */}
      <Card style={{ marginBottom: '32px' }}>
        <div className="card-heading" style={{ marginBottom: '16px' }}>
          <div>
            <h2 className="section-title">✅ Écritures validées</h2>
            <p className="page-subtitle">{filteredValidees.length} écriture(s) comptabilisée(s)</p>
          </div>
        </div>

        {loading ? (
          <p className="page-subtitle">Chargement...</p>
        ) : filteredValidees.length === 0 ? (
          <p className="page-subtitle">Aucune écriture validée pour le moment.</p>
        ) : (
          <div className="table-wrap">
            <table className="balance-table">
              {renderHead(false)}
              <tbody>
                {filteredValidees.map((row) => (
                  <tr key={row.id}>{renderCells(row)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* SECTION 2 : BROUILLONS (en bas) */}
      {rowsBrouillons.length > 0 && (
        <Card>
          <div className="card-heading" style={{ marginBottom: '16px' }}>
            <div>
              <h2 className="section-title">📝 Écritures en brouillon</h2>
              <p className="page-subtitle">{filteredBrouillons.length} écriture(s) en attente de validation</p>
            </div>
          </div>

          {filteredBrouillons.length === 0 ? (
            <p className="page-subtitle">Aucune écriture en brouillon.</p>
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
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}