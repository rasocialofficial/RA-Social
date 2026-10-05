import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers = config.headers || {};
    delete config.headers['Content-Type'];
    delete config.headers['content-type'];
  }
  return config;
});

export const authAPI = {
  verifyTwoFactorLogin: (challengeToken, code) => api.post('/auth/2fa/verify-login', { challengeToken, code }),
  twoFactorStatus: () => api.get('/auth/2fa/status'),
  twoFactorSetup: () => api.post('/auth/2fa/setup'),
  twoFactorEnable: (code) => api.post('/auth/2fa/enable', { code }),
  twoFactorDisable: (password, code) => api.post('/auth/2fa/disable', { password, code }),
  checkUsername: (username) => api.get(`/auth/check-username?username=${encodeURIComponent(username)}`),
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  createChannel: (channelName) => api.post('/auth/channel', { channelName })
};


export const accountAPI = {
  exportData: () => api.get('/account/export'),
  delete: (password) => api.delete('/account', { data: { password } })
};
export const uploadAPI = {
  media: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/posts/upload', formData, {
      // Let Axios/browser set the multipart boundary automatically.
      headers: {}
    });
  }
};

export const postAPI = {
  create: (data) => api.post('/posts', data),
  getFeed: (page = 1, limit = 10) => api.get(`/posts/feed?page=${page}&limit=${limit}`),
  getMyCreatorAds: () => api.get('/posts/creator-ads/mine'),
  getById: (id) => api.get(`/posts/${id}`),
  update: (id, data) => api.patch(`/posts/${id}`, data),
  delete: (id) => api.delete(`/posts/${id}`),
  hide: (id) => api.patch(`/posts/${id}/hide`),
  like: (id) => api.post(`/posts/${id}/like`),
  addComment: (id, content) => api.post(`/posts/${id}/comments`, { content }),
  view: (id) => api.post(`/posts/${id}/view`),
  download: (id) => `${API_URL}/posts/${id}/download`,
  getHashtag: (name) => api.get(`/search/hashtag/${encodeURIComponent(name)}`)
};

export const savedPostAPI = {
  list: () => api.get('/saved-posts'),
  status: (postId) => api.get(`/saved-posts/${postId}/status`),
  save: (postId) => api.post(`/saved-posts/${postId}`),
  remove: (postId) => api.delete(`/saved-posts/${postId}`)
};


export const watchHistoryAPI = {
  list: () => api.get('/watch-history'),
  clear: () => api.delete('/watch-history')
};

export const reportAPI = {
  create: (postId, reason) => api.post(`/posts/${postId}/report`, { reason }),
  mine: () => api.get('/reports/mine'),
};

export const monetizationAPI = {
  status: () => api.get('/monetization/status'),
  apply: () => api.post('/monetization/apply'),
  analytics: (days = 30) => api.get(`/monetization/analytics?days=${days}`)
};

export const liveAPI = {
  list: () => api.get('/live-sessions'),
  create: (data) => api.post('/live-sessions', data),
  start: (id) => api.patch(`/live-sessions/${id}/start`),
  end: (id) => api.patch(`/live-sessions/${id}/end`),
  remove: (id) => api.delete(`/live-sessions/${id}`),
};

export const payoutAPI = {
  list: () => api.get('/payouts'),
  request: (data) => api.post('/payouts', data)
};

export const searchAPI = {
  search: (query, type = 'all') => {
    const value = String(query || '').trim();
    if (!value) return Promise.reject(new Error('Search query is required'));
    return api.get('/search', {
      params: { query: value, q: value, type: String(type || 'all').toLowerCase() },
      timeout: 15000
    });
  }
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: () => api.put('/notifications/read'),
  deleteOne: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete('/notifications')
};

export const vibeAPI = {
  getAll: () => api.get('/vibes'),
  create: (data) => api.post('/vibes', data),
  delete: (id) => api.delete(`/vibes/${id}`)
};

export const chatAPI = {
  getChats: () => api.get('/chats'),
  getMessages: (chatId) => api.get(`/chats/${chatId}/messages`),
  createChat: (participantId) => api.post('/chats', { participantId }),
  sendMessage: (chatId, content, mediaUrl = null, replyToId = null, forwardedFromId = null) => api.post(`/chats/${chatId}/messages`, { content, mediaUrl, replyToId, forwardedFromId }),
  deleteForMe: (chatId, messageId) => api.delete(`/chats/${chatId}/messages/${messageId}/me`),
  deleteForEveryone: (chatId, messageId) => api.delete(`/chats/${chatId}/messages/${messageId}/everyone`),
  pin: (chatId, messageId) => api.patch(`/chats/${chatId}/messages/${messageId}/pin`),
  forward: (chatId, messageId, targetChatId) => api.post(`/chats/${chatId}/messages/${messageId}/forward`, { targetChatId })
};

export const followAPI = {
  follow: (userId) => api.post(`/follow/${userId}`),
  getStatus: (userId) => api.get(`/follow/${userId}/status`)
};

export default api;
export const userSafetyAPI = {
  status: (userId) => api.get(`/user-safety/${userId}`),
  toggle: (userId, action) => api.post(`/user-safety/${userId}/toggle`, { action })
};

export const userAPI = { getPublic: (id) => api.get(`/users/${id}`) };

export const sessionAPI = {
  list: () => api.get('/sessions'),
  logout: () => api.post('/sessions/logout'),
  logoutAll: () => api.post('/sessions/logout-all'),
  revoke: (id) => api.delete(`/sessions/${id}`)
};
