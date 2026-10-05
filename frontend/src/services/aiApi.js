import api from './api';

export const aiAPI = {
  capabilities: () => api.get('/ai/capabilities'),
  health: () => api.get('/ai/health'),
  usage: () => api.get('/ai/usage'),
  chat: (data) => api.post('/ai/chat', data),
  research: (data) => api.post('/ai/research', data),
  coding: (data) => api.post('/ai/coding', data),
  dataAnalysis: (data) => api.post('/ai/data-analysis', data),
  writing: (data) => api.post('/ai/writing', data),
  social: (data) => api.post('/ai/social', data),
  creative: (data) => api.post('/ai/creative', data),
  video: (data) => api.post('/ai/video', data),
  generateImage: (data) => api.post('/ai/generate-image', data),
  editImage: (file, prompt, conversationId, imageUrl = '') => { const formData = new FormData(); if (file) formData.append('image', file); formData.append('prompt', prompt); if (conversationId) formData.append('conversationId', conversationId); if (imageUrl) formData.append('imageUrl', imageUrl); return api.post('/ai/edit-image', formData); },
  generateVideo: (data) => api.post('/ai/generate-video', data),
  transcribe: (file) => { const formData = new FormData(); formData.append('audio', file); return api.post('/ai/transcribe', formData); },
  memories: () => api.get('/ai/memory'),
  saveMemory: (data) => api.post('/ai/memory', data),
  deleteMemory: (id) => api.delete(`/ai/memory/${id}`),
  analyzeFiles: (files, task = 'summarize', question = '', conversationId) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('task', task);
    formData.append('question', question);
    if (conversationId) formData.append('conversationId', conversationId);
    return api.post('/ai/file-analyze', formData);
  },
  upload: (files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return api.post('/ai/upload', formData);
  },
  history: () => api.get('/ai/history'),
  getConversation: (id) => api.get(`/ai/history/${id}`),
  deleteConversation: (id) => api.delete(`/ai/history/${id}`),
};

export default aiAPI;
