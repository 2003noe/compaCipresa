import { useMemo, useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { CalendarDays, ChevronDown, CloudUpload, Paperclip, PlusCircle, Trash2, CheckCircle2, XCircle } from 'lucide-react';

const initialLines = [
  { account: '411100', label: 'Client coopérative boundiali', debit: 4200000, credit: 0 },
  { account: '701100', label: 'Ventes de marchandises de café', debit: 0, credit: 3500000 },
  { account: '443100', label: 'TVA facturée 18%', debit: 0, credit: 700000 },
  { account: '', label: '', debit: 0, credit: 0 },
];

const money = (value) => new Intl.NumberFormat('fr-FR').format(value || 0);

export default function JournalEntryForm() {
  const [lines, setLines] = useState(initialLines);
  const [attachment, setAttachment] = useState('Facture_Boundiali_88.pdf');
  const [message, setMessage] = useState('');

  const totals = useMemo(() => lines.reduce((acc, line) => ({
    debit: acc.debit + Number(line.debit || 0),
    credit: acc.credit + Number(line.credit || 0),
  }), { debit: 0, credit: 0 }), [lines]);

  const balanced = totals.debit === totals.credit;

  const updateLine = (index, field, value) => {
    setLines((current) => current.map((line, i) => i === index ? { ...line, [field]: field === 'debit' || field === 'credit' ? value.replace(/\D/g, '') : value } : line));
  };

  const addLine = () => setLines((current) => [...current, { account: '', label: '', debit: 0, credit: 0 }]);
  const removeLine = (index) => setLines((current) => current.filter((_, i) => i !== index));

  return (
    <div className="page-content entry-page">
      <div className="entry-title-row">
        <div><h1 className="page-title">Nouvelle écriture comptable</h1><p className="page-subtitle">Enregistrez une transaction dans vos journaux auxiliaires</p></div>
        <div className={`balanced-pill ${balanced ? 'ok' : 'warning'}`}><CheckCircle2 size={14}/>{balanced ? 'Écriture équilibrée ✓' : 'Écriture déséquilibrée'}</div>
      </div>

      <div className="entry-grid">
        <div className="entry-main-col">
          <Card className="entry-meta-card">
            <div className="entry-fields-grid">
              <Input label="Date d'écriture" placeholder="15 Oct 2025" icon={CalendarDays}/>
              <Select label="Journal comptable"><option>Journal des ventes (VE)</option><option>Journal des achats (HA)</option><option>Opérations diverses (OD)</option><option>Banque (BQ)</option></Select>
              <Input label="N° de Pièce" placeholder="VE-2025-0052"/>
              <Input label={<>Référence externe<br/>(Optionnel)</>} placeholder="Facture COOP-88"/>
            </div>
          </Card>

          <Card className="entry-lines-card">
            <h2 className="section-title">Lignes d'écriture</h2>
            <div className="entry-table">
              <div className="entry-table-head"><span>N° Compte</span><span>Libellé de l'écriture</span><span className="right">Débit (FCFA)</span><span className="right">Crédit (FCFA)</span><span></span></div>
              {lines.map((line, index) => (
                <div className={`entry-table-row ${index === lines.length - 1 && !line.account ? 'empty-row' : ''}`} key={index}>
                  <input className="entry-cell-input account-cell" value={line.account} onChange={(e) => updateLine(index, 'account', e.target.value)} placeholder="Saisir compte..." />
                  <input className="entry-cell-input label-cell" value={line.label} onChange={(e) => updateLine(index, 'label', e.target.value)} placeholder="Saisir libellé de la ligne..." />
                  <input className="entry-cell-input money-cell" inputMode="numeric" value={line.debit ? money(line.debit) : ''} onChange={(e) => updateLine(index, 'debit', e.target.value)} placeholder="0" />
                  <input className="entry-cell-input money-cell" inputMode="numeric" value={line.credit ? money(line.credit) : ''} onChange={(e) => updateLine(index, 'credit', e.target.value)} placeholder="0" />
                  <button type="button" className="delete-line" disabled={lines.length === 1} onClick={() => removeLine(index)}><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
            <button type="button" className="add-line" onClick={addLine}><PlusCircle size={15}/> Ajouter une ligne</button>
            <div className="entry-total-row"><strong>Total général</strong><strong>{money(totals.debit)} FCFA</strong><strong>{money(totals.credit)} FCFA</strong></div>
          </Card>

          <div className="entry-actions"><Button variant="secondary" onClick={() => setMessage('Brouillon enregistré dans la démo.')}>Enregistrer en brouillon</Button><Button onClick={() => setMessage(balanced ? 'Écriture validée dans la démo.' : 'Impossible de valider : les totaux doivent être équilibrés.')}>Valider l'écriture</Button><button type="button" className="text-button" onClick={() => setMessage('')}>Annuler</button></div>
          {message && <div className="success-message">{message}</div>}
        </div>

        <Card className="attachment-card">
          <h2 className="section-title">Pièces justificatives</h2>
          <label className="upload-dropzone"><input type="file" hidden onChange={(e) => setAttachment(e.target.files?.[0]?.name || '')}/><CloudUpload size={23}/><strong>Glissez-déposez un fichier</strong><span>PDF, PNG ou JPEG jusqu'à 10MB</span></label>
          {attachment && <div className="attachment-item"><Paperclip size={18}/><div><strong>{attachment}</strong><span>1.2 MB — Ajouté par vous</span></div><button type="button" onClick={() => setAttachment('')}><XCircle size={16}/></button></div>}
        </Card>
      </div>
    </div>
  );
}
