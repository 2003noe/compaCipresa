import { supabase } from "../lib/supabaseClient";

export async function askAccountingAssistant({ question, page, displayedData, conversation }) {
  return supabase.functions.invoke("accounting-assistant", {
    body: { question, page, displayedData, conversation },
  });
}
