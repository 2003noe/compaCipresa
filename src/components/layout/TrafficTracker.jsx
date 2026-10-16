import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';

// Enregistre seulement les chemins de page, jamais les paramètres d'URL ni
// le contenu affiché ou saisi. La politique RLS contrôle l'écriture.
export default function TrafficTracker() {
  const location = useLocation();
  const { session, selectedEntrepriseId } = useAuth();
  const lastEvent = useRef('');

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !selectedEntrepriseId || !location.pathname) return;
    const eventKey = `${userId}:${selectedEntrepriseId}:${location.pathname}`;
    if (lastEvent.current === eventKey) return;
    lastEvent.current = eventKey;

    supabase.from('activity_events').insert({
      entreprise_id: selectedEntrepriseId,
      user_id: userId,
      event_type: 'page_view',
      page_path: location.pathname,
    }).then(({ error }) => {
      if (error) console.warn('Journalisation de la visite indisponible:', error.message);
    });
  }, [session?.user?.id, selectedEntrepriseId, location.pathname]);

  return null;
}
