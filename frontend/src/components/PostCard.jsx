import React, { useEffect, useRef, useState } from 'react';
import { Heart, MessageSquare, Share2, Send, X, Eye, Download, MoreHorizontal, Link2, Flag, Play, ExternalLink, Reply, ChevronDown } from 'lucide-react';
import { postAPI, followAPI, reportAPI, savedPostAPI } from '../services/api';
import ShareToChatModal from './ShareToChatModal';
import { useAuth } from '../context/AuthContext';
import { downloadMedia } from '../utils/download';

function PostCard({ post, onLike, onOpenReel, profileMode = false, onChanged }) {
  const { user } = useAuth();
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareChatOpen, setShareChatOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(Boolean(post._following || post.following));
  const [joinMenuOpen, setJoinMenuOpen] = useState(false);
  const [views, setViews] = useState(post.viewCount || 0);
  const [saved, setSaved] = useState(Boolean(post._saved));
  const [saveLoading, setSaveLoading] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => setViews(post.viewCount || 0), [post.viewCount]);
  useEffect(() => setFollowing(Boolean(post._following || post.following)), [post._following, post.following]);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const handleFollow = async () => {
    if (!post.user?.id || post.user.id === user?.id) return;
    try { const res = await followAPI.follow(post.user.id); setFollowing(Boolean(res.data.data.following)); setJoinMenuOpen(false); } catch (err) { console.error(err); }
  };
  const recordView = async () => { try { const res = await postAPI.view(post.id); if (typeof res.data.data?.viewCount === 'number') setViews(res.data.data.viewCount); } catch {} };
  const handleDelete = async () => {
    if (!window.confirm('Delete this post permanently?')) return;
    try { await postAPI.delete(post.id); onChanged?.(); } catch (e) { alert(e.response?.data?.message || 'Failed to delete post'); }
  };
  const handleHide = async () => {
    try { await postAPI.hide(post.id); setMenuOpen(false); onChanged?.(); } catch (e) { alert(e.response?.data?.message || 'Failed to hide post'); }
  };
  const loadComments = async () => {
    setCommentOpen(true); setCommentLoading(true);
    try { const res = await postAPI.getById(post.id); setComments(res.data.data.comments || []); } catch { setComments([]); } finally { setCommentLoading(false); }
  };
  const addComment = async () => {
    const text = comment.trim(); if (!text) return;
    try {
      const res = await postAPI.addComment(post.id, replyTo ? `${replyTo.user?.username ? '@' + replyTo.user.username + ' ' : ''}${text}` : text);
      setComments(prev => [res.data.data, ...prev]); setComment(''); setReplyTo(null);
    } catch (e) { alert(e.response?.data?.message || 'Failed to add comment'); }
  };
  const share = async () => {
    const url = `${window.location.origin}/?post=${post.id}`;
    try { if (navigator.share) await navigator.share({ title: 'RA Social post', text: post.content || 'Check this post', url }); else await navigator.clipboard.writeText(url); setSharing(true); setTimeout(() => setSharing(false), 1200); } catch {}
  };
  const mediaLooksLikeVideo = Boolean(post.mediaType === 'video' || /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(post.mediaUrl || '') || /[?&]resource_type=video/i.test(post.mediaUrl || ''));
  const handleDownload = async () => {
    if (!post.mediaUrl || downloading) return;
    setDownloading(true);
    const ext = mediaLooksLikeVideo ? 'mp4' : 'jpg';
    try { await downloadMedia(post.mediaUrl, `ra-social-${post.id}.${ext}`, postAPI.download(post.id)); } finally { setDownloading(false); }
  };
  useEffect(() => { setSaved(Boolean(post._saved)); }, [post._saved]);
  useEffect(() => { let active = true; savedPostAPI.status(post.id).then(r => active && setSaved(Boolean(r.data?.data?.saved))).catch(() => {}); return () => { active = false; }; }, [post.id]);
  const saveToApp = async () => {
    if (saveLoading) return;
    setSaveLoading(true);
    try {
      if (saved) { await savedPostAPI.remove(post.id); setSaved(false); alert('Removed from Saved'); }
      else { await savedPostAPI.save(post.id); setSaved(true); alert('Saved'); }
    } catch (e) { alert(e.response?.data?.message || 'Unable to update saved post'); } finally { setSaveLoading(false); setMenuOpen(false); }
  };

  return (
    <article className={`relative bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible ${menuOpen ? 'z-[80]' : 'z-0'}`}>
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <img src={post.user?.avatarUrl || `https://i.pravatar.cc/150?u=${post.user?.id}`} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 truncate">{post.user?.fullName || post.user?.username}</h3>
              {post.user?.id !== user?.id && <div className="flex items-center gap-1 shrink-0">
                {!following ? (
                  <button onClick={handleFollow} className="px-5 py-2 rounded-full text-sm font-semibold bg-purple-600 text-white">Join</button>
                ) : (
                  <div className="relative flex items-center">
                    <button onClick={() => setJoinMenuOpen(v => !v)} className="px-4 py-2 rounded-l-full text-sm font-semibold bg-gray-100 text-gray-700" aria-expanded={joinMenuOpen}>Joined</button>
                    <button onClick={() => setJoinMenuOpen(v => !v)} className="p-2 rounded-r-full bg-gray-100 text-gray-700 border-l border-white" aria-label="Joined options" aria-expanded={joinMenuOpen}><ChevronDown className="w-4 h-4" /></button>
                    {joinMenuOpen && <div className="absolute left-0 top-11 z-[65] w-32 bg-white rounded-xl shadow-xl border py-1">
                      <button onClick={handleFollow} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Unjoin</button>
                    </div>}
                  </div>
                )}
                <button onClick={recordView} className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200" aria-label="Views"><Eye className="w-4 h-4" /><span>{views.toLocaleString()}</span></button>
              </div>}
            </div>
            <p className="text-sm text-gray-500">@{post.user?.username}</p>
          </div>
        </div>
        {profileMode && user?.id === post.user?.id && <span className="text-xs text-gray-400">My post</span>}
      </div>

      {post.content && <div className="px-4 pb-3"><p className="text-gray-800 whitespace-pre-wrap break-words">{post.content}</p></div>}
      {post.mediaUrl && <div className="px-4 pb-3">
        {mediaLooksLikeVideo ? (
          <button type="button" onClick={() => { recordView(); onOpenReel?.(post); }} className="relative w-full max-h-[70vh] rounded-lg bg-black overflow-hidden block" aria-label="Open video in Reels">
            <video src={post.mediaUrl} playsInline preload="metadata" muted controls={false} className="w-full max-h-[70vh] object-contain bg-black pointer-events-none" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20"><span className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center"><Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" /></span></span>
          </button>
        ) : <button type="button" onClick={recordView} className="block w-full text-left"><img src={post.mediaUrl} alt="Post media" loading="lazy" className="w-full max-h-[70vh] object-contain rounded-lg bg-gray-100" /></button>}
      </div>}

      <div className="relative px-3 py-3 border-t">
        <div className="flex items-center gap-1.5 pr-12 overflow-x-auto whitespace-nowrap">
          <button onClick={onLike} className="action-btn hover:text-red-500"><Heart className="w-5 h-5" /><span>{post.likesCount || 0}</span></button>
          <button onClick={loadComments} className="action-btn hover:text-blue-500"><MessageSquare className="w-5 h-5" /><span>{post.commentsCount || 0}</span></button>
          <button onClick={share} className="action-btn hover:text-green-500"><Share2 className="w-5 h-5" /><span>{sharing ? 'Copied' : 'Share'}</span></button>
          <button onClick={() => setShareChatOpen(true)} className="action-btn hover:text-purple-600" title="Share to Chat"><Send className="w-5 h-5" /><span>Chat</span></button>
          {post.mediaUrl && <button onClick={handleDownload} disabled={downloading} className="action-btn hover:text-purple-600 disabled:opacity-50"><Download className="w-5 h-5" /><span>{downloading ? 'Saving…' : 'Download'}</span></button>}
        </div>
        <div ref={menuRef} className="absolute right-3 bottom-3 z-[90]">
          <button onClick={() => setMenuOpen(v => !v)} className="action-btn bg-white" aria-expanded={menuOpen} aria-haspopup="menu" aria-label="More options"><MoreHorizontal className="w-5 h-5" /></button>
          {menuOpen && <div role="menu" className="absolute right-0 bottom-11 z-[100] w-56 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-gray-200 py-1 overflow-hidden">
            {post.mediaUrl && <button onClick={saveToApp} className="menu-item"><Download className="w-4 h-4" />{saved ? 'Remove from Saved' : 'Save to Saved'}</button>}
            {post.mediaUrl && <button onClick={() => { window.open(post.mediaUrl, '_blank', 'noopener,noreferrer'); setMenuOpen(false); }} className="menu-item"><ExternalLink className="w-4 h-4" />Open media</button>}
            <button onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/?post=${post.id}`); alert('Post link copied'); } catch {} setMenuOpen(false); }} className="menu-item"><Link2 className="w-4 h-4" />Copy link</button>
            {profileMode && user?.id === post.user?.id && <><button onClick={handleHide} className="menu-item"><Eye className="w-4 h-4" />Hide post</button><button onClick={handleDelete} className="menu-item text-red-600"><X className="w-4 h-4" />Delete post</button></>}
            <button onClick={() => { (async () => { const reason = window.prompt('Why are you reporting this post?', 'Inappropriate content'); if (!reason) return; try { await reportAPI.create(post.id, reason); alert('Report submitted.'); } catch (e) { alert(e.response?.data?.message || 'Failed to report post'); } finally { setMenuOpen(false); } })(); }} className="menu-item text-red-600"><Flag className="w-4 h-4" />Report</button>
          </div>}
        </div>
      </div>

      {commentOpen && <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setCommentOpen(false)}>
        <div className="bg-white w-full sm:max-w-lg max-h-[78vh] rounded-t-2xl sm:rounded-2xl flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b"><b>Comments</b><button onClick={() => setCommentOpen(false)}><X className="w-5 h-5" /></button></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {commentLoading && <p className="text-sm text-gray-400 text-center">Loading comments…</p>}
            {!commentLoading && comments.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No comments yet.</p>}
            {comments.map(c => <div key={c.id} className="rounded-xl bg-gray-50 p-3"><div className="flex items-start gap-2"><img src={c.user?.avatarUrl || `https://i.pravatar.cc/80?u=${c.user?.id}`} className="w-8 h-8 rounded-full" alt="" /><div className="flex-1"><b className="text-sm">{c.user?.fullName || c.user?.username}</b><p className="text-sm text-gray-700 mt-1 break-words">{c.content}</p><div className="flex gap-4 mt-2"><button className="text-xs text-gray-500 hover:text-red-500"><Heart className="inline w-3.5 h-3.5 mr-1" />Like</button><button onClick={() => { setReplyTo(c); setComment(''); }} className="text-xs text-gray-500 hover:text-purple-600"><Reply className="inline w-3.5 h-3.5 mr-1" />Reply</button></div></div></div></div>)}
          </div>
          <div className="p-3 border-t">{replyTo && <div className="flex items-center justify-between text-xs text-purple-600 mb-2">Replying to {replyTo.user?.fullName || replyTo.user?.username}<button onClick={() => setReplyTo(null)}><X className="w-4 h-4" /></button></div>}<div className="flex gap-2"><input autoFocus value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder={replyTo ? 'Write a reply…' : 'Write a comment…'} className="flex-1 border rounded-full px-4 py-2 text-sm outline-none" /><button onClick={addComment} className="p-2 rounded-full bg-purple-600 text-white"><Send className="w-4 h-4" /></button></div></div>
        </div>
      </div>}
      <ShareToChatModal open={shareChatOpen} onClose={() => setShareChatOpen(false)} item={{ ...post, currentUserId: user?.id }} />
    </article>
  );
}
export default PostCard;
