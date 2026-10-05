import React from 'react';
import { LogIn, User } from 'lucide-react';

export default function GuestProfilePage({ onLogin }) {
  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-20 pb-24">
      <div className="mx-auto max-w-md rounded-3xl bg-white border border-gray-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-blue-500 text-white">
          <User className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
        <p className="mt-2 text-sm text-gray-500">Login to access your profile and account.</p>
        <button
          type="button"
          onClick={onLogin}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-blue-500 px-5 py-3 font-semibold text-white"
        >
          <LogIn className="h-5 w-5" />
          Login
        </button>
      </div>
    </div>
  );
}
