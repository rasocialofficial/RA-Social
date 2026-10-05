import React, { useEffect, useState } from 'react';
import { ArrowLeft, Hash, RefreshCw } from 'lucide-react';
import { postAPI } from '../services/api';
import PostCard from '../components/PostCard';

export default function HashtagPage({ name, onBack, onOpenReel }) {
  const [data, setData] = useState({ hashtag: { name: name || '', postsCount: 0 }, posts: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const clean = String(name || '').replace(/^#/, '').trim();
    if (!clean) return;
    setLoading(true);
    try {
      const response = await postAPI.getHashtag(clean);
      setData(response.data?.data || { hashtag: { name: clean, postsCount: 0 }, posts: [] });
    } catch (error) {
      console.error('Failed to load hashtag:', error);
      setData({ hashtag: { name: clean, postsCount: 0 }, posts: [] });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [name]);

  const handleLike = async (postId) => {
    try { await postAPI.like(postId); await load(); } catch (error) { console.error('Failed to like:', error); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100" aria-label="Back"><ArrowLeft className="w-5 h-5" /></button>
        <div className="w-9 h-9 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center"><Hash className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h1 className="font-bold text-lg truncate">#{data.hashtag?.name || name}</h1>
          <p className="text-xs text-gray-500">{data.hashtag?.postsCount || 0} posts</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-gray-100 text-gray-600" aria-label="Refresh"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>

      {loading ? <div className="py-24 text-center text-gray-400">Loading #{String(name || '').replace(/^#/, '')}…</div> : data.posts.length === 0 ? (
        <div className="py-24 text-center px-6">
          <Hash className="w-12 h-12 mx-auto text-gray-300" />
          <p className="font-semibold text-gray-600 mt-3">No posts with this hashtag yet</p>
          <p className="text-sm text-gray-400 mt-1">Try another hashtag or create the first post.</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {data.posts.map(post => <PostCard key={post.id} post={post} onLike={() => handleLike(post.id)} onOpenReel={onOpenReel} onChanged={load} />)}
        </div>
      )}
    </div>
  );
}
