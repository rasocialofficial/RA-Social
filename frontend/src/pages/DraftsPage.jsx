import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Trash2, Edit3 } from 'lucide-react';

const keyFor = (userId) => `ra-social-drafts-${userId || 'guest'}`;

export default function DraftsPage({ userId, onBack, onEdit, searchQuery = '' }) {
  const [drafts, setDrafts] = useState([]);
  const load = () => {
    try { setDrafts(JSON.parse(localStorage.getItem(keyFor(userId)) || '[]')); } catch { setDrafts([]); }
  };
  useEffect(load, [userId]);
  const visibleDrafts = drafts.filter((d) => { const q = String(searchQuery || '').trim().toLowerCase(); if (!q) return true; return String(d.content || '').toLowerCase().includes(q); });
  const remove = (id) => {
    const next = drafts.filter(d => d.id !== id); setDrafts(next); localStorage.setItem(keyFor(userId), JSON.stringify(next));
  };
  return <div className="min-h-screen bg-gray-50 pb-24">
    <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
      <FileText className="w-5 h-5 text-purple-600" /><h1 className="font-bold text-lg">Drafts</h1>
      <span className="ml-auto text-xs text-gray-400">{drafts.length}</span>
    </header>
    {visibleDrafts.length === 0 ? <div className="py-20 text-center px-6"><FileText className="w-12 h-12 mx-auto text-gray-300" /><p className="font-semibold text-gray-600 mt-3">No drafts yet</p><p className="text-sm text-gray-400 mt-1">Save a post as a draft and come back anytime.</p></div> :
      <div className="p-4 space-y-3">{visibleDrafts.map(d => <div key={d.id} className="bg-white rounded-2xl p-4 shadow-sm border flex gap-3">
        {d.mediaItems?.length > 1 ? <div className="w-20 h-20 grid grid-cols-2 gap-0.5 rounded-xl overflow-hidden bg-black">{d.mediaItems.slice(0,4).map((m,i) => m.mediaType === 'video' ? <video key={i} src={m.mediaUrl} className="w-full h-full object-cover" muted /> : <img key={i} src={m.mediaUrl} alt="Draft" className="w-full h-full object-cover" />)}</div> : d.mediaUrl ? (d.mediaType === 'video' ? <video src={d.mediaUrl} className="w-20 h-20 rounded-xl object-cover bg-black" muted /> : <img src={d.mediaUrl} alt="Draft" className="w-20 h-20 rounded-xl object-cover bg-gray-100" />) : <div className="w-20 h-20 rounded-xl bg-purple-50 flex items-center justify-center"><FileText className="w-7 h-7 text-purple-400" /></div>}
        <div className="flex-1 min-w-0"><p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{d.content || 'Media draft'}</p>{d.mediaItems?.length > 1 && <p className="text-[11px] text-purple-600 mt-1">{d.mediaItems.length} media files</p>}<p className="text-[11px] text-gray-400 mt-2">Updated {new Date(d.updatedAt || d.createdAt).toLocaleString()}</p></div>
        <div className="flex flex-col gap-2"><button onClick={() => onEdit(d)} className="p-2 rounded-full bg-purple-50 text-purple-600" aria-label="Edit draft"><Edit3 className="w-4 h-4" /></button><button onClick={() => remove(d.id)} className="p-2 rounded-full bg-red-50 text-red-600" aria-label="Delete draft"><Trash2 className="w-4 h-4" /></button></div>
      </div>)}</div>}
  </div>;
}
