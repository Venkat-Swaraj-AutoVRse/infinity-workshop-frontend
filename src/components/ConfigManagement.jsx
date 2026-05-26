import React, { useState, useEffect } from 'react';
import api from '../api';

const ConfigManagement = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editConfigId, setEditConfigId] = useState(null);
  const [formValues, setFormValues] = useState({
    type: '',
    category: '',
    tenantId: '',
    labels: '',
    settings: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/configs');
      if (response.data && response.data.data) {
        setConfigs(response.data.data);
      } else {
        setError('Failed to load configs');
      }
    } catch (err) {
      console.error('Error fetching configs:', err);
      setError(err.response?.data?.message || err.message || 'Error loading configs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.type.trim() || !formValues.category.trim()) {
      alert('Type and Category are required');
      return;
    }
    
    setActionLoading(true);
    try {
      let labelsList = [];
      if (formValues.labels) {
        labelsList = formValues.labels
          .split(',')
          .map((lbl) => lbl.trim())
          .filter(Boolean);
      }
      
      let parsedSettings = {};
      if (formValues.settings) {
        try {
          parsedSettings = JSON.parse(formValues.settings);
        } catch {
          alert('Settings must be valid JSON');
          setActionLoading(false);
          return;
        }
      }

      const payload = {
        type: formValues.type,
        category: formValues.category,
        tenantId: formValues.tenantId || null,
        labels: labelsList,
        settings: parsedSettings
      };

      if (editConfigId) {
        await api.put(`/configs/${editConfigId}`, {
          labels: labelsList,
          settings: parsedSettings
        });
      } else {
        await api.post('/configs', payload);
      }

      setEditConfigId(null);
      setFormValues({
        type: '',
        category: '',
        tenantId: '',
        labels: '',
        settings: ''
      });
      await fetchConfigs();
    } catch (err) {
      console.error('Error saving config:', err);
      alert(err.response?.data?.message || 'Failed to save config');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (config) => {
    setEditConfigId(config._id);
    setFormValues({
      type: config.type || '',
      category: config.category || '',
      tenantId: config.tenantId || '',
      labels: (config.labels || []).join(', '),
      settings: config.settings ? JSON.stringify(config.settings, null, 2) : ''
    });
  };

  const handleCancel = () => {
    setEditConfigId(null);
    setFormValues({
      type: '',
      category: '',
      tenantId: '',
      labels: '',
      settings: ''
    });
  };

  const handleDeleteClick = async (configId, categoryName) => {
    if (window.confirm(`Are you sure you want to delete the config for "${categoryName}"?`)) {
      setActionLoading(true);
      try {
        await api.delete(`/configs/${configId}`);
        await fetchConfigs();
      } catch (err) {
        console.error('Error deleting config:', err);
        alert(err.response?.data?.message || 'Failed to delete config');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading && configs.length === 0) {
    return <div className="admin-loading">Loading configs...</div>;
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h1>Config Management</h1>
        <p>Manage global and tenant-specific configurations.</p>
      </div>

      <div className="admin-content-wrapper">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-form-section">
          <h2>{editConfigId ? 'Edit Config' : 'Create New Config'}</h2>
          
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Type</label>
              <input
                type="text"
                name="type"
                value={formValues.type}
                onChange={handleInputChange}
                placeholder="e.g., label_category, project_modules"
                disabled={actionLoading || !!editConfigId}
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <input
                type="text"
                name="category"
                value={formValues.category}
                onChange={handleInputChange}
                placeholder="e.g., MODULES, ENVIRONMENTS"
                disabled={actionLoading || !!editConfigId}
              />
            </div>
            
            <div className="form-group">
              <label>Tenant ID (Optional)</label>
              <input
                type="text"
                name="tenantId"
                value={formValues.tenantId}
                onChange={handleInputChange}
                placeholder="Leave blank for global config"
                disabled={actionLoading || !!editConfigId}
              />
            </div>
            
            <div className="form-group">
              <label>Labels (Comma separated)</label>
              <input
                type="text"
                name="labels"
                value={formValues.labels}
                onChange={handleInputChange}
                placeholder="Label1, Label2, Label3"
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Settings (JSON format)</label>
              <textarea
                name="settings"
                value={formValues.settings}
                onChange={handleInputChange}
                placeholder='{"key": "value"}'
                rows={4}
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="admin-btn primary" disabled={actionLoading}>
                {editConfigId ? 'Update Config' : 'Create Config'}
              </button>
              {editConfigId && (
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="admin-list-section">
          <h2>Existing Configs ({configs.length})</h2>
          
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Tenant ID</th>
                  <th>Labels</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => (
                  <tr key={cfg._id}>
                    <td className="font-medium">{cfg.type}</td>
                    <td>{cfg.category}</td>
                    <td className="mono" style={{ fontSize: '0.8rem' }}>
                      {cfg.tenantId || 'Global'}
                    </td>
                    <td>
                      <div
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={cfg.labels?.join(', ')}
                      >
                        {cfg.labels?.join(', ') || '-'}
                      </div>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn edit-btn"
                        onClick={() => handleEditClick(cfg)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleDeleteClick(cfg._id, cfg.category)}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
                
                {configs.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted py-4">
                      No configs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigManagement;
