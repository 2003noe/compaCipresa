import { useState } from 'react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Toggle from '../ui/Toggle';
import Button from '../ui/Button';

export default function AccountForm() {
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState('Actif');
  const [lettrable, setLettrable] = useState(true);
  const [reconciliable, setReconciliable] = useState(false);
  const submit = (another = false) => setSaved(another ? 'another' : 'saved');

  return <div className="page-content form-page account-form-page">
    <div className="page-header"><div><h1 className="page-title">Nouveau compte comptable</h1><p className="page-subtitle">Créez un nouveau compte dans votre plan comptable SYSCOHADA</p></div></div>
    <Card className="account-card">
      <div className="form-section precise-section"><h2>Identification du compte</h2>
        <div className="grid grid-2"><Input label="Numéro de compte" placeholder="Ex: 411001"/><Input label="Libellé du compte" placeholder="Ex: Client - Coopérative Gagnoa"/>
          <Select label="Classe de compte"><option>Classe 4 - Comptes de tiers</option><option>Classe 1 - Ressources durables</option><option>Classe 2 - Actif immobilisé</option><option>Classe 5 - Trésorerie</option><option>Classe 6 - Charges</option><option>Classe 7 - Produits</option></Select>
          <fieldset className="radio-field"><legend>Type de compte</legend><div className="radio-row">{['Actif','Passif','Charge','Produit'].map(option => <label key={option}><input type="radio" name="accountType" checked={type === option} onChange={() => setType(option)}/><span>{option}</span></label>)}</div></fieldset>
        </div>
      </div>
      <div className="form-section precise-section"><h2>Configuration &amp; Propriétés</h2>
        <div className="grid grid-2"><Select label="Compte parent"><option>411000 - Clients ordinaires</option><option>401000 - Fournisseurs</option><option>512000 - Banques</option></Select><Select label="Devise"><option>FCFA (XOF)</option><option>EUR (€)</option><option>USD ($)</option></Select></div>
        <div className="toggle-pair"><Toggle label="Lettrable" description="Permet d'associer des débits et des crédits" checked={lettrable} onChange={() => setLettrable(v => !v)}/><Toggle label="Réconciliable" description="Soumis au rapprochement de trésorerie" checked={reconciliable} onChange={() => setReconciliable(v => !v)}/></div>
        <Input label="Notes / Description" placeholder="Ajoutez des détails internes sur l'affectation ou l'usage réglementaire de ce compte..."/>
      </div>
      <div className="form-section precise-section opening-section"><h2>Solde d'ouverture</h2><div className="grid grid-2"><Input label="Solde débiteur (FCFA)" placeholder="0"/><Input label="Solde créditeur (FCFA)" placeholder="0"/></div></div>
      <div className="form-actions left-actions"><Button onClick={() => submit(false)}>Enregistrer le compte</Button><Button variant="secondary" onClick={() => submit(true)}>Enregistrer et créer un autre</Button><button className="text-button" type="button">Annuler</button></div>
      {saved && <div className="success-message">{saved === 'another' ? 'Compte enregistré. Le formulaire est prêt pour une nouvelle saisie.' : 'Compte enregistré dans la démo. Il sera relié à l’API ultérieurement.'}</div>}
    </Card>
  </div>;
}
