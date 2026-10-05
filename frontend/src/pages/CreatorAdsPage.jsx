import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Megaphone, Video, Image as ImageIcon, Type, Upload, Pencil, Trash2, Save, X, PlayCircle } from 'lucide-react';
import { postAPI, uploadAPI } from '../services/api';

const MAX = 50 * 1024 * 1024;
const MAX_TEXT = 2000;
const ACCEPTED = ['image/', 'video/'];

export default function CreatorAdsPage({ user, onBack }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState('');
  const [dirty, setDirty] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const inputRef = useRef(null);

  const loadAds = async () => {
    setLoading(true);
    try {
      const res = await postAPI.getMyCreatorAds();
      setAds(res.data?.data || []);
    } catch (e) {
      console.error('Failed to load creator ads', e);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user?.id) loadAds(); }, [user?.id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setEditing(null); setContent(''); setFile(null); setFiles([]); setPreview(''); setDirty(false); setUploadName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const chooseFile = (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (!selected.length) return;
    const valid = selected.filter(next => ACCEPTED.some(prefix => next.type?.startsWith(prefix)) && next.size <= MAX);
    if (valid.length !== selected.length) return alert('This file can’t be uploaded. Please choose another file.');
    if (preview && !editing?.mediaUrl) URL.revokeObjectURL(preview);
    setFiles(valid);
    setFile(valid[0]);
    setPreview(URL.createObjectURL(valid[0]));
    setUploadName(valid.length > 1 ? `${valid.length} media files selected` : valid[0].name);
    setDirty(true);
  };

  const startCreate = () => { reset(); setEditing({ id: null }); };
  const startEdit = (ad) => {
    reset();
    setEditing(ad);
    setContent(ad.content || '');
    setFiles(ad.mediaUrl ? [null] : []);
    setPreview(ad.mediaUrl || '');
    setUploadName(ad.mediaUrl ? 'Existing media' : '');
    setDirty(false);
  };

  const save = async () => {
    if (!content.trim() && !file && !editing?.mediaUrl) return alert('Add ad text or media.');
    if (content.length > MAX_TEXT) return alert(`Ad text must be ${MAX_TEXT} characters or less.`);
    setSaving(true);
    try {
      if (editing?.id) {
        let mediaUrl = editing.mediaUrl || null;
        let mediaType = editing.mediaType || 'text';
        if (file) {
          const up = await uploadAPI.media(file);
          mediaUrl = up.data.data.url;
          mediaType = up.data.data.mediaType;
        }
        await postAPI.update(editing.id, { content: content.trim(), mediaUrl, mediaType, isCreatorAd: true });
      } else if (files.length > 1) {
        for (const selectedFile of files) {
          const up = await uploadAPI.media(selectedFile);
          await postAPI.create({ content: content.trim(), mediaUrl: up.data.data.url, mediaType: up.data.data.mediaType, isCreatorAd: true });
        }
      } else {
        let mediaUrl = null;
        let mediaType = 'text';
        if (file) {
          const up = await uploadAPI.media(file);
          mediaUrl = up.data.data.url;
          mediaType = up.data.data.mediaType;
        }
        await postAPI.create({ content: content.trim(), mediaUrl, mediaType, isCreatorAd: true });
      }
      reset();
      await loadAds();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to save Creator Ad');
    } finally { setSaving(false); }
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Discard your unsaved Creator Ad changes?')) return;
    reset();
  };

  const remove = async (ad) => {
    if (!window.confirm('Delete this Creator Ad?')) return;
    try { await postAPI.delete(ad.id); await loadAds(); }
    catch (e) { alert(e.response?.data?.message || 'Failed to delete ad'); }
  };

  const editorTitle = editing?.id ? 'Edit Creator Ad' : 'Create Creator Ad';

  return <div className="min-h-screen bg-gradient-to-br from-pink-50 to-blue-50 pb-24">
    <header className="sticky top-0 z-20 bg-white border-b px-4 py-3 flex items-center gap-3">
      <button onClick={() => { if (editing) requestClose(); else onBack?.(); }} className="p-2 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5" /></button>
      <div className="flex-1"><h1 className="font-bold text-gray-900">Creator Ads</h1><p className="text-xs text-gray-500">Create, edit and manage your promotional posts</p></div>
      {!editing && <button onClick={startCreate} className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm font-semibold flex items-center gap-1"><Megaphone className="w-4 h-4" /> Create Ad</button>}
    </header>

    <main className="max-w-2xl mx-auto p-4">
      {editing && <section className="bg-white rounded-2xl shadow-sm p-4 mb-5">
        <div className="flex items-center justify-between mb-4"><div><h2 className="font-bold text-gray-900">{editorTitle}</h2><p className="text-xs text-gray-500">Upload a photo/video or create a text ad.</p></div><button onClick={requestClose} className="p-2 rounded-full bg-gray-100"><X className="w-5 h-5" /></button></div>
        <textarea value={content} onChange={e => { setContent(e.target.value); setDirty(true); }} maxLength={MAX_TEXT} placeholder="Write your advertisement..." className="w-full min-h-28 border rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300" />
        {(preview || file) ? <div className="mt-3 rounded-xl overflow-hidden bg-black relative">
          {(file?.type?.startsWith('video/') || editing?.mediaType === 'video') ? <video src={preview} controls className="w-full max-h-80 object-contain" /> : <img src={preview} alt="Ad preview" className="w-full max-h-80 object-contain" />}
          <button onClick={() => { setFile(null); if (preview && preview !== editing?.mediaUrl) URL.revokeObjectURL(preview); setPreview(''); setUploadName(''); setDirty(true); }} className="absolute top-2 right-2 bg-black/70 text-white p-2 rounded-full"><X className="w-4 h-4" /></button>
        </div> : <button onClick={() => inputRef.current?.click()} className="mt-3 w-full border-2 border-dashed border-purple-200 bg-purple-50 rounded-xl py-8 flex flex-col items-center gap-2 text-purple-700"><Upload className="w-8 h-8" /><b>Upload photo or video</b><span className="text-xs text-purple-500">Select one or multiple photos/videos</span></button>}
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple={!editing?.id} onChange={chooseFile} className="hidden" />
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400"><span>{content.length}/{MAX_TEXT}</span>{uploadName && <span className="truncate max-w-[65%]">{uploadName}</span>}</div>
        <div className="mt-4 flex gap-2"><button onClick={() => inputRef.current?.click()} className="flex-1 py-3 rounded-xl border font-semibold flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> {preview ? 'Replace media' : 'Add media'}</button><button onClick={save} disabled={saving} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" /> {saving ? 'Saving...' : editing?.id ? 'Save Changes' : 'Publish Ad'}</button></div>
      </section>}

      {!editing && <section className="bg-white rounded-2xl shadow-sm p-5 mb-5 border border-purple-100"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center"><Megaphone className="w-6 h-6 text-white" /></div><div><h2 className="font-bold text-gray-900">Your Creator Ads</h2><p className="text-sm text-gray-500">Ads created here appear on Home and are mixed into Reels.</p></div></div></section>}

      {loading ? <div className="py-16 text-center text-gray-400">Loading ads...</div> : !ads.length ? <div className="bg-white rounded-2xl p-8 text-center shadow-sm"><Megaphone className="w-12 h-12 mx-auto text-purple-300 mb-3" /><h3 className="font-bold text-gray-800">No Creator Ads yet</h3><p className="text-sm text-gray-500 mt-1">Create your first promotional post from the button above.</p>{!editing && <button onClick={startCreate} className="mt-4 px-5 py-2.5 rounded-full bg-purple-600 text-white font-semibold">Create Ad</button>}</div> : <div className="space-y-4">{ads.map(ad => <article key={ad.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">CREATOR AD</span><span className="text-xs text-gray-400">{new Date(ad.createdAt).toLocaleDateString()}</span></div><div className="flex gap-1"><button onClick={() => startEdit(ad)} className="p-2 rounded-full hover:bg-blue-50 text-blue-600"><Pencil className="w-4 h-4" /></button><button onClick={() => remove(ad)} className="p-2 rounded-full hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button></div></div>
        {ad.mediaUrl && (ad.mediaType === 'video' ? <video src={ad.mediaUrl} controls className="w-full max-h-[520px] bg-black object-contain" /> : <img src={ad.mediaUrl} alt="Creator ad" className="w-full max-h-[520px] object-contain bg-gray-50" />)}
        {ad.content && <p className="px-4 py-3 text-gray-800 whitespace-pre-wrap">{ad.content}</p>}
      </article>)}</div>}
    </main>
  </div>;
}
