import React, { useState } from 'react';
import { ChevronLeft, Film, FileText, Eye, BarChart2 } from 'lucide-react';

export default function AnalyticsHubPage({ user, onBack, onOpenViews, onOpenFollowers, onOpenRevenue }) {
  const [tab, setTab] = useState('reels');
  const reels = (user?.posts || []).filter((p) => p.mediaType === 'video');
  const posts = (user?.posts || []).filter((p) => p.mediaType !== 'video');

  const renderList = (items) => {
    if (items.length === 0) {
      return <p className="text-center text-gray-400 py-10 text-sm">No {tab} yet — post something to see analytics here.</p>;
    }
    return items.map((item) => {
      const likes = item.likes?.length || 0;
      const comments = item.comments?.length || 0;
      const views = Number(item.viewCount || 0);
      return (
        <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm mb-3">
          <p className="font-semibold text-gray-800 mb-2 line-clamp-1">{item.content || 'Untitled post'}</p>
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
            <span className="flex items-center gap-1"><Eye className="w-4 h-4" />{views} views</span>
            <span>❤️ {likes}</span>
            <span>💬 {comments}</span>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-blue-500 text-white text-sm font-semibold">Boost</button>
            <button onClick={onOpenViews} className="flex-1 py-2 rounded-lg border-2 border-purple-300 text-purple-600 text-sm font-semibold">Analytics</button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Reels & Posts Analytics Hub</h1>
      </div>

      <div className="p-4">
        <div className="flex bg-white rounded-full p-1 mb-4 shadow-sm">
          <button
            onClick={() => setTab('reels')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold flex items-center justify-center gap-1 ${tab === 'reels' ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' : 'text-gray-500'}`}
          >
            <Film className="w-4 h-4" /> Reels
          </button>
          <button
            onClick={() => setTab('posts')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold flex items-center justify-center gap-1 ${tab === 'posts' ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' : 'text-gray-500'}`}
          >
            <FileText className="w-4 h-4" /> Posts
          </button>
        </div>

        {renderList(tab === 'reels' ? reels : posts)}

        <div className="grid grid-cols-1 gap-3 mt-4">
          <button onClick={onOpenFollowers} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <span className="font-semibold text-gray-700">Followers & Joins Analytics</span>
            <BarChart2 className="w-5 h-5 text-purple-500" />
          </button>
          <button onClick={onOpenRevenue} className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between">
            <span className="font-semibold text-gray-700">Ad Revenue Analytics</span>
            <BarChart2 className="w-5 h-5 text-purple-500" />
          </button>
        </div>
      </div>
    </div>
  );
}
