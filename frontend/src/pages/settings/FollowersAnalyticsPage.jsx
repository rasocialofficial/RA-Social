import React from 'react';
import { ChevronLeft, UserPlus, TrendingUp, Star } from 'lucide-react';

export default function FollowersAnalyticsPage({ user, onBack }) {
  const followers = user?.followersCount || 0;
  const following = user?.followingCount || 0;

  const cards = [
    { label: 'Total Followers', value: followers, icon: UserPlus },
    { label: 'Total Following', value: following, icon: TrendingUp },
    { label: 'Engagement Ratio', value: followers > 0 ? `${Math.min(100, Math.round((following / followers) * 100))}%` : '—', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Followers & Joins Analytics</h1>
      </div>
      <div className="p-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm mb-3 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-blue-400 flex items-center justify-center">
              <c.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{c.value}</p>
              <p className="text-sm text-gray-500">{c.label}</p>
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-400 text-center mt-4">
          Daily/weekly growth trends need historical tracking, which isn't stored yet — these are current totals only.
        </p>
      </div>
    </div>
  );
}
