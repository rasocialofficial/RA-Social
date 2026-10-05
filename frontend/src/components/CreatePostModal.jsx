import React, { useRef, useState, useEffect } from 'react';
import { X, Image, Video, Radio, RotateCcw, Pencil, Check, RefreshCw, Play, Pause } from 'lucide-react';
import { postAPI, uploadAPI } from '../services/api';
import MediaEditor from './MediaEditor';

function CreatePostModal({ onClose, onPostCreated, userId, isCreator = false, initialDraft, onDraftSaved }) {
  const [content, setContent] = useState(initialDraft?.content || '');
  const [savedDraftId, setSavedDraftId] = useState(initialDraft?.id || null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaKind, setMediaKind] = useState(null);
  const [uploadStage, setUploadStage] = useState(null);
  const [livePreview, setLivePreview] = useState(false);
  const [liveState, setLiveState] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [isCreatorAd, setIsCreatorAd] = useState(Boolean(initialDraft?.isCreatorAd));
  const [imageRotation, setImageRotation] = useState(0);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const appendSelectionRef = useRef(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const loading = uploadStage !== null;

  // Stop camera only when the modal unmounts. The old effect depended on
  // previewUrl, which stopped the live camera every time media selection changed.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // Revoke each object URL when it is replaced/unmounted to avoid leaking blobs.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setLivePreview(false); setLiveState('idle');
  };

  const startLivePreview = async () => {
    setCameraError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live camera is not supported by this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      setLivePreview(true); setLiveState('live');
      requestAnimationFrame(() => { if (videoRef.current) videoRef.current.srcObject = stream; });
    } catch {
      setCameraError('Camera/microphone permission was denied or is unavailable.');
    }
  };

  const pickPhoto = (append = false) => { appendSelectionRef.current = append; photoInputRef.current?.click(); };
  const pickVideo = (append = false) => { appendSelectionRef.current = append; videoInputRef.current?.click(); };

  const onMediaFilesChosen = (event, kind) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    const limit = 50 * 1024 * 1024;
    const expectedPrefix = kind === 'video' ? 'video/' : 'image/';
    const valid = selected.filter(f => f.size <= limit && f.type.startsWith(expectedPrefix));
    if (valid.length !== selected.length) {
      alert('This file can’t be uploaded. Please choose another file.');
    }
    if (!valid.length) return;
    const appending = appendSelectionRef.current;
    const nextFiles = appending ? [...files, ...valid] : [...valid];
    appendSelectionRef.current = false;
    if (previewUrl && !appending) URL.revokeObjectURL(previewUrl);
    setFiles(nextFiles);
    const nextIndex = appending ? Math.max(0, nextFiles.length - valid.length) : 0;
    setActiveIndex(nextIndex);
    setFile(nextFiles[nextIndex]);
    setMediaKind(nextFiles[nextIndex]?.type?.startsWith('video/') ? 'video' : 'photo');
    setPreviewUrl(URL.createObjectURL(nextFiles[nextIndex]));
    setImageRotation(0);
    setEditOpen(false);
  };

  const clearMedia = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null); setFiles([]); setActiveIndex(0); setPreviewUrl(null); setMediaKind(null); setEditOpen(false); setImageRotation(0);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const selectMedia = (index) => {
    const item = files[index];
    if (!item) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setActiveIndex(index);
    setFile(item);
    setMediaKind(item.type?.startsWith('video/') ? 'video' : 'photo');
    setPreviewUrl(URL.createObjectURL(item));
    setEditOpen(false);
  };

  const applyEditedMedia = (editedFile) => {
    const normalizedFile = mediaKind === 'video'
      ? new File([editedFile], `${(file?.name || 'video').replace(/\.[^.]+$/, '')}-edited.webm`, { type: editedFile.type?.startsWith('video/') ? editedFile.type : 'video/webm', lastModified: Date.now() })
      : editedFile;
    setFiles(prev => prev.map((item, i) => i === activeIndex ? normalizedFile : item));
    setFile(normalizedFile);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(normalizedFile));
    setEditOpen(false);
  };

  const rotateImage = async () => {
    if (!file || mediaKind !== 'photo' || !previewUrl) return;
    const nextRotation = (imageRotation + 90) % 360;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const swap = nextRotation % 180 !== 0;
      canvas.width = swap ? img.naturalHeight : img.naturalWidth;
      canvas.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(nextRotation * Math.PI / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      canvas.toBlob(blob => {
        if (!blob) return;
        const newFile = new File([blob], file.name || 'edited-image.jpg', { type: file.type || 'image/jpeg' });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setFile(newFile);
        setPreviewUrl(URL.createObjectURL(newFile));
        setImageRotation(nextRotation);
      }, file.type || 'image/jpeg', 0.92);
    };
    img.src = previewUrl;
  };

  const saveDraft = async () => {
    if (!content.trim() && !files.length && !initialDraft?.mediaUrl) return;
    setDraftSaving(true);
    try {
      const selectedFiles = files.length ? files : (file ? [file] : []);
      let mediaItems = Array.isArray(initialDraft?.mediaItems) ? initialDraft.mediaItems : [];
      if (selectedFiles.length) {
        mediaItems = await Promise.all(selectedFiles.map(async selectedFile => {
          const upload = await uploadAPI.media(selectedFile);
          return { mediaUrl: upload.data.data.url, mediaType: selectedFile.type?.startsWith('video/') ? 'video' : upload.data.data.mediaType };
        }));
      }
      const primary = mediaItems[0] || { mediaUrl: initialDraft?.mediaUrl || null, mediaType: initialDraft?.mediaType || 'text' };
      const key = `ra-social-drafts-${userId || 'guest'}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const id = savedDraftId || crypto.randomUUID();
      const draft = { id, content: content.trim(), mediaUrl: primary.mediaUrl, mediaType: primary.mediaType, mediaItems, isCreatorAd, createdAt: initialDraft?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      const next = [draft, ...existing.filter(d => d.id !== id)].slice(0, 50);
      localStorage.setItem(key, JSON.stringify(next)); setSavedDraftId(id); onDraftSaved?.();
      alert('Draft saved');
    } catch (error) { alert(error.response?.data?.message || 'Failed to save draft'); }
    finally { setDraftSaving(false); }
  };

  const handleSubmit = async () => {
    const selectedFiles = files.length ? files : (file ? [file] : []);
    if (!content.trim() && !selectedFiles.length && !initialDraft?.mediaUrl) return;
    setUploadStage('uploading');
    try {
      const items = selectedFiles.length ? await Promise.all(selectedFiles.map(async (selectedFile) => {
        const upload = await uploadAPI.media(selectedFile);
        return { mediaUrl: upload.data.data.url, mediaType: selectedFile.type?.startsWith('video/') ? 'video' : upload.data.data.mediaType };
      })) : [{ mediaUrl: initialDraft?.mediaUrl || null, mediaType: initialDraft?.mediaType || 'text' }];
      setUploadStage('publishing');
      for (const item of items) {
        await postAPI.create({ content: content.trim(), mediaUrl: item.mediaUrl, mediaType: item.mediaType, isCreatorAd: false });
      }
      if (savedDraftId) { const key = `ra-social-drafts-${userId || 'guest'}`; const drafts = JSON.parse(localStorage.getItem(key) || '[]'); localStorage.setItem(key, JSON.stringify(drafts.filter(d => d.id !== savedDraftId))); }
      onPostCreated?.();
      stopCamera();
      onClose();
    } catch (error) {
      console.error('Failed to create post:', error);
      alert('Couldn’t publish your post. Please try again.');
      setUploadStage(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <button onClick={() => { stopCamera(); onClose(); }} aria-label="Close" disabled={loading}><X className="w-6 h-6 text-gray-600" /></button>
          <h2 className="font-semibold">Create Post</h2>
          <div className="flex items-center gap-3"><button onClick={saveDraft} disabled={loading || draftSaving || (!content.trim() && !files.length && !initialDraft?.mediaUrl)} className="text-gray-600 text-sm font-semibold disabled:opacity-50">{draftSaving ? 'Saving…' : 'Save draft'}</button><button onClick={handleSubmit} disabled={loading || draftSaving || (!content.trim() && !files.length && !initialDraft?.mediaUrl)} className="text-purple-600 font-semibold disabled:opacity-50">Post</button></div>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/95 z-30 flex flex-col items-center justify-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-gray-800">{uploadStage === 'uploading' ? 'Uploading media…' : 'Publishing post…'}</p>
            <p className="text-xs text-gray-500">Please keep this window open.</p>
          </div>
        )}

        <div className="p-4 space-y-4">
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What's on your mind?" className="w-full h-32 resize-none focus:outline-none text-gray-800" />

          {!previewUrl && !livePreview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button type="button" onClick={pickPhoto} className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-5 hover:bg-gray-50">
                <Image className="w-7 h-7 text-gray-600" /><span className="text-sm font-semibold text-gray-700">Photo</span><span className="text-[11px] text-gray-400">Select multiple photos</span>
              </button>
              <button type="button" onClick={pickVideo} className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-5 hover:bg-gray-50">
                <Video className="w-7 h-7 text-gray-600" /><span className="text-sm font-semibold text-gray-700">Video</span><span className="text-[11px] text-gray-400">Select multiple videos</span>
              </button>
              <button type="button" onClick={startLivePreview} className="flex flex-col items-center gap-2 border-2 border-red-300 bg-red-50 rounded-xl py-5 hover:bg-red-100">
                <Radio className="w-7 h-7 text-red-600" /><span className="text-sm font-bold text-red-600">LIVE</span><span className="text-[11px] text-red-500">Camera</span>
              </button>
            </div>
          )}

          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onMediaFilesChosen(e, 'photo')} />
          <input ref={videoInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => onMediaFilesChosen(e, 'video')} />

          {previewUrl && (
            <div className="rounded-xl overflow-hidden border bg-gray-50">
              <div className="relative bg-black min-h-40 flex items-center justify-center">
                {mediaKind === 'video'
                  ? <video key={previewUrl} src={previewUrl} controls playsInline preload="metadata" className="w-full max-h-80 object-contain bg-black" />
                  : <img src={previewUrl} alt="Selected media preview" className="w-full max-h-80 object-contain bg-black" />}
                <div className="absolute top-2 right-2 flex gap-2">
                  <button type="button" onClick={() => setEditOpen(true)} className="p-2 bg-white/90 rounded-full text-gray-800 shadow" aria-label="Edit selected media"><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={clearMedia} className="p-2 bg-black/70 rounded-full text-white" aria-label="Remove media"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between">
                <div className="min-w-0"><p className="text-sm font-semibold truncate">{files.length > 1 ? `${files.length} media files selected` : file?.name}</p><p className="text-xs text-gray-500">{files.length > 1 ? `Each ${mediaKind === 'video' ? 'video' : 'photo'} will be posted separately.` : 'Media selected'}</p></div>
                <button type="button" onClick={() => (mediaKind === 'video' ? pickVideo(true) : pickPhoto(true))} className="flex items-center gap-1 px-3 py-2 rounded-full bg-gray-100 text-sm font-medium"><RefreshCw className="w-4 h-4" />Add more {mediaKind === 'video' ? 'videos' : 'photos'}</button>
              </div>
              {files.length > 1 && <div className="px-3 pb-3 flex gap-2 overflow-x-auto">{files.map((item, index) => <button type="button" onClick={() => selectMedia(index)} key={`${item.name}-${index}`} className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 bg-black ${activeIndex === index ? 'border-purple-600 ring-2 ring-purple-200' : 'border-gray-200'}`}>{item.type.startsWith('video/') ? <div className="w-full h-full flex items-center justify-center text-white"><Video className="w-6 h-6" /></div> : <img src={URL.createObjectURL(item)} alt="" className="w-full h-full object-cover" />}{index === activeIndex && <span className="absolute bottom-0 left-0 right-0 text-[9px] bg-purple-600 text-white">Editing</span>}</button>)}</div>}
            </div>
          )}

          {editOpen && previewUrl && file && <MediaEditor file={file} mediaType={mediaKind === 'video' ? 'video' : 'image'} onApply={applyEditedMedia} onClose={() => setEditOpen(false)} />}

          {livePreview && (
            <div className="border-2 border-red-200 rounded-xl p-4 bg-red-50">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-bold text-red-600">● LIVE CAMERA</p><p className="text-xs text-gray-500">Camera preview is ready. Public live streaming is coming soon.</p></div>
                <div className="flex gap-2">
                  <button onClick={() => { if (videoRef.current) { if (videoRef.current.paused) { videoRef.current.play(); setLiveState('live'); } else { videoRef.current.pause(); setLiveState('paused'); } } }} className="flex items-center gap-2 px-3 py-2 bg-white border rounded-full text-sm font-semibold">{liveState === 'live' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}{liveState === 'live' ? 'Pause' : 'Resume'}</button>
                  <button onClick={stopCamera} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full"><X className="w-4 h-4" />Stop</button>
                </div>
              </div>
              <video ref={videoRef} autoPlay muted playsInline className="mt-3 w-full max-h-80 rounded-lg bg-black object-cover" />
              {cameraError && <p className="text-sm text-red-600 mt-2">{cameraError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default CreatePostModal;
