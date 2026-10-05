import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Send, Paperclip, Smile, Plus, X, MessageCircle, Check, CheckCheck, ArrowLeft, Camera, ImagePlus, Trash2, ChevronLeft, ChevronRight, Clock3, Reply, Forward, Pin, MoreVertical } from 'lucide-react';
import api, { searchAPI, chatAPI, vibeAPI, userSafetyAPI } from '../services/api';
import MediaEditor from '../components/MediaEditor';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const EMOJIS = ['😀','😂','😍','🥰','😎','👍','❤️','🔥','🎉','👏','🙏','😊','😢','😮','🤝','✨'];

const formatRemaining = (expiresAt) => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m left`;
};

function VibeViewer({ vibes, index, userId, onClose, onDelete }) {
  const vibe = vibes[index];
  const [remaining, setRemaining] = useState(vibe ? formatRemaining(vibe.expiresAt) : '');
  useEffect(() => {
    if (!vibe) return undefined;
    setRemaining(formatRemaining(vibe.expiresAt));
    const id = setInterval(() => setRemaining(formatRemaining(vibe.expiresAt)), 30000);
    return () => clearInterval(id);
  }, [vibe?.id, vibe?.expiresAt]);
  if (!vibe) return null;
  return (
    <div className="fixed inset-0 z-[140] bg-black flex items-center justify-center">
      <button onClick={onClose} className="absolute top-4 right-4 z-20 p-3 rounded-full bg-white/10 text-white"><X /></button>
      <div className="absolute top-4 left-4 right-16 z-10 text-white">
        <div className="h-1 bg-white/30 rounded-full"><div className="h-full bg-white w-full" /></div>
        <div className="mt-3 flex items-center gap-3"><img src={vibe.user?.avatarUrl || `https://i.pravatar.cc/80?u=${vibe.userId}`} className="w-9 h-9 rounded-full object-cover" alt="" /><div><b>{vibe.user?.fullName || vibe.user?.username}</b><p className="text-xs text-white/70">@{vibe.user?.username} · {remaining}</p></div></div>
      </div>
      {index > 0 && <button onClick={() => window.dispatchEvent(new CustomEvent('ra-vibe-prev'))} className="absolute left-3 p-3 rounded-full bg-white/10 text-white z-10"><ChevronLeft /></button>}
      <div className="w-full h-full flex items-center justify-center p-4 md:p-12">
        {vibe.mediaType === 'video' ? <video src={vibe.mediaUrl} controls autoPlay playsInline className="max-w-full max-h-full object-contain rounded-xl" /> : <img src={vibe.mediaUrl} alt={vibe.caption || 'Vibe'} className="max-w-full max-h-full object-contain rounded-xl" />}
      </div>
      {index < vibes.length - 1 && <button onClick={() => window.dispatchEvent(new CustomEvent('ra-vibe-next'))} className="absolute right-3 p-3 rounded-full bg-white/10 text-white z-10"><ChevronRight /></button>}
      {vibe.caption && <div className="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-[90%] bg-black/60 text-white px-4 py-2 rounded-xl text-sm text-center">{vibe.caption}</div>}
      {vibe.userId === userId && <button onClick={() => onDelete(vibe.id)} className="absolute bottom-5 right-5 p-3 rounded-full bg-red-600 text-white"><Trash2 className="w-5 h-5" /></button>}
    </div>
  );
}

