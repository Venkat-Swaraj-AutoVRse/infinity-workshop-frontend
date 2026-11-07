import axios from 'axios';
import api from './api';

// Formats Unity's AudioImporter takes (same list as the Unity uploader's RootFiles.AudioExtensions).
export const SFX_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.aif', '.aiff'];

export const isSfxFile = (file) => SFX_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

export const baseName = (fileName) => fileName.replace(/\.[^.]+$/, '');

/** A random Unity GUID: 32 lowercase hex characters. */
export const newUnityGuid = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

// A label as a YAML scalar: plain like Unity writes it ("- Fuel Station"), single-quoted only when
// plain text would be misread (leading indicator characters, ": ", " #", surrounding spaces).
const yamlScalar = (text) =>
  /^[\s\-?:,\[\]{}#&*!|>'"%@`]|:\s|\s#|:$|\s$/.test(text) ? `'${text.replace(/'/g, "''")}'` : text;

/**
 * The .meta Unity 6 writes for a newly imported audio clip (AudioImporter, default settings).
 * `labels` are the asset's Unity labels, which is where the editor uploader reads tags from
 * (AssetDatabase.GetLabels), so a downloaded clip shows the same tags as labels in Unity.
 * `userData` holds the cloud asset id, which is how the Unity package links a local file to its
 * library asset (ImporterAssetId), so a downloaded clip is recognised as already linked.
 */
export const buildAudioMeta = (guid, assetId = '', labels = []) => {
  // Unity labels are case-insensitive: keep the first spelling of each, sorted like the Unity label editor.
  const unique = new Map();
  labels.map((l) => l.trim()).filter(Boolean).forEach((l) => unique.has(l.toLowerCase()) || unique.set(l.toLowerCase(), l));
  const sorted = Array.from(unique.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [
    'fileFormatVersion: 2',
    `guid: ${guid}`,
    ...(sorted.length ? ['labels:', ...sorted.map((l) => `- ${yamlScalar(l)}`)] : []),
    'AudioImporter:',
    '  externalObjects: {}',
    '  serializedVersion: 8',
    '  defaultSettings:',
    '    serializedVersion: 2',
    '    loadType: 0',
    '    sampleRateSetting: 0',
    '    sampleRateOverride: 44100',
    '    compressionFormat: 1',
    '    quality: 1',
    '    conversionMode: 0',
    '    preloadAudioData: 0',
    '  platformSettingOverrides: {}',
    '  forceToMono: 0',
    '  normalize: 1',
    '  loadInBackground: 0',
    '  ambisonic: 0',
    '  3D: 1',
    `  userData: ${assetId}`,
    '  assetBundleName: ',
    '  assetBundleVariant: ',
    '',
  ].join('\n');
};

// Asset ids are UUIDs (36 characters). The manifest needs the .meta size before the id exists, so
// the size is taken with a placeholder of the same length and the real id is swapped in afterwards.
const ASSET_ID_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

const encoder = new TextEncoder();

/**
 * A waveform PNG (data URI) like the Unity uploader's: peak per column, normalised, on a dark square.
 * Returns null when the browser can't decode the format (e.g. .aif outside Safari).
 */
export const renderWaveformThumbnail = async (file, size = 256) => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const peaks = new Float32Array(size);
    const perColumn = Math.max(1, Math.floor(buffer.length / size));
    const stride = Math.max(1, Math.floor(perColumn / 2048));
    let max = 0;
    for (let x = 0; x < size; x++) {
      const start = x * perColumn;
      const end = Math.min(buffer.length, start + perColumn);
      let peak = 0;
      for (let i = start; i < end; i += stride) {
        for (const data of channels) peak = Math.max(peak, Math.abs(data[i]));
      }
      peaks[x] = peak;
      max = Math.max(max, peak);
    }

    // Same look as the in-page player: rounded bars, centred, with margin, on the app's dark surface.
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    g.fillStyle = '#1c1c21';
    g.fillRect(0, 0, size, size);
    const bars = 48;
    const pad = size * 0.1;
    const slot = (size - pad * 2) / bars;
    const barWidth = slot * 0.6;
    const mid = size / 2;
    g.fillStyle = '#BD78E5';
    for (let b = 0; b < bars; b++) {
      let peak = 0;
      const from = Math.floor((b * size) / bars);
      const to = Math.floor(((b + 1) * size) / bars);
      for (let x = from; x < to; x++) peak = Math.max(peak, peaks[x]);
      const h = Math.max(3, (max > 0 ? peak / max : 0) * size * 0.55);
      const x = pad + b * slot + (slot - barWidth) / 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, mid - h / 2, barWidth, h, barWidth / 2);
      else g.rect(x, mid - h / 2, barWidth, h);
      g.fill();
    }
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  } finally {
    ctx.close?.();
  }
};

/** Distinct collection keys already used by audio assets in this tenant. */
export const fetchAudioCollections = async (tenantId) => {
  const keys = new Set();
  for (let page = 1; page <= 20; page++) {
    const response = await api.get('/assets', {
      params: { tenantId, assetType: 'audio', page, limit: 100 },
    });
    const { assets = [], pagination } = response.data.data || {};
    for (const asset of assets) {
      const details = asset.currentVersionId?.unityAssetDetails;
      if (details?.isPartOfCollection && details.collectionKey) keys.add(details.collectionKey);
    }
    if (!pagination?.hasNext) break;
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
};

const putToS3 = (url, body, onProgress) =>
  // Plain axios, not the api client: S3 rejects a presigned URL that also carries our Authorization header.
  axios.put(url, body, {
    headers: { 'Content-Type': 'application/octet-stream' },
    onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
  });

/**
 * Uploads one clip as a new library asset (assetType "audio"): the clip plus a generated Unity
 * .meta, a waveform thumbnail, tags and an optional collection. Resolves to the new asset id.
 */
export const uploadSfx = async ({ file, name, tenantId, tags, collectionKey, notes, onProgress }) => {
  const guid = newUnityGuid();
  const metaName = `${file.name}.meta`;
  const metaSize = encoder.encode(buildAudioMeta(guid, ASSET_ID_PLACEHOLDER, tags)).length;
  const thumbnail = await renderWaveformThumbnail(file);
  const inCollection = Boolean(collectionKey);

  const start = await api.post('/assets/start-upload', {
    name,
    tenantId,
    assetType: 'audio',
    tags,
    notes: notes || undefined,
    files: [
      { fileName: file.name, s3RelativePath: file.name, type: 'audio', size: file.size },
      { fileName: metaName, s3RelativePath: metaName, type: 'meta', size: metaSize },
    ],
    unityAssetDetails: {
      unityGuid: guid,
      nameWithExtension: file.name,
      type: 'audio',
      usesSharedMaterials: false,
      sharedMaterials: [],
      isPartOfCollection: inCollection,
      collectionKey: inCollection ? collectionKey : '',
      localTargetFolder: '',
      legacyId: '',
    },
    ...(thumbnail && { thumbnail }),
  });

  const { assetId, versionNumber, urls } = start.data.data;
  const urlFor = (fileName) => urls.find((u) => u.fileName === fileName)?.url;
  const meta = new Blob([encoder.encode(buildAudioMeta(guid, assetId, tags))]);

  await putToS3(urlFor(file.name), file, (p) => onProgress?.(p * 0.95));
  await putToS3(urlFor(metaName), meta);
  onProgress?.(1);

  await api.post('/assets/finalize-upload', { assetId, versionNumber, notes: notes || undefined });
  return assetId;
};
