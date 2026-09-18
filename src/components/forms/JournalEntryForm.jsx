import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { CalendarDays, CloudUpload, Paperclip, PlusCircle, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const money = (value) => new Intl.NumberFormat('fr-FR').format(value || 0);
const today = () => new Date().toISOString().slice(0, 10);
const defaultPiece = () => `EC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

const ATTACHMENT_BUCKET = 'pieces-justificatives';
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ATTACHMENT_ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const initialLines = () => ([
  { account: '', label: '', debit: 0, credit: 0 },
  { account: '', label: '', debit: 0, credit: 0 },
]);

export default function JournalEntryForm() {
  const nav = useNavigate();
  const [lines, setLines] = useState(initialLines);
  const [date, setDate] = useState(today());
  const [piece, setPiece] = useState(defaultPiece());
  const [reference, setReference] = useState('');
  const [journals, setJournals] = useState([]);
  const [journalId, setJournalId] = useState('');
  const [exercise, setExercise] = useState(null);
  const [accountOptions, setAccountOptions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    Promise.all([
      supabase.from('exercices_comptables').select('id,code,annee,statut').eq('statut', 'OUVERT').order('annee', { ascending: false }).limit(1),
      supabase.from('journaux').select('id,code,libelle').order('code'),
      supabase.from('comptes_comptables').select('numero,libelle').order('numero'),
    ]).then(([ex, jr, ac]) => {
      setExercise(ex.data?.[0] || null);
      setJournals(jr.data || []);
      if (jr.data?.[0]) setJournalId(jr.data[0].id);
      setAccountOptions(ac.data || []);
    });
  }, []);

  const totals = useMemo(() => lines.reduce((acc, line) => ({
    debit: acc.debit + Number(line.debit || 0),
    credit: acc.credit + Number(line.credit || 0),
  }), { debit: 0, credit: 0 }), [lines]);

  const balanced = totals.debit === totals.credit && totals.debit > 0;

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: field === 'debit' || field === 'credit' ? Number(value.replace(/\D/g, '')) || 0 : value } : line)));
  };

  const addLine = () => setLines((current) => [...current, { account: '', label: '', debit: 0, credit: 0 }]);
  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  const addAttachments = (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const accepted = []; const rejected = [];
    incoming.forEach((file) => {
      const typeOk = ATTACHMENT_ACCEPTED_TYPES.includes(file.type) || /\.(pdf|png|jpe?g)$/i.test(file.name);
      if (!typeOk) { rejected.push(`${file.name} (format non supporté)`); return; }
      if (file.size > ATTACHMENT_MAX_SIZE) { rejected.push(`${file.name} (> 10 Mo)`); return; }
      accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file });
    });
    if (accepted.length) setAttachments((current) => [...current, ...accepted]);
    if (rejected.length) setError(`Fichier(s) ignoré(s) : ${rejected.join(', ')}`);
  };
  const removeAttachment = (id) => setAttachments((current) => current.filter((a) => a.id !== id));
  const handleFileInputChange = (e) => { addAttachments(e.target.files); e.target.value = ''; };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); addAttachments(e.dataTransfer.files); };

  const save = async (statut) => {
    setError(''); setNotice('');

    if (lines.length < 2 || !balanced) {
      setError("L'écriture doit contenir au moins deux lignes et être équilibrée.");
      return;
    }
    if (!supabaseConfigured) { setError("Supabase n'est pas configuré."); return; }
    if (!exercise || !journalId) {
      setError("Aucun exercice ouvert ou journal disponible. Vérifiez la configuration comptable (voir plus bas).");
      return;
    }
    if (lines.some((l) => !l.account.trim() || !l.label.trim())) {
      setError('Chaque ligne doit avoir un numéro de compte et un libellé.');
      return;
    }

    setSaving(true);

    const { data: entry, error: insertError } = await supabase.from('ecritures_comptables').insert({
      numero: piece,
      date_ecriture: date,
      libelle: lines[0]?.label || 'Opération comptable',
      reference_piece: reference || piece,
      statut,
      exercice_id: exercise.id,
      journal_id: journalId,
    }).select('id').single();

    if (insertError) { setSaving(false); setError(insertError.message); return; }

    const accountRows = await supabase.from('comptes_comptables').select('id,numero').in('numero', lines.map((l) => l.account.trim()));
    if (accountRows.error) { setSaving(false); await supabase.from('ecritures_comptables').delete().eq('id', entry.id); setError(accountRows.error.message); return; }

    const accountMap = Object.fromEntries((accountRows.data || []).map((a) => [a.numero, a.id]));
    const missing = lines.map((l) => l.account.trim()).filter((numero) => !accountMap[numero]);
    if (missing.length) {
      setSaving(false);
      await supabase.from('ecritures_comptables').delete().eq('id', entry.id);
      setError(`Compte(s) introuvable(s) dans le plan comptable : ${[...new Set(missing)].join(', ')}`);
      return;
    }

    const lignes = lines.map((l) => ({ ecriture_id: entry.id, compte_id: accountMap[l.account.trim()], libelle: l.label.trim(), debit: Number(l.debit || 0), credit: Number(l.credit || 0) }));
    const linesResult = await supabase.from('lignes_ecritures').insert(lignes);
    if (linesResult.error) { setSaving(false); await supabase.from('ecritures_comptables').delete().eq('id', entry.id); setError(linesResult.error.message); return; }

    let attachmentNotice = '';
    if (attachments.length) {
      const failed = [];
      for (const attachment of attachments) {
        const safeName = attachment.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `${entry.id}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, attachment.file, { cacheControl: '3600', upsert: false });
        if (upload.error) { failed.push(`${attachment.file.name} (${upload.error.message})`); continue; }
        const pieceInsert = await supabase.from('pieces_comptables').insert({ ecriture_id: entry.id, type: attachment.file.type || 'application/octet-stream', reference: attachment.file.name, fichier_url: path });
        if (pieceInsert.error) failed.push(`${attachment.file.name} (${pieceInsert.error.message})`);
      }
      if (failed.length) attachmentNotice = `Écriture enregistrée, mais échec de dépôt pour : ${failed.join(', ')}`;
    }

    setSaving(false);
    setAttachments([]);
    setNotice(attachmentNotice || (statut === 'VALIDEE' ? 'Écriture validée.' : 'Écriture enregistrée en brouillon.'));
    window.setTimeout(() => nav('/journal'), 500);
  };

  return (
    <div className="page-content entry-page">
      <div className="entry-title-row">
        <div><h1 className="page-title">Nouvelle écriture comptable</h1><p className="page-subtitle">Enregistrez une transaction dans vos journaux auxiliaires</p></div>
        <div className={`balanced-pill ${balanced ? 'ok' : 'warning'}`}><CheckCircle2 size={14} />{balanced ? 'Écriture équilibrée ✓' : 'Écriture déséquilibrée'}</div>
      </div>

      <div className="entry-grid">
        <div className="entry-main-col">
          <Card className="entry-meta-card">
            <div className="entry-fields-grid">
              <Input label="Date d'écriture" type="date" icon={CalendarDays} value={date} onChange={(e) => setDate(e.target.value)} />
              <Select label="Journal comptable" value={journalId} onChange={(e) => setJournalId(e.target.value)}>
                {journals.length === 0 && <option value="">Aucun journal disponible</option>}
                {journals.map((j) => <option key={j.id} value={j.id}>{j.code} — {j.libelle}</option>)}
              </Select>
              <Input label="N° de Pièce" value={piece} onChange={(e) => setPiece(e.target.value)} />
              <Input label="Référence externe (optionnel)" placeholder="Facture COOP-88" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </Card>

          <Card className="entry-lines-card">
            <h2 className="section-title">Lignes d'écriture</h2>
            <datalist id="accounts-list">
              {accountOptions.map((a) => <option key={a.numero} value={a.numero}>{a.libelle}</option>)}
            </datalist>
            <div className="entry-table">
              <div className="entry-table-head"><span>N° Compte</span><span>Libellé de l'écriture</span><span className="right">Débit (FCFA)</span><span className="right">Crédit (FCFA)</span><span></span></div>
              {lines.map((line, index) => (
                <div className="entry-table-row" key={index}>
                  <input className="entry-cell-input account-cell" list="accounts-list" value={line.account} onChange={(e) => updateLine(index, 'account', e.target.value)} placeholder="Saisir compte..." />
                  <input className="entry-cell-input label-cell" value={line.label} onChange={(e) => updateLine(index, 'label', e.target.value)} placeholder="Saisir libellé de la ligne..." />
                  <input className="entry-cell-input money-cell" inputMode="numeric" value={line.debit ? money(line.debit) : ''} onChange={(e) => updateLine(index, 'debit', e.target.value)} placeholder="0" />
                  <input className="entry-cell-input money-cell" inputMode="numeric" value={line.credit ? money(line.credit) : ''} onChange={(e) => updateLine(index, 'credit', e.target.value)} placeholder="0" />
                  <button type="button" className="delete-line" disabled={lines.length <= 2} onClick={() => removeLine(index)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="add-line" onClick={addLine}><PlusCircle size={15} /> Ajouter une ligne</button>
            <div className="entry-total-row"><strong>Total général</strong><strong>{money(totals.debit)} FCFA</strong><strong>{money(totals.credit)} FCFA</strong></div>
          </Card>

          <div className="entry-actions">
            <Button variant="secondary" disabled={saving} onClick={() => save('BROUILLON')}>Enregistrer en brouillon</Button>
            <Button disabled={saving} onClick={() => save('VALIDEE')}>{saving ? 'Enregistrement…' : "Valider l'écriture"}</Button>
            <button type="button" className="text-button" onClick={() => nav('/journal')}>Annuler</button>
          </div>
          {error && <div className="message error" role="alert">{error}</div>}
          {notice && <div className="message success" role="status">{notice}</div>}
        </div>

        <Card className="attachment-card">
          <h2 className="section-title">Pièces justificatives</h2>
          <input ref={fileInputRef} type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={handleFileInputChange} />
          <div
            className={`upload-dropzone${dragOver ? ' drag-active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <CloudUpload size={23} /><strong>Glissez-déposez un fichier</strong><span>PDF, PNG ou JPEG jusqu'à 10 MB</span>
          </div>
          {attachments.map((a) => (
            <div className="attachment-item" key={a.id}>
              <Paperclip size={18} />
              <div><strong>{a.file.name}</strong><span>{formatFileSize(a.file.size)}</span></div>
              <button type="button" onClick={() => removeAttachment(a.id)}><XCircle size={16} /></button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
