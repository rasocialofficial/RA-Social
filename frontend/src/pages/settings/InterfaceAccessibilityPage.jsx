import React, { useState, useEffect } from 'react';
import { ChevronLeft, Palette, Type, Contrast } from 'lucide-react';

const KEY = 'ra_social_interface';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || { theme: 'light', fontSize: 'medium', highContrast: false };
  } catch {
    return { theme: 'light', fontSize: 'medium', highContrast: false };
  }
}

export function applyInterfacePrefs(prefs) {
  const root = document.documentElement;
  root.classList.toggle('dark', prefs.theme === 'dark');
  root.classList.toggle('high-contrast', prefs.highContrast);
  root.style.fontSize = prefs.fontSize === 'small' ? '14px' : prefs.fontSize === 'large' ? '18px' : '16px';
}

export default function InterfaceAccessibilityPage({ onBack }) {
  const [prefs, setPrefs] = useState(loadPrefs());

  useEffect(() => {
    applyInterfacePrefs(prefs);
    localStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Interface & Accessibility</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold">Theme & Display</h2>
          </div>
          <label className="text-sm text-gray-500 block mb-1">Select Mode</label>
          <select
            value={prefs.theme}
            onChange={(e) => setPrefs({ ...prefs, theme: e.target.value })}
            className="w-full border border-gray-300 rounded-xl px-4 py-3"
          >
            <option value="light">Light Mode</option>
            <option value="dark">Dark Mode</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Type className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold">Font Size</h2>
          </div>
          <div className="flex bg-gray-100 rounded-full p-1">
            {['small', 'medium', 'large'].map((size) => (
              <button
                key={size}
                onClick={() => setPrefs({ ...prefs, fontSize: size })}
                className={`flex-1 py-2 rounded-full text-sm font-semibold capitalize ${
                  prefs.fontSize === size ? 'bg-gradient-to-r from-pink-500 to-blue-500 text-white' : 'text-gray-500'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Contrast className="w-5 h-5 text-pink-500" />
              <div>
                <h2 className="font-bold">High Contrast</h2>
                <p className="text-xs text-gray-400">Increases contrast for better visibility</p>
              </div>
            </div>
            <button
              onClick={() => setPrefs({ ...prefs, highContrast: !prefs.highContrast })}
              className={`w-12 h-7 rounded-full transition ${prefs.highContrast ? 'bg-gradient-to-r from-pink-500 to-blue-500' : 'bg-gray-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition ${prefs.highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">RA Social · v1.0</p>
      </div>
    </div>
  );
}
