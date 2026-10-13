import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { useEffect, useState } from 'react';
import { useExercice } from '../../context/ExerciceContext';
import { genererPeriodesMensuelles } from '../../lib/clotures';
import ExerciceSelect from '../../components/forms/ExerciceSelect';

const presets = {
  treasury: { title:'Nouvelle opération de trésorerie', subtitle:'Enregistrez un mouvement de caisse ou de banque', fields:[['Type d’opération','select'],['Date','date'],['Libellé','text'],['Montant','text']] },
  inventory: { title:"Nouvel arrêté d'inventaire", subtitle:"Configurez les critères de l'inventaire patrimonial", fields:[['Exercice','select'],['Date d’inventaire','date'],['Responsable','text'],['Méthode valorisation','select']] },
  closing: { title:'Nouvelle clôture comptable', subtitle:'Préparez la clôture de l’exercice ou d’une période', fields:[['Période','select'],['Date de clôture','date'],['Responsable','text'],['Commentaire','text']] },
  grand: { title:'Nouvelle vue du grand livre', subtitle:'Configurez les paramètres d’affichage du grand livre', fields:[['Compte','select'],['Du','date'],['Au','date'],['Format','select']] },
  balance: { title:'Générer une balance', subtitle:'Configurez les critères de génération de la balance générale', fields:[['Exercice','select'],['Du compte','text'],['Au compte','text'],['Format','select']] },
  result: { title:'Nouveau compte de résultat', subtitle:'Préparez les paramètres du compte de résultat', fields:[['Exercice','select'],['Période','select'],['Format','select'],['Commentaire','text']] },
};

export default function GenericNewForm({type}) {
  const { selectedExerciceId } = useExercice();
  const [formExerciceId, setFormExerciceId] = useState(selectedExerciceId);
  useEffect(() => setFormExerciceId(selectedExerciceId), [selectedExerciceId]);
  const formExercice = exercices.find((e) => e.id === formExerciceId) || null;
  const config=presets[type] || presets.treasury; const [saved,setSaved]=useState(false);
  const periods = genererPeriodesMensuelles(formExercice);
  return <div className="page-content form-page"><div className="page-header"><div><h1 className="page-title">{config.title}</h1><p className="page-subtitle">{config.subtitle} — exercice {formExercice?.code || 'non sélectionné'}</p></div></div><Card><div className="form-section"><h2>Informations</h2><ExerciceSelect value={formExerciceId} onChange={(event)=>setFormExerciceId(event.target.value)} /><div className="grid grid-2">{config.fields.filter(([label])=>label!=='Exercice').map(([label,kind])=>kind==='select'?<Select key={label} label={label}>{(label==='Période'?periods.map((p)=>p.libelle):label==='Type d’opération'?['Encaissement','Décaissement']:label==='Format'?['Écran','Excel','PDF']:['Standard']).map((option)=><option key={option}>{option}</option>)}</Select>:<Input key={label} label={label} type={kind} min={kind==='date'?formExercice?.date_debut:undefined} max={kind==='date'?formExercice?.date_fin:undefined} placeholder={kind==='text'?'Saisissez une valeur…':''}/>)}</div></div><div className="form-section"><h2>Commentaires</h2><Input label="Notes / Description" placeholder="Ajoutez des informations complémentaires…"/></div><div className="form-actions left-actions"><Button onClick={()=>setSaved(true)}>Enregistrer</Button><button className="text-button">Annuler</button></div>{saved&&<div className="success-message">Enregistrement effectué dans la démo.</div>}</Card></div>
}
