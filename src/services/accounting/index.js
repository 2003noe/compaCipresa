import { supabase } from "../../lib/supabaseClient";

// Accounting domain facade. Tenant isolation and authorization are enforced by
// PostgreSQL RLS; the exercise id remains an explicit business filter.
export const accountingService = {
  listExercises() {
    return supabase.from("exercices_comptables")
      .select("id,code,annee,date_debut,date_fin,statut")
      .order("annee", { ascending: false });
  },
  listJournals() {
    return supabase.from("journaux").select("id,code,libelle,type").order("code");
  },
  balances(exerciseId, dateStart, dateEnd) {
    return supabase.rpc("soldes_comptes_exercice", {
      p_exercice_id: exerciseId,
      p_date_debut: dateStart,
      p_date_fin: dateEnd,
    });
  },
};

export { accountController } from "./accountController";
