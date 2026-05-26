import React, { useState, useEffect } from 'react';
import api from '../api';

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editTenantId, setEditTenantId] = useState(null);
  const [formValues, setFormValues] = useState({
    name: '',
    description: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tenants');
      if (response.data && response.data.data) {
        setTenants(response.data.data);
      } else {
        setError('Failed to load tenants');
      }
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setError(err.response?.data?.message || 'Error loading tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
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
    if (!formValues.name.trim()) {
      alert('Tenant name is required');
      return;
    }
    
    setActionLoading(true);
    try {
      if (editTenantId) {
        await api.put(`/tenants/${editTenantId}`, formValues);
      } else {
        await api.post('/tenants', formValues);
      }
      setEditTenantId(null);
      setFormValues({ name: '', description: '' });
      await fetchTenants();
    } catch (err) {
      console.error('Error saving tenant:', err);
      alert(err.response?.data?.message || 'Failed to save tenant');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (tenant) => {
    setEditTenantId(tenant._id);
    setFormValues({
      name: tenant.name || '',
      description: tenant.description || ''
    });
  };

  const handleCancel = () => {
    setEditTenantId(null);
    setFormValues({ name: '', description: '' });
  };

  const handleDeleteClick = async (tenantId, tenantName) => {
    if (window.confirm(`Are you sure you want to delete the tenant "${tenantName}"? This action cannot be undone.`)) {
      setActionLoading(true);
      try {
        await api.delete(`/tenants/${tenantId}`);
        await fetchTenants();
      } catch (err) {
        console.error('Error deleting tenant:', err);
        alert(err.response?.data?.message || 'Failed to delete tenant');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading && tenants.length === 0) {
    return <div className="admin-loading">Loading tenants...</div>;
  }

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h1>Tenant Management</h1>
        <p>Manage workspaces / tenants in the system.</p>
      </div>

      <div className="admin-content-wrapper">
        {error && <div className="admin-error">{error}</div>}

        <div className="admin-form-section">
          <h2>{editTenantId ? 'Edit Tenant' : 'Create New Tenant'}</h2>
          
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formValues.name}
                onChange={handleInputChange}
                placeholder="Tenant Name"
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                name="description"
                value={formValues.description}
                onChange={handleInputChange}
                placeholder="Description (Optional)"
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="admin-btn primary" disabled={actionLoading}>
                {editTenantId ? 'Update Tenant' : 'Create Tenant'}
              </button>
              {editTenantId && (
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
          <h2>Existing Tenants ({tenants.length})</h2>
          
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant._id}>
                    <td className="font-medium">{tenant.name}</td>
                    <td>{tenant.description || '-'}</td>
                    <td className="mono">{tenant._id}</td>
                    <td className="actions-cell">
                      <button
                        className="icon-btn edit-btn"
                        onClick={() => handleEditClick(tenant)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="icon-btn delete-btn"
                        onClick={() => handleDeleteClick(tenant._id, tenant.name)}
                        title="Delete"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
                
                {tenants.length === 0 && !loading && (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">
                      No tenants found.
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

export default TenantManagement;
