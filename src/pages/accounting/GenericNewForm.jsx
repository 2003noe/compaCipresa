import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useState } from 'react';

const presets = {
  treasury: { title:'Nouvelle opération de trésorerie', subtitle:'Enregistrez un mouvement de caisse ou de banque', fields:[['Type d’opération','select'],['Date','date'],['Libellé','text'],['Montant','text']] },
  bank: { title:'Nouveau rapprochement bancaire', subtitle:'Associez les écritures comptables au relevé bancaire', fields:[['Compte bancaire','select'],['Date du relevé','date'],['Référence relevé','text'],['Solde relevé','text']] },
  tax: { title:'Nouvelle déclaration fiscale', subtitle:'Préparez une nouvelle déclaration de TVA et taxes', fields:[['Période','select'],['Date limite','date'],['TVA collectée','text'],['TVA déductible','text']] },
  closing: { title:'Nouvelle clôture comptable', subtitle:'Préparez la clôture de l’exercice ou d’une période', fields:[['Période','select'],['Date de clôture','date'],['Responsable','text'],['Commentaire','text']] },
  grand: { title:'Nouvelle vue du grand livre', subtitle:'Configurez les paramètres d’affichage du grand livre', fields:[['Compte','select'],['Du','date'],['Au','date'],['Format','select']] },
  balance: { title:'Générer une balance', subtitle:'Configurez les critères de génération de la balance générale', fields:[['Exercice','select'],['Du compte','text'],['Au compte','text'],['Format','select']] },
  result: { title:'Nouveau compte de résultat', subtitle:'Préparez les paramètres du compte de résultat', fields:[['Exercice','select'],['Période','select'],['Format','select'],['Commentaire','text']] },
};

export default function GenericNewForm({type}) {
  const config=presets[type] || presets.treasury; const [saved,setSaved]=useState(false);
  const options = ['Exercice 2025-2026','Janvier 2026','Février 2026'];
  return <div className="page-content form-page"><div className="page-header"><div><h1 className="page-title">{config.title}</h1><p className="page-subtitle">{config.subtitle}</p></div></div><Card><div className="form-section"><h2>Informations</h2><div className="grid grid-2">{config.fields.map(([label,kind])=>kind==='select'?<Select key={label} label={label}><option>{options[0]}</option><option>{options[1]}</option><option>{options[2]}</option></Select>:<Input key={label} label={label} type={kind} placeholder={kind==='text'?'Saisissez une valeur…':''}/>)}</div></div><div className="form-section"><h2>Commentaires</h2><Input label="Notes / Description" placeholder="Ajoutez des informations complémentaires…"/></div><div className="form-actions left-actions"><Button onClick={()=>setSaved(true)}>Enregistrer</Button><button className="text-button">Annuler</button></div>{saved&&<div className="success-message">Enregistrement effectué dans la démo.</div>}</Card></div>
}
