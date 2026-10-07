// Point d'accès unique au client Supabase pour tous les modèles.
import { supabase } from "../lib/supabaseClient";

export function getClient() {
  if (!supabase) throw new Error("Supabase n'est pas configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  return supabase;
}
