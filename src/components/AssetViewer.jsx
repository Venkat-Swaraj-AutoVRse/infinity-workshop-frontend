import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import ThreeDViewer from './ThreeDViewer';

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
      
      let downloadedCount = 0;
      for (const file of files) {
        try {
          const res = await fetch(file.url);
          if (!res.ok) {
            console.warn(`Failed to download ${file.fileName}: ${res.status}`);
            continue;
          }
          const blob = await res.blob();
          const objectUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = file.fileName;
          document.body.appendChild(link);
          link.click();
          window.URL.revokeObjectURL(objectUrl);
          document.body.removeChild(link);
          
          downloadedCount++;
          setDownloadProgress(Math.round((downloadedCount / files.length) * 100));
        } catch (err) {
          console.warn(`Error downloading ${file.fileName}:`, err);
        }
      }
      
      if (downloadedCount > 0) {
        alert(`Successfully downloaded ${downloadedCount}/${files.length} files`);
      } else {
        alert('Failed to download files');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to get download URLs: ' + (err.response?.data?.message || err.message));
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
