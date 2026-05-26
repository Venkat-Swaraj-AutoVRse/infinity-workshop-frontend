import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const CATEGORY_MAP = {
  Projects: 'PROJECTS',
  Modules: 'MODULE',
  'Asset Type': 'ASSET TYPE',
  Industry: 'INDUSTRY',
  Environments: 'ENVIRONMENTS',
  Custom: 'CUSTOM'
};

const CATEGORIES_KEYS = Object.keys(CATEGORY_MAP);

const LabelsAndTags = () => {
  const [categoriesConfigs, setCategoriesConfigs] = useState({});
  const [projectModulesConfigs, setProjectModulesConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCategoryTab, setSelectedCategoryTab] = useState(CATEGORIES_KEYS[0]);
  const [newLabelInput, setNewLabelInput] = useState('');
  const [newProjectInput, setNewProjectInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [moduleSearchInput, setModuleSearchInput] = useState('');
  const [showModuleSuggestions, setShowModuleSuggestions] = useState(false);

  const suggestionsRef = useRef(null);

  const userStr = localStorage.getItem('iw_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isRegularUser = user?.role === 'user';

  // Close suggestions dropdown on clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowModuleSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchData = async () => {
    const tenantId = localStorage.getItem('iw_tenantId');
    if (!tenantId) {
      setError('No tenant selected');
      setLoading(false);
      return;
    }
    
    try {
      const response = await api.get(`/configs/tenant/${tenantId}`);
      if (response.data && response.data.data) {
        const catMapObj = {};
        const projModArr = [];
        
        response.data.data.forEach((config) => {
          if (config.type === 'project_modules') {
            projModArr.push(config);
          } else {
            const cat = config.category || 'CUSTOM';
            catMapObj[cat] = config;
          }
        });
        
        setCategoriesConfigs(catMapObj);
        setProjectModulesConfigs(projModArr);
      } else {
        setError('Failed to load labels');
      }
    } catch (err) {
      console.error('Error fetching labels:', err);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLabel = async () => {
    const labelStr = newLabelInput.trim();
    if (!labelStr) return;
    
    setActionLoading(true);
    const tenantId = localStorage.getItem('iw_tenantId');
    const categoryKey = CATEGORY_MAP[selectedCategoryTab];
    const existingConfig = categoriesConfigs[categoryKey];
    
    try {
      if (existingConfig) {
        if ((existingConfig.labels || []).includes(labelStr)) {
          alert('Label already exists in this category');
          setActionLoading(false);
          return;
        }
        const updatePayload = {
          labels: [...(existingConfig.labels || []), labelStr],
          settings: existingConfig.settings || {},
          tenantId
        };
        await api.put(`/configs/${existingConfig._id}`, updatePayload);
      } else {
        const createPayload = {
          type: 'label_category',
          category: categoryKey,
          labels: [labelStr],
          tenantId
        };
        await api.post('/configs', createPayload);
      }
      setNewLabelInput('');
      await fetchData();
    } catch (err) {
      console.error('Error adding label:', err);
      alert(err.response?.data?.message || 'Failed to add label');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveLabel = async (categoryKey, labelStr) => {
    if (!window.confirm(`Are you sure you want to remove the label "${labelStr}"?`)) return;
    
    setActionLoading(true);
    const config = categoriesConfigs[categoryKey];
    try {
      if (config) {
        const updatePayload = {
          labels: (config.labels || []).filter((lbl) => lbl !== labelStr),
          settings: config.settings || {},
          tenantId: config.tenantId
        };
        await api.put(`/configs/${config._id}`, updatePayload);
        await fetchData();
      }
    } catch (err) {
      console.error('Error removing label:', err);
      alert(err.response?.data?.message || 'Failed to remove label');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateProject = async () => {
    const projName = newProjectInput.trim();
    if (!projName) return;
    
    setActionLoading(true);
    const tenantId = localStorage.getItem('iw_tenantId');
    try {
      const createPayload = {
        type: 'project_modules',
        category: projName,
        labels: [],
        tenantId
      };
      await api.post('/configs', createPayload);
      setNewProjectInput('');
      await fetchData();
    } catch (err) {
      console.error('Error creating project mapping:', err);
      alert(err.response?.data?.message || 'Failed to create project mapping');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddModuleToProject = async (configId, moduleStr = null) => {
    const targetModule = moduleStr || newLabelInput.trim();
    if (!targetModule) return;
    
    setActionLoading(true);
    const projectConfig = projectModulesConfigs.find((x) => x._id === configId);
    
    try {
      if ((projectConfig.labels || []).includes(targetModule)) {
        alert('Module already exists in this project');
        setActionLoading(false);
        return;
      }
      const updatePayload = {
        labels: [...(projectConfig.labels || []), targetModule],
        settings: projectConfig.settings || {},
        tenantId: projectConfig.tenantId
      };
      await api.put(`/configs/${configId}`, updatePayload);
      setNewLabelInput('');
      setModuleSearchInput('');
      setShowModuleSuggestions(false);
      await fetchData();
    } catch (err) {
      console.error('Error adding module to project:', err);
      alert(err.response?.data?.message || 'Failed to add module to project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveModuleFromProject = async (configId, moduleStr) => {
    if (!window.confirm(`Are you sure you want to remove the module "${moduleStr}" from this project?`)) return;
    
    setActionLoading(true);
    const config = projectModulesConfigs.find((x) => x._id === configId);
    try {
      if (config) {
        const updatePayload = {
          labels: (config.labels || []).filter((lbl) => lbl !== moduleStr),
          settings: config.settings || {},
          tenantId: config.tenantId
        };
        await api.put(`/configs/${config._id}`, updatePayload);
        await fetchData();
      }
    } catch (err) {
      console.error('Error removing module from project:', err);
      alert(err.response?.data?.message || 'Failed to remove module');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteProject = async (configId, projectCategory) => {
    if (window.confirm(`Are you sure you want to delete the entire project "${projectCategory}"?`)) {
      setActionLoading(true);
      try {
        await api.delete(`/configs/${configId}`);
        if (selectedCategoryTab === `project_${configId}`) {
          setSelectedCategoryTab(CATEGORIES_KEYS[0]);
        }
        await fetchData();
      } catch (err) {
        console.error('Error deleting project mapping:', err);
        alert(err.response?.data?.message || 'Failed to delete project mapping');
      } finally {
        setActionLoading(false);
      }
    }
  };

  if (loading) {
    return <div className="labels-loading">Loading labels...</div>;
  }

  if (error) {
    return <div className="labels-error">{error}</div>;
  }

  const renderDetailPane = () => {
    if (selectedCategoryTab.startsWith('project_')) {
      const configId = selectedCategoryTab.split('_')[1];
      const projectConfig = projectModulesConfigs.find((x) => x._id === configId);
      
      if (!projectConfig) {
        return <div className="no-data">Project no longer exists.</div>;
      }

      const allModulesConfig = categoriesConfigs[CATEGORY_MAP.Modules];
      const allModulesList = allModulesConfig ? allModulesConfig.labels || [] : [];
      const suggestions = allModulesList.filter((m) =>
        m.toLowerCase().includes(moduleSearchInput.toLowerCase())
      );

      return (
        <div className="labels-detail-pane">
          <div className="detail-header">
            <h2 className="detail-title">
              {projectConfig.category}{' '}
              <span className="detail-subtitle">/ Modules</span>
            </h2>
            {!isRegularUser && (
              <button
                className="delete-mapping-btn"
                onClick={() => handleDeleteProject(projectConfig._id, projectConfig.category)}
                disabled={actionLoading}
                title="Delete Project"
              >
                Delete Project
              </button>
            )}
          </div>

          <div
            className="add-label-form inline"
            ref={suggestionsRef}
            style={{ position: 'relative', marginBottom: '24px', marginTop: 0, borderTop: 'none', paddingTop: 0 }}
          >
            <div className="searchable-dropdown-container" style={{ flex: 1, display: 'flex' }}>
              <input
                type="text"
                value={moduleSearchInput}
                onFocus={() => setShowModuleSuggestions(true)}
                onChange={(e) => {
                  setModuleSearchInput(e.target.value);
                  setNewLabelInput(e.target.value);
                  setShowModuleSuggestions(true);
                }}
                placeholder="Search or add a module..."
                className="add-label-input"
                disabled={actionLoading || isRegularUser}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && moduleSearchInput.trim()) {
                    e.preventDefault();
                    handleAddModuleToProject(projectConfig._id, moduleSearchInput.trim());
                    setShowModuleSuggestions(false);
                  }
                }}
              />
              {showModuleSuggestions && (
                <div className="module-suggestions-menu">
                  {suggestions.length === 0 ? (
                    <div className="suggestion-item empty">No matching modules found</div>
                  ) : (
                    suggestions.map((item, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onClick={() => {
                          setModuleSearchInput(item);
                          setNewLabelInput(item);
                          handleAddModuleToProject(projectConfig._id, item);
                          setShowModuleSuggestions(false);
                        }}
                      >
                        {item}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {!isRegularUser && (
              <button
                className="add-label-btn"
                onClick={() => handleAddModuleToProject(projectConfig._id, moduleSearchInput.trim())}
                disabled={actionLoading || !moduleSearchInput.trim()}
              >
                Add Module
              </button>
            )}
          </div>

          <div className="tags-container">
            {projectConfig.labels && projectConfig.labels.length > 0 ? (
              <div className="tags-list">
                {projectConfig.labels.map((moduleStr, idx) => (
                  <span key={idx} className="tag-badge">
                    {moduleStr}
                    {!isRegularUser && (
                      <button
                        className="tag-remove-btn"
                        onClick={() => handleRemoveModuleFromProject(projectConfig._id, moduleStr)}
                        disabled={actionLoading}
                        title="Remove module"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <div className="no-data tags-empty">No modules mapped to this project yet.</div>
            )}
          </div>
        </div>
      );
    }

    const currentDbCategory = CATEGORY_MAP[selectedCategoryTab];
    const categoryConfig = categoriesConfigs[currentDbCategory];

    return (
      <div className="labels-detail-pane">
        <div className="detail-header">
          <h2 className="detail-title">{selectedCategoryTab}</h2>
        </div>

        <div className="add-label-form inline" style={{ marginBottom: '24px', marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
          <input
            type="text"
            value={newLabelInput}
            onChange={(e) => setNewLabelInput(e.target.value)}
            placeholder={`Add new ${selectedCategoryTab.toLowerCase()}...`}
            className="add-label-input"
            disabled={actionLoading || isRegularUser}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLabel();
              }
            }}
          />
          {!isRegularUser && (
            <button
              className="add-label-btn"
              onClick={handleAddLabel}
              disabled={actionLoading || !newLabelInput.trim()}
            >
              Add Label
            </button>
          )}
        </div>

        <div className="tags-container">
          {categoryConfig && categoryConfig.labels && categoryConfig.labels.length > 0 ? (
            <div className="tags-list">
              {categoryConfig.labels.map((labelStr, idx) => (
                <span key={idx} className="tag-badge">
                  {labelStr}
                  {!isRegularUser && (
                    <button
                      className="tag-remove-btn"
                      onClick={() => handleRemoveLabel(currentDbCategory, labelStr)}
                      disabled={actionLoading}
                      title="Remove label"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="no-data tags-empty">
              No labels have been created for {selectedCategoryTab} yet.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="labels-container">
      <div className="labels-header">
        <h1>Labels & Tags</h1>
      </div>
      
      <div className="labels-two-column">
        <div className="labels-sidebar">
          <div className="labels-nav-group">
            <h3 className="labels-nav-title">Categories</h3>
            <ul className="labels-nav-list">
              {CATEGORIES_KEYS.map((catKey) => (
                <li key={catKey}>
                  <button
                    className={`labels-nav-btn ${selectedCategoryTab === catKey ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategoryTab(catKey);
                      setNewLabelInput('');
                    }}
                  >
                    {catKey}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="labels-nav-group">
            <h3 className="labels-nav-title">Projects</h3>
            <div className="add-project-mini-form">
              <input
                type="text"
                value={newProjectInput}
                onChange={(e) => setNewProjectInput(e.target.value)}
                placeholder="New Project..."
                className="add-label-input slim"
                disabled={actionLoading || isRegularUser}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateProject();
                  }
                }}
              />
              {!isRegularUser && (
                <button
                  className="add-label-btn slim"
                  onClick={handleCreateProject}
                  disabled={actionLoading || !newProjectInput.trim()}
                >
                  +
                </button>
              )}
            </div>
            
            <ul className="labels-nav-list projects">
              {projectModulesConfigs.map((proj) => (
                <li key={proj._id}>
                  <button
                    className={`labels-nav-btn project ${
                      selectedCategoryTab === `project_${proj._id}` ? 'active' : ''
                    }`}
                    onClick={() => {
                      setSelectedCategoryTab(`project_${proj._id}`);
                      setNewLabelInput('');
                    }}
                  >
                    <span className="folder-emoji">📁</span> {proj.category}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="labels-main-content">{renderDetailPane()}</div>
      </div>
    </div>
  );
};

export default LabelsAndTags;
