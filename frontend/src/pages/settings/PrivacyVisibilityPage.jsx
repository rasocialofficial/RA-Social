import React, { useState } from 'react';
import { ChevronLeft, Eye, CheckCircle2, Shield, Download } from 'lucide-react';

const KEY = 'ra_social_privacy';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { publicProfile: true, activityStatus: true };
  } catch {
    return { publicProfile: true, activityStatus: true };
  }
}

export default function PrivacyVisibilityPage({ onBack }) {
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
        <h1 className="text-lg font-bold">Privacy & Visibility</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm divide-y divide-gray-100">
          <div className="flex items-center gap-2 pb-3">
            <Eye className="w-5 h-5 text-pink-500" />
            <div>
              <h2 className="font-bold">Visibility Controls</h2>
              <p className="text-xs text-gray-400">Control who can see your profile and activity.</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-400" />
              <div>
                <p className="font-medium text-sm">Make Profile Public</p>
                <p className="text-xs text-gray-400">Your profile is visible to everyone</p>
              </div>
            </div>
            <Toggle active={prefs.publicProfile} onClick={() => toggle('publicProfile')} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-purple-400" />
              <div>
                <p className="font-medium text-sm">Show Activity Status</p>
                <p className="text-xs text-gray-400">Let others see when you're active</p>
              </div>
            </div>
            <Toggle active={prefs.activityStatus} onClick={() => toggle('activityStatus')} />
          </div>

          <button className="flex items-center gap-2 py-3 w-full text-left">
            <Shield className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium text-sm">Blocked Users</p>
              <p className="text-xs text-gray-400">Manage accounts you don't want to interact with</p>
            </div>
          </button>

          <button className="flex items-center gap-2 py-3 w-full text-left">
            <Download className="w-5 h-5 text-purple-400" />
            <div>
              <p className="font-medium text-sm">Data Download</p>
              <p className="text-xs text-gray-400">Download a copy of your data</p>
            </div>
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          These preferences are saved on this device only — the backend doesn't enforce profile privacy yet.
        </p>
      </div>
    </div>
  );
}
