import React from 'react';

const AssetCard = ({ asset }) => {
  const title = asset.name || asset.title || asset.id || asset._id;
  const imageUrl = asset.thumbnailUrl || asset.previewUrl || asset.primaryFileUrl || '';
  const assetType = asset.assetType || 'asset';

  return (
    <div className="asset-card">
      <div className="asset-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={title} />
        ) : (
          <div className="asset-card-placeholder">
            <div className="asset-icon">📦</div>
          </div>
        )}
        <div className="asset-card-content">
          <h3 className="asset-card-title">{title}</h3>
          <p className="asset-card-type-badge">{assetType}</p>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
