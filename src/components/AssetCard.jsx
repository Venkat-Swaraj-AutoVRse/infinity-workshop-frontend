import React from 'react';
import { assetTypeIcon, assetTypeLabel } from '../assetTypes';

const AssetCard = ({ asset }) => {
  const title = asset.name || asset.title || asset.id || asset._id;
  const imageUrl = asset.thumbnailUrl || asset.previewUrl || asset.primaryFileUrl || '';

  return (
    <div className="asset-card">
      <div className="asset-card-image">
        {imageUrl ? (
          <img src={imageUrl} alt={title} />
        ) : (
          <div className="asset-card-placeholder">
            <div className="asset-icon">{assetTypeIcon(asset.assetType)}</div>
          </div>
        )}
        <div className="asset-card-content">
          <h3 className="asset-card-title">{title}</h3>
          <p className="asset-card-type-badge">{assetTypeLabel(asset.assetType)}</p>
        </div>
      </div>
    </div>
  );
};

export default AssetCard;
