import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchLabels } from './AssetList';
import AudioPreview from './AudioPreview';
import { SFX_EXTENSIONS, baseName, fetchAudioCollections, isSfxFile, uploadSfx } from '../sfxUpload';

const CATEGORY_NAMES = {
  PROJECTS: 'Projects',
  MODULE: 'Modules',
  'ASSET TYPE': 'Asset type',
  INDUSTRY: 'Industry',
  ENVIRONMENTS: 'Environments',
  CUSTOM: 'Custom',
  Custom: 'Custom',
};

const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const useOutsideClick = (ref, onOutside) => {
  useEffect(() => {
    const handle = (e) => ref.current && !ref.current.contains(e.target) && onOutside();
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onOutside]);
};

/** Text field with a dropdown of existing collections; any other text names a new one; empty means none. */
const CollectionInput = ({ value, onChange, options, disabled }) => {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  useOutsideClick(ref, () => setOpen(false));
  const q = value.trim().toLowerCase();
  const matches = options.filter((o) => o.toLowerCase().includes(q));
  const isNew = q && !options.some((o) => o.toLowerCase() === q);

  return (
    <div className="sfx-combo" ref={ref}>
      <div className="sfx-field-box">
        <input
          className="sfx-bare-input"
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          placeholder="No collection: each clip downloads to its own folder"
          disabled={disabled}
        />
        {isNew && <span className="sfx-pill-new">New</span>}
        {value && !disabled && (
          <button type="button" className="sfx-clear" onClick={() => onChange('')} aria-label="Clear collection">×</button>
        )}
      </div>
      {open && !disabled && matches.length > 0 && (
        <ul className="sfx-menu">
          {matches.map((o) => (
            <li key={o}>
              <button type="button" onClick={() => { onChange(o); setOpen(false); }}>
                <span className="sfx-menu-icon">📁</span>{o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Labels used in earlier SFX uploads on this browser, newest first: the quickest way back to common tags.
const RECENT_KEY = 'iw_recentSfxTags';
const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};
const rememberRecentTags = (tags) => {
  try {
    const next = [...tags, ...readRecent().filter((t) => !tags.includes(t))].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable: recents are a convenience */ }
};

/**
 * Inline label picker: search across every label, or browse one category at a time. Labels are chips
 * that toggle on and off, so the list never has to be scrolled to find what's selected.
 */
const TagPicker = ({ value, onChange, groups, disabled }) => {
  const [query, setQuery] = useState('');
  const [recent] = useState(readRecent);
  const allGroups = useMemo(() => {
    const known = new Set(groups.flatMap((g) => g.labels));
    const recentLabels = recent.filter((l) => known.has(l));
    return recentLabels.length ? [{ name: 'Recent', section: 'top', labels: recentLabels }, ...groups] : groups;
  }, [groups, recent]);
  const [category, setCategory] = useState(null);
  const current = allGroups.find((g) => g.name === category) || allGroups[0];
  const total = groups.reduce((n, g) => n + g.labels.length, 0);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return groups
      .map((g) => ({ ...g, labels: g.labels.filter((l) => l.toLowerCase().includes(q)) }))
      .filter((g) => g.labels.length > 0);
  }, [groups, q]);

  const selected = new Set(value);
  // Functional update (onChange is a state setter) so quick successive clicks don't drop a label.
  const toggle = (label) =>
    onChange((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]));
  const selectedIn = (g) => g.labels.reduce((n, l) => n + (selected.has(l) ? 1 : 0), 0);

  const chips = (labels) => (
    <div className="tagp-chips">
      {labels.map((l) => (
        <button
          type="button"
          key={l}
          className={`tagp-chip ${selected.has(l) ? 'on' : ''}`}
          aria-pressed={selected.has(l)}
          onClick={() => toggle(l)}
          disabled={disabled}
        >
          {selected.has(l) && <span aria-hidden="true">✓</span>}
          {l}
        </button>
      ))}
    </div>
  );

  const navItem = (g) => {
    const n = selectedIn(g);
    return (
      <button
        type="button"
        key={g.name}
        className={`tagp-cat ${g === current ? 'active' : ''}`}
        onClick={() => setCategory(g.name)}
      >
        <span className="tagp-cat-name">{g.name}</span>
        {n > 0 ? <span className="tagp-cat-sel">{n}</span> : <span className="tagp-cat-count">{g.labels.length}</span>}
      </button>
    );
  };

  if (groups.length === 0) {
    return <div className="tagp tagp-empty">No labels yet. Add them under Labels &amp; Tags.</div>;
  }

  const top = allGroups.filter((g) => g.section !== 'clients');
  const clients = allGroups.filter((g) => g.section === 'clients');

  return (
    <div className={`tagp ${disabled ? 'is-disabled' : ''}`}>
      <div className="tagp-selected">
        {value.length === 0 && <span className="tagp-placeholder">No tags selected</span>}
        {value.map((t) => (
          <span key={t} className="sfx-token">
            {t}
            {!disabled && <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`}>×</button>}
          </span>
        ))}
        {value.length > 1 && !disabled && (
          <button type="button" className="tagp-clear" onClick={() => onChange([])}>Clear all</button>
        )}
      </div>

      <div className="tagp-panel">
        <div className="tagp-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              // Enter adds the only match, or the exact match, without reaching for the mouse.
              if (e.key === 'Enter') {
                e.preventDefault();
                const flat = matches.flatMap((g) => g.labels);
                const pick = flat.find((l) => l.toLowerCase() === q) || (flat.length === 1 ? flat[0] : null);
                if (pick && !selected.has(pick)) { toggle(pick); setQuery(''); }
              }
            }}
            placeholder={`Search ${total} labels`}
            disabled={disabled}
            aria-label="Search labels"
          />
          {query && <button type="button" className="sfx-clear" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
        </div>

        {q ? (
          <div className="tagp-results">
            {matches.length === 0 && <div className="tagp-none">No labels match “{query.trim()}”</div>}
            {matches.map((g) => (
              <div key={g.name} className="tagp-result-group">
                <div className="tagp-group-name">{g.name}</div>
                {chips(g.labels)}
              </div>
            ))}
          </div>
        ) : (
          <div className="tagp-browse">
            <nav className="tagp-nav" aria-label="Label categories">
              {top.map(navItem)}
              {clients.length > 0 && <div className="tagp-nav-heading">Clients</div>}
              {clients.map(navItem)}
            </nav>
            <div className="tagp-pane">
              <div className="tagp-group-name">{current.name}</div>
              {chips(current.labels)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

let nextId = 1;

const SfxUpload = () => {
  const tenantId = localStorage.getItem('iw_tenantId');
  const inputRef = useRef(null);

  const [items, setItems] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState([]);
  const [labelGroups, setLabelGroups] = useState([]);
  const [tags, setTags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [collection, setCollection] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    fetchLabels(tenantId).then((result) => {
      if (!result.success) return;
      // Standard categories first in a fixed order; any other category is a client's own module labels.
      const order = Object.keys(CATEGORY_NAMES);
      const groups = Object.entries(result.labels)
        .map(([key, configs]) => ({
          key,
          name: CATEGORY_NAMES[key] || key,
          section: key in CATEGORY_NAMES ? 'standard' : 'clients',
          labels: Array.from(new Set(configs.flatMap((c) => c.labels || []).filter(Boolean)))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        }))
        .filter((g) => g.labels.length > 0)
        // CUSTOM and Custom (the fallback for configs without a category) are one group.
        .reduce((acc, g) => {
          const same = acc.find((x) => x.name === g.name);
          if (same) same.labels = Array.from(new Set([...same.labels, ...g.labels])).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          else acc.push(g);
          return acc;
        }, [])
        .sort((a, b) =>
          a.section !== b.section
            ? (a.section === 'standard' ? -1 : 1)
            : a.section === 'standard'
              ? order.indexOf(a.key) - order.indexOf(b.key)
              : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setLabelGroups(groups);
    });
    fetchAudioCollections(tenantId)
      .then(setCollections)
      .catch((err) => console.error('Error loading collections:', err));
  }, [tenantId]);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    setRejected(files.filter((f) => !isSfxFile(f)).map((f) => f.name));
    setItems((prev) => [
      ...prev,
      ...files.filter(isSfxFile).map((file) => ({
        id: nextId++, file, name: baseName(file.name), status: 'pending', progress: 0, error: null, assetId: null,
      })),
    ]);
  };

  const updateItem = (id, patch) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));

  const collectionKey = collection.trim();
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'error');
  const done = items.filter((i) => i.status === 'done');

  // Clips in one collection download into the same folder, so their file names must differ.
  const duplicateNames = useMemo(() => {
    if (!collectionKey) return [];
    const counts = new Map();
    items.forEach((i) => counts.set(i.file.name.toLowerCase(), (counts.get(i.file.name.toLowerCase()) || 0) + 1));
    return Array.from(counts).filter(([, n]) => n > 1).map(([name]) => name);
  }, [items, collectionKey]);

  const problem = [
    !tenantId && 'Select a tenant first.',
    pending.some((i) => !i.name.trim()) && 'Every clip needs a name.',
    duplicateNames.length > 0 && `Same file name twice in one collection: ${duplicateNames.join(', ')}`,
  ].find(Boolean);

  const handleUpload = async () => {
    setUploading(true);
    for (const item of pending) {
      updateItem(item.id, { status: 'uploading', progress: 0, error: null });
      try {
        const assetId = await uploadSfx({
          file: item.file,
          name: item.name.trim(),
          tenantId,
          tags,
          collectionKey,
          notes: notes.trim(),
          onProgress: (p) => updateItem(item.id, { progress: Math.round(p * 100) }),
        });
        updateItem(item.id, { status: 'done', progress: 100, assetId });
      } catch (err) {
        console.error('SFX upload failed:', err);
        const message = err.response?.data?.message || err.message;
        updateItem(item.id, {
          status: 'error',
          error: err.code === 'ERR_NETWORK' ? `${message} (S3 may need CORS enabled for this site)` : message,
        });
      }
    }
    sessionStorage.removeItem('iw_assetGridCache'); // so the asset grid shows the new clips
    if (tags.length) rememberRecentTags(tags);
    if (collectionKey && !collections.includes(collectionKey)) {
      setCollections((prev) => [...prev, collectionKey].sort((a, b) => a.localeCompare(b)));
    }
    setUploading(false);
  };

  const startOver = () => {
    setItems((prev) => prev.filter((i) => i.status !== 'done'));
    setRejected([]);
  };

  const hasItems = items.length > 0;

  return (
    <div className="sfx-page">
      <div className="sfx-inner">
        <header className="sfx-head">
          <h1>Upload sound effects</h1>
          <p>Clips upload with a Unity .meta, so they import in Unity like clips uploaded from the editor.</p>
        </header>

        <div
          className={`sfx-drop ${dragging ? 'dragging' : ''} ${hasItems ? 'slim' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!uploading) addFiles(e.dataTransfer.files); }}
        >
          {hasItems ? (
            <span><strong>+ Add more clips</strong> or drop them here</span>
          ) : (
            <>
              <div className="sfx-drop-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 10v4M7 7v10M11 4v16M15 8v8M19 11v2" /></svg>
              </div>
              <div className="sfx-drop-title">Drop audio clips here</div>
              <div className="sfx-drop-sub">or <span className="sfx-link">browse files</span> · {SFX_EXTENSIONS.join(' ')}</div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={SFX_EXTENSIONS.join(',')}
            hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
        {rejected.length > 0 && <p className="sfx-note warn">Skipped, not audio: {rejected.join(', ')}</p>}

        {hasItems && (
          <>
            <section className="sfx-card">
              <div className="sfx-card-head">
                <h2>Clips <span className="sfx-count">{items.length}</span></h2>
                {!uploading && pending.length > 0 && (
                  <button type="button" className="sfx-text-btn" onClick={() => setItems((p) => p.filter((i) => i.status === 'done'))}>
                    Clear
                  </button>
                )}
              </div>
              <ul className="sfx-clips">
                {items.map((item) => (
                  <li key={item.id} className={`sfx-clip is-${item.status}`}>
                    <div className="sfx-clip-name">
                      <input
                        className="sfx-name-input"
                        value={item.name}
                        disabled={item.status === 'uploading' || item.status === 'done'}
                        onChange={(e) => updateItem(item.id, { name: e.target.value })}
                        placeholder="Asset name"
                        aria-label="Asset name"
                      />
                      <span className="sfx-clip-file">{item.file.name} · {formatSize(item.file.size)}</span>
                    </div>
                    <div className="sfx-clip-player">
                      <AudioPreview source={item.file} compact />
                    </div>
                    <div className="sfx-clip-status">
                      {item.status === 'uploading' && <span className="sfx-status-text">{item.progress}%</span>}
                      {item.status === 'done' && <Link className="sfx-done" to={`/assets/${item.assetId}`}>✓ View</Link>}
                      {item.status === 'error' && <span className="sfx-status-err" title={item.error}>Failed</span>}
                      {(item.status === 'pending' || item.status === 'error') && !uploading && (
                        <button type="button" className="sfx-icon-btn" onClick={() => removeItem(item.id)} aria-label="Remove clip">×</button>
                      )}
                    </div>
                    {item.status === 'error' && <div className="sfx-clip-error">{item.error}</div>}
                    {item.status === 'uploading' && <div className="sfx-clip-progress" style={{ width: `${item.progress}%` }} />}
                  </li>
                ))}
              </ul>
            </section>

            <section className="sfx-card">
              <div className="sfx-card-head">
                <h2>Details</h2>
                <span className="sfx-card-hint">Applies to every clip in this upload</span>
              </div>
              <div className="sfx-fields">
                <div className="sfx-field">
                  <span className="sfx-label">Collection</span>
                  <CollectionInput value={collection} onChange={setCollection} options={collections} disabled={uploading} />
                  <span className="sfx-help">Clips in a collection download together into one folder in Unity.</span>
                </div>
                <div className="sfx-field">
                  <span className="sfx-label">Tags</span>
                  <TagPicker value={tags} onChange={setTags} groups={labelGroups} disabled={uploading} />
                </div>
                <label className="sfx-field">
                  <span className="sfx-label">Notes <em>optional</em></span>
                  <textarea
                    className="sfx-textarea"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What changed, where it's used…"
                    disabled={uploading}
                  />
                </label>
              </div>
            </section>
          </>
        )}
      </div>

      {hasItems && (
        <div className="sfx-bar">
          <div className="sfx-bar-inner">
            <div className="sfx-bar-summary">
              {problem ? (
                <span className="warn">{problem}</span>
              ) : pending.length === 0 ? (
                <span className="ok">
                  {done.length} clip{done.length === 1 ? '' : 's'} uploaded ·{' '}
                  <button type="button" className="sfx-text-btn" onClick={startOver}>Upload more</button>
                </span>
              ) : (
                <span>
                  {pending.length} clip{pending.length === 1 ? '' : 's'}
                  {collectionKey ? <> into <strong>{collectionKey}</strong></> : ''}
                  {tags.length > 0 ? ` · ${tags.length} tag${tags.length === 1 ? '' : 's'}` : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              className="sfx-primary"
              onClick={handleUpload}
              disabled={uploading || pending.length === 0 || Boolean(problem)}
            >
              {uploading ? 'Uploading…' : `Upload ${pending.length > 1 ? `${pending.length} clips` : 'clip'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SfxUpload;
