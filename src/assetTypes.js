// Mirrors ASSET_TYPES in the backend's constants.js.
export const ASSET_TYPES = [
  { value: '3dmodel', label: 'Model', icon: '📦' },
  { value: 'prefab', label: 'Prefab', icon: '🧩' },
  { value: 'material', label: 'Material', icon: '🎨' },
  { value: 'texture', label: 'Texture', icon: '🖼️' },
  { value: 'audio', label: 'Audio', icon: '🔊' },
  { value: 'shader', label: 'Shader', icon: '✨' },
  { value: 'script', label: 'Script', icon: '📜' },
];

const BY_VALUE = Object.fromEntries(ASSET_TYPES.map((t) => [t.value, t]));

export const assetTypeLabel = (type) => BY_VALUE[type]?.label || type || 'Asset';
export const assetTypeIcon = (type) => BY_VALUE[type]?.icon || '📦';

const extensionOf = (name) => {
  const clean = String(name || '').split('?')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
};

// Formats browsers can play or show natively; others (.aif, .tga, .psd, .exr, ...) fall back to the thumbnail.
const PLAYABLE_AUDIO = new Set(['.wav', '.mp3', '.ogg', '.flac']);
const VIEWABLE_IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

const fileNameOf = (file) => file?.fileName || file?.s3RelativePath || '';

export const findPlayableAudio = (files) =>
  (files || []).find((f) => f.url && PLAYABLE_AUDIO.has(extensionOf(fileNameOf(f))));

export const findViewableImage = (files) =>
  (files || []).find((f) => f.url && VIEWABLE_IMAGE.has(extensionOf(fileNameOf(f))));
