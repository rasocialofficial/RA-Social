import React, { useEffect, useState } from 'react';
import { Search, X, Clock3, Trash2, ArrowUpRight, ArrowLeft } from 'lucide-react';
import api, { followAPI } from '../services/api';

const HISTORY_KEY = 'ra_social_search_history';
const MAX_HISTORY = 12;

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function SearchPage({ initialQuery = '', source = 'home', onBack, onOpenProfile, onOpenHashtag }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [history, setHistory] = useState(readHistory);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState({});
  const [error, setError] = useState('');


  useEffect(() => {
    const value = String(initialQuery || '').trim();
    setQuery(value);
    setError('');
    setResults(null);
    if (value) handleSearch(value);
    // Search should run whenever another page opens Search with a new query.
  }, [initialQuery]);

  const saveHistory = (term) => {
    const value = term.trim();
    if (!value) return;
    const next = [value, ...history.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_HISTORY);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const deleteHistoryItem = (term) => {
    const next = history.filter(item => item !== term);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const handleSearch = async (term = query) => {
    const q = term.trim();
    if (!q) { setResults(null); return; }
    setQuery(q);
    saveHistory(q);
    setLoading(true);
    setError('');
    try {
      // A normal search is one unified search. There are no All/User/Post/Hashtag tabs.
      const response = await api.get('/search', { params: { query: q, type: source === 'reels' ? 'posts' : 'all' } });
      const data = response.data?.data || {};
      setResults({
        users: Array.isArray(data.users) ? data.users : [],
        posts: Array.isArray(data.posts) ? data.posts : [],
        hashtags: Array.isArray(data.hashtags) ? data.hashtags : []
      });
    } catch (error) {
      console.error('Search failed:', error);
      setResults({ users: [], posts: [], hashtags: [] });
      setError(error?.response?.data?.message || 'Search is temporarily unavailable. Please try again.');
    } finally { setLoading(false); }
  };

  const clearSearch = () => { setQuery(''); setResults(null); setError(''); };

  const resultCount = (results?.users?.length || 0) + (results?.posts?.length || 0) + (results?.hashtags?.length || 0);

  return (
    <div className="pt-6 px-4 min-h-screen">
      <div className="max-w-2xl mx-auto mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              autoFocus type="search" enterKeyHint="search" value={query}
              onChange={e => { setQuery(e.target.value); if (!e.target.value.trim()) setResults(null); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder="Search"
              className="w-full pl-10 pr-10 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {query && <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Clear search"><X className="w-5 h-5" /></button>}
          </div>
          <button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="px-5 py-3 bg-purple-600 text-white rounded-full font-semibold disabled:opacity-40">
            {loading ? '...' : 'Search'}
          </button>
        </div>

        {!query.trim() && !results && (
          <section className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Clock3 className="w-4 h-4" />{source === 'reels' ? 'Reels search history' : 'Search history'}</h2>
              {history.length > 0 && <button onClick={clearHistory} className="text-sm text-red-600 flex items-center gap-1"><Trash2 className="w-4 h-4" />Clear all</button>}
            </div>
            {history.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No search history yet.</div>
            ) : (
              <div className="bg-white rounded-xl border divide-y">
                {history.map(item => (
                  <div key={item} className="flex items-center gap-3 px-4 py-3">
                    <Clock3 className="w-4 h-4 text-gray-400 shrink-0" />
                    <button onClick={() => handleSearch(item)} className="flex-1 text-left text-gray-800 truncate">{item}</button>
                    <button onClick={() => handleSearch(item)} className="p-1 text-gray-400 hover:text-purple-600" aria-label={`Search ${item}`}><ArrowUpRight className="w-4 h-4" /></button>
                    <button onClick={() => deleteHistoryItem(item)} className="p-1 text-gray-400 hover:text-red-600" aria-label={`Delete ${item}`}><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {loading && <div className="text-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" /></div>}

        {results && !loading && (
          <div className="space-y-3 mt-5">
            {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">{error}</div>}
            {resultCount === 0 && <div className="text-center py-20 text-gray-500">No results found</div>}
            {[
              ...(source === 'reels' ? [] : (results.users || []).map(u => ({ kind: 'user', id: `user-${u.id}`, item: u }))),
              ...(results.posts || []).filter(post => source === 'reels' ? (post.mediaType === 'video' || /video|reel/i.test(String(post.mediaType || '')) || Boolean(post.mediaUrl)) : true).map(post => ({ kind: 'post', id: `post-${post.id}`, item: post })),
              ...(source === 'reels' ? [] : (results.hashtags || []).map(tag => ({ kind: 'hashtag', id: `hashtag-${tag.id}`, item: tag })))
            ].map(result => {
              if (result.kind === 'user') {
                const u = result.item;
                return <div key={result.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <button onClick={() => onOpenProfile?.(u.id)}><img src={u.avatarUrl || `https://i.pravatar.cc/150?u=${u.id}`} alt="" className="w-11 h-11 rounded-full object-cover" /></button>
                  <button onClick={() => onOpenProfile?.(u.id)} className="min-w-0 flex-1 text-left"><h4 className="font-semibold truncate">{u.fullName || u.username}</h4><p className="text-sm text-gray-500">@{u.username}</p></button>
                  <button onClick={async () => { try { const r = await followAPI.follow(u.id); setFollowing(v => ({...v, [u.id]: Boolean(r.data?.data?.following)})); } catch(e) { console.error(e); } }} className="px-3 py-1.5 rounded-full bg-purple-600 text-white text-xs font-semibold">{following[u.id] ? 'Following' : 'Follow'}</button>
                </div>;
              }
              if (result.kind === 'post') {
                const post = result.item;
                return <div key={result.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-2"><img src={post.user?.avatarUrl || `https://i.pravatar.cc/150?u=${post.user?.id}`} alt="" className="w-8 h-8 rounded-full" /><div><p className="font-semibold text-sm">{post.user?.fullName || post.user?.username}</p><p className="text-xs text-gray-500">@{post.user?.username}</p></div></div>
                  {post.content && <p className="text-gray-800 whitespace-pre-wrap break-words">{post.content}</p>}
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500"><span>♥ {post.likesCount || 0}</span><span>💬 {post.commentsCount || 0}</span><span>◉ {post.viewCount || 0}</span></div>
                </div>;
              }
              const tag = result.item;
              return <button key={result.id} onClick={() => onOpenHashtag?.(tag.name)} className="w-full flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm text-left hover:border-purple-200 hover:bg-purple-50/40"><span className="font-medium text-gray-800">#{tag.name}</span><span className="text-sm text-gray-500">{tag.postsCount || 0} posts</span></button>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default SearchPage;
