import { supabase } from "../lib/supabaseClient";

// Boundary for the company domain. The database remains the source of truth
// for membership, active tenant and authorization.
export const companiesService = {
  async listMemberships(userId) {
    return supabase
      .from("entreprise_utilisateurs")
      .select("entreprise_id,role_id,entreprise:entreprises(id,nom),role:roles(id,code,nom)")
      .eq("user_id", userId);
  },
  async setActive(entrepriseId) {
    return supabase.rpc("switch_active_entreprise", { p_entreprise_id: entrepriseId });
  },
  async provision(entrepriseName) {
    return supabase.rpc("create_entreprise_for_current_user", { p_nom: entrepriseName });
  },
  async addExistingUser(email, roleCode) {
    return supabase.rpc("add_user_to_active_company", { p_email: email, p_role_code: roleCode });
  },
};
