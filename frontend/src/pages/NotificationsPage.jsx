import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, User, Bell, Trash2, X } from 'lucide-react';
import { notificationAPI } from '../services/api';

function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel, danger = true }) {
  return (
    <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100" aria-label="Cancel"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 text-sm text-gray-600">{message}</div>
        <div className="p-4 border-t flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className={`px-5 py-2.5 rounded-xl text-white font-semibold ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function NotificationsPage({ searchQuery = '' }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchNotifications();
    notificationAPI.markAsRead().then(() => {
      window.dispatchEvent(new Event('ra:notifications-updated'));
    }).catch(() => {});
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await notificationAPI.getNotifications();
      setNotifications(response.data.data.notifications || []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const visibleNotifications = notifications.filter((item) => { const q = String(searchQuery || '').trim().toLowerCase(); if (!q) return true; return [item.message, item.sender?.fullName, item.sender?.username, item.post?.content, item.type].filter(Boolean).join(' ').toLowerCase().includes(q); });

  const getIcon = (type) => {
    switch (type) {
      case 'like': return <Heart className="w-6 h-6 text-red-500" />;
      case 'comment': return <MessageCircle className="w-6 h-6 text-blue-500" />;
      case 'follow': return <User className="w-6 h-6 text-green-500" />;
      default: return <Bell className="w-6 h-6 text-gray-500" />;
    }
  };

  const removeOne = async (id) => {
    setDeleting(true);
    try {
      await notificationAPI.deleteOne(id);
      setNotifications(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('ra:notifications-updated'));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  };

  const removeAll = async () => {
    setDeleting(true);
    try {
      await notificationAPI.deleteAll();
      setNotifications([]);
      window.dispatchEvent(new Event('ra:notifications-updated'));
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
    } finally {
      setDeleting(false);
      setConfirm(null);
    }
  };

  return (
    <div className="pt-20 px-4 min-h-screen pb-24">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
          <p className="text-sm text-gray-500 mt-1">Your latest activity and updates</p>
        </div>
        {visibleNotifications.length > 0 && (
          <button
            onClick={() => setConfirm({ type: 'all' })}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold"
          >
            <Trash2 className="w-4 h-4" /> Delete all
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto" /><p className="text-gray-500 mt-4">Loading notifications...</p></div>
      ) : visibleNotifications.length === 0 ? (
        <div className="text-center py-20"><Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold text-gray-700">No notifications yet</h3><p className="text-gray-500 mt-2">When someone likes or comments on your posts, you'll see it here</p></div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-3">
          {visibleNotifications.map((notification) => (
            <div key={notification.id} className={`flex items-center gap-3 sm:gap-4 p-4 bg-white rounded-2xl shadow-sm border ${!notification.isRead ? 'border-purple-200' : 'border-gray-100'}`}>
              <div className="flex-shrink-0">{getIcon(notification.type)}</div>
              <img src={notification.sender?.avatarUrl || `https://i.pravatar.cc/150?u=${notification.senderId || notification.id}`} alt="" className="w-11 h-11 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-gray-800"><span className="font-semibold">{notification.sender?.fullName || notification.sender?.username || 'RA Social'}</span>{' '}{notification.message}</p>
                {notification.post && <p className="text-sm text-gray-500 truncate mt-1">{notification.post.content}</p>}
                <p className="text-xs text-gray-400 mt-1">{new Date(notification.createdAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setConfirm({ type: 'one', id: notification.id })}
                className="p-2 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                aria-label="Delete notification"
                title="Delete notification"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.type === 'all' ? 'Delete all notifications?' : 'Delete notification?'}
          message={confirm.type === 'all' ? 'All your notifications will be permanently removed. This cannot be undone.' : 'This notification will be permanently removed. Do you want to continue?'}
          confirmLabel={deleting ? 'Deleting...' : 'Confirm'}
          onCancel={() => !deleting && setConfirm(null)}
          onConfirm={() => confirm.type === 'all' ? removeAll() : removeOne(confirm.id)}
        />
      )}
    </div>
  );
}

export default NotificationsPage;
