import React, { useState, useEffect } from 'react';
import { ChevronLeft, Clock, List } from 'lucide-react';

const STORAGE_KEY = 'ra_social_scheduled_posts';

export default function PostSchedulerPage({ onBack }) {
  const [dateTime, setDateTime] = useState('');
  const [caption, setCaption] = useState('');
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setQueue(JSON.parse(saved));
  }, []);

  const handleSchedule = () => {
    if (!dateTime || !caption) return;
    const next = [...queue, { id: Date.now(), dateTime, caption }];
    setQueue(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDateTime('');
    setCaption('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Post Scheduler & Queue</h1>
      </div>

      <div className="p-4">
        <div className="text-xs text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-4">
          ⚠️ There's no backend scheduling engine yet — items saved here stay only on this device (not auto-posted). A real scheduler needs a background job service on the backend.
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold">Schedule New Content</h2>
          </div>
          <label className="text-sm text-gray-500 block mb-1">Select Date & Time</label>
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
          />
          <label className="text-sm text-gray-500 block mb-1">Post Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write caption..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3"
          />
          <button
            onClick={handleSchedule}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 text-white font-semibold"
          >
            Schedule Post
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <List className="w-5 h-5 text-purple-500" />
            <h2 className="font-bold">Queued Posts ({queue.length})</h2>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing queued yet.</p>
          ) : (
            queue.map((q) => (
              <div key={q.id} className="border-b border-gray-100 py-2">
                <p className="font-semibold text-gray-800 text-sm">{q.caption}</p>
                <p className="text-xs text-gray-400">Scheduled for {new Date(q.dateTime).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
