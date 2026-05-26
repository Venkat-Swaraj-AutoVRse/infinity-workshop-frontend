import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import api from '../api';

const Sidebar = ({ theme, toggleTheme, handleLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('iw_sidebar_collapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProjects, setActiveProjects] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState(localStorage.getItem('iw_tenantId') || '');
  
  const profileRef = useRef(null);

  let userName = 'Admin';
  let userRole = 'Admin';
  
  try {
    const userStr = localStorage.getItem('iw_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      userName = user.name || user.username || 'Admin';
      if (user.role) {
        userRole = user.role.charAt(0).toUpperCase() + user.role.slice(1);
      }
    }
  } catch (err) {
    console.error('Error parsing user data for sidebar:', err);
  }

  const avatarLetters = userName.substring(0, 2).toUpperCase();
  const isSuperAdmin = userRole.toLowerCase() === 'superadmin';

  // Handle outside click for profile menu
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch tenants
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await api.get('/tenants');
        if (response.data && response.data.data) {
          setTenants(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching tenants for sidebar:', err);
      }
    };
    fetchTenants();
  }, []);

  // Fetch project modules configs for the projects folder list
  useEffect(() => {
    const fetchProjects = async () => {
      const currentTenantId = localStorage.getItem('iw_tenantId');
      if (currentTenantId) {
        try {
          const response = await api.get(`/configs/tenant/${currentTenantId}`);
          if (response.data && response.data.data) {
            const projectConfigs = response.data.data.filter((cfg) => cfg.type === 'project_modules');
            setProjects(projectConfigs);
          }
        } catch (err) {
          console.error('Error fetching projects for sidebar:', err);
        }
      }
    };
    fetchProjects();
  }, []);

  // Sync active project selection from grid cache
  useEffect(() => {
    const syncActiveProjects = () => {
      try {
        const cacheStr = sessionStorage.getItem('iw_assetGridCache');
        if (cacheStr && location.pathname.startsWith('/assets')) {
          const cache = JSON.parse(cacheStr);
          if (cache.activeCategories?.includes('Projects')) {
            setActiveProjects(cache.selectedLabels || []);
          } else {
            setActiveProjects([]);
          }
        } else {
          setActiveProjects([]);
        }
      } catch (err) {
        console.error('Error reading active projects:', err);
      }
    };
    
    syncActiveProjects();
    window.addEventListener('iw_assetGridCache_updated', syncActiveProjects);
    return () => window.removeEventListener('iw_assetGridCache_updated', syncActiveProjects);
  }, [location.pathname]);

  const handleCollapseToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    localStorage.setItem('iw_sidebar_collapsed', newCollapsed);
    if (newCollapsed) {
      setProfileMenuOpen(false);
    }
  };

  const handleMobileClose = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  const handleTenantSwitch = (e) => {
    const val = e.target.value;
    localStorage.setItem('iw_tenantId', val);
    setTenantId(val);
    sessionStorage.removeItem('iw_assetGridCache');
    window.location.hash = '#/assets';
    window.location.reload();
  };

  return (
    <>
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileOpen(true)}
        title="Open Menu"
      >
        <span className="hamburger-icon">☰</span>
      </button>

      {mobileOpen && (
        <div className="mobile-sidebar-backdrop" onClick={handleMobileClose} />
      )}

      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-logo">
            <div className="logo-icon">∞</div>
            {!collapsed && <span className="logo-text">Infinity Workshop</span>}
          </Link>
          <button
            className="collapse-btn"
            onClick={handleCollapseToggle}
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? '➡' : '⬅'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            {!collapsed && (
              <div className="workspace-header">
                <h3 className="nav-section-title">Workspace</h3>
                {tenants.length > 0 && (
                  <select
                    className="tenant-switcher"
                    value={tenantId}
                    onChange={handleTenantSwitch}
                    title="Switch Tenant"
                  >
                    {tenants.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            <ul className="nav-list">
              <li>
                <Link
                  to="/assets"
                  className={`nav-item ${location.pathname.startsWith('/assets') ? 'active' : ''}`}
                  title={collapsed ? 'All Assets' : ''}
                  onClick={handleMobileClose}
                >
                  <span className="nav-icon">📦</span>
                  {!collapsed && 'All Assets'}
                </Link>
              </li>
              <li>
                <Link
                  to="/labels"
                  className={`nav-item ${location.pathname === '/labels' ? 'active' : ''}`}
                  title={collapsed ? 'Labels & Tags' : ''}
                  onClick={handleMobileClose}
                >
                  <span className="nav-icon">🏷️</span>
                  {!collapsed && 'Labels & Tags'}
                </Link>
              </li>
            </ul>
          </div>

          <div className="nav-section">
            {collapsed ? (
              <div className="nav-icon-only" title="Projects">
                📁
              </div>
            ) : (
              <div className="nav-section-header" onClick={() => setProjectsOpen(!projectsOpen)}>
                <h3 className="nav-section-title">Projects</h3>
                <span className={`foldout-chevron ${projectsOpen ? 'open' : ''}`}>▼</span>
              </div>
            )}
            
            {!collapsed && projectsOpen && (
              <ul className="nav-list project-list">
                {projects.length > 0 ? (
                  projects.map((proj) => (
                    <li key={proj._id}>
                      <Link
                        to={`/assets?project=${encodeURIComponent(proj.category)}`}
                        className={`nav-item project-item ${
                          activeProjects.includes(proj.category) ? 'active' : ''
                        }`}
                        onClick={handleMobileClose}
                        style={{ textDecoration: 'none' }}
                      >
                        <span className="nav-icon folder-icon">📁</span>
                        {proj.category}
                      </Link>
                    </li>
                  ))
                ) : (
                  <li className="empty-nav">No projects defined</li>
                )}
              </ul>
            )}
          </div>

          {isSuperAdmin && (
            <div className="nav-section">
              {collapsed ? (
                <div className="nav-icon-only" title="Administration">
                  ⚙️
                </div>
              ) : (
                <div className="nav-section-header">
                  <h3 className="nav-section-title">Administration</h3>
                </div>
              )}
              
              <ul className="nav-list">
                <li>
                  <Link
                    to="/tenants"
                    className={`nav-item ${location.pathname === '/tenants' ? 'active' : ''}`}
                    title={collapsed ? 'Tenants' : ''}
                    onClick={handleMobileClose}
                  >
                    <span className="nav-icon">🏢</span>
                    {!collapsed && 'Tenants'}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/configs"
                    className={`nav-item ${location.pathname === '/configs' ? 'active' : ''}`}
                    title={collapsed ? 'Configs' : ''}
                    onClick={handleMobileClose}
                  >
                    <span className="nav-icon">🛠️</span>
                    {!collapsed && 'Configs'}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/actions-triggers"
                    className={`nav-item ${location.pathname === '/actions-triggers' ? 'active' : ''}`}
                    title={collapsed ? 'Actions & Triggers' : ''}
                    onClick={handleMobileClose}
                  >
                    <span className="nav-icon">⚡</span>
                    {!collapsed && 'Actions & Triggers'}
                  </Link>
                </li>
              </ul>
            </div>
          )}

          <div className="nav-section" style={{ marginTop: 'auto' }}>
            <ul className="nav-list">
              <li>
                <Link
                  to="/health"
                  className={`nav-item ${location.pathname === '/health' ? 'active' : ''}`}
                  title={collapsed ? 'System Health' : ''}
                  onClick={handleMobileClose}
                >
                  <span className="nav-icon">💖</span>
                  {!collapsed && 'System Health'}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="sidebar-footer" ref={profileRef}>
          <button
            className={`sidebar-profile-btn ${profileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              if (!collapsed) setProfileMenuOpen(!profileMenuOpen);
            }}
            title={collapsed ? userName : ''}
          >
            <div className="profile-avatar">{avatarLetters}</div>
            {!collapsed && (
              <>
                <div className="profile-info">
                  <span className="profile-name">{userName}</span>
                  <span className="profile-role">{userRole}</span>
                </div>
                <span className="profile-chevron">⚙️</span>
              </>
            )}
          </button>
          
          {!collapsed && profileMenuOpen && (
            <div className="sidebar-profile-menu">
              <div className="sidebar-menu-item" onClick={toggleTheme}>
                <span className="menu-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </div>
              <div className="sidebar-menu-divider" />
              <div className="sidebar-menu-item logout" onClick={handleLogout}>
                <span className="menu-icon">🚪</span>
                Logout
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
