import React, { useState } from 'react';
import { ChevronLeft, Bell, Mail } from 'lucide-react';

const KEY = 'ra_social_notifications';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {
      newFollower: true,
      weeklyReports: true,
      productUpdates: true,
      promotional: false,
    };
  } catch {
    return { newFollower: true, weeklyReports: true, productUpdates: true, promotional: false };
  }
}

export default function NotificationsSettingsPage({ onBack }) {
  const [prefs, setPrefs] = useState(loadPrefs());

  const toggle = (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };

  const Toggle = ({ active, onClick }) => (
    <button onClick={onClick} className={`w-12 h-7 rounded-full transition ${active ? 'bg-gradient-to-r from-pink-500 to-blue-500' : 'bg-gray-300'}`}>
      <div className={`w-5 h-5 bg-white rounded-full shadow transform transition ${active ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Notifications Settings</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold">Push Alerts</h2>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">New Follower Alerts</span>
            <Toggle active={prefs.newFollower} onClick={() => toggle('newFollower')} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Weekly Revenue Reports</span>
            <Toggle active={prefs.weeklyReports} onClick={() => toggle('weeklyReports')} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold">Email Notifications</h2>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Product Updates</span>
            <Toggle active={prefs.productUpdates} onClick={() => toggle('productUpdates')} />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium">Promotional Offers</span>
            <Toggle active={prefs.promotional} onClick={() => toggle('promotional')} />
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          ⚠️ No push/email delivery service is connected yet — these preferences are saved for when that's added.
        </p>
      </div>
    </div>
  );
}
