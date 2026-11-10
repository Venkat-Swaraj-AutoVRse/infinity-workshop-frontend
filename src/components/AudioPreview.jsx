import React, { useCallback, useEffect, useRef, useState } from 'react';

// SFX are often under a second, so clips shorter than a minute show tenths ("0.4s", "12.0s").
const formatTime = (seconds, total = seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  if (!Number.isFinite(total) || total < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Peak per bar across all channels, normalised to 0..1. */
const computePeaks = (buffer, bars) => {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const perBar = Math.max(1, Math.floor(buffer.length / bars));
  const stride = Math.max(1, Math.floor(perBar / 1024));
  const peaks = new Float32Array(bars);
  let max = 0;
  for (let b = 0; b < bars; b++) {
    const start = b * perBar;
    const end = Math.min(buffer.length, start + perBar);
    let peak = 0;
    for (let i = start; i < end; i += stride) {
      for (const data of channels) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    peaks[b] = peak;
    if (peak > max) max = peak;
  }
  if (max > 0) for (let b = 0; b < bars; b++) peaks[b] /= max;
  return peaks;
};

const cssVar = (el, name, fallback) =>
  (el && getComputedStyle(el).getPropertyValue(name).trim()) || fallback;

/**
 * Waveform audio player. `source` is a File/Blob (local clip) or a URL (S3). The clip is fetched once:
 * the bytes drive both the waveform and playback. If the URL can't be read (CORS) or the browser can't
 * decode the format, it still plays through the plain URL with a progress bar instead of a waveform.
 */
const AudioPreview = ({ source, compact = false, onInfo }) => {
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | nowave | error
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hover, setHover] = useState(null);
  const [width, setWidth] = useState(0);

  // Load bytes → object URL for playback + decoded peaks for the waveform.
  useEffect(() => {
    if (!source) return undefined;
    let cancelled = false;
    let objectUrl = null;
    setPeaks(null);
    setState('loading');
    setPlaying(false);
    setTime(0);

    const load = async () => {
      let blob = null;
      try {
        if (typeof source === 'string') {
          const res = await fetch(source);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          blob = await res.blob();
        } else {
          blob = source;
        }
      } catch {
        if (!cancelled) { setSrc(source); setState('nowave'); }
        return;
      }
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { setState('nowave'); return; }
      const ctx = new AudioCtx();
      try {
        const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
        if (cancelled) return;
        setPeaks(computePeaks(buffer, compact ? 120 : 240));
        setDuration(buffer.duration);
        onInfo?.({ duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels });
        setState('ready');
      } catch {
        if (!cancelled) setState('nowave');
      } finally {
        ctx.close?.();
      }
    };
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, compact]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track the canvas width so bars stay crisp at any size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw: played part in accent, rest muted, hover cursor.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || !width) return;
    const height = compact ? 36 : 120;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const g = canvas.getContext('2d');
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, height);

    const played = cssVar(canvas, '--accent-primary-light', '#BD78E5');
    const rest = cssVar(canvas, '--text-muted', '#808080');
    const barGap = compact ? 1 : 2;
    const barWidth = Math.max(1, width / peaks.length - barGap);
    const progressX = duration > 0 ? (time / duration) * width : 0;
    const mid = height / 2;

    for (let i = 0; i < peaks.length; i++) {
      const x = i * (barWidth + barGap);
      const h = Math.max(2, peaks[i] * (height - 4));
      g.fillStyle = x + barWidth / 2 <= progressX ? played : rest;
      g.globalAlpha = x + barWidth / 2 <= progressX ? 1 : 0.45;
      const r = Math.min(barWidth / 2, 2);
      g.beginPath();
      if (g.roundRect) g.roundRect(x, mid - h / 2, barWidth, h, r);
      else g.rect(x, mid - h / 2, barWidth, h);
      g.fill();
    }
    g.globalAlpha = 1;
    if (hover !== null) {
      g.fillStyle = cssVar(canvas, '--text-primary', '#fff');
      g.globalAlpha = 0.6;
      g.fillRect(Math.round(hover), 0, 1, height);
      g.globalAlpha = 1;
    }
  }, [peaks, width, time, duration, hover, compact]);

  // Smooth progress while playing.
  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const tick = () => {
      if (audioRef.current) setTime(audioRef.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const seekTo = (clientX) => {
    const audio = audioRef.current;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!audio || !rect || !duration) return;
    const t = Math.min(duration, Math.max(0, ((clientX - rect.left) / rect.width) * duration));
    audio.currentTime = t;
    setTime(t);
  };

  const progress = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div className={`audio-preview ${compact ? 'compact' : ''} ${state === 'error' ? 'is-error' : ''}`}>
      <button
        type="button"
        className="audio-preview-play"
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
        )}
      </button>

      <div className="audio-preview-body">
        <div
          ref={wrapRef}
          className="audio-preview-wave"
          onClick={(e) => seekTo(e.clientX)}
          onMouseMove={(e) => {
            const rect = wrapRef.current.getBoundingClientRect();
            setHover(e.clientX - rect.left);
          }}
          onMouseLeave={() => setHover(null)}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onKeyDown={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            if (e.key === 'ArrowRight') audio.currentTime = Math.min(duration, audio.currentTime + 1);
            else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 1);
            else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); return; }
            else return;
            setTime(audio.currentTime);
          }}
        >
          {state === 'ready' && <canvas ref={canvasRef} />}
          {state === 'loading' && <div className="audio-preview-skeleton" />}
          {state === 'nowave' && (
            <div className="audio-preview-track"><div className="audio-preview-track-fill" style={{ width: `${progress}%` }} /></div>
          )}
        </div>
        {!compact && (
          <div className="audio-preview-times">
            <span>{formatTime(time, duration)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}
      </div>
      {compact && <span className="audio-preview-time">{formatTime(playing || time > 0 ? time : duration, duration)}</span>}

      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setTime(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
          onLoadedMetadata={(e) => { if (!duration && Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
          onTimeUpdate={(e) => !playing && setTime(e.currentTarget.currentTime)}
          onError={() => setState((s) => (s === 'nowave' ? 'error' : s))}
        />
      )}
    </div>
  );
};

export default AudioPreview;
export { formatTime };
