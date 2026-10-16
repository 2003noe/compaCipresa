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
  const inline = (value, keyPrefix) => value.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={key}>{part.slice(1, -1)}</code>;
    return part;
  });
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const blocks = [];
  let paragraph = [];
  let index = 0;
  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(<p key={`p-${index++}`}>{inline(paragraph.join(" ").trim(), `pi-${index}`)}</p>);
      paragraph = [];
    }
  };
  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) { flushParagraph(); continue; }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { flushParagraph(); blocks.push(<hr key={`hr-${index++}`} />); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = Math.min(heading[1].length, 4);
      const content = inline(heading[2].replace(/\s+#+$/, ""), `h-${index}`);
      blocks.push(level === 1 ? <h3 key={`h-${index++}`}>{content}</h3> : level === 2 ? <h4 key={`h-${index++}`}>{content}</h4> : <h5 key={`h-${index++}`}>{content}</h5>);
      continue;
    }
    if (isTableRow(line)) {
      flushParagraph();
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) rows.push(lines[i++].trim());
      i -= 1;
      const cells = rows.map((row) => row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
      const isSeparator = (row) => row.every((cell) => /^:?-{3,}:?$/.test(cell));
      const headerIndex = cells.findIndex(isSeparator);
      const head = headerIndex > 0 ? cells[headerIndex - 1] : cells[0];
      const dataRows = cells.filter((row, rowIndex) => !isSeparator(row) && row !== head);
      blocks.push(<div className="assistant-table-wrap" key={`table-${index}`}><table key={`table-inner-${index++}`}><thead><tr>{head.map((cell, cellIndex) => <th key={cellIndex}>{inline(cell, `th-${cellIndex}`)}</th>)}</tr></thead><tbody>{dataRows.map((row, rowIndex) => <tr key={rowIndex}>{head.map((_, cellIndex) => <td key={cellIndex}>{inline(row[cellIndex] || "", `td-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    const listMatch = line.match(/^\s*([-*+] |\d+[.)] )(.*)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = /^\d/.test(listMatch[1]);
      const items = [];
      while (i < lines.length) {
        const match = lines[i].trim().match(/^([-*+] |\d+[.)] )(.*)$/);
        if (!match || /^\d/.test(match[1]) !== ordered) break;
        items.push(match[2]);
        i += 1;
      }
      i -= 1;
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index++}`}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item, `li-${itemIndex}`)}</li>)}</List>);
      continue;
    }
    if (line.startsWith(">")) { flushParagraph(); blocks.push(<blockquote key={`q-${index++}`}>{inline(line.replace(/^>\s?/, ""), `qi-${index}`)}</blockquote>); continue; }
    paragraph.push(line);
  }
  flushParagraph();
  return <div className="assistant-message-text">{blocks}</div>;
}

export default function AccountingAssistant() {
  const location = useLocation();
  const { selectedExercice, selectedExerciceId } = useExercice();
  const { selectedEntreprise, selectedEntrepriseId } = useAuth();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [conversations, setConversations] = useState({});
  const [busyKeys, setBusyKeys] = useState([]);
  const transcriptRef = useRef(null);
  const generationRef = useRef({});
  const [geometry, setGeometry] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const page = useMemo(() => `${location.pathname}${location.search}`, [location]);
  const conversationKey = `${selectedEntrepriseId || "no-company"}:${selectedExerciceId || "no-exercise"}:${location.pathname}`;
  const messages = conversations[conversationKey] || [];
  const busy = busyKeys.includes(conversationKey);
  const question = drafts[conversationKey] || "";
  const panelStyle = geometry ? { left: geometry.left, top: geometry.top, width: geometry.width, height: geometry.height, right: "auto", bottom: "auto" } : undefined;

  useEffect(() => {
    if (!interaction) return undefined;
    const move = (event) => {
      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;
      const minWidth = Math.min(320, window.innerWidth - 24);
      const minHeight = Math.min(360, window.innerHeight - 24);
      let { left, top, width, height } = interaction.rect;
      if (interaction.mode === "move") {
        left += dx;
        top += dy;
      } else {
        if (interaction.mode.includes("e")) width = Math.max(minWidth, Math.min(window.innerWidth - 24 - left, width + dx));
        if (interaction.mode.includes("s")) height = Math.max(minHeight, Math.min(window.innerHeight - 24 - top, height + dy));
        if (interaction.mode.includes("w")) {
          const nextWidth = Math.max(minWidth, Math.min(width - dx, left + width - 12));
          left += width - nextWidth;
          width = nextWidth;
        }
        if (interaction.mode.includes("n")) {
          const nextHeight = Math.max(minHeight, Math.min(height - dy, top + height - 12));
          top += height - nextHeight;
          height = nextHeight;
        }
      }
      left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
      top = Math.max(12, Math.min(top, window.innerHeight - height - 12));
      setGeometry({ left, top, width, height });
    };
    const stop = () => setInteraction(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [interaction]);

  function startInteraction(event, mode) {
    if (event.button !== 0) return;
    const panel = event.currentTarget.closest(".assistant-panel");
    if (!panel) return;
    event.preventDefault();
    const rect = panel.getBoundingClientRect();
    setGeometry({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    setInteraction({ mode, startX: event.clientX, startY: event.clientY, rect });
  }

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [messages, open]);

  async function submit(text = question) {
    const prompt = text.trim();
    if (!prompt || busy) return;
    setDrafts((current) => ({ ...current, [conversationKey]: "" }));
    const requestConversationKey = conversationKey;
    const requestGeneration = generationRef.current[requestConversationKey] || 0;
    setBusyKeys((current) => current.includes(requestConversationKey) ? current : [...current, requestConversationKey]);
    const responseId = newId();
    const conversation = messages
      .filter((message) => !message.error && !message.pending && ["user", "assistant"].includes(message.role))
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));
    setConversations((current) => ({
      ...current,
      [requestConversationKey]: [
        ...(current[requestConversationKey] || []),
        { id: newId(), role: "user", content: prompt },
        { id: responseId, role: "assistant", content: "", pending: true },
      ],
    }));

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
      if (requestGeneration !== (generationRef.current[requestConversationKey] || 0)) return;

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

      setConversations((current) => ({
        ...current,
        [requestConversationKey]: (current[requestConversationKey] || []).map((message) => message.id === responseId
          ? { ...message, content: answer, pending: false, error: Boolean(error) }
          : message),
      }));
    } catch (error) {
      if (requestGeneration !== (generationRef.current[requestConversationKey] || 0)) return;
      console.error("Accounting assistant request failed:", error);
      setConversations((current) => ({
        ...current,
        [requestConversationKey]: (current[requestConversationKey] || []).map((message) => message.id === responseId
          ? { ...message, content: `La requête a échoué : ${error?.message || "erreur réseau inconnue"}. Réessayez dans un instant.`, pending: false, error: true }
          : message),
      }));
    } finally {
      if (requestGeneration === (generationRef.current[requestConversationKey] || 0)) {
        setBusyKeys((current) => current.filter((key) => key !== requestConversationKey));
      }
    }
  }

  function clearConversation() {
    generationRef.current[conversationKey] = (generationRef.current[conversationKey] || 0) + 1;
    setConversations((current) => ({ ...current, [conversationKey]: [] }));
    setDrafts((current) => ({ ...current, [conversationKey]: "" }));
    setBusyKeys((current) => current.filter((key) => key !== conversationKey));
  }

  return <>
    <button type="button" className="assistant-launcher" onClick={() => setOpen((value) => !value)} aria-label="Assistant comptable"><Bot size={20} /></button>
    {open && <section className="assistant-panel" style={panelStyle} aria-label="Assistant comptable">
      {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((edge) => <div key={edge} className={`assistant-resize-handle assistant-resize-${edge}`} onPointerDown={(event) => startInteraction(event, edge)} aria-hidden="true" />)}
      <header className="assistant-header" onPointerDown={(event) => { if (!event.target.closest("button")) startInteraction(event, "move"); }}>
        <div><strong>Assistant comptable</strong><small>{selectedEntreprise?.nom || "Entreprise"}{selectedExercice ? ` · ${selectedExercice.code}` : ""}</small></div>
        <div className="assistant-header-actions">
          <button type="button" onClick={clearConversation} aria-label="Effacer la conversation" title="Nouvelle conversation"><RotateCcw size={16} /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer"><X size={17} /></button>
        </div>
      </header>
      <p className="assistant-privacy">Votre question et les chiffres visibles de cette page sont envoyés à Groq pour générer une réponse. N’incluez pas de données confidentielles.</p>
      {messages.length === 0 && <div className="assistant-suggestions">{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => submit(suggestion)} disabled={busy}>{suggestion}</button>)}</div>}
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
        <textarea value={question} onChange={(event) => setDrafts((current) => ({ ...current, [conversationKey]: event.target.value }))} placeholder="Posez votre question…" rows={2} disabled={busy} />
        <button type="submit" disabled={busy || !question.trim()} aria-label="Envoyer la question"><Send size={17} /></button>
      </form>
    </section>}
  </>;
}
