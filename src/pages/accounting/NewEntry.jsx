
import { useSearchParams } from 'react-router-dom';
import JournalEntryForm from '../../components/forms/JournalEntryForm';

export default function NewEntry() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  return <JournalEntryForm editId={editId} />;
}