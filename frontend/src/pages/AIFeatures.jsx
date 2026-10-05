import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Send, Paperclip, Image as ImageIcon, Video, FileText,
  MessageSquare, Trash2, X, Sparkles, Menu, ArrowLeft, Loader2,
  Bot, User as UserIcon, Mic, Palette, Brain, Settings, Download, FolderOpen, Wand2,
  Search, Code2, BarChart3, PenSquare, Share2
} from 'lucide-react';
import { aiAPI } from '../services/aiApi';
import MediaEditor from '../components/MediaEditor';

const MAX_FILES = 6;

function AIFeatures({ searchQuery = '' }) {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [researchMode, setResearchMode] = useState(false);
  const [researchDepth, setResearchDepth] = useState('standard');
  const [codingMode, setCodingMode] = useState(false);
  const [codingTask, setCodingTask] = useState('general');
  const [dataMode, setDataMode] = useState(false);
  const [dataTask, setDataTask] = useState('analyze');
  const [writingMode, setWritingMode] = useState(false);
  const [writingTask, setWritingTask] = useState('general');
  const [writingTone, setWritingTone] = useState('natural');
  const [writingLength, setWritingLength] = useState('medium');
  const [socialMode, setSocialMode] = useState(false);
  const [socialTask, setSocialTask] = useState('content_ideas');
  const [socialPlatform, setSocialPlatform] = useState('all');
  const [socialTone, setSocialTone] = useState('natural');
  const [creativeMode, setCreativeMode] = useState(false);
  const [creativeTask, setCreativeTask] = useState('idea');
  const [creativeStyle, setCreativeStyle] = useState('creative');
  const [videoMode, setVideoMode] = useState(false);
  const [videoTask, setVideoTask] = useState('storyboard');
  const [videoDuration, setVideoDuration] = useState('short');
  const [memoryMode, setMemoryMode] = useState(false);
  const [mediaGenerateMode, setMediaGenerateMode] = useState(null);
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [aiWorkspace, setAiWorkspace] = useState('text');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSaveChats, setAutoSaveChats] = useState(() => localStorage.getItem('ra-ai-auto-save') !== 'false');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('ra-ai-compact') === 'true');
  const [usage, setUsage] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [memories, setMemories] = useState([]);
  const audioInputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [rawFiles, setRawFiles] = useState([]);
  const [aiEditIndex, setAiEditIndex] = useState(null);
  const [aiEditSaving, setAiEditSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadHistory();
    aiAPI.capabilities().then((res) => setCapabilities(res.data?.data || null)).catch(() => {});
    aiAPI.usage().then((res) => setUsage(res.data?.data || null)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('ra-ai-auto-save', String(autoSaveChats));
    if (autoSaveChats && messages.length) localStorage.setItem(`ra-ai-autosave-${conversationId || 'draft'}`, JSON.stringify({ messages, savedAt: new Date().toISOString() }));
  }, [autoSaveChats, messages, conversationId]);
  useEffect(() => { localStorage.setItem('ra-ai-compact', String(compactMode)); }, [compactMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await aiAPI.history();
      setConversations(res.data?.data?.conversations || []);
    } catch (error) {
      console.error('AI history error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const newChat = () => {
    setConversationId(null);
    setMessages([]);
    setInputText('');
    setAttachments([]);
    setRawFiles([]);
    setSidebarOpen(false);
    setResearchMode(false);
    setCodingMode(false);
    setDataMode(false);
    setWritingMode(false);
    setSocialMode(false);
    setCreativeMode(false);
    setVideoMode(false);
    setMemoryMode(false);
    setMediaGenerateMode(null);
    setEditSourceUrl('');
    setAiWorkspace('text');
  };

  const openConversation = async (id) => {
    try {
      const res = await aiAPI.getConversation(id);
      const data = res.data?.data?.conversation;
      setConversationId(data.id);
      setMessages(data.messages || []);
      setAttachments([]);
      setRawFiles([]);
      setSidebarOpen(false);
    } catch (error) {
      console.error('Open AI conversation error:', error);
    }
  };

  const closeAllModes = () => {
    setResearchMode(false);
    setCodingMode(false);
    setDataMode(false);
    setWritingMode(false);
    setSocialMode(false);
    setCreativeMode(false);
    setVideoMode(false);
    setMemoryMode(false);
    setMediaGenerateMode(null);
    setEditSourceUrl('');
  };

  const toggleMode = (mode) => {
    const active = mode === 'research' ? researchMode
      : mode === 'coding' ? codingMode
      : mode === 'data' ? dataMode
      : mode === 'writing' ? writingMode
      : mode === 'social' ? socialMode
      : mode === 'creative' ? creativeMode
      : mode === 'video' ? videoMode
      : mode === 'memory' ? memoryMode
      : mode === 'image' ? mediaGenerateMode === 'image'
      : mode === 'mediaVideo' ? mediaGenerateMode === 'video'
      : false;
    closeAllModes();
    if (active) return;
    if (mode === 'research') setResearchMode(true);
    if (mode === 'coding') setCodingMode(true);
    if (mode === 'data') setDataMode(true);
    if (mode === 'writing') setWritingMode(true);
    if (mode === 'social') setSocialMode(true);
    if (mode === 'creative') setCreativeMode(true);
    if (mode === 'video') setVideoMode(true);
    if (mode === 'memory') { setMemoryMode(true); loadMemories(); }
    if (mode === 'image') setMediaGenerateMode('image');
    if (mode === 'mediaVideo') setMediaGenerateMode('video');
  };

  const selectTextWorkspace = () => {
    closeAllModes();
    setAiWorkspace('text');
  };

  const selectVideoWorkspace = () => {
    closeAllModes();
    setAiWorkspace('video');
    setMediaGenerateMode('video');
  };

  const visibleConversations = conversations.filter((item) => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return String(item.title || '').toLowerCase().includes(q);
  });

  const deleteConversation = async (id, event) => {
    event.stopPropagation();
    try {
      await aiAPI.deleteConversation(id);
      setConversations((items) => items.filter((item) => item.id !== id));
      if (conversationId === id) newChat();
    } catch (error) {
      console.error('Delete AI conversation error:', error);
    }
  };

  const handleFiles = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;

    const available = MAX_FILES - attachments.length;
    const files = selected.slice(0, available);
    if (!files.length) return;

    setUploading(true);
    try {
      const res = await aiAPI.upload(files);
      const uploaded = res.data?.data?.files || [];
      setAttachments((prev) => [...prev, ...uploaded].slice(0, MAX_FILES));
      setRawFiles((prev) => [...prev, ...files].slice(0, MAX_FILES));
    } catch (error) {
      console.error('AI upload error:', error);
      alert(error.response?.data?.message || 'Could not upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const applyAIEdit = async (editedFile) => {
    if (aiEditIndex == null || !editedFile) return;
    setAiEditSaving(true);
    try {
      const res = await aiAPI.upload([editedFile]);
      const uploaded = res.data?.data?.files?.[0];
      if (!uploaded) throw new Error('Edited file upload failed');
      setAttachments(prev => prev.map((item, i) => i === aiEditIndex ? uploaded : item));
      setRawFiles(prev => prev.map((item, i) => i === aiEditIndex ? editedFile : item));
      setAiEditIndex(null);
    } catch (error) {
      alert(error.response?.data?.message || error.message || 'Could not save edited attachment.');
    } finally { setAiEditSaving(false); }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setRawFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const analyzeFiles = async (task) => {
    if (!rawFiles.length || sending || uploading) return;
    setSending(true);
    try {
      const response = await aiAPI.analyzeFiles(rawFiles, task, inputText.trim(), conversationId);
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `file-user-${Date.now()}`, role: 'user', content: inputText.trim() || `${task} the attached file(s).`, attachments },
        { id: `file-ai-${Date.now()}`, role: 'assistant', content: data.response || 'File analysis completed.', model: data.model, fileAI: true }
      ]);
      setInputText('');
      setAttachments([]);
      setRawFiles([]);
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'File analysis failed. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const runDataAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `data-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const dataContext = attachments.map((file) => `FILE: ${file.name}\n${file.textPreview || file.url || ''}`).join('\n\n');
      const response = await aiAPI.dataAnalysis({ request, task: dataTask, context: dataContext, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `data-ai-${Date.now()}`, role: 'assistant', content: data.response || 'Analysis completed.', model: data.model, dataAI: true, sources: data.sources || [], executedTools: data.executedTools || [] }]);
      setDataMode(false);
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Reasoning/Data AI failed. Please try again.' }]);
    } finally { setSending(false); }
  };

  const runCodingAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `code-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const response = await aiAPI.coding({ request, task: codingTask, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `code-ai-${Date.now()}`, role: 'assistant', content: data.response || 'Coding response completed.', model: data.model, coding: true, sources: data.sources || [], executedTools: data.executedTools || [] }]);
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Coding AI failed. Please try again.' }]);
    } finally { setSending(false); }
  };

  const runWritingAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `writing-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const response = await aiAPI.writing({ request, task: writingTask, tone: writingTone, length: writingLength, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `writing-ai-${Date.now()}`, role: 'assistant', content: data.response || 'Writing completed.', model: data.model, writing: true }]);
      setWritingMode(false);
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Writing AI failed. Please try again.' }]);
    } finally { setSending(false); }
  };

  const runSocialAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `social-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const response = await aiAPI.social({ request, task: socialTask, platform: socialPlatform, tone: socialTone, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `social-ai-${Date.now()}`, role: 'assistant', content: data.response || 'Social AI completed.', model: data.model, socialAI: true }]);
      setSocialMode(false);
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Social Media AI failed. Please try again.' }]);
    } finally { setSending(false); }
  };

  const runCreativeAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `creative-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const response = await aiAPI.creative({ request, task: creativeTask, style: creativeStyle, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `creative-ai-${Date.now()}`, role: 'assistant', content: data.response || 'Creative response completed.', model: data.model, creativeAI: true }]);
      setCreativeMode(false);
      await loadHistory();
    } catch (error) { setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Creative AI failed. Please try again.' }]); }
    finally { setSending(false); }
  };

  const runVideoAI = async () => {
    const request = inputText.trim();
    if (!request || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { id: `video-user-${Date.now()}`, role: 'user', content: request }]);
    setInputText('');
    try {
      const response = await aiAPI.video({ request, task: videoTask, duration: videoDuration, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev, { id: data.messageId || `video-ai-${Date.now()}`, role: 'assistant', content: data.response || data.message || data.text || 'Video AI completed. Try another request if you need a different plan.', model: data.model, videoAI: true }]);
      setVideoMode(false);
      await loadHistory();
    } catch (error) { setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Video AI failed. Please try again.' }]); }
    finally { setSending(false); }
  };

  const startImageEdit = (imageUrl = '') => {
    closeAllModes();
    setMediaGenerateMode('edit-image');
    setEditSourceUrl(imageUrl || '');
    if (!imageUrl && !rawFiles.some((file) => file.type?.startsWith('image/'))) {
      fileInputRef.current?.click();
    }
  };

  const runMediaGeneration = async () => {
    const prompt = inputText.trim();
    if (!prompt || sending || !mediaGenerateMode) return;
    const type = mediaGenerateMode;
    setSending(true);
    setMessages((prev) => [...prev, { id: `media-user-${Date.now()}`, role: 'user', content: prompt }]);
    setInputText('');
    try {
      if (type === 'edit-image') {
        const sourceFile = rawFiles.find((file) => file.type?.startsWith('image/')) || null;
        if (!sourceFile && !editSourceUrl) throw new Error('Please attach an image to edit, or choose Edit on a generated image.');
        const response = await aiAPI.editImage(sourceFile, prompt, conversationId, editSourceUrl);
        const data = response.data?.data || {};
        if (data.conversationId) setConversationId(data.conversationId);
        setMessages((prev) => [...prev, { id: data.messageId || `edit-ai-${Date.now()}`, role: 'assistant', content: 'Image edited successfully.', model: data.model, mediaUrl: data.url, mediaType: 'image', mediaAI: true }]);
      } else {
        const response = type === 'image'
          ? await aiAPI.generateImage({ prompt, conversationId })
          : await aiAPI.generateVideo({ prompt, duration: 4, conversationId });
        const data = response.data?.data || {};
        if (data.conversationId) setConversationId(data.conversationId);
        setMessages((prev) => [...prev, {
          id: `media-ai-${Date.now()}`,
          role: 'assistant',
          content: type === 'image' ? 'Image generated successfully.' : 'Video generated successfully.',
          model: data.model,
          mediaUrl: data.url,
          mediaType: type,
          mediaAI: true
        }]);
      }
      setMediaGenerateMode(null);
      setEditSourceUrl('');
      await loadHistory();
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || error.message || `${type === 'edit-image' ? 'Image editing' : type === 'image' ? 'Image' : 'Video'} failed. Check the media generation API configuration.` }]);
    } finally { setSending(false); }
  };

  const loadMemories = async () => {
    try { const res = await aiAPI.memories(); setMemories(res.data?.data?.memories || []); }
    catch (error) { console.error('AI memory error:', error); }
  };

  const saveMemory = async () => {
    const content = inputText.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await aiAPI.saveMemory({ content, category: 'general' });
      setMemories((prev) => [res.data?.data?.memory, ...prev].filter(Boolean));
      setMessages((prev) => [...prev, { id: `memory-${Date.now()}`, role: 'assistant', content: 'Memory saved for your RA Social AI profile.', memoryAI: true }]);
      setInputText('');
    } catch (error) { setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error.response?.data?.message || 'Could not save memory.' }]); }
    finally { setSending(false); }
  };

  const deleteMemory = async (id) => {
    try { await aiAPI.deleteMemory(id); setMemories((prev) => prev.filter((item) => item.id !== id)); }
    catch (error) { console.error('Delete AI memory error:', error); }
  };

  const handleAudio = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || sending) return;
    setSending(true);
    try {
      const res = await aiAPI.transcribe(file);
      const text = res.data?.data?.text || '';
      if (text) setInputText((prev) => `${prev}${prev ? ' ' : ''}${text}`);
      else alert('No speech was detected in the audio.');
    } catch (error) { alert(error.response?.data?.message || 'Voice transcription failed.'); }
    finally { setSending(false); }
  };

  const sendMessage = async () => {
    const message = inputText.trim();
    if ((!message && !attachments.length) || sending || uploading) return;

    const outgoing = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: message || 'Please analyze the attached file(s).',
      attachments,
      createdAt: new Date().toISOString()
    };

    setMessages((prev) => [...prev, outgoing]);
    setInputText('');
    setAttachments([]);
    setRawFiles([]);
    setSending(true);

    try {
      const res = await aiAPI.chat({
        message,
        conversationId,
        attachments
      });
      const data = res.data?.data;
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId || `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response,
          model: data.model,
          agent: data.agent,
          vision: data.vision,
          sources: data.sources || [],
          executedTools: data.executedTools || [],
          createdAt: new Date().toISOString()
        }
      ]);
      await loadHistory();
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: error.response?.data?.message || 'AI could not respond right now. Please try again.'
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const runDeepResearch = async () => {
    const topic = inputText.trim();
    if (!topic || sending) return;
    setSending(true);
    try {
      const response = await aiAPI.research({ topic, depth: researchDepth, conversationId });
      const data = response.data?.data || {};
      setConversationId(data.conversationId || conversationId);
      setMessages((prev) => [...prev,
        { id: `user-${Date.now()}`, role: 'user', content: topic },
        { id: data.messageId || `research-${Date.now()}`, role: 'assistant', content: data.response || 'Research completed.', model: data.model, sources: data.sources || [], agent: true }
      ]);
      await loadHistory();
      setInputText('');
      setResearchMode(false);
    } catch (error) {
      setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'assistant', content: error?.response?.data?.message || 'Deep research failed. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const exportChat = () => {
    if (!messages.length) return;
    const title = conversations.find((item) => item.id === conversationId)?.title || 'RA Social AI Chat';
    const body = messages.map((m) => `## ${m.role === 'user' ? 'You' : 'RA Social AI'}\n\n${m.content || ''}`).join('\n\n---\n\n');
    const blob = new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title.replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'ra-ai-chat'}.md`; a.click(); URL.revokeObjectURL(url);
  };

  const saveWorkspace = () => {
    const payload = { conversationId, title: conversations.find((item) => item.id === conversationId)?.title || 'AI Workspace', messages, savedAt: new Date().toISOString() };
    localStorage.setItem(`ra-ai-workspace-${conversationId || 'draft'}`, JSON.stringify(payload));
    alert('AI workspace saved on this device.');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (sending || uploading) return;
      if (mediaGenerateMode) return runMediaGeneration();
      if (researchMode) return runDeepResearch();
      if (codingMode) return runCodingAI();
      if (dataMode) return runDataAI();
      if (writingMode) return runWritingAI();
      if (socialMode) return runSocialAI();
      if (creativeMode) return runCreativeAI();
      if (videoMode) return runVideoAI();
      if (memoryMode) return saveMemory();
      return sendMessage();
    }
  };

  const fileIcon = (mime) => {
    if (mime?.startsWith('image/')) return <ImageIcon size={16} />;
    if (mime?.startsWith('video/')) return <Video size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="pt-16 pb-28 min-h-[100dvh] bg-gradient-to-b from-white to-purple-50/40 flex flex-col overflow-hidden">
      <div className="flex-1 flex min-h-[calc(100vh-64px)] overflow-hidden">
        {/* History */}
        <aside className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed top-16 left-0 z-40 w-72 h-[calc(100vh-64px)] bg-white border-r border-gray-200 shadow-xl transition-transform duration-200 flex flex-col`}>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="font-bold text-gray-900 flex items-center gap-2"><Sparkles size={20} /> AI Chats</div>
            <button onClick={newChat} className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white" title="New chat"><Plus size={18} /></button>
          </div>
          <div className="p-3">
            <button onClick={newChat} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-200 text-purple-700 font-semibold hover:bg-purple-50">
              <MessageSquare size={18} /> New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            {loadingHistory ? (
              <div className="p-4 text-sm text-gray-400">Loading history...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">{searchQuery.trim() ? 'No AI conversations match your search.' : 'Your AI conversations will appear here.'}</div>
            ) : visibleConversations.map((item) => (
              <button key={item.id} onClick={() => openConversation(item.id)} className={`w-full text-left group flex items-center gap-2 p-3 rounded-xl mb-1 ${conversationId === item.id ? 'bg-purple-50' : 'hover:bg-gray-50'}`}>
                <MessageSquare size={17} className="text-gray-500 shrink-0" />
                <span className="flex-1 truncate text-sm text-gray-700">{item.title}</span>
                <span onClick={(e) => deleteConversation(item.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500"><Trash2 size={15} /></span>
              </button>
            ))}
          </div>
        </aside>

        {sidebarOpen && <button className="fixed inset-0 top-16 bg-black/20 z-30" onClick={() => setSidebarOpen(false)} aria-label="Close history" />}

        {/* Chat */}
        <main className="flex-1 flex flex-col min-w-0 pb-2 min-h-0">
          <header className="bg-white/90 backdrop-blur border-b sticky top-0 z-10 px-3 sm:px-4 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <button className="p-2 rounded-full hover:bg-gray-100 shrink-0" onClick={() => setSidebarOpen((v) => !v)} title="AI history" aria-label="AI history"><Menu size={21} /></button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center shrink-0"><Bot size={20} /></div>
              <div className="min-w-0 flex-1"><div className="font-semibold text-gray-900 truncate">RA Social AI</div></div>
              <button onClick={newChat} title="New chat" className="p-2 rounded-full border hover:bg-gray-50 shrink-0"><Plus size={17} /></button>
            </div>

          </header>
          {settingsOpen && (
            <div className="border-b bg-white px-4 py-3 shadow-sm">
              <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-gray-800">AI Settings</span>
                <label className="flex items-center gap-2"><input type="checkbox" checked={autoSaveChats} onChange={(e) => setAutoSaveChats(e.target.checked)} /> Auto-save chats</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={compactMode} onChange={(e) => setCompactMode(e.target.checked)} /> Compact mode</label>
                {usage && <span className="text-gray-500">{usage.conversations || 0} chats • {usage.messages || 0} messages</span>}
                
              </div>
            </div>
          )}

          <section className={`flex-1 min-h-0 overflow-y-auto px-4 py-6 pb-4 ${compactMode ? 'py-3' : ''}`}>
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto text-center pt-12 md:pt-20">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-lg"><Sparkles size={30} /></div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-5">{aiWorkspace === 'video' ? 'What video can I create?' : 'What can I help you with?'}</h1>
                <p className="text-gray-500 mt-2 text-sm">{aiWorkspace === 'video' ? 'Describe your video idea.' : 'Ask anything.'}</p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-left">
                  {['Analyze this photo', 'Deep research a topic', 'Calculate / analyze data', 'Plan a video storyboard'].map((text) => (
                    <button key={text} onClick={() => { setInputText(text); if (text.startsWith('Deep research')) setResearchMode(true); if (text.startsWith('Calculate')) setDataMode(true); if (text.startsWith('Write a')) setWritingMode(true); if (text.startsWith('Create a reel')) setSocialMode(true); if (text.startsWith('Create a visual')) setCreativeMode(true); if (text.startsWith('Plan a video')) setVideoMode(true); if (text.startsWith('Transcribe')) audioInputRef.current?.click(); }} className="p-4 rounded-xl bg-white border hover:border-purple-300 hover:shadow-sm text-sm text-gray-700">{text}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-5">
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {message.role !== 'user' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center shrink-0"><Bot size={16} /></div>}
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user' ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-br-md' : 'bg-white border border-gray-100 shadow-sm text-gray-800 rounded-bl-md'}`}>
                      {message.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {message.attachments.map((file, index) => {
                            const mediaType = file.type || (file.mimeType?.startsWith('video/') ? 'video' : file.mimeType?.startsWith('image/') ? 'image' : null);
                            if (mediaType === 'image' && file.url) return <img key={`${file.url}-${index}`} src={file.url} alt={file.name || 'AI image'} className="max-w-full max-h-72 rounded-lg object-contain" loading="lazy" />;
                            if (mediaType === 'video' && file.url) return <video key={`${file.url}-${index}`} src={file.url} controls playsInline className="max-w-full max-h-72 rounded-lg bg-black" />;
                            return <a key={`${file.url || file.name}-${index}`} href={file.url || '#'} target="_blank" rel="noreferrer" className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${message.role === 'user' ? 'bg-white/15' : 'bg-gray-100'}`}>
                              {fileIcon(file.mimeType)}<span className="max-w-32 truncate">{file.name || 'Attachment'}</span>
                            </a>;
                          })}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words text-[15px] leading-6">{message.content}</div>
                      {message.mediaUrl && message.mediaType === 'image' && <><img src={message.mediaUrl} alt="AI generated" className="mt-3 max-w-full rounded-xl border" loading="lazy" /><button onClick={() => startImageEdit(message.mediaUrl)} className="mt-2 inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50"><Wand2 size={14} /> Edit image</button></>}
                      {message.mediaUrl && message.mediaType === 'video' && <video src={message.mediaUrl} controls playsInline className="mt-3 max-w-full rounded-xl border" />}
                      {message.mediaUrl && <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-purple-600 hover:underline">Open generated {message.mediaType}</a>}
                      {(message.model || message.agent || message.vision || message.fileAI || message.coding || message.dataAI || message.socialAI || message.creativeAI || message.videoAI || message.memoryAI || message.mediaAI) && <div className="mt-2 text-[10px] opacity-50 flex flex-wrap gap-2">{message.model && <span>{message.model}</span>}{message.agent && <span>• Agent tools used</span>}{message.writing && <span>• Writing AI</span>}{message.vision && <span>• Vision analysis</span>}{message.fileAI && <span>• File analysis</span>}{message.coding && <span>• Coding AI</span>}{message.dataAI && <span>• Data & Reasoning</span>}{message.socialAI && <span>• Social & Reels</span>}{message.creativeAI && <span>• Creative AI</span>}{message.videoAI && <span>• Video AI</span>}{message.mediaAI && <span>• Media Generation</span>}{message.memoryAI && <span>• Memory</span>}</div>}
                      {message.sources?.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-gray-100">
                          <div className="text-[11px] font-semibold text-gray-500 mb-1">Sources</div>
                          <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, index) => (
                              <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="text-[11px] text-purple-600 hover:underline truncate max-w-[220px]">{source.title || source.url}</a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {message.role === 'user' && <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0"><UserIcon size={16} /></div>}
                  </div>
                ))}
                {sending && <div className="flex gap-3"><div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white flex items-center justify-center"><Bot size={16} /></div><div className="bg-white border rounded-2xl px-4 py-3"><Loader2 className="animate-spin text-purple-600" size={20} /></div></div>}
                <div ref={messagesEndRef} />
              </div>
            )}
          </section>

          <div className="shrink-0 bg-white border-t px-3 md:px-6 py-3">
            <div className="max-w-3xl mx-auto">
              {attachments.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {attachments.map((file, index) => (
                    <div key={`${file.url}-${index}`} className="relative shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 text-xs">
                      {fileIcon(file.mimeType)}<span className="max-w-32 truncate">{file.name}</span>
                      {rawFiles[index]?.type?.startsWith('image/') || rawFiles[index]?.type?.startsWith('video/') ? <button onClick={() => setAiEditIndex(index)} disabled={aiEditSaving} className="text-purple-600 font-semibold">Edit</button> : null}
                      <button onClick={() => removeAttachment(index)} className="text-gray-500 hover:text-red-500"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              {attachments.length > 0 && rawFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                  <button onClick={() => analyzeFiles('summarize')} disabled={sending} className="px-3 py-1.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold disabled:opacity-50">Summarize</button>
                  <button onClick={() => analyzeFiles('extract')} disabled={sending} className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold disabled:opacity-50">Extract</button>
                  {rawFiles.length > 1 && <button onClick={() => analyzeFiles('compare')} disabled={sending} className="px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold disabled:opacity-50">Compare</button>}
                  <button onClick={() => analyzeFiles('outline')} disabled={sending} className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold disabled:opacity-50">Outline</button>
                  <button onClick={() => analyzeFiles('qa')} disabled={sending || !inputText.trim()} className="px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-semibold disabled:opacity-50">Ask about files</button>
                </div>
              )}
              {codingMode && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  <span className="font-semibold">Coding AI</span>
                  <select value={codingTask} onChange={(e) => setCodingTask(e.target.value)} className="ml-auto rounded-lg border border-blue-200 bg-white px-2 py-1 outline-none">
                    <option value="general">General coding</option><option value="generate">Generate code</option><option value="debug">Debug / fix error</option><option value="review">Code review</option><option value="refactor">Refactor</option><option value="explain">Explain code</option><option value="tests">Generate tests</option><option value="sql">SQL / database</option><option value="architecture">Architecture</option>
                  </select>
                  <button onClick={() => setCodingMode(false)} className="px-2 py-1 rounded-lg hover:bg-blue-100">Cancel</button>
                </div>
              )}
              {dataMode && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <span className="font-semibold">Data & Reasoning AI</span>
                  <select value={dataTask} onChange={(e) => setDataTask(e.target.value)} className="ml-auto rounded-lg border border-emerald-200 bg-white px-2 py-1 outline-none">
                    <option value="analyze">Analyze data</option><option value="calculate">Calculate</option><option value="statistics">Statistics</option><option value="compare">Compare</option><option value="patterns">Find patterns</option><option value="table">Build / explain table</option><option value="decision">Decision support</option><option value="forecast">Forecast / projection</option>
                  </select>
                  <button onClick={() => setDataMode(false)} className="px-2 py-1 rounded-lg hover:bg-emerald-100">Cancel</button>
                </div>
              )}
              {writingMode && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-pink-200 bg-pink-50 px-3 py-2 text-xs text-pink-700">
                  <span className="font-semibold">Writing AI</span>
                  <select value={writingTask} onChange={(e) => setWritingTask(e.target.value)} className="rounded-lg border border-pink-200 bg-white px-2 py-1 outline-none">
                    <option value="general">General writing</option><option value="caption">Caption</option><option value="social_post">Social post</option><option value="blog">Blog / article</option><option value="email">Email</option><option value="script">Script</option><option value="headline">Headline / hook</option><option value="rewrite">Rewrite</option><option value="grammar">Grammar / spelling</option><option value="summarize">Summarize</option><option value="paraphrase">Paraphrase</option><option value="cta">CTA</option>
                  </select>
                  <select value={writingTone} onChange={(e) => setWritingTone(e.target.value)} className="rounded-lg border border-pink-200 bg-white px-2 py-1 outline-none">
                    <option value="natural">Natural</option><option value="casual">Casual</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="formal">Formal</option><option value="persuasive">Persuasive</option><option value="creative">Creative</option>
                  </select>
                  <select value={writingLength} onChange={(e) => setWritingLength(e.target.value)} className="rounded-lg border border-pink-200 bg-white px-2 py-1 outline-none">
                    <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                  </select>
                  <button onClick={() => setWritingMode(false)} className="px-2 py-1 rounded-lg hover:bg-pink-100">Cancel</button>
                </div>
              )}
              {socialMode && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                  <span className="font-semibold">Social & Reels AI</span>
                  <select value={socialTask} onChange={(e) => setSocialTask(e.target.value)} className="rounded-lg border border-orange-200 bg-white px-2 py-1 outline-none">
                    <option value="content_ideas">Content ideas</option><option value="caption">Caption</option><option value="reel_script">Reel script</option><option value="hooks">Hooks</option><option value="hashtags">Hashtags</option><option value="cta">CTA</option><option value="title_description">Title / description</option><option value="content_calendar">Content calendar</option><option value="engagement">Engagement ideas</option><option value="repurpose">Repurpose content</option><option value="platform_adapt">Platform adaptation</option><option value="ab_variants">A/B variants</option><option value="posting_strategy">Posting strategy</option><option value="performance">Performance insights</option>
                  </select>
                  <select value={socialPlatform} onChange={(e) => setSocialPlatform(e.target.value)} className="rounded-lg border border-orange-200 bg-white px-2 py-1 outline-none">
                    <option value="all">All platforms</option><option value="instagram">Instagram</option><option value="youtube">YouTube</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option><option value="x">X</option>
                  </select>
                  <select value={socialTone} onChange={(e) => setSocialTone(e.target.value)} className="rounded-lg border border-orange-200 bg-white px-2 py-1 outline-none">
                    <option value="natural">Natural</option><option value="casual">Casual</option><option value="professional">Professional</option><option value="energetic">Energetic</option><option value="educational">Educational</option><option value="persuasive">Persuasive</option><option value="creative">Creative</option>
                  </select>
                  <button onClick={() => setSocialMode(false)} className="px-2 py-1 rounded-lg hover:bg-orange-100">Cancel</button>
                </div>
              )}
              {creativeMode && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-fuchsia-200 bg-fuchsia-50 px-3 py-2 text-xs text-fuchsia-700">
                  <span className="font-semibold">Creative AI</span>
                  <select value={creativeTask} onChange={(e) => setCreativeTask(e.target.value)} className="rounded-lg border border-fuchsia-200 bg-white px-2 py-1 outline-none">
                    <option value="idea">Ideas</option><option value="story">Story / characters</option><option value="image_prompt">Image prompt</option><option value="campaign">Campaign concept</option><option value="dialogue">Dialogue</option><option value="names">Names / taglines</option><option value="variations">Creative variations</option>
                  </select>
                  <select value={creativeStyle} onChange={(e) => setCreativeStyle(e.target.value)} className="rounded-lg border border-fuchsia-200 bg-white px-2 py-1 outline-none">
                    <option value="creative">Creative</option><option value="cinematic">Cinematic</option><option value="minimal">Minimal</option><option value="funny">Funny</option><option value="dramatic">Dramatic</option><option value="premium">Premium</option>
                  </select>
                  <button onClick={() => setCreativeMode(false)} className="px-2 py-1 rounded-lg hover:bg-fuchsia-100">Cancel</button>
                </div>
              )}
              {videoMode && (
                <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-700">
                  <span className="font-semibold">Video AI</span>
                  <select value={videoTask} onChange={(e) => setVideoTask(e.target.value)} className="rounded-lg border border-cyan-200 bg-white px-2 py-1 outline-none">
                    <option value="storyboard">Storyboard</option><option value="shot_list">Shot list</option><option value="voiceover">Voiceover</option><option value="editing_plan">Editing plan</option><option value="broll">B-roll plan</option><option value="thumbnail">Thumbnail concept</option><option value="repurpose">Repurpose video</option>
                  </select>
                  <select value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} className="rounded-lg border border-cyan-200 bg-white px-2 py-1 outline-none">
                    <option value="short">Short</option><option value="30-60 seconds">30–60 sec</option><option value="1-3 minutes">1–3 min</option><option value="long">Long</option>
                  </select>
                  <button onClick={() => setVideoMode(false)} className="px-2 py-1 rounded-lg hover:bg-cyan-100">Cancel</button>
                </div>
              )}
              {memoryMode && (
                <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  <div className="flex items-center gap-2"><Brain size={15} /><span className="font-semibold">Personal AI Memory</span><button onClick={loadMemories} className="ml-auto px-2 py-1 rounded-lg bg-white border">Refresh</button><button onClick={saveMemory} disabled={!inputText.trim() || sending} className="px-2 py-1 rounded-lg bg-violet-600 text-white disabled:opacity-40">Save</button><button onClick={() => setMemoryMode(false)} className="px-2 py-1 rounded-lg hover:bg-violet-100">Close</button></div>
                  {memories.length > 0 && <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">{memories.slice(0, 8).map((item) => <div key={item.id} className="flex gap-2 items-start bg-white/70 rounded-lg p-2"><span className="flex-1">{item.content}</span><button onClick={() => deleteMemory(item.id)} className="text-red-500"><Trash2 size={13} /></button></div>)}</div>}
                </div>
              )}
              {mediaGenerateMode && (
                <div className={`mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${mediaGenerateMode === 'image' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
                  {mediaGenerateMode === 'image' ? <ImageIcon size={15} /> : <Video size={15} />}
                  <span className="font-semibold">{mediaGenerateMode === 'image' ? 'AI Image Generation' : mediaGenerateMode === 'edit-image' ? 'AI Image Editing' : 'AI Video Generation'}</span>
                  <span className="text-[11px] opacity-70">Powered by Pollinations</span>
                  <button onClick={() => setMediaGenerateMode(null)} className="ml-auto px-2 py-1 rounded-lg hover:bg-white/70">Cancel</button>
                </div>
              )}
              {researchMode && (
                <div className="mb-2 flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
                  <span className="font-semibold">Deep Research</span>
                  <select value={researchDepth} onChange={(e) => setResearchDepth(e.target.value)} className="ml-auto rounded-lg border border-purple-200 bg-white px-2 py-1 outline-none">
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </select>
                  <button onClick={() => setResearchMode(false)} className="px-2 py-1 rounded-lg hover:bg-purple-100">Cancel</button>
                </div>
              )}
              <div className="flex items-end gap-2 border rounded-2xl p-2 shadow-sm focus-within:border-purple-400 bg-white">
                <button onClick={() => audioInputRef.current?.click()} disabled={sending} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-40" title="Voice transcription"><Mic size={20} /></button>
                <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudio} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading || attachments.length >= MAX_FILES} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-40" title="Attach files"><Plus size={23} /></button>
                <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.txt,.json,.csv,.md,.log,.xml,.html,.css,.js,.jsx,.ts,.tsx,.sql,.prisma,.yaml,.yml,.zip" onChange={handleFiles} className="hidden" />
                <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={handleKeyDown} rows={1} placeholder={uploading ? 'Uploading files...' : 'Message RA Social AI...'} className="flex-1 resize-none outline-none bg-transparent px-2 py-2 max-h-32" />
                <button onClick={mediaGenerateMode ? runMediaGeneration : researchMode ? runDeepResearch : codingMode ? runCodingAI : dataMode ? runDataAI : writingMode ? runWritingAI : socialMode ? runSocialAI : creativeMode ? runCreativeAI : videoMode ? runVideoAI : memoryMode ? saveMemory : sendMessage} disabled={sending || uploading || (!inputText.trim() && !attachments.length)} className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-40" title={mediaGenerateMode ? `Generate ${mediaGenerateMode}` : researchMode ? 'Start research' : codingMode ? 'Run coding AI' : dataMode ? 'Run data analysis' : writingMode ? 'Run Writing AI' : socialMode ? 'Run Social & Reels AI' : creativeMode ? 'Run Creative AI' : videoMode ? 'Run Video AI' : memoryMode ? 'Save memory' : 'Send'}><Send size={18} /></button>
              </div>
              <div className="text-[10px] text-gray-400 text-center mt-2">+ supports up to {MAX_FILES} attachments • AI may make mistakes</div>
            </div>
          </div>
        </main>
      </div>
      {aiEditIndex != null && rawFiles[aiEditIndex] && <MediaEditor file={rawFiles[aiEditIndex]} mediaType={rawFiles[aiEditIndex].type?.startsWith('video/') ? 'video' : 'image'} onApply={applyAIEdit} onClose={() => setAiEditIndex(null)} />}
    </div>
  );
}

export default AIFeatures;