import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) return;
    if (localStorage.getItem('ra_social_install_dismissed') === 'true') return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (isIos()) {
      setShowIosHint(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  const dismiss = () => {
    setShowBanner(false);
    setShowIosHint(false);
    localStorage.setItem('ra_social_install_dismissed', 'true');
  };

  if (!showBanner && !showIosHint) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] bg-white rounded-2xl shadow-2xl border border-pink-100 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-blue-500 flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 text-sm">
        {showBanner ? (
          <>
            <p className="font-semibold text-gray-800">Install RA Social</p>
            <p className="text-gray-500 text-xs">Add to your home screen for the full app experience.</p>
          </>
        ) : (
          <>
            <p className="font-semibold text-gray-800">Install RA Social</p>
            <p className="text-gray-500 text-xs">Tap Share <span className="inline-block">⬆️</span> then "Add to Home Screen".</p>
          </>
        )}
      </div>
      {showBanner && (
        <button onClick={handleInstall} className="px-3 py-2 bg-gradient-to-r from-pink-500 to-blue-500 text-white text-xs font-semibold rounded-lg shrink-0">
          Install
        </button>
      )}
      <button onClick={dismiss} className="text-gray-400 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
