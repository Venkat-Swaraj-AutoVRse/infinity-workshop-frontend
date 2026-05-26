import React, { useState, useEffect } from 'react';
import api from '../api';

const ActionsAndTriggers = () => {
  const [activeTab, setActiveTab] = useState('actions'); // 'actions' or 'triggers'
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editItemId, setEditItemId] = useState(null);
  const [formValues, setFormValues] = useState({
    Name: '',
    Description: '',
    type: 'custom',
    TargetObject: '',
    Options: ''
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = activeTab === 'actions' ? '/actions' : '/triggers';
      const response = await api.get(endpoint);
      if (response.data && response.data.data) {
        setItems(response.data.data);
      } else {
        setError(`Failed to load ${activeTab}`);
      }
    } catch (err) {
      console.error(`Error fetching ${activeTab}:`, err);
      setError(err.response?.data?.message || `Error loading ${activeTab}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Reset form when switching tabs
    setEditItemId(null);
    setFormValues({
      Name: '',
      Description: '',
      type: 'custom',
      TargetObject: '',
      Options: ''
    });
  }, [activeTab]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.Name.trim()) {
      alert('Name is required');
      return;
    }
    
    setActionLoading(true);
    try {
      let parsedTargetObject = {};
      if (formValues.TargetObject.trim()) {
        try {
          parsedTargetObject = JSON.parse(formValues.TargetObject);
        } catch {
          alert('TargetObject must be valid JSON');
          setActionLoading(false);
          return;
        }
      }
      
      let parsedOptions = [];
      if (formValues.Options.trim()) {
        try {
          parsedOptions = JSON.parse(formValues.Options);
          if (!Array.isArray(parsedOptions)) {
            throw new Error('Not an array');
          }
        } catch {
          alert('Options must be a valid JSON Array (e.g., ["opt1", "opt2"])');
          setActionLoading(false);
          return;
        }
      }

      const payload = {
        Name: formValues.Name,
        Description: formValues.Description,
        type: formValues.type || 'custom',
        TargetObject: parsedTargetObject,
        Options: parsedOptions
      };

      const endpoint = activeTab === 'actions' ? '/actions' : '/triggers';

      if (editItemId) {
        await api.put(`${endpoint}/${editItemId}`, payload);
      } else {
        await api.post(endpoint, payload);
      }

      setEditItemId(null);
      setFormValues({
        Name: '',
        Description: '',
        type: 'custom',
        TargetObject: '',
        Options: ''
      });
      await fetchData();
    } catch (err) {
      console.error(`Error saving ${activeTab.slice(0, -1)}:`, err);
      alert(err.response?.data?.message || `Failed to save ${activeTab.slice(0, -1)}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditClick = (item) => {
    setEditItemId(item._id);
    setFormValues({
      Name: item.Name || '',
      Description: item.Description || '',
      type: item.type || 'custom',
      TargetObject: item.TargetObject ? JSON.stringify(item.TargetObject, null, 2) : '',
      Options: item.Options ? JSON.stringify(item.Options, null, 2) : ''
    });
  };

  const handleCancel = () => {
    setEditItemId(null);
    setFormValues({
      Name: '',
      Description: '',
      type: 'custom',
      TargetObject: '',
      Options: ''
    });
  };

  const handleDeleteClick = async (itemId, name) => {
    const itemSingular = activeTab === 'actions' ? 'action' : 'trigger';
    if (window.confirm(`Are you sure you want to delete the ${itemSingular} "${name}"?`)) {
      setActionLoading(true);
      try {
        const endpoint = activeTab === 'actions' ? '/actions' : '/triggers';
        await api.delete(`${endpoint}/${itemId}`);
        await fetchData();
      } catch (err) {
        console.error(`Error deleting ${itemSingular}:`, err);
        alert(err.response?.data?.message || `Failed to delete ${itemSingular}`);
      } finally {
        setActionLoading(false);
      }
    }
  };

  return (
    <div className="admin-page-container">
      <div className="admin-header">
        <h1>Actions & Triggers</h1>
        <p>Manage system actions and triggers for dynamic configurations.</p>
      </div>

      <div className="admin-content-wrapper">
        <div className="tabs-container" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <button
            className={`admin-btn ${activeTab === 'actions' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab('actions')}
            disabled={actionLoading}
          >
            Actions
          </button>
          <button
            className={`admin-btn ${activeTab === 'triggers' ? 'primary' : 'secondary'}`}
            onClick={() => setActiveTab('triggers')}
            disabled={actionLoading}
          >
            Triggers
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-form-section">
          <h2>
            {editItemId
              ? `Edit ${activeTab.slice(0, -1)}`
              : `Create New ${activeTab.slice(0, -1)}`}
          </h2>
          
          <form onSubmit={handleSubmit} className="admin-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="Name"
                value={formValues.Name}
                onChange={handleInputChange}
                placeholder="e.g., SendEmail, OnUserClick"
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                name="Description"
                value={formValues.Description}
                onChange={handleInputChange}
                placeholder="Short description..."
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Type</label>
              <input
                type="text"
                name="type"
                value={formValues.type}
                onChange={handleInputChange}
                placeholder="e.g., custom, system"
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Target Object (JSON format)</label>
              <textarea
                name="TargetObject"
                value={formValues.TargetObject}
                onChange={handleInputChange}
                placeholder='{"key": "value"}'
                rows={4}
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-group">
              <label>Options (JSON Array format)</label>
              <textarea
                name="Options"
                value={formValues.Options}
                onChange={handleInputChange}
                placeholder='["Option 1", "Option 2"]'
                rows={3}
                disabled={actionLoading}
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="admin-btn primary" disabled={actionLoading}>
                {editItemId ? 'Update' : 'Create'} {activeTab.slice(0, -1)}
              </button>
              {editItemId && (
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
          <h2>
            Existing {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ({items.length})
          </h2>
          
          {loading && items.length === 0 ? (
            <div className="admin-loading">Loading...</div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Target Object</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id}>
                      <td className="font-medium">{item.Name}</td>
                      <td>{item.type || '-'}</td>
                      <td>{item.Description || '-'}</td>
                      <td>
                        <div
                          style={{
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={JSON.stringify(item.TargetObject)}
                        >
                          {item.TargetObject ? JSON.stringify(item.TargetObject) : '-'}
                        </div>
                      </td>
                      <td className="actions-cell">
                        <button
                          className="icon-btn edit-btn"
                          onClick={() => handleEditClick(item)}
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          className="icon-btn delete-btn"
                          onClick={() => handleDeleteClick(item._id, item.Name)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        No {activeTab} found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActionsAndTriggers;
