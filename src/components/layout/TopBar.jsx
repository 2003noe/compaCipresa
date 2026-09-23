import { useEffect, useRef, useState } from 'react';
import { Search, CalendarDays, Plus, Sun, Moon, FileText, BookOpen } from 'lucide-react';
import Button from '../ui/Button';
import NotificationsPanel from './NotificationsPanel';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useTheme } from '../../context/ThemeContext';

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ comptes: [], ecritures: [] });
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const goNew = () => {
    if (location.pathname === '/journal') navigate('/nouvelle-ecriture');
    else if (location.pathname === '/plan-comptable') navigate('/nouveau-compte');
    else navigate('/nouvelle-ecriture');
  };

  useEffect(() => {
    if (!supabaseConfigured) return undefined;
    window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setResults({ comptes: [], ecritures: [] }); setSearching(false); return undefined; }
    setSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      const term = `%${query.trim()}%`;
      const [comptesRes, ecrituresRes] = await Promise.all([
        supabase.from('comptes_comptables').select('id,numero,libelle').or(`numero.ilike.${term},libelle.ilike.${term}`).limit(5),
        supabase.from('ecritures_comptables').select('id,numero,libelle,reference_piece,date_ecriture').or(`numero.ilike.${term},libelle.ilike.${term},reference_piece.ilike.${term}`).limit(5),
      ]);
      setResults({ comptes: comptesRes.data || [], ecritures: ecrituresRes.data || [] });
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const onClick = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const aucunResultat = query.trim().length >= 2 && !searching && results.comptes.length === 0 && results.ecritures.length === 0;

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-search" ref={searchRef}>
          <Search size={16} />
          <input
            placeholder="Rechercher un compte, une écriture…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && query.trim().length >= 2 && (
            <div className="search-panel">
              {searching && <p className="page-subtitle" style={{ padding: 14 }}>Recherche…</p>}
              {!searching && results.comptes.length > 0 && (
                <div className="search-group">
                  <span className="search-group-title">Comptes</span>
                  {results.comptes.map((c) => (
                    <button key={c.id} type="button" className="search-result" onClick={() => { navigate('/plan-comptable'); setOpen(false); setQuery(''); }}>
                      <BookOpen size={14} /><span>{c.numero} — {c.libelle}</span>
                    </button>
                  ))}
                </div>
              )}
              {!searching && results.ecritures.length > 0 && (
                <div className="search-group">
                  <span className="search-group-title">Écritures</span>
                  {results.ecritures.map((e) => (
                    <button key={e.id} type="button" className="search-result" onClick={() => { navigate('/journal'); setOpen(false); setQuery(''); }}>
                      <FileText size={14} /><span>{e.numero} — {e.libelle}</span>
                    </button>
                  ))}
                </div>
              )}
              {aucunResultat && <p className="page-subtitle" style={{ padding: 14 }}>Aucun résultat pour « {query} ».</p>}
            </div>
          )}
        </div>
        <button className="period-selector" type="button"><CalendarDays size={14} /><b>Exercice 2025-2026</b></button>
      </div>
      <div className="topbar-right">
        <button className="icon-button" type="button" onClick={toggleTheme} aria-label="Changer de thème" title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <NotificationsPanel />
        <Button size="sm" icon={Plus} onClick={goNew}>Nouvelle écriture</Button>
      </div>
    </header>
  );
}
