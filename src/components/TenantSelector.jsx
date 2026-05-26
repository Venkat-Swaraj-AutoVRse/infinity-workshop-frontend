import React, { useState, useEffect } from 'react';
import api from '../api';

const TenantSelector = ({ onTenantSelected }) => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await api.get('/tenants');
        setTenants(response.data.data || []);
      } catch (err) {
        console.error('Error fetching tenants:', err);
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTenants();
  }, []);

  const handleSelectTenant = (tenantId) => {
    localStorage.setItem('iw_tenantId', tenantId);
    onTenantSelected();
  };

  if (loading) {
    return <div className="tenant-loading">Loading tenants...</div>;
  }

  if (error) {
    return <div className="tenant-error">Error: {error}</div>;
  }

  if (tenants.length === 0) {
    return <div className="tenant-empty">No tenants available</div>;
  }

  return (
    <div className="tenant-selector-container">
      <div className="tenant-selector-box">
        <h2>Select a Workspace</h2>
        <p className="tenant-subtitle">Choose a workspace to manage assets</p>
        <div className="tenant-grid">
          {tenants.map((tenant) => (
            <div
              key={tenant._id}
              className="tenant-card"
              onClick={() => handleSelectTenant(tenant._id)}
            >
              <div className="tenant-icon">📦</div>
              <div className="tenant-info">
                <div className="tenant-name">{tenant.name}</div>
                <div className="tenant-description">{tenant.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TenantSelector;
