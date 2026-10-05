import React, { useEffect, useState } from 'react';
import { X, Send, Search, Check } from 'lucide-react';
import { chatAPI } from '../services/api';

export default function ShareToChatModal({ open, onClose, item }) {
  const [chats, setChats] = useState([]);
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [sent, setSent] = useState({});
  useEffect(() => { if (!open) return; chatAPI.getChats().then(r => setChats(r.data.data || [])).catch(() => setChats([])); }, [open]);
  if (!open) return null;
  const filtered = chats.filter(c => { const o = c.participants?.find(p => p.id !== item?.currentUserId) || c.participants?.[0]; const s = `${o?.fullName||''} ${o?.username||''}`.toLowerCase(); return s.includes(query.toLowerCase()); });
  const sendTo = async (chat) => {
    if (sendingId) return;
    setSendingId(chat.id);
    try {
      const url = `${window.location.origin}/?post=${item.id}`;
      const type = item.mediaType === 'video' ? 'Reel' : 'Post';
      await chatAPI.sendMessage(chat.id, `📤 Shared ${type}\n${item.content ? item.content.slice(0,180) + (item.content.length > 180 ? '…' : '') + '\n' : ''}${url}`);
      setSent(v => ({ ...v, [chat.id]: true }));
    } catch (e) { alert(e?.response?.data?.message || 'Could not share to chat'); }
    finally { setSendingId(null); }
  };
  return <div className="fixed inset-0 z-[120] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-md max-h-[82dvh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
      <div className="p-4 border-b flex items-center justify-between"><div><h3 className="font-bold text-lg">Share to Chat</h3><p className="text-xs text-gray-500">Choose a conversation</p></div><button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X className="w-5 h-5"/></button></div>
      <div className="p-3 border-b"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search chats" className="w-full bg-gray-100 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none"/></div></div>
      <div className="overflow-y-auto flex-1 p-2">{filtered.length ? filtered.map(c=>{const o=c.participants?.find(p=>p.id!==item?.currentUserId)||c.participants?.[0]; return <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50"><img src={o?.avatarUrl||`https://i.pravatar.cc/80?u=${o?.id}`} className="w-11 h-11 rounded-full object-cover"/><div className="min-w-0 flex-1"><b className="block truncate text-sm">{o?.fullName||o?.username}</b><span className="text-xs text-gray-500">@{o?.username}</span></div><button onClick={()=>sendTo(c)} disabled={sendingId===c.id||sent[c.id]} className="px-3 py-2 rounded-full bg-purple-600 text-white text-xs font-semibold disabled:opacity-70 flex items-center gap-1">{sent[c.id]?<><Check className="w-4 h-4"/>Sent</>:<><Send className="w-4 h-4"/>{sendingId===c.id?'Sending':'Send'}</>}</button></div>}) : <div className="p-10 text-center text-sm text-gray-400">No chats found</div>}</div>
    </div>
  </div>;
}
