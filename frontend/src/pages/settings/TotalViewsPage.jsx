import React from 'react';
import { ChevronLeft, Film, Users, Clock } from 'lucide-react';

export default function TotalViewsPage({ user, onBack }) {
  const posts = user?.posts || [];
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes?.length || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);
  const estReach = totalLikes * 8 + totalComments * 3;

  const cards = [
    { label: 'Reels Views (estimated)', value: estReach.toLocaleString(), icon: Film, note: 'based on likes/comments' },
    { label: 'Posts Reach (estimated)', value: (totalLikes * 5).toLocaleString(), icon: Users, note: 'based on likes' },
    { label: 'Total Engagement', value: (totalLikes + totalComments).toLocaleString(), icon: Clock, note: 'likes + comments' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Total Views Analytics</h1>
      </div>
      <div className="p-4">
        <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
          ⚠️ No real impression-tracking exists on the backend yet — numbers below are estimates from likes/comments, not actual view counts.
        </div>
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm mb-3 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-blue-400 flex items-center justify-center">
              <c.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className="text-xs text-gray-400">{c.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