export default function ChatPage({ searchQuery = '' }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]), [selectedChat, setSelectedChat] = useState(null), [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(''), [loading, setLoading] = useState(true), [newChatOpen, setNewChatOpen] = useState(false);
  const [phoneQuery, setPhoneQuery] = useState(''), [inviteNumber, setInviteNumber] = useState('');
  const [phoneSearching, setPhoneSearching] = useState(false), [sending, setSending] = useState(false), [emojiOpen, setEmojiOpen] = useState(false);
  const [galleryFile, setGalleryFile] = useState(null), [galleryFiles, setGalleryFiles] = useState([]), [messageMenu, setMessageMenu] = useState(null), [replyingTo, setReplyingTo] = useState(null), [forwardingMessage, setForwardingMessage] = useState(null), [deletingMessage, setDeletingMessage] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState([]), [typingUserId, setTypingUserId] = useState(null);
  const [safetyOpen, setSafetyOpen] = useState(false), [safety, setSafety] = useState({ blocked: false, muted: false, restricted: false });
  const [vibes, setVibes] = useState([]), [vibeComposerOpen, setVibeComposerOpen] = useState(false), [vibeFiles, setVibeFiles] = useState([]), [vibePreviewUrls, setVibePreviewUrls] = useState([]), [vibeCaption, setVibeCaption] = useState(''), [vibeUploading, setVibeUploading] = useState(false), [vibeViewerIndex, setVibeViewerIndex] = useState(null), [vibeEditIndex, setVibeEditIndex] = useState(null), [chatEditIndex, setChatEditIndex] = useState(null);
  const sendingRef = useRef(false), socketRef = useRef(null), selectedChatRef = useRef(null), endRef = useRef(null), galleryRef = useRef(null), vibeRef = useRef(null), typingTimerRef = useRef(null);

  const other = (chat) => chat?.participants?.find(p => p.id !== user?.id) || chat?.participants?.[0];
  const otherUser = selectedChat ? other(selectedChat) : null;
  const otherOnline = !!otherUser && onlineUserIds.includes(otherUser.id);
  const ownVibes = useMemo(() => vibes.filter(v => v.userId === user?.id), [vibes, user?.id]);
  const otherVibeGroups = useMemo(() => {
    const groups = new Map();
    vibes.filter(v => v.userId !== user?.id).forEach(v => {
      if (!groups.has(v.userId)) groups.set(v.userId, []);
      groups.get(v.userId).push(v);
    });
    return Array.from(groups.values());
  }, [vibes, user?.id]);
  const ownVibe = ownVibes[0] || null;
  const visibleChats = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => {
      const person = other(chat);
      const haystack = [person?.fullName, person?.username, person?.phoneNumber, chat?.messages?.[0]?.content].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [chats, searchQuery]);
  const storyGroups = useMemo(() => [
    ...(ownVibes.length ? [{ userId: user?.id, items: ownVibes, own: true }] : []),
    ...otherVibeGroups.map(items => ({ userId: items[0]?.userId, items, own: false }))
  ], [ownVibes, otherVibeGroups, user?.id]);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => {
    if (!otherUser?.id) { setSafety({ blocked: false, muted: false, restricted: false }); setSafetyOpen(false); return; }
    userSafetyAPI.status(otherUser.id).then(r => setSafety(r.data.data || {})).catch(() => setSafety({ blocked: false, muted: false, restricted: false }));
    setSafetyOpen(false);
  }, [otherUser?.id]);

  const fetchChats = async () => { try { const r = await chatAPI.getChats(); setChats(r.data.data || []); } catch (e) { console.error('Get chats failed', e); } finally { setLoading(false); } };
  const fetchMessages = async (id) => { try { const r = await chatAPI.getMessages(id); setMessages(r.data.data || []); await api.post(`/chats/${id}/read`); } catch (e) { console.error('Get messages failed', e); } };
  const fetchVibes = async () => { try { const r = await vibeAPI.getAll(); setVibes(r.data.data || []); } catch (e) { console.error('Get vibes failed', e); } };

  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('token') }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect_error', e => console.warn('Chat socket unavailable:', e.message));
    socket.on('new_message', data => {
      if (selectedChatRef.current?.id !== data.chatId) return;
      setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
      if (data.senderId !== user?.id) api.post(`/chats/${data.chatId}/read`).catch(() => {});
    });
    socket.on('message_read', ({ chatId, messageIds }) => {
      if (selectedChatRef.current?.id !== chatId) return;
      const ids = new Set(messageIds || []); setMessages(prev => prev.map(m => ids.has(m.id) ? { ...m, isRead: true } : m));
    });
    socket.on('message_hidden', ({ chatId, messageId, userId }) => { if (selectedChatRef.current?.id === chatId && userId === user?.id) setMessages(prev => prev.filter(m => m.id !== messageId)); });
    socket.on('message_deleted', ({ chatId, messageId }) => { if (selectedChatRef.current?.id === chatId) setMessages(prev => prev.filter(m => m.id !== messageId)); });
    socket.on('message_pin_changed', ({ chatId, messageId, pinned }) => { if (selectedChatRef.current?.id === chatId) setMessages(prev => prev.map(m => m.id === messageId ? { ...m, pinned } : m)); });
    socket.on('presence_snapshot', ({ userIds }) => setOnlineUserIds(userIds || []));
    socket.on('user_presence', ({ userId, online }) => setOnlineUserIds(prev => online ? [...new Set([...prev, userId])] : prev.filter(id => id !== userId)));
    socket.on('typing', ({ chatId, userId, isTyping }) => { if (selectedChatRef.current?.id === chatId && userId !== user?.id) setTypingUserId(isTyping ? userId : null); });
    fetchChats(); fetchVibes();
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); socket.disconnect(); };
  }, [user?.id]);

  useEffect(() => { if (!selectedChat) { setMessages([]); return; } socketRef.current?.emit('join_chat', selectedChat.id); fetchMessages(selectedChat.id); setTypingUserId(null); }, [selectedChat?.id]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const prev = () => setVibeViewerIndex(i => i == null ? i : Math.max(0, i - 1));
    const next = () => setVibeViewerIndex(i => i == null ? i : Math.min(vibes.length - 1, i + 1));
    window.addEventListener('ra-vibe-prev', prev); window.addEventListener('ra-vibe-next', next);
    return () => { window.removeEventListener('ra-vibe-prev', prev); window.removeEventListener('ra-vibe-next', next); };
  }, [vibes.length]);

  const emitTyping = (isTyping) => {
    if (!selectedChat || !socketRef.current) return;
    socketRef.current.emit('typing', { chatId: selectedChat.id, isTyping });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTyping) typingTimerRef.current = setTimeout(() => socketRef.current?.emit('typing', { chatId: selectedChat.id, isTyping: false }), 1800);
  };
  const uploadAttachment = async (file) => { const form = new FormData(); form.append('file', file); const r = await api.post('/posts/upload', form); return r.data.data.url; };
  const sendReply = async () => {
    if (!selectedChat || !replyingTo || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    const content = newMessage.trim(); const selected = galleryFiles.length ? galleryFiles : (galleryFile ? [galleryFile] : []);
    if (!content && !selected.length) { sendingRef.current = false; setSending(false); return; }
    try {
      if (selected.length) {
        for (const file of selected) { const mediaUrl = await uploadAttachment(file); const r = await chatAPI.sendMessage(selectedChat.id, '', mediaUrl, replyingTo.id); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
        if (content) { const r = await chatAPI.sendMessage(selectedChat.id, content, null, replyingTo.id); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
      } else { const r = await chatAPI.sendMessage(selectedChat.id, content, null, replyingTo.id); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
      setNewMessage(''); setGalleryFile(null); setGalleryFiles([]); setReplyingTo(null); fetchChats();
    } catch (e) { alert(e.response?.data?.message || 'Failed to send reply'); } finally { sendingRef.current = false; setSending(false); }
  };
  const sendMessage = async () => {
    emitTyping(false); if (replyingTo) return sendReply();
    const content = newMessage.trim(); const selected = galleryFiles.length ? galleryFiles : (galleryFile ? [galleryFile] : []);
    if ((!content && !selected.length) || !selectedChat || sendingRef.current) return;
    sendingRef.current = true; setSending(true);
    try {
      if (selected.length) {
        for (const file of selected) { const mediaUrl = await uploadAttachment(file); const r = await chatAPI.sendMessage(selectedChat.id, '', mediaUrl); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
        if (content) { const r = await chatAPI.sendMessage(selectedChat.id, content, null); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
      } else { const r = await chatAPI.sendMessage(selectedChat.id, content, null); setMessages(prev => prev.some(m => m.id === r.data.data.id) ? prev : [...prev, r.data.data]); }
      setNewMessage(''); setGalleryFile(null); setGalleryFiles([]); setEmojiOpen(false); fetchChats();
    } catch (e) { alert(e.response?.data?.message || 'Failed to send message'); } finally { sendingRef.current = false; setSending(false); }
  };
  const deleteMessage = async (message, mode) => {
    if (!selectedChat || deletingMessage) return; if (!window.confirm(mode === 'everyone' ? 'Delete this message for everyone?' : 'Delete this message for you?')) return;
    setDeletingMessage(true); try { if (mode === 'everyone') await chatAPI.deleteForEveryone(selectedChat.id, message.id); else await chatAPI.deleteForMe(selectedChat.id, message.id); setMessages(prev => prev.filter(m => m.id !== message.id)); setMessageMenu(null); fetchChats(); } catch (e) { alert(e.response?.data?.message || 'Failed to delete message'); } finally { setDeletingMessage(false); }
  };
  const togglePin = async (message) => { try { const r = await chatAPI.pin(selectedChat.id, message.id); setMessages(prev => prev.map(m => m.id === message.id ? { ...m, pinned: r.data.data.pinned } : m)); setMessageMenu(null); } catch (e) { alert(e.response?.data?.message || 'Failed to pin message'); } };
  const forwardTo = async target => { try { await chatAPI.forward(selectedChat.id, forwardingMessage.id, target.id); setForwardingMessage(null); setMessageMenu(null); fetchChats(); } catch (e) { alert(e.response?.data?.message || 'Failed to forward message'); } };
  const toggleSafety = async action => { if (!otherUser?.id) return; try { const r = await userSafetyAPI.toggle(otherUser.id, action); const key = action === 'block' ? 'blocked' : action === 'mute' ? 'muted' : 'restricted'; setSafety(v => ({ ...v, [key]: r.data.data.enabled })); setSafetyOpen(false); if (action === 'block' && r.data.data.enabled) setSelectedChat(null); } catch (e) { alert(e.response?.data?.message || 'Could not update setting'); } };
  const startChatWith = async u => { try { const r = await chatAPI.createChat(u.id); setNewChatOpen(false); await fetchChats(); setSelectedChat(r.data.data); } catch (e) { alert(e.response?.data?.message || 'Could not start chat'); } };
  const searchByPhone = async () => { const q = phoneQuery.trim(); if (!q) return; setPhoneSearching(true); try { const r = await searchAPI.search(q, 'users'); const us = (r.data.data?.users || []).filter(u => u.id !== user?.id); if (us[0]) { await startChatWith(us[0]); setPhoneQuery(''); } else { setInviteNumber(q); alert('No RA Social account found. You can invite them.'); } } finally { setPhoneSearching(false); } };
  const inviteViaWhatsApp = () => { const digits = inviteNumber.replace(/\D/g, ''); if (!digits) return alert('Enter a mobile number'); window.open(`https://wa.me/${digits}?text=${encodeURIComponent(`Join me on RA Social! ${window.location.origin}`)}`, '_blank', 'noopener,noreferrer'); };
  const galleryChanged = e => { const selected = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')); e.target.value = ''; if (!selected.length) return; setGalleryFiles(prev => [...prev, ...selected].slice(0, 10)); setGalleryFile(selected[0]); };
  const applyChatEdit = (editedFile) => { if (chatEditIndex == null) return; setGalleryFiles(prev => prev.map((f, i) => i === chatEditIndex ? editedFile : f)); setGalleryFile(editedFile); setChatEditIndex(null); };
  const appendEmoji = e => setNewMessage(v => v + e);
  const applyVibeEdit = (editedFile) => {
    if (vibeEditIndex == null) return;
    setVibeFiles(prev => prev.map((f, i) => i === vibeEditIndex ? editedFile : f));
    setVibeEditIndex(null);
  };

  useEffect(() => {
    const urls = vibeFiles.map(file => URL.createObjectURL(file));
    setVibePreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [vibeFiles]);

  const publishVibe = async () => {
    if (!vibeFiles.length || vibeUploading) return;
    setVibeUploading(true);
    try {
      const created = [];
      for (const file of vibeFiles) {
        const data = await uploadAttachment(file);
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        const r = await vibeAPI.create({ mediaUrl: data, mediaType, caption: vibeCaption });
        created.push(r.data.data);
      }
      setVibes(prev => [...created, ...prev]);
      setVibeComposerOpen(false);
      setVibeFiles([]);
      setVibePreviewUrls([]);
      setVibeCaption('');
    } catch (e) { alert(e.response?.data?.message || 'Failed to post Vibe'); }
    finally { setVibeUploading(false); }
  };
  const deleteVibe = async id => { try { await vibeAPI.delete(id); setVibes(prev => prev.filter(v => v.id !== id)); setVibeViewerIndex(null); } catch (e) { alert(e.response?.data?.message || 'Failed to delete Vibe'); } };

  return <div className="pt-16 h-[100dvh] flex overflow-hidden bg-white">
    <section className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] shrink-0 flex-col border-r border-gray-200 min-h-0`}>
      <div className="p-4 border-b flex items-center justify-between shrink-0"><h2 className="text-xl font-bold">Messages</h2><button onClick={() => setNewChatOpen(true)} className="w-12 h-12 shrink-0 bg-purple-600 text-white rounded-full flex items-center justify-center" aria-label="New chat"><Plus className="w-6 h-6" /></button></div>
      <div className="border-b bg-white px-3 py-3 shrink-0"><div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 overflow-x-auto pb-1"><div className="flex items-start gap-3 w-max">
          {storyGroups.map(group => {
            const first = group.items[0];
            const idx = vibes.findIndex(x => x.id === first?.id);
            return <button key={group.userId} onClick={() => idx >= 0 && setVibeViewerIndex(idx)} className="shrink-0 w-16 text-center"><div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600"><img src={first?.mediaUrl} alt={group.own ? 'Your Vibe' : (first?.user?.fullName || first?.user?.username || 'Vibe')} className="w-full h-full rounded-full object-cover border-2 border-white" /></div><span className="block text-xs font-semibold mt-1 truncate">{group.own ? 'Your Vibe' : (first?.user?.fullName || first?.user?.username)}</span></button>;
          })}
          {!storyGroups.length && <div className="w-16 text-center text-xs text-gray-400 py-4">No Vibes</div>}
        </div></div>
        <button onClick={() => { setVibeFiles([]); setVibeCaption(''); setVibeComposerOpen(true); }} className="shrink-0 w-12 h-12 min-w-12 min-h-12 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-sm" aria-label="Add Vibe"><Plus className="w-6 h-6" /></button>
      </div><div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400"><Clock3 className="w-3 h-3" /> Vibes disappear automatically after 24 hours</div></div>
      <div className="flex-1 min-h-0 overflow-y-auto">{loading ? <div className="text-center py-20 text-gray-400">Loading chats...</div> : visibleChats.length ? visibleChats.map(c => { const o = other(c); return <button key={c.id} onClick={() => setSelectedChat(c)} className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 ${selectedChat?.id === c.id ? 'bg-purple-50' : ''}`}><div className="relative shrink-0"><img src={o?.avatarUrl || `https://i.pravatar.cc/150?u=${o?.id}`} className="w-12 h-12 rounded-full object-cover" alt="" />{onlineUserIds.includes(o?.id) && <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-green-500 ring-2 ring-white" />}</div><div className="min-w-0"><h3 className="font-semibold truncate">{o?.fullName || o?.username}</h3><p className="text-sm text-gray-500 truncate">{c.messages?.[0]?.content || 'Start chatting'}</p></div></button>; }) : <div className="p-8 text-center text-sm text-gray-400">{searchQuery.trim() ? 'No chats match your search.' : 'No chats yet. Tap + to start a conversation.'}</div>}</div>
    </section>
    <section className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 min-h-0 flex-col h-full`}>
      {selectedChat ? <>
        <header className="h-16 shrink-0 border-b flex items-center gap-3 px-3 md:px-4 bg-white"><button onClick={() => setSelectedChat(null)} className="md:hidden p-2 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button><div className="relative"><img src={otherUser?.avatarUrl || 'https://i.pravatar.cc/150'} className="w-9 h-9 rounded-full object-cover" alt="" />{otherOnline && <span className="absolute right-0 bottom-0 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-white" />}</div><div className="min-w-0 flex-1"><h3 className="font-semibold truncate">{otherUser?.fullName || otherUser?.username}</h3><p className="text-xs text-gray-500">{typingUserId ? 'typing...' : otherOnline ? 'Online' : 'Private chat'}</p></div><div className="relative"><button onClick={() => setSafetyOpen(v => !v)} className="p-2 rounded-full hover:bg-gray-100" title="Safety"><MoreVertical className="w-5 h-5" /></button>{safetyOpen && <div className="absolute right-0 top-10 z-50 w-52 bg-white border rounded-xl shadow-lg p-1 text-sm"><button onClick={() => toggleSafety('mute')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100">{safety.muted ? 'Unmute notifications' : 'Mute notifications'}</button><button onClick={() => toggleSafety('restrict')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100">{safety.restricted ? 'Unrestrict user' : 'Restrict user'}</button><button onClick={() => toggleSafety('block')} className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-50 text-red-600">{safety.blocked ? 'Unblock user' : 'Block user'}</button></div>}</div></header>
        <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-2 bg-gray-50">{messages.map((m, i) => { const mine = m.senderId === user?.id; return <div key={m.id || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`relative max-w-[82%] sm:max-w-[70%] px-3 py-2 rounded-2xl ${mine ? 'bg-purple-600 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm'}`}>{m.pinned && <div className="text-[10px] mb-1 opacity-70 flex items-center gap-1"><Pin className="w-3 h-3" /> Pinned</div>}{m.replyTo && <div className="text-[10px] opacity-70 border-l-2 pl-2 mb-1 truncate">Replying to {m.replyTo.content || 'media'}</div>}<div className="flex items-end gap-2"><div className="min-w-0">{m.mediaUrl && (/(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(m.mediaUrl) ? <video src={m.mediaUrl} controls playsInline className="block mb-1 max-w-[220px] max-h-56 rounded-lg" /> : <a href={m.mediaUrl} target="_blank" rel="noreferrer"><img src={m.mediaUrl} alt="Attachment" className="block mb-1 max-w-[220px] max-h-56 rounded-lg object-contain" /></a>)}{m.content && <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>}</div>{mine && (m.isRead ? <CheckCheck className="w-4 h-4 text-sky-200 shrink-0" /> : <Check className="w-4 h-4 opacity-70 shrink-0" />)}</div><div className="flex items-center justify-end gap-2 mt-1"><span className="text-[10px] opacity-70">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button onClick={() => setMessageMenu(messageMenu === m.id ? null : m.id)} className="opacity-60 hover:opacity-100"><MoreVertical className="w-3 h-3" /></button></div>{messageMenu === m.id && <div className="absolute right-2 bottom-8 z-40 bg-white text-gray-800 border rounded-xl shadow-lg p-1 w-40 text-xs"><button onClick={() => { setReplyingTo(m); setMessageMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex gap-2"><Reply className="w-3 h-3" /> Reply</button><button onClick={() => togglePin(m)} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex gap-2"><Pin className="w-3 h-3" /> {m.pinned ? 'Unpin' : 'Pin'}</button><button onClick={() => { setForwardingMessage(m); setMessageMenu(null); }} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex gap-2"><Forward className="w-3 h-3" /> Forward</button><button onClick={() => deleteMessage(m, 'me')} className="w-full text-left px-3 py-2 hover:bg-gray-100">Delete for me</button>{mine && <button onClick={() => deleteMessage(m, 'everyone')} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600">Delete for everyone</button>}</div>}</div></div>; })}<div ref={endRef} /></div>
        {replyingTo && <div className="px-3 py-2 bg-white border-t text-xs flex items-center gap-2"><Reply className="w-4 h-4" /><span className="truncate flex-1">Replying to: {replyingTo.content || 'media'}</span><button onClick={() => setReplyingTo(null)}><X className="w-4 h-4" /></button></div>}
        {emojiOpen && <div className="px-3 pt-2 bg-white border-t flex flex-wrap gap-1">{EMOJIS.map(e => <button key={e} onClick={() => appendEmoji(e)} className="text-2xl p-1">{e}</button>)}</div>}
        {galleryFiles.length > 0 && <div className="px-3 pt-2 bg-white text-xs text-gray-500 flex items-center gap-2 overflow-x-auto"><span className="shrink-0">{galleryFiles.length} media selected</span>{galleryFiles.map((f,i)=><button key={`${f.name}-${i}`} onClick={() => setChatEditIndex(i)} className="shrink-0 px-2 py-1 rounded-full bg-purple-50 text-purple-700 font-semibold">Edit {i+1}</button>)}<button onClick={() => { setGalleryFiles([]); setGalleryFile(null); }} className="text-red-500 shrink-0">Clear</button></div>}
        {chatEditIndex != null && galleryFiles[chatEditIndex] && <MediaEditor file={galleryFiles[chatEditIndex]} mediaType={galleryFiles[chatEditIndex].type?.startsWith('video/') ? 'video' : 'image'} onApply={applyChatEdit} onClose={() => setChatEditIndex(null)} />}
        <footer className="shrink-0 p-2 md:p-3 border-t bg-white"><div className="flex items-center gap-1.5 max-w-4xl mx-auto"><button onClick={() => galleryRef.current?.click()} className="p-2 rounded-full hover:bg-gray-100"><Paperclip className="w-5 h-5 text-gray-500" /></button><input ref={galleryRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={galleryChanged} /><button onClick={() => setEmojiOpen(v => !v)} className="p-2 rounded-full hover:bg-gray-100"><Smile className="w-5 h-5 text-gray-500" /></button><input value={newMessage} onChange={e => { setNewMessage(e.target.value); emitTyping(true); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Type a message..." className="flex-1 min-w-0 px-3 md:px-4 py-2.5 bg-gray-100 rounded-full outline-none text-sm" /><button onClick={sendMessage} disabled={sending || (!newMessage.trim() && !galleryFile)} className="shrink-0 p-3 bg-purple-600 text-white rounded-full disabled:opacity-50"><Send className="w-5 h-5" /></button></div></footer>
      </> : <div className="flex-1 items-center justify-center hidden md:flex text-center"><div><MessageCircle className="w-16 h-16 mx-auto text-gray-300 mb-3" /><h3 className="text-xl font-semibold text-gray-700">Select a chat</h3><p className="text-gray-500 mt-1">Choose a conversation</p></div></div>}
    </section>
    {newChatOpen && <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"><div className="p-4 border-b flex justify-between"><b>New chat</b><button onClick={() => setNewChatOpen(false)}><X /></button></div><div className="p-4 space-y-4"><div className="flex gap-2"><input value={phoneQuery} onChange={e => setPhoneQuery(e.target.value)} placeholder="Mobile number (+91...)" inputMode="tel" className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm" /><button onClick={searchByPhone} disabled={phoneSearching} className="px-4 rounded-full bg-green-500 text-white text-sm">{phoneSearching ? '...' : 'Chat'}</button></div><div className="border-t pt-4"><input value={inviteNumber} onChange={e => setInviteNumber(e.target.value)} placeholder="Number to invite" className="w-full bg-gray-100 rounded-full px-4 py-2 text-sm mb-2" /><button onClick={inviteViaWhatsApp} className="w-full py-2 bg-green-500 text-white rounded-full text-sm font-semibold">Invite via WhatsApp</button></div></div></div></div>}
    {forwardingMessage && <div className="fixed inset-0 z-[110] bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80dvh] overflow-y-auto"><div className="p-4 border-b flex justify-between"><b>Forward message</b><button onClick={() => setForwardingMessage(null)}><X /></button></div><div className="p-2">{chats.filter(c => c.id !== selectedChat?.id).map(c => <button key={c.id} onClick={() => forwardTo(c)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"><img src={other(c)?.avatarUrl || `https://i.pravatar.cc/80?u=${other(c)?.id}`} className="w-10 h-10 rounded-full" alt="" /><span>{other(c)?.fullName || other(c)?.username}</span></button>)}</div></div></div>}
    {vibeEditIndex != null && vibeFiles[vibeEditIndex] && <MediaEditor file={vibeFiles[vibeEditIndex]} mediaType={vibeFiles[vibeEditIndex].type?.startsWith('video/') ? 'video' : 'image'} onApply={applyVibeEdit} onClose={() => setVibeEditIndex(null)} />}
    {vibeComposerOpen && <div className="fixed inset-0 z-[130] bg-black/50 flex items-end sm:items-center justify-center p-4"><div className="bg-white w-full sm:max-w-md rounded-3xl overflow-hidden max-h-[90dvh] flex flex-col"><div className="p-4 border-b flex justify-between"><div><b>Post Vibe</b><p className="text-xs text-gray-500">Photos and videos · 24 hours</p></div><button onClick={() => setVibeComposerOpen(false)}><X /></button></div><div className="p-4 space-y-4 overflow-y-auto">{vibeFiles.length ? <div className="grid grid-cols-3 gap-2">{vibeFiles.map((f, i) => <div key={`${f.name}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-black">{f.type.startsWith('video/') ? <video src={vibePreviewUrls[i] || ''} className="w-full h-full object-cover" muted /> : <img src={vibePreviewUrls[i] || ''} alt="" className="w-full h-full object-cover" />}<button onClick={() => setVibeEditIndex(i)} className="absolute bottom-1 left-1 px-2 py-1 rounded-full bg-white/90 text-purple-700 text-[10px] font-bold">Edit</button><button onClick={() => setVibeFiles(prev => prev.filter((_, n) => n !== i))} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"><X className="w-4 h-4" /></button></div>)}</div> : <div className="w-full h-40 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50 flex flex-col items-center justify-center gap-2 text-purple-700"><ImagePlus className="w-10 h-10" /><b>Add photos or videos</b></div>}<input ref={vibeRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { const selected = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/')); if (selected.length) setVibeFiles(prev => [...prev, ...selected].slice(0, 20)); e.target.value = ''; }} /><input value={vibeCaption} onChange={e => setVibeCaption(e.target.value)} maxLength={300} placeholder="Add a caption (optional)" className="w-full px-4 py-3 rounded-xl bg-gray-100" /><div className="flex gap-2"><button onClick={() => vibeRef.current?.click()} className="flex-1 py-3 rounded-xl border font-semibold">{vibeFiles.length ? 'Add more' : 'Choose media'}</button><button onClick={publishVibe} disabled={!vibeFiles.length || vibeUploading} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-50">{vibeUploading ? 'Posting...' : `Post ${vibeFiles.length || ''} Vibe${vibeFiles.length === 1 ? '' : 's'}`}</button></div></div></div></div>}
    {vibeViewerIndex !== null && <VibeViewer vibes={vibes} index={vibeViewerIndex} userId={user?.id} onClose={() => setVibeViewerIndex(null)} onDelete={deleteVibe} />}
  </div>;
}