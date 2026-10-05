import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Check, RotateCw, FlipHorizontal, FlipVertical, Crop, SlidersHorizontal,
  Sparkles, Type, Gauge, Scissors, Volume2, VolumeX, Play, Pause, Music2,
  Wand2, Move, Palette, RotateCcw
} from 'lucide-react';

const FILTERS = {
  Original: '',
  Vivid: 'saturate(1.35) contrast(1.08)',
  Warm: 'saturate(1.16) sepia(.14) contrast(1.04)',
  Cool: 'saturate(.95) hue-rotate(12deg) contrast(1.05)',
  'B&W': 'grayscale(1) contrast(1.08)',
  Vintage: 'sepia(.28) saturate(.78) contrast(.96)',
  Cinematic: 'contrast(1.18) saturate(.88) brightness(.98)',
  Fade: 'contrast(.92) saturate(.84) brightness(1.04)',
  Dramatic: 'contrast(1.3) saturate(1.05) brightness(.96)',
  Sunset: 'sepia(.12) saturate(1.3) hue-rotate(-8deg) contrast(1.06)',
  Mono: 'grayscale(1) contrast(1.2) brightness(.96)'
};

const RATIOS = [
  ['free', 'Original'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:4', '3:4'],
  ['16:9', '16:9'], ['9:16', '9:16']
];
const SPEEDS = [.25, .5, .75, 1, 1.25, 1.5, 2, 3];
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function MediaEditor({ file, mediaType, onApply, onClose }) {
  const type = mediaType || (file?.type?.startsWith('video/') ? 'video' : 'image');
  const [tab, setTab] = useState(type === 'video' ? 'trim' : 'adjust');
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [filter, setFilter] = useState('Original');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [blur, setBlur] = useState(0);
  const [sharpen, setSharpen] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [tint, setTint] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [aspect, setAspect] = useState('free');
  const [fitMode, setFitMode] = useState('fill');
  const [text, setText] = useState('');
  const [textSize, setTextSize] = useState(34);
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState(true);
  const [textStroke, setTextStroke] = useState(1);
  const [textPosition, setTextPosition] = useState('bottom');
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [musicFile, setMusicFile] = useState(null);
  const [musicVolume, setMusicVolume] = useState(.65);
  const [musicLoop, setMusicLoop] = useState(true);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const musicInputRef = useRef(null);
  const url = useMemo(() => file ? URL.createObjectURL(file) : '', [file]);
  const musicUrl = useMemo(() => musicFile ? URL.createObjectURL(musicFile) : '', [musicFile]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (musicUrl) URL.revokeObjectURL(musicUrl); }, [musicUrl]);
  useEffect(() => { if (duration && !end) setEnd(duration); }, [duration, end]);

  const visualFilter = `${FILTERS[filter] || ''} brightness(${brightness / 100}) contrast(${contrast / 100}) saturate(${saturation / 100}) blur(${blur}px) ${tint ? `hue-rotate(${tint}deg)` : ''}`;
  const previewTransform = `translate(${posX * 0.35}px, ${posY * 0.35}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipX ? -1 : 1}) scaleY(${flipY ? -1 : 1})`;

  const reset = () => {
    setRotation(0); setFlipX(false); setFlipY(false); setFilter('Original');
    setBrightness(100); setContrast(100); setSaturation(100); setBlur(0); setSharpen(0);
    setWarmth(0); setTint(0); setVignette(0); setZoom(1); setPosX(0); setPosY(0);
    setAspect('free'); setFitMode('fill'); setText(''); setTextSize(34); setTextColor('#ffffff');
    setTextBg(true); setTextStroke(1); setTextPosition('bottom'); setStart(0); setEnd(duration || 0);
    setSpeed(1); setVolume(1); setMusicFile(null); setMusicVolume(.65); setError('');
  };

  const drawText = (ctx, w, h) => {
    if (!text.trim()) return;
    ctx.save();
    const safeSize = clamp(textSize, 14, 100);
    ctx.font = `700 ${safeSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = textPosition === 'top' ? safeSize * 1.8 : textPosition === 'center' ? h / 2 : h - safeSize * 1.8;
    const label = text.trim();
    const metrics = ctx.measureText(label);
    const padX = 18, padY = 10;
    if (textBg) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.roundRect((w - metrics.width) / 2 - padX, y - safeSize / 2 - padY, metrics.width + padX * 2, safeSize + padY * 2, 12); ctx.fill(); }
    if (textStroke > 0) { ctx.lineWidth = textStroke * 2; ctx.strokeStyle = 'rgba(0,0,0,.9)'; ctx.strokeText(label, w / 2, y); }
    ctx.fillStyle = textColor; ctx.fillText(label, w / 2, y);
    ctx.restore();
  };

  const applyColorLayers = (ctx) => {
    if (warmth > 0) { ctx.save(); ctx.globalAlpha = warmth / 180; ctx.fillStyle = '#ffb35c'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    if (warmth < 0) { ctx.save(); ctx.globalAlpha = Math.abs(warmth) / 180; ctx.fillStyle = '#5aa7ff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
    if (vignette > 0) {
      const g = ctx.createRadialGradient(ctx.canvas.width/2, ctx.canvas.height/2, Math.min(ctx.canvas.width, ctx.canvas.height)*.18, ctx.canvas.width/2, ctx.canvas.height/2, Math.max(ctx.canvas.width, ctx.canvas.height)*.72);
      g.addColorStop(.45, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette/100})`);
      ctx.fillStyle = g; ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
    }
  };

  const getCrop = (w, h) => {
    if (aspect === 'free') return { w, h };
    const [aw, ah] = aspect.split(':').map(Number); const target = aw / ah;
    if (w / h > target) return { w: h * target, h };
    return { w, h: w / target };
  };

  const imageExport = async () => {
    const img = imageRef.current; if (!img) throw new Error('Image is not ready.');
    const nw = img.naturalWidth || img.width, nh = img.naturalHeight || img.height;
    const crop = getCrop(nw, nh); const rotated = rotation % 180 !== 0;
    const outW = Math.max(1, Math.round(rotated ? crop.h : crop.w));
    const outH = Math.max(1, Math.round(rotated ? crop.w : crop.h));
    const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = outH;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not create image editor canvas.');
    ctx.save(); ctx.fillStyle = '#111'; ctx.fillRect(0,0,outW,outH);
    if (fitMode === 'blur') { ctx.filter = 'blur(28px)'; ctx.drawImage(img, 0, 0, outW, outH); ctx.filter = 'none'; }
    ctx.translate(outW/2, outH/2); ctx.rotate(rotation*Math.PI/180); ctx.scale(flipX?-1:1, flipY?-1:1); ctx.filter = `${FILTERS[filter]||''} brightness(${brightness/100}) contrast(${contrast/100}) saturate(${saturation/100}) blur(${blur}px)`;
    const sx = (nw-crop.w)/2 - (posX/100)*crop.w*.28, sy = (nh-crop.h)/2 - (posY/100)*crop.h*.28;
    ctx.drawImage(img, sx, sy, crop.w, crop.h, -crop.w*zoom/2, -crop.h*zoom/2, crop.w*zoom, crop.h*zoom);
    ctx.restore(); ctx.filter = 'none'; applyColorLayers(ctx); drawText(ctx,outW,outH);
    return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(new File([b], file.name.replace(/\.[^.]+$/,'')+'-edited.jpg',{type:'image/jpeg',lastModified:Date.now()})):reject(new Error('Could not export image.')),'image/jpeg',.95));
  };

  const exportVideo = async () => {
    const video = videoRef.current;
    if (!video) throw new Error('Video is not ready.');
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || typeof video.captureStream !== 'function') throw new Error('This browser can’t edit this video. Please try another browser.');
    const total = duration || video.duration || 0; if (!total) throw new Error('Video duration is not ready yet.');
    const from = clamp(Number(start)||0,0,Math.max(0,total-.05)); const to = clamp(Number(end)||total,from+.05,total);
    const bw = video.videoWidth||1280, bh=video.videoHeight||720, crop=getCrop(bw,bh), rotated=rotation%180!==0;
    const cw=Math.max(2,Math.round(rotated?crop.h:crop.w)), ch=Math.max(2,Math.round(rotated?crop.w:crop.h));
    const canvas=canvasRef.current||document.createElement('canvas'); canvas.width=cw; canvas.height=ch; const ctx=canvas.getContext('2d',{alpha:false});
    const stream=canvas.captureStream(30); const source=video.captureStream();
    let audioCtx=null, destination=null, videoSource=null, musicEl=null, musicSource=null;
    try {
      if (source.getAudioTracks().length || musicUrl) {
        audioCtx=new (window.AudioContext||window.webkitAudioContext)(); destination=audioCtx.createMediaStreamDestination();
        videoSource=audioCtx.createMediaElementSource(video); const videoGain=audioCtx.createGain(); videoGain.gain.value=volume; videoSource.connect(videoGain).connect(destination); videoSource.connect(audioCtx.destination);
        if (musicUrl) { musicEl=new Audio(musicUrl); musicEl.loop=musicLoop; musicEl.volume=1; musicSource=audioCtx.createMediaElementSource(musicEl); const musicGain=audioCtx.createGain(); musicGain.gain.value=musicVolume; musicSource.connect(musicGain).connect(destination); musicSource.connect(audioCtx.destination); }
        destination.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
      } else source.getAudioTracks().forEach(t=>stream.addTrack(t));
      const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
      const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8000000}:undefined); const chunks=[]; let raf=null; let stopped=false;
      const done=new Promise((resolve,reject)=>{recorder.ondataavailable=e=>e.data?.size&&chunks.push(e.data);recorder.onerror=()=>reject(new Error('Video export failed. Please try again.'));recorder.onstop=resolve;});
      const seekTo=()=>new Promise((resolve,reject)=>{const ok=()=>{video.removeEventListener('seeked',ok);resolve();};video.addEventListener('seeked',ok,{once:true});video.addEventListener('error',()=>reject(new Error('Could not seek video.')),{once:true});video.currentTime=from;});
      await seekTo(); video.playbackRate=speed; video.volume=volume; if(audioCtx?.state==='suspended') await audioCtx.resume(); if(musicEl){musicEl.currentTime=0;}
      recorder.start(200); await video.play(); if(musicEl) await musicEl.play().catch(()=>{}); setPlaying(true);
      const draw=()=>{if(stopped)return;if(video.currentTime>=to||video.ended){stopped=true;video.pause();if(musicEl)musicEl.pause();if(recorder.state!=='inactive')recorder.stop();return;}ctx.save();ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#111';ctx.fillRect(0,0,cw,ch);if(fitMode==='blur'){ctx.filter='blur(24px)';ctx.drawImage(video,0,0,cw,ch);ctx.filter='none';}ctx.translate(cw/2,ch/2);ctx.rotate(rotation*Math.PI/180);ctx.scale(flipX?-1:1,flipY?-1:1);ctx.filter=`${FILTERS[filter]||''} brightness(${brightness/100}) contrast(${contrast/100}) saturate(${saturation/100}) blur(${blur}px)`;const sx=(bw-crop.w)/2-(posX/100)*crop.w*.28,sy=(bh-crop.h)/2-(posY/100)*crop.h*.28;ctx.drawImage(video,sx,sy,crop.w,crop.h,-crop.w*zoom/2,-crop.h*zoom/2,crop.w*zoom,crop.h*zoom);ctx.restore();ctx.filter='none';applyColorLayers(ctx);drawText(ctx,cw,ch);raf=requestAnimationFrame(draw);};
      draw(); await done; if(raf)cancelAnimationFrame(raf); if(!chunks.length)throw new Error('No edited video data was produced.');
      return new File([new Blob(chunks,{type:mime||'video/webm'})],file.name.replace(/\.[^.]+$/,'')+'-edited.webm',{type:mime||'video/webm',lastModified:Date.now()});
    } finally {
      try{video.pause();}catch{}; if(video)video.playbackRate=1; if(video)video.volume=1; try{source.getTracks().forEach(t=>t.stop());}catch{}; try{stream.getTracks().forEach(t=>t.stop());}catch{}; try{if(audioCtx)audioCtx.close();}catch{}; if(musicEl)musicEl.pause(); setPlaying(false);
    }
  };

  const apply = async () => { if(!file)return; setProcessing(true);setError('');try{onApply?.(type==='image'?await imageExport():await exportVideo());}catch(e){setError(e.message||'Could not export edited media.');}finally{setProcessing(false);setPlaying(false);} };
  const previewSeek=(value)=>{const n=Number(value);setStart(Math.min(n,Math.max(0,(end||duration)-.1)));if(videoRef.current)videoRef.current.currentTime=n;};
  const previewEnd=(value)=>setEnd(Math.max(Number(value),start+.1));

  const tabs=type==='video'
    ? [['trim',Scissors,'Trim'],['adjust',SlidersHorizontal,'Adjust'],['filters',Sparkles,'Filters'],['crop',Crop,'Crop'],['text',Type,'Text'],['music',Music2,'Music'],['speed',Gauge,'Speed']]
    : [['adjust',SlidersHorizontal,'Adjust'],['filters',Sparkles,'Filters'],['crop',Crop,'Crop'],['text',Type,'Text']];

  return <div className="fixed inset-0 z-[180] bg-black/80 flex items-end sm:items-center justify-center">
    <div className="w-full max-w-4xl max-h-[96dvh] overflow-hidden bg-[#111] text-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-white/10 bg-[#151515]">
        <button onClick={onClose} disabled={processing} className="p-2 rounded-full hover:bg-white/10"><X/></button>
        <div className="flex-1 min-w-0"><b className="block truncate">{type==='image'?'Photo Editor':'Video Editor'}</b><span className="text-[11px] text-white/50">Pro edit • Save keeps the file ready for Post / Reels / Vibe / Chat</span></div>
        <button onClick={reset} disabled={processing} className="p-2 rounded-full hover:bg-white/10" title="Reset"><RotateCcw className="w-4 h-4"/></button>
        <button onClick={apply} disabled={processing} className="px-4 py-2 rounded-full bg-white text-black font-bold text-sm flex items-center gap-1">{processing?'Exporting…':<><Check className="w-4 h-4"/>Save edit</>}</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative bg-black min-h-[34vh] sm:min-h-[48vh] flex items-center justify-center overflow-hidden">
          {type==='image' ? <img ref={imageRef} src={url} alt="Editing preview" className="max-h-[52vh] max-w-[94vw] object-contain select-none" style={{filter:visualFilter,transform:previewTransform}}/> : <div className="relative w-full flex justify-center"><video ref={videoRef} src={url} playsInline preload="metadata" className="max-h-[52vh] max-w-full object-contain" style={{filter:visualFilter,transform:previewTransform}} onLoadedMetadata={e=>{const d=e.currentTarget.duration||0;setDuration(d);if(!end)setEnd(d);}} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/><canvas ref={canvasRef} className="hidden"/><button onClick={()=>{const v=videoRef.current;if(!v)return;if(v.paused){v.play();}else v.pause();}} className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-black/65 border border-white/20 flex items-center justify-center">{playing?<Pause/>:<Play/>}</button></div>}
          {vignette>0 && <div className="pointer-events-none absolute inset-0" style={{background:'radial-gradient(circle, transparent 45%, rgba(0,0,0,.55) 100%)',opacity:vignette/100}}/>}
          {text.trim() && <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl font-bold text-center whitespace-pre-wrap ${textPosition==='top'?'top-6':textPosition==='center'?'top-1/2 -translate-y-1/2':'bottom-6'}`} style={{color:textColor,WebkitTextStroke:`${textStroke}px #000`,background:textBg?'rgba(0,0,0,.55)':'transparent',fontSize:Math.max(14,textSize*.45)}}>{text}</div>}
        </div>

        {type==='video' && <div className="px-4 py-3 bg-[#181818] border-y border-white/10"><div className="flex items-center justify-between text-[11px] text-white/60 mb-2"><span>{start.toFixed(1)}s</span><span>{duration.toFixed(1)}s</span><span>{Math.max(0,(end-start)).toFixed(1)}s clip</span></div><div className="relative"><input type="range" min="0" max={Math.max(duration,.1)} step=".05" value={start} onChange={e=>previewSeek(e.target.value)} className="w-full accent-white"/><input type="range" min=".05" max={Math.max(duration,.1)} step=".05" value={end||duration||.05} onChange={e=>previewEnd(e.target.value)} className="w-full accent-white"/></div></div>}

        <div className="px-3 pt-3 bg-[#151515] overflow-x-auto"><div className="flex gap-2 min-w-max pb-2">{tabs.map(([key,Icon,label])=><button key={key} onClick={()=>setTab(key)} className={`min-w-[72px] px-3 py-2 rounded-xl text-[11px] font-semibold flex flex-col items-center gap-1 ${tab===key?'bg-white text-black':'bg-white/5 text-white/65'}`}><Icon className="w-5 h-5"/><span>{label}</span></button>)}</div></div>

        <div className="p-4 bg-[#151515] min-h-[250px]">
          {tab==='trim' && type==='video' && <section className="space-y-4"><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Start<input type="range" min="0" max={Math.max(duration,.1)} step=".05" value={start} onChange={e=>previewSeek(e.target.value)} className="w-full"/></label><label className="text-xs font-semibold">End<input type="range" min=".05" max={Math.max(duration,.1)} step=".05" value={end||duration||.05} onChange={e=>previewEnd(e.target.value)} className="w-full"/></label></div><div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide"><button onClick={()=>setRotation(r=>(r+90)%360)} className="tool"><RotateCw/>Rotate</button><button onClick={()=>setFlipX(v=>!v)} className="tool"><FlipHorizontal/>Flip H</button><button onClick={()=>setFlipY(v=>!v)} className="tool"><FlipVertical/>Flip V</button><button onClick={()=>setVolume(v=>v?0:1)} className="tool">{volume?<Volume2/>:<VolumeX/>}{volume?'Sound':'Muted'}</button></div></section>}
          {tab==='adjust' && <section className="space-y-4"><div className="grid sm:grid-cols-2 gap-4">{[['Brightness',brightness,setBrightness,40,180],['Contrast',contrast,setContrast,40,180],['Saturation',saturation,setSaturation,0,200],['Blur',blur,setBlur,0,8],['Sharpen',sharpen,setSharpen,0,100],['Warmth',warmth,setWarmth,-100,100],['Tint',tint,setTint,-30,30],['Vignette',vignette,setVignette,0,100]].map(([label,val,setter,min,max])=><label key={label} className="text-xs font-semibold text-white/80">{label}<span className="float-right text-white/45">{typeof val==='number'?Math.round(val):val}</span><input type="range" min={min} max={max} step={label==='Blur'?.5:1} value={val} onChange={e=>setter(Number(e.target.value))} className="w-full accent-white"/></label>)}</div><div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide"><button className="tool" onClick={()=>setRotation(r=>(r+90)%360)}><RotateCw/>Rotate</button><button className="tool" onClick={()=>setFlipX(v=>!v)}><FlipHorizontal/>Flip H</button><button className="tool" onClick={()=>setFlipY(v=>!v)}><FlipVertical/>Flip V</button></div></section>}
          {tab==='filters' && <section><div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{Object.keys(FILTERS).map(name=><button key={name} onClick={()=>setFilter(name)} className={`rounded-2xl overflow-hidden border border-white/10 bg-white/5 ${filter===name?'ring-2 ring-white':''}`}><div className="h-20 bg-gradient-to-br from-purple-300 via-pink-300 to-orange-200" style={{filter:FILTERS[name]}}/><span className="block p-2 text-xs font-semibold">{name}</span></button>)}</div></section>}
          {tab==='crop' && <section className="space-y-5"><div><p className="text-xs font-semibold text-white/60 mb-2">Canvas ratio</p><div className="flex flex-wrap gap-2">{RATIOS.map(([value,label])=><button key={value} onClick={()=>setAspect(value)} className={`px-4 py-2 rounded-full border text-sm ${aspect===value?'bg-white text-black border-white':'border-white/15 text-white/70'}`}>{label}</button>)}</div></div><div><p className="text-xs font-semibold text-white/60 mb-2">Frame</p><div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide"><button onClick={()=>setFitMode('fill')} className={`px-4 py-2 rounded-full border ${fitMode==='fill'?'bg-white text-black':'border-white/15 text-white/70'}`}>Fill</button><button onClick={()=>setFitMode('blur')} className={`px-4 py-2 rounded-full border ${fitMode==='blur'?'bg-white text-black':'border-white/15 text-white/70'}`}>Blur background</button></div></div><label className="block text-xs font-semibold">Zoom {zoom.toFixed(2)}×<input type="range" min="1" max="3" step=".01" value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="w-full accent-white"/></label><div className="grid grid-cols-2 gap-4"><label className="text-xs font-semibold flex items-center gap-2"><Move className="w-4 h-4"/>Horizontal<input type="range" min="-100" max="100" value={posX} onChange={e=>setPosX(Number(e.target.value))} className="flex-1 accent-white"/></label><label className="text-xs font-semibold flex items-center gap-2"><Move className="w-4 h-4 rotate-90"/>Vertical<input type="range" min="-100" max="100" value={posY} onChange={e=>setPosY(Number(e.target.value))} className="flex-1 accent-white"/></label></div></section>}
          {tab==='text' && <section className="space-y-4"><textarea value={text} onChange={e=>setText(e.target.value)} maxLength={160} placeholder="Type text…" className="w-full min-h-24 bg-white/5 border border-white/10 rounded-2xl p-3 outline-none"/><div className="grid grid-cols-2 gap-4"><label className="text-xs font-semibold">Size<input type="range" min="16" max="88" value={textSize} onChange={e=>setTextSize(Number(e.target.value))} className="w-full accent-white"/></label><label className="text-xs font-semibold">Position<select value={textPosition} onChange={e=>setTextPosition(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg p-2"><option value="top">Top</option><option value="center">Center</option><option value="bottom">Bottom</option></select></label></div><div className="flex items-center gap-3"><Palette className="w-4 h-4"/><input type="color" value={textColor} onChange={e=>setTextColor(e.target.value)} className="w-10 h-10 bg-transparent"/><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={textBg} onChange={e=>setTextBg(e.target.checked)}/> Background</label></div><label className="text-xs font-semibold">Outline<input type="range" min="0" max="3" step="1" value={textStroke} onChange={e=>setTextStroke(Number(e.target.value))} className="w-full accent-white"/></label></section>}
          {tab==='music' && type==='video' && <section className="space-y-4"><input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={e=>setMusicFile(e.target.files?.[0]||null)}/><button onClick={()=>musicInputRef.current?.click()} className="w-full p-4 rounded-2xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center gap-2"><Music2/> {musicFile?musicFile.name:'Add music from device'}</button>{musicFile&&<><label className="text-xs font-semibold">Music volume<input type="range" min="0" max="1" step=".01" value={musicVolume} onChange={e=>setMusicVolume(Number(e.target.value))} className="w-full accent-white"/></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={musicLoop} onChange={e=>setMusicLoop(e.target.checked)}/> Loop music to fill the clip</label></>}</section>}
          {tab==='speed' && type==='video' && <section><p className="text-xs text-white/55 mb-3">Playback speed</p><div className="grid grid-cols-4 gap-2">{SPEEDS.map(v=><button key={v} onClick={()=>setSpeed(v)} className={`py-3 rounded-xl border text-sm font-semibold ${speed===v?'bg-white text-black border-white':'border-white/10 bg-white/5 text-white/70'}`}>{v}×</button>)}</div><div className="mt-5 p-3 rounded-2xl bg-white/5 text-xs text-white/55 flex gap-2"><Wand2 className="w-4 h-4 shrink-0"/> Speed is applied during export. Trim, filters, crop, text and audio stay synchronized to the selected clip.</div></section>}
        </div>
        {error && <div className="mx-4 mb-4 rounded-2xl bg-red-500/15 border border-red-400/20 text-red-200 text-sm p-3">{error}</div>}
      </div>
      <style>{`.tool{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;padding:.55rem .8rem;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.05);font-size:.8rem;font-weight:600;flex:0 0 auto;white-space:nowrap}.tool svg{width:16px;height:16px;flex:0 0 auto}.scrollbar-hide{scrollbar-width:none}.scrollbar-hide::-webkit-scrollbar{display:none}`}</style>
    </div>
  </div>;
}
export default MediaEditor;
