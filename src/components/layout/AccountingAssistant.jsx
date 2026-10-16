import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, RotateCcw, Send, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { askAccountingAssistant } from "../../services/assistant";
import { useExercice } from "../../context/ExerciceContext";
import { useAuth } from "../../context/AuthContext";

const suggestions = [
  "Explique-moi cette page avec des mots simples.",
  "Que signifient les principaux chiffres affichés ?",
  "Quelles vérifications comptables dois-je faire ?",
];

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function MessageText({ text }) {
  return <div className="assistant-message-text">{String(text || "").split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <span key={index}>{part}</span>,
  )}</div>;
}

export default function AccountingAssistant() {
  const location = useLocation();
  const { selectedExercice, selectedExerciceId } = useExercice();
  const { selectedEntreprise, selectedEntrepriseId } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const transcriptRef = useRef(null);
  const generationRef = useRef(0);
  const page = useMemo(() => `${location.pathname}${location.search}`, [location]);

  // Do not keep context from a different company or accounting year in the transcript.
  useEffect(() => {
    generationRef.current += 1;
    setMessages([]);
    setQuestion("");
    setBusy(false);
  }, [selectedEntrepriseId, selectedExerciceId]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, open]);

  async function submit(text = question) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setQuestion("");
    setBusy(true);
    const requestGeneration = generationRef.current;
    const responseId = newId();
    const conversation = messages
      .filter((message) => !message.error && !message.pending && ["user", "assistant"].includes(message.role))
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", content: prompt },
      { id: responseId, role: "assistant", content: "", pending: true },
    ]);

    try {
      const { data, error } = await askAccountingAssistant({
        question: prompt,
        page,
        conversation,
        displayedData: {
          entreprise: selectedEntreprise?.nom || null,
          exercice: selectedExercice ? { code: selectedExercice.code, annee: selectedExercice.annee } : null,
          chiffresEtTexteVisibles: (document.querySelector(".page-content")?.innerText || document.body.innerText || "").slice(0, 12000),
        },
      });
      if (requestGeneration !== generationRef.current) return;

      let answer = data?.answer || "Groq n’a renvoyé aucun texte.";
      if (error) {
        let details = error.message || "La fonction Supabase a échoué.";
        try {
          const response = error.context?.clone ? error.context.clone() : null;
          const body = response ? await response.json() : null;
          const providerStatus = body?.providerStatus || error.status;
          if (providerStatus === 429) {
            const retry = body.retryAfter ? ` Réessayez dans environ ${body.retryAfter} secondes.` : " Le quota gratuit ou la limite de débit est atteint; attendez son renouvellement avant de réessayer.";
            details = `Groq a refusé la requête parce que la limite de l’offre gratuite est atteinte.${retry}`;
          } else if (providerStatus === 503) {
            details = "Groq est temporairement indisponible ou saturé. La fonction a réessayé automatiquement; réessayez dans quelques minutes.";
          } else if (body?.error) {
            details = `Erreur Groq (${body.model || "modèle sélectionné"}) : ${body.error}`;
          }
        } catch { /* Certaines erreurs ne contiennent pas de réponse JSON. */ }
        console.error("Accounting assistant invocation failed:", error);
        answer = details;
      } else if (data?.incomplete) {
        answer += "\n\nLa réponse a été interrompue par la limite de génération. Vous pouvez demander « continue » pour la suite.";
      }

      setMessages((current) => current.map((message) => message.id === responseId
        ? { ...message, content: answer, pending: false, error: Boolean(error) }
        : message));
    } catch (error) {
      if (requestGeneration !== generationRef.current) return;
      console.error("Accounting assistant request failed:", error);
      setMessages((current) => current.map((message) => message.id === responseId
        ? { ...message, content: `La requête a échoué : ${error?.message || "erreur réseau inconnue"}. Réessayez dans un instant.`, pending: false, error: true }
        : message));
    } finally {
      if (requestGeneration === generationRef.current) setBusy(false);
    }
  }

  function clearConversation() {
    generationRef.current += 1;
    setMessages([]);
    setQuestion("");
    setBusy(false);
  }

  return <>
    <button type="button" className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label="Assistant comptable"><Bot size={20} /></button>
    {open && <section className="assistant-panel" aria-label="Assistant comptable">
      <header className="assistant-header">
        <div><strong>Assistant comptable</strong><small>{selectedEntreprise?.nom || "Entreprise"}{selectedExercice ? ` · ${selectedExercice.code}` : ""}</small></div>
        <div className="assistant-header-actions">
          <button type="button" onClick={clearConversation} aria-label="Effacer la conversation" title="Nouvelle conversation"><RotateCcw size={16} /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer"><X size={17} /></button>
        </div>
      </header>
      <p className="assistant-privacy">Votre question et les chiffres visibles de cette page sont envoyés à Groq pour générer une réponse. N’incluez pas de données confidentielles.</p>
      {messages.length === 0 && <div className="assistant-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => { setQuestion(suggestion); submit(suggestion); }} disabled={busy}>{suggestion}</button>)}</div>}
      <div className="assistant-messages" ref={transcriptRef} aria-live="polite">
        {messages.length === 0 && <p className="assistant-empty">Posez une question sur cette page. Vos échanges restent visibles pendant votre session.</p>}
        {messages.map((message) => <article key={message.id} className={`assistant-message assistant-message-${message.role}${message.error ? " is-error" : ""}`}>
          <strong>{message.role === "user" ? "Vous" : "Assistant"}{message.pending ? " · Réponse en cours…" : ""}</strong>
          {message.pending
            ? <span className="assistant-typing" role="status" aria-label="L’assistant rédige"><i /><i /><i /></span>
            : <MessageText text={message.content} />}
        </article>)}
      </div>
      <form className="assistant-composer" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Posez votre question…" rows={2} disabled={busy} />
        <button type="submit" disabled={busy || !question.trim()} aria-label="Envoyer la question"><Send size={17} /></button>
      </form>
    </section>}
  </>;
}
