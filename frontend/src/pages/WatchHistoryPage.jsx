import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock3, Trash2 } from 'lucide-react';
import { watchHistoryAPI } from '../services/api';
import PostCard from '../components/PostCard';

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);
const formatDay = (value) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

export default function WatchHistoryPage({ onBack, searchQuery = '' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await watchHistoryAPI.list();
      setItems(res.data?.data || []);
    } catch (e) {
      console.error('Watch history load error', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filteredItems = useMemo(() => { const q = String(searchQuery || '').trim().toLowerCase(); if (!q) return items; return items.filter(item => [item.post?.content, item.post?.user?.fullName, item.post?.user?.username, ...(item.post?.hashtags || [])].filter(Boolean).join(' ').toLowerCase().includes(q)); }, [items, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((item) => {
      const key = dayKey(item.watchedAt);
      if (!map.has(key)) map.set(key, { date: item.watchedAt, items: [] });
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [filteredItems]);

  const clearAll = async () => {
    if (!items.length || !window.confirm('Clear your watch history?')) return;
    try { await watchHistoryAPI.clear(); setItems([]); } catch (e) { alert(e.response?.data?.message || 'Unable to clear watch history'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
        <Clock3 className="w-5 h-5 text-purple-600" />
        <h1 className="font-bold text-lg flex-1">Watch History</h1>
        {items.length > 0 && <button onClick={clearAll} className="text-xs font-semibold text-red-500 flex items-center gap-1"><Trash2 className="w-4 h-4" />Clear</button>}
      </header>
      <div className="px-4 py-3 text-xs text-gray-500 bg-purple-50 border-b border-purple-100">Showing the last 30 days. Older history is automatically removed.</div>
      {loading ? <div className="py-20 text-center text-gray-400">Loading watch history…</div> : !items.length ? (
        <div className="py-20 text-center px-6"><Clock3 className="w-12 h-12 mx-auto text-gray-300" /><p className="font-semibold text-gray-600 mt-3">No watch history</p><p className="text-sm text-gray-400 mt-1">Posts and videos you open will appear here.</p></div>
      ) : (
        <div className="px-4 py-4 space-y-6">
          {groups.map(group => <section key={dayKey(group.date)}>
            <h2 className="text-sm font-bold text-gray-700 mb-3 sticky top-[57px] bg-gray-50 py-1 z-10">{formatDay(group.date)}</h2>
            <div className="space-y-4">{group.items.map(item => item.post && <div key={`${item.post.id}-${item.watchedAt}`}><p className="text-[11px] text-gray-400 mb-1">Watched {new Date(item.watchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p><PostCard post={item.post} onLike={() => {}} onChanged={load} /></div>)}</div>
          </section>)}
        </div>
      )}
    </div>
  );
}
