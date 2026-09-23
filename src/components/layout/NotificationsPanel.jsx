import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { supabase, supabaseConfigured } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { dateFrCourt } from '../../lib/notifications';

export default function NotificationsPanel() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = () => {
    if (!supabaseConfigured || !session?.user) return;
    setLoading(true);
    supabase.from('notifications').select('id,type,titre,message,lu,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(15).then(({ data, error }) => {
      if (!error) setItems(data || []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); const id = window.setInterval(load, 60000); return () => window.clearInterval(id); }, [session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const nonLues = items.filter((n) => !n.lu);

  const marquerLue = async (n) => {
    if (n.lu) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, lu: true } : x)));
    await supabase.from('notifications').update({ lu: true }).eq('id', n.id);
  };

  const toutMarquer = async () => {
    if (nonLues.length === 0) return;
    setItems((prev) => prev.map((x) => ({ ...x, lu: true })));
    await supabase.from('notifications').update({ lu: true }).eq('user_id', session.user.id).eq('lu', false);
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="icon-button" type="button" onClick={() => { setOpen((o) => !o); if (!open) load(); }} aria-label="Notifications">
        <Bell size={16} />
        {nonLues.length > 0 && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {nonLues.length > 0 && <button type="button" className="text-button" onClick={toutMarquer}><CheckCheck size={12} /> Tout marquer comme lu</button>}
          </div>
          <div className="notif-list">
            {loading && <p className="page-subtitle" style={{ padding: 16 }}>Chargement…</p>}
            {!loading && items.map((n) => (
              <button key={n.id} type="button" className={`notif-item ${n.lu ? '' : 'unread'}`} onClick={() => marquerLue(n)}>
                <span className="notif-dot" />
                <div>
                  <strong>{n.titre}</strong>
                  <p>{n.message}</p>
                  <small>{dateFrCourt(n.created_at)}</small>
                </div>
              </button>
            ))}
            {!loading && items.length === 0 && <p className="page-subtitle" style={{ padding: 16 }}>Aucune notification.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
