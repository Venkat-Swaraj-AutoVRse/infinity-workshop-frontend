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

/** Selected labels as tokens; typing filters the tenant's labels, grouped by category. */
const TagInput = ({ value, onChange, groups, disabled }) => {
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  useOutsideClick(ref, () => setOpen(false));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, labels: g.labels.filter((l) => !value.includes(l) && (!q || l.toLowerCase().includes(q))) }))
      .filter((g) => g.labels.length > 0);
  }, [groups, query, value]);
  const flat = filtered.flatMap((g) => g.labels);

  useEffect(() => setActive(0), [query, open]);

  const add = (label) => {
    onChange([...value, label]);
    setQuery('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && flat[active]) { e.preventDefault(); add(flat[active]); }
    else if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1));
    else if (e.key === 'Escape') setOpen(false);
  };

  let index = -1;
  return (
    <div className="sfx-combo" ref={ref}>
      <div className="sfx-field-box sfx-token-box" onClick={() => { inputRef.current?.focus(); setOpen(true); }}>
        {value.map((t) => (
          <span key={t} className="sfx-token">
            {t}
            {!disabled && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== t)); }} aria-label={`Remove ${t}`}>×</button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          className="sfx-bare-input"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={value.length ? '' : 'Add labels'}
          disabled={disabled}
        />
      </div>
      {open && !disabled && (
        <div className="sfx-menu sfx-menu-grouped">
          {filtered.length === 0 && (
            <div className="sfx-menu-empty">
              {groups.length === 0 ? 'No labels yet. Add them under Labels & Tags.' : 'No matching labels'}
            </div>
          )}
          {filtered.map((g) => (
            <div key={g.name} className="sfx-menu-group">
              <div className="sfx-menu-group-name">{g.name}</div>
              {g.labels.map((l) => {
                index += 1;
                const i = index;
                return (
                  <button
                    type="button"
                    key={l}
                    className={i === active ? 'active' : ''}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(l)}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
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
      const groups = Object.entries(result.labels)
        .map(([key, configs]) => ({
          name: CATEGORY_NAMES[key] || `Modules · ${key}`,
          labels: Array.from(new Set(configs.flatMap((c) => c.labels || []).filter(Boolean))).sort(),
        }))
        .filter((g) => g.labels.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
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
                  <TagInput value={tags} onChange={setTags} groups={labelGroups} disabled={uploading} />
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
