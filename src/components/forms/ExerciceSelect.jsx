import Select from '../ui/Select';
import { useExercice } from '../../context/ExerciceContext';

/** Select a form-specific accounting year, initially following the topbar choice. */
export default function ExerciceSelect({ value, onChange, disabled = false }) {
  const { exercices, loading } = useExercice();

  return (
    <Select
      label="Exercice comptable"
      required
      value={value || ''}
      onChange={onChange}
      disabled={disabled || loading}
    >
      <option value="">Sélectionner un exercice…</option>
      {exercices.map((exercice) => (
        <option key={exercice.id} value={exercice.id}>
          {exercice.code || exercice.annee} ({exercice.date_debut} – {exercice.date_fin})
        </option>
      ))}
    </Select>
  );
}
