import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import ThreeDViewer from './ThreeDViewer';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (bytes) => {
  let crc = -1;
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  return (crc ^ -1) >>> 0;
};

const sanitizeZipName = (name, fallback) => {
  const clean = String(name || fallback)
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
  return clean || fallback;
};

const uniqueZipName = (name, used) => {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const slash = name.lastIndexOf('/');
  const dot = name.lastIndexOf('.');
  const hasExt = dot > slash;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  let index = 2;
  let next = `${base} (${index})${ext}`;

  while (used.has(next)) {
    index++;
    next = `${base} (${index})${ext}`;
  }

  used.add(next);
  return next;
};

const createZipBlob = (files) => {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const bytes = new Uint8Array(file.buffer);
    if (bytes.length > 0xffffffff) throw new Error('File too large for zip download');

    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, bytes.length, true);
    localView.setUint32(22, bytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, bytes.length, true);
    centralView.setUint32(24, bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    localParts.push(local, bytes);
    centralParts.push(central);
    offset += local.length + bytes.length;
  }

  if (files.length > 0xffff || offset > 0xffffffff) throw new Error('Zip too large to download');

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
};

const AssetViewer = ({ isOverlay = false }) => {
  const { assetId } = useParams();
  const navigate = useNavigate();

  const [asset, setAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [activeTab, setActiveTab] = useState('preview');
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const userStr = localStorage.getItem('iw_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isRegularUser = user?.role === 'user';

  const handleClose = useCallback((e) => {
    if (e) e.preventDefault();
    if (!isOverlay) {
      navigate('/assets');
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      navigate('/assets');
    }, 300);
  }, [navigate, isOverlay]);

  useEffect(() => {
    if (!isOverlay) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlay, handleClose]);

  // Fetch asset details
  useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true);
      try {
        const tenantId = localStorage.getItem('iw_tenantId');
        const params = tenantId ? { tenantId } : {};
        const response = await api.get(`/assets/${assetId}`, { params });
        setAsset(response.data.data);
        
        // Default to latest version number
        const latestVer = response.data.data?.latestVersionNumber || 1;
        setSelectedVersion(latestVer);
      } catch (err) {
        console.error('Error fetching asset:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAsset();
  }, [assetId]);

  // Fetch asset versions
  useEffect(() => {
    if (!asset) return;
    const fetchVersions = async () => {
      setLoadingVersions(true);
      try {
        const tenantId = localStorage.getItem('iw_tenantId');
        const params = tenantId ? { tenantId } : {};
        const response = await api.get(`/assets/${assetId}/versions`, { params });
        setVersions(response.data.data || []);
      } catch (err) {
        console.error('Error fetching versions:', err);
      } finally {
        setLoadingVersions(false);
      }
    };
    fetchVersions();
  }, [assetId, asset]);

  const handleDownload = async () => {
    if (!selectedVersion) {
      alert('Please select a version to download');
      return;
    }
    
    setIsDownloading(true);
    setDownloadProgress(0);
    
    try {
      const tenantId = localStorage.getItem('iw_tenantId');
      const params = { tenantId };
      const response = await api.post(
        `/assets/${assetId}/versions/${selectedVersion}/download`,
        { tenantId },
        { params }
      );
      
      console.log('Download URLs:', response.data);
      const files = response.data.data?.files || [];
      
      if (files.length === 0) {
        alert('No files found for this version');
        setIsDownloading(false);
        return;
      }
      
      const usedNames = new Set();
      const downloadedFiles = [];
      for (const [index, file] of files.entries()) {
        try {
          const res = await fetch(file.url);
          if (!res.ok) {
            console.warn(`Failed to download ${file.fileName}: ${res.status}`);
            continue;
          }

          const name = uniqueZipName(
            sanitizeZipName(file.s3RelativePath || file.relativePath || file.fileName, `file-${index + 1}`),
            usedNames
          );
          downloadedFiles.push({ name, buffer: await res.arrayBuffer() });
          setDownloadProgress(Math.round((downloadedFiles.length / files.length) * 100));
        } catch (err) {
          console.warn(`Error downloading ${file.fileName}:`, err);
          if (err instanceof TypeError) {
            throw new Error('Cannot create zip because S3 blocks browser access to the file contents. The API needs to return a zip file, or the S3 bucket needs CORS enabled for this app.');
          }
        }
      }
      
      if (downloadedFiles.length > 0) {
        const zipBlob = createZipBlob(downloadedFiles);
        const objectUrl = window.URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        const rawName = asset?.name || asset?.title || asset?.assetId || assetId;
        link.href = objectUrl;
        link.download = `${rawName}-v${selectedVersion}.zip`.replace(/[\\/:*?"<>|]+/g, '-');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);

        if (downloadedFiles.length < files.length) {
          alert(`Downloaded ${downloadedFiles.length}/${files.length} files as a zip`);
        }
      } else {
        alert('Failed to download files');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download zip: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleArchive = async () => {
    if (!selectedVersion) return;
    
    if (window.confirm(`Are you sure you want to archive version ${selectedVersion}?`)) {
      setIsArchiving(true);
      try {
        const tenantId = localStorage.getItem('iw_tenantId');
        await api.delete(`/assets/${assetId}/versions/${selectedVersion}`, {
          params: { tenantId }
        });
        alert(`Version ${selectedVersion} archived successfully.`);
        
        // Refresh version list
        const response = await api.get(`/assets/${assetId}/versions`, {
          params: { tenantId }
        });
        setVersions(response.data.data || []);
        setSelectedVersion('');
      } catch (err) {
        console.error('Error archiving version:', err);
        alert('Failed to archive version: ' + (err.response?.data?.message || err.message));
      } finally {
        setIsArchiving(false);
      }
    }
  };

  const isFbxFile = (fileName) => fileName?.toLowerCase().endsWith('.fbx') || false;
  const hasFbx = asset?.files?.some(file => isFbxFile(file.fileName)) || false;
  
  const previewImgUrl = asset?.previewUrl || asset?.primaryFileUrl || asset?.thumbnailUrl || '';

  const renderStatus = () => {
    if (loading) return <div className="viewer-loading">Loading asset...</div>;
    if (error) return <div className="viewer-error">Error: {error}</div>;
    if (!asset) return <div className="viewer-error">Asset not found</div>;
    return null;
  };

  const statusIndicator = renderStatus();

  const viewerContent = asset ? (
    <div className={`asset-viewer-container ${isOverlay ? 'is-overlay' : ''}`}>
      {isOverlay ? (
        <button className="viewer-close-btn" onClick={handleClose} title="Close Panel">
          ×
        </button>
      ) : (
        <Link to="/assets" className="viewer-back-btn">
          ← Back to Assets
        </Link>
      )}

      <div className="viewer-content">
        <div className="viewer-preview">
          {hasFbx && (
            <div className="preview-tabs">
              <button
                className={`preview-tab ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                Preview
              </button>
              <button
                className={`preview-tab ${activeTab === '3d' ? 'active' : ''}`}
                onClick={() => setActiveTab('3d')}
              >
                3D Viewer
              </button>
            </div>
          )}
          
          <div className="preview-content">
            {activeTab === 'preview' ? (
              <div className="preview-image">
                {previewImgUrl ? (
                  <img src={previewImgUrl} alt="preview" />
                ) : (
                  <div className="preview-placeholder">
                    <div className="preview-icon">📦</div>
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            ) : (
              <ThreeDViewer fileUrl={asset.primaryFileUrl || previewImgUrl} fileName={asset.name} />
            )}
          </div>
        </div>

        <div className="viewer-details">
          <div className="viewer-header">
            <div className="header-title">
              <h1>{asset.name || asset.title || asset.id || asset._id}</h1>
              <p className="viewer-id">{asset.assetId || asset._id}</p>
            </div>
            
            <div className="header-actions">
              {!loadingVersions && versions.length > 0 && (
                <div className="download-section">
                  <select
                    value={selectedVersion || ''}
                    onChange={(e) => setSelectedVersion(parseInt(e.target.value))}
                    className="version-select"
                  >
                    <option value="">Select Version</option>
                    {versions.map((ver) => {
                      const verNum = ver.versionNumber ?? ver.version;
                      let dateObj = null;
                      
                      if (ver.createdAt || ver.uploadedAt || ver.updatedAt) {
                        dateObj = new Date(ver.createdAt || ver.uploadedAt || ver.updatedAt);
                      } else if (ver._id) {
                        dateObj = new Date(parseInt(ver._id.substring(0, 8), 16) * 1000);
                      } else if (asset.updatedAt || asset.createdAt) {
                        dateObj = new Date(asset.updatedAt || asset.createdAt);
                      }
                      
                      const dateStr = dateObj && !isNaN(dateObj) ? dateObj.toLocaleDateString() : 'Unknown Date';
                      const isArchived = ver.status === 'archived';
                      
                      return (
                        <option key={verNum} value={verNum} disabled={isArchived}>
                          {isArchived ? '[Archived] ' : ''}
                          Version {verNum} ({dateStr})
                        </option>
                      );
                    })}
                  </select>
                  
                  <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading || !selectedVersion}
                      className="download-btn"
                      style={{ flex: 1 }}
                    >
                      {isDownloading ? `Downloading... ${downloadProgress}%` : '⬇'}
                    </button>
                    {!isRegularUser && (
                      <button
                        onClick={handleArchive}
                        disabled={isArchiving || !selectedVersion}
                        className="archive-btn"
                        title="Delete Version"
                      >
                        {isArchiving ? '...' : '🗑'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="viewer-info">
            <div className="info-section">
              <h3>Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Type</span>
                  <span className="info-value">{asset.assetType || 'Unknown'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Created</span>
                  <span className="info-value">
                    {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Updated</span>
                  <span className="info-value">
                    {asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Version</span>
                  <span className="info-value">{asset.latestVersionNumber || '1'}</span>
                </div>
              </div>
            </div>

            {asset.tags && asset.tags.length > 0 && (
              <div className="info-section">
                <h3>Tags</h3>
                <div className="tags-list">
                  {asset.tags.map((tag, idx) => (
                    <span key={idx} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="info-section metadata-section">
              <div className="metadata-header" onClick={() => setIsMetadataOpen(!isMetadataOpen)}>
                <h3>Metadata</h3>
                <span className={`collapse-chevron ${isMetadataOpen ? 'open' : ''}`}>▼</span>
              </div>
              {isMetadataOpen && (
                <pre className="metadata">
                  {JSON.stringify(asset, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (isOverlay) {
    return (
      <div
        className="asset-slide-over-container"
        onMouseDown={(e) => {
          if (
            e.target.classList.contains('asset-slide-over-container') ||
            e.target.classList.contains('asset-slide-over-backdrop')
          ) {
            handleClose(e);
          }
        }}
      >
        <div className={`asset-slide-over-backdrop ${isClosing ? 'closing' : ''}`} />
        <div className={`asset-slide-over-panel ${isClosing ? 'closing' : ''}`}>
          {statusIndicator || viewerContent}
        </div>
      </div>
    );
  }

  return statusIndicator || viewerContent;
};

export default AssetViewer;
