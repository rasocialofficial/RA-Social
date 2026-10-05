import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bookmark, Film, Image as ImageIcon, Trash2 } from 'lucide-react';
import { savedPostAPI } from '../services/api';
import PostCard from '../components/PostCard';

export default function SavedPostsPage({ onBack, searchQuery = '' }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await savedPostAPI.list(); setItems(r.data?.data || []); }
    catch (e) { console.error('Saved posts load error', e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter(x => { const q = String(searchQuery || '').trim().toLowerCase(); const matchesPage = !q || [x.post?.content, x.post?.user?.fullName, x.post?.user?.username, ...(x.post?.hashtags || [])].filter(Boolean).join(' ').toLowerCase().includes(q); return matchesPage && (filter === 'all' || (filter === 'reels' ? x.post?.mediaType === 'video' : x.post?.mediaType !== 'video')); });
  const remove = async (id) => { try { await savedPostAPI.remove(id); setItems(prev => prev.filter(x => x.post?.id !== id)); } catch (e) { alert(e.response?.data?.message || 'Unable to remove saved post'); } };

  return <div className="min-h-screen bg-gray-50 pb-24">
    <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
      <Bookmark className="w-5 h-5 text-purple-600" /><h1 className="font-bold text-lg">Saved</h1>
    </header>
    <div className="px-4 py-3 flex gap-2 overflow-x-auto">
      {[['all','All',Bookmark],['posts','Posts',ImageIcon],['reels','Reels',Film]].map(([key,label,Icon]) => <button key={key} onClick={() => setFilter(key)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${filter === key ? 'bg-purple-600 text-white' : 'bg-white border text-gray-600'}`}><Icon className="w-4 h-4" />{label}</button>)}
    </div>
    {loading ? <div className="py-20 text-center text-gray-400">Loading saved content…</div> : filtered.length === 0 ? <div className="py-20 text-center px-6"><Bookmark className="w-12 h-12 mx-auto text-gray-300" /><p className="font-semibold text-gray-600 mt-3">No saved {filter === 'all' ? 'posts or reels' : filter} yet</p><p className="text-sm text-gray-400 mt-1">Use Save to Saved on a post or reel to keep it here.</p></div> : <div className="px-4 space-y-4">{filtered.map(item => item.post && <div key={item.post.id} className="relative"><PostCard post={{...item.post, _saved: true}} onLike={() => {}} onChanged={load} /><button onClick={() => remove(item.post.id)} className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 shadow border text-gray-600 hover:text-red-600" aria-label="Remove saved"><Trash2 className="w-4 h-4" /></button></div>)}</div>}
  </div>;
}
