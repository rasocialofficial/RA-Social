import React from 'react';
import { ChevronLeft, Briefcase } from 'lucide-react';

export default function BrandCollabPage({ user, onBack }) {
  const earnings = user?.earnings || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Brand Collaborations</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-sm text-gray-500">Total Earnings</p>
          <p className="text-2xl font-bold text-gray-800">${earnings.toFixed(2)}</p>
          <p className="text-xs text-gray-400">Lifetime earnings</p>
        </div>

        <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
          ⚠️ Brand deal matching isn't built into the backend yet — no sponsorship offers are connected. This will populate once that marketplace feature is added.
        </div>

        <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
          <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No active offers yet.</p>
        </div>
      </div>
    </div>
  );
}
