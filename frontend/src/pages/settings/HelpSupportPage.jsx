import React, { useState } from 'react';
import { ChevronLeft, Headphones, MessageCircle, Phone, ChevronRight } from 'lucide-react';

const faqs = [
  { q: 'How do I reset my account?', a: 'Go to Login, tap "Forgot Password?", and follow the OTP steps to set a new password.' },
  { q: 'How to update my profile?', a: 'Open Me → Profile Overview to edit your display name and bio.' },
  { q: 'How do payouts work?', a: 'Payouts aren\'t live yet — check the Billing & Earnings screen for updates.' },
];

export default function HelpSupportPage({ onBack }) {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-blue-100">
      <div className="bg-gradient-to-r from-pink-500 to-blue-500 text-white px-4 py-4 flex items-center gap-3">
        <button onClick={onBack}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-lg font-bold">Help & Support</h1>
      </div>

      <div className="p-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-blue-400 flex items-center justify-center">
            <Headphones className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-bold">Customer Support</p>
            <p className="text-sm text-gray-500">Email: support@rasocial.com</p>
          </div>
        </div>

        <h3 className="font-bold mb-2">FAQ</h3>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100 mb-4">
          {faqs.map((f, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-medium text-sm">{f.q}</span>
                <ChevronRight className={`w-4 h-4 text-gray-400 transition ${openFaq === i ? 'rotate-90' : ''}`} />
              </button>
              {openFaq === i && <p className="px-5 pb-4 text-sm text-gray-500">{f.a}</p>}
            </div>
          ))}
        </div>

        <h3 className="font-bold mb-2">Contact</h3>
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-5 py-4">
            <MessageCircle className="w-5 h-5 text-pink-500" />
            <div>
              <p className="font-medium text-sm">Live Chat</p>
              <p className="text-xs text-gray-400">Use the Chat tab to reach us</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <Phone className="w-5 h-5 text-purple-500" />
            <div>
              <p className="font-medium text-sm">Email Support</p>
              <p className="text-xs text-gray-400">support@rasocial.com</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
