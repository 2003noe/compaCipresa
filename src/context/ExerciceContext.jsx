import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";
import { accountingService } from "../services/accounting";

const ExerciceContext = createContext(undefined);
const STORAGE_KEY = "cipresa-exercice";

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export function ExerciceProvider({ children }) {
  const { session, selectedEntrepriseId } = useAuth();
  const [exercices, setExercices] = useState([]);
  const [selectedExerciceId, setSelectedExerciceIdState] = useState(readStored);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabaseConfigured || !supabase || !session?.user || !selectedEntrepriseId) {
      setExercices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await accountingService.listExercises();
    const list = data || [];
    setExercices(list);
    // Exercice mémorisé s'il existe encore, sinon exercice ouvert, sinon le plus récent
    setSelectedExerciceIdState((current) => {
      if (current && list.some((e) => e.id === current)) return current;
      return (list.find((e) => e.statut === "OUVERT") || list[0])?.id || "";
    });
    setLoading(false);
  }, [session?.user?.id, selectedEntrepriseId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const setSelectedExerciceId = useCallback((id) => {
    setSelectedExerciceIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* stockage indisponible, on ignore */
    }
  }, []);

  const selectedExercice = useMemo(
    () => exercices.find((e) => e.id === selectedExerciceId) || null,
    [exercices, selectedExerciceId],
  );

  const value = useMemo(
    () => ({
      exercices,
      selectedExerciceId,
      selectedExercice,
      setSelectedExerciceId,
      reloadExercices: load,
      loading,
    }),
    [exercices, selectedExerciceId, selectedExercice, setSelectedExerciceId, load, loading],
  );

  return <ExerciceContext.Provider value={value}>{children}</ExerciceContext.Provider>;
}

export function useExercice() {
  const ctx = useContext(ExerciceContext);
  if (!ctx) throw new Error("useExercice doit être utilisé à l'intérieur de <ExerciceProvider>");
  return ctx;
}
