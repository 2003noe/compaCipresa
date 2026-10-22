import { useState, useEffect } from 'react';
import { X, Plus, FolderTree, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Toggle from '../ui/Toggle';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';

const ACCOUNT_CLASSES = [
  'Classe 1 - Ressources durables',
  'Classe 2 - Immobilisations',
  'Classe 3 - Stocks',
  'Classe 4 - Comptes de tiers',
  'Classe 5 - Trésorerie',
  'Classe 6 - Charges',
  'Classe 7 - Produits',
];

export default function SubAccountModal({
  isOpen,
  onClose,
  account,
  subAccounts = [],
  selectedExercice,
  onSubAccountCreated,
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [soldeDebit, setSoldeDebit] = useState('0');
  const [soldeCredit, setSoldeCredit] = useState('0');
  const [lettrable, setLettrable] = useState(false);
  const [reconciliable, setReconciliable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Proposer un code séquentiel par défaut quand le compte sélectionné change
  useEffect(() => {
    if (!account) return;
    const prefix = account.code;
    const existingCodes = (subAccounts || [])
      .map(s => s.code || s.numero)
      .filter(c => c && c.startsWith(prefix));

    let nextNumber = `${prefix}01`;
    if (existingCodes.length > 0) {
      const numbers = existingCodes
        .map(c => parseInt(c.slice(prefix.length), 10))
        .filter(n => !isNaN(n));
      if (numbers.length > 0) {
        const max = Math.max(...numbers);
        nextNumber = `${prefix}${String(max + 1).padStart(2, '0')}`;
      }
    }
    setCode(nextNumber);
    setLabel('');
    setSoldeDebit('0');
    setSoldeCredit('0');
    setError('');
    setSuccess('');
    setShowCreateForm(false);
  }, [account, subAccounts]);

  if (!isOpen || !account) return null;

  const totalDebit = subAccounts.reduce((sum, s) => sum + (Number(s.soldeDebit || s.solde_ouverture_debit || 0)), 0);
  const totalCredit = subAccounts.reduce((sum, s) => sum + (Number(s.soldeCredit || s.solde_ouverture_credit || 0)), 0);
  const netBalance = totalDebit - totalCredit;

  const handleSaveSubAccount = async (e) => {
    e?.preventDefault();
    setError('');
    setSuccess('');

    if (!code.trim() || !label.trim()) {
      setError('Veuillez renseigner le numéro et le libellé du sous-compte.');
      return;
    }

    if (!code.trim().startsWith(account.code)) {
      setError(`Le numéro de compte doit obligatoirement débuter par la racine ${account.code}.`);
      return;
    }

    if (!selectedExercice?.id) {
      setError('Aucun exercice comptable sélectionné.');
      return;
    }

    if (selectedExercice?.statut && selectedExercice.statut !== 'OUVERT') {
      setError("Impossible de créer un sous-compte dans un exercice clôturé.");
      return;
    }

    setSaving(true);

    try {
      const classeName = (account.classe >= 1 && account.classe <= 7)
        ? ACCOUNT_CLASSES[account.classe - 1]
        : (account.classeName || `Classe ${account.classe}`);

      const payload = {
        numero: code.trim(),
        libelle: label.trim(),
        classe: classeName,
        nature: account.nature || 'ACTIF',
        actif: true,
        compte_parent_id: account.dbId || null,
        devise: 'XAF',
        lettrable,
        reconciliable,
        solde_ouverture_debit: Number(soldeDebit) || 0,
        solde_ouverture_credit: Number(soldeCredit) || 0,
        exercice_id: selectedExercice.id,
      };

      const { data, error: insertError } = await supabase
        .from('comptes_comptables')
        .insert(payload)
        .select();

      if (insertError) {
        throw new Error(insertError.message);
      }

      setSuccess(`Le sous-compte ${code.trim()} a été créé avec succès.`);
      setLabel('');
      setSoldeDebit('0');
      setSoldeCredit('0');
      setShowCreateForm(false);

      if (onSubAccountCreated) {
        onSubAccountCreated(data?.[0] || payload);
      }
    } catch (err) {
      setError(`Erreur lors de la création : ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="subaccounts-modal-backdrop" onClick={onClose}>
      <div className="subaccounts-modal-box" onClick={(e) => e.stopPropagation()}>
        
        {/* En-tête */}
        <div className="subaccounts-modal-header">
          <div>
            <div className="subaccounts-modal-title">
              <FolderTree size={22} />
              <span>Compte {account.code} — {account.label}</span>
            </div>
            <p className="subaccounts-modal-subtitle">
              {account.theme || `Classe ${account.classe}`} • Nature : {account.nature || 'Standard'} • Exercice : {selectedExercice?.code || 'Actif'}
            </p>
            {account.details && (
              <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.9, fontStyle: 'italic' }}>
                Précisions : {account.details}
              </div>
            )}
          </div>
          <button className="subaccounts-modal-close" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        {/* Corps */}
        <div className="subaccounts-modal-body">

          {/* Synthèse rapide */}
          <div className="subaccounts-stats-row">
            <div className="subaccounts-stat-card">
              <div className="subaccounts-stat-label">Sous-comptes créés</div>
              <div className="subaccounts-stat-value">{subAccounts.length}</div>
            </div>
            <div className="subaccounts-stat-card">
              <div className="subaccounts-stat-label">Total Débit d'ouverture</div>
              <div className="subaccounts-stat-value">{totalDebit.toLocaleString('fr-FR')} XAF</div>
            </div>
            <div className="subaccounts-stat-card">
              <div className="subaccounts-stat-label">Solde Net</div>
              <div className="subaccounts-stat-value" style={{ color: netBalance >= 0 ? '#10b981' : '#ef4444' }}>
                {netBalance.toLocaleString('fr-FR')} XAF
              </div>
            </div>
          </div>

          {/* Notifications */}
          {error && (
            <div className="message error" style={{ margin: 0 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="message success" style={{ margin: 0 }}>
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* Bloc de création de sous-compte */}
          <div className={`subaccounts-create-box ${showCreateForm ? 'active' : ''}`}>
            <div className="subaccounts-create-header">
              <h3>
                <Plus size={16} color="var(--color-primary)" />
                <span>Nouveau sous-compte rattaché à {account.code}</span>
              </h3>
              <Button
                variant={showCreateForm ? 'secondary' : 'primary'}
                onClick={() => setShowCreateForm(v => !v)}
              >
                {showCreateForm ? 'Masquer le formulaire' : '+ Créer un sous-compte'}
              </Button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleSaveSubAccount} style={{ marginTop: 16 }}>
                <div className="grid grid-2" style={{ gap: 14 }}>
                  <Input
                    label="Numéro du sous-compte *"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={`Ex: ${account.code}01`}
                    required
                  />
                  <Input
                    label="Libellé du sous-compte *"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Ex: Client ordinaire - Agence Yaoundé"
                    required
                  />
                  <Input
                    label="Solde d'ouverture débit (XAF)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={soldeDebit}
                    onChange={(e) => setSoldeDebit(e.target.value)}
                  />
                  <Input
                    label="Solde d'ouverture crédit (XAF)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={soldeCredit}
                    onChange={(e) => setSoldeCredit(e.target.value)}
                  />
                </div>

                <div className="toggle-pair" style={{ marginTop: 12 }}>
                  <Toggle
                    label="Lettrable"
                    description="Rapprochement pièces débits et crédits"
                    checked={lettrable}
                    onChange={setLettrable}
                  />
                  <Toggle
                    label="Réconciliable"
                    description="Rapprochement de trésorerie"
                    checked={reconciliable}
                    onChange={setReconciliable}
                  />
                </div>

                <div className="flex gap-2" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                  <Button variant="secondary" type="button" onClick={() => setShowCreateForm(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <><Loader2 size={15} className="spin" /> Enregistrement…</> : 'Enregistrer le sous-compte'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Liste des sous-comptes existants */}
          <div>
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                Sous-comptes enregistrés ({subAccounts.length})
              </h4>
            </div>

            {subAccounts.length === 0 ? (
              <div className="subaccounts-empty">
                <p style={{ margin: 0, fontWeight: 600 }}>Aucun sous-compte n'est encore enregistré sous le compte {account.code}.</p>
                <p style={{ margin: '6px 0 14px 0', fontSize: 12 }}>
                  Vous pouvez en créer un dès maintenant en cliquant sur le bouton ci-dessus.
                </p>
                <Button variant="secondary" icon={Plus} onClick={() => setShowCreateForm(true)}>
                  Créer un sous-compte
                </Button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Libellé</th>
                      <th className="text-right">Débit</th>
                      <th className="text-right">Crédit</th>
                      <th className="text-right">Solde</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subAccounts.map((sub, idx) => {
                      const deb = Number(sub.soldeDebit || sub.solde_ouverture_debit || 0);
                      const cred = Number(sub.soldeCredit || sub.solde_ouverture_credit || 0);
                      const solde = deb - cred;
                      return (
                        <tr key={sub.id || idx}>
                          <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                            {sub.code || sub.numero}
                          </td>
                          <td style={{ fontWeight: 500 }}>
                            {sub.label || sub.libelle}
                          </td>
                          <td className="text-right">
                            {deb.toLocaleString('fr-FR')} {sub.devise || 'XAF'}
                          </td>
                          <td className="text-right">
                            {cred.toLocaleString('fr-FR')} {sub.devise || 'XAF'}
                          </td>
                          <td className="text-right" style={{ fontWeight: 600, color: solde >= 0 ? '#10b981' : '#ef4444' }}>
                            {solde.toLocaleString('fr-FR')} {sub.devise || 'XAF'}
                          </td>
                          <td>
                            <span className="badge badge-success">
                              {sub.status || (sub.actif !== false ? 'Actif' : 'Inactif')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
