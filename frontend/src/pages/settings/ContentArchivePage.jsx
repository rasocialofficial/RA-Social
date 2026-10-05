import React from 'react';
import { ChevronLeft, Folder } from 'lucide-react';

export default function ContentArchivePage({ user, onBack }) {
  const posts = user?.posts || [];
  const publishedReels = posts.filter((p) => p.mediaType === 'video').length;
  const totalContent = posts.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Content Archive</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-blue-400 flex items-center justify-center">
            <Folder className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase">Total Content</p>
            <p className="text-3xl font-bold text-gray-800">{totalContent}</p>
            <p className="text-xs text-gray-400">items</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm divide-y divide-gray-100">
          <h3 className="font-bold mb-2">Managed Posts</h3>
          <div className="flex justify-between items-center py-3">
            <div>
              <p className="font-semibold text-gray-800">Published Reels</p>
              <p className="text-xs text-gray-400">Active</p>
            </div>
            <span className="text-2xl font-bold text-pink-500">{publishedReels}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <div>
              <p className="font-semibold text-gray-800">Published Posts</p>
              <p className="text-xs text-gray-400">Active</p>
            </div>
            <span className="text-2xl font-bold text-pink-500">{totalContent - publishedReels}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Drafts and bookmarks aren't tracked in the backend yet — only your published posts are shown here.
        </p>
      </div>
    </div>
  );
}
