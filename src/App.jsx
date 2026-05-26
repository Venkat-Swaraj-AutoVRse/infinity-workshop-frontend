import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import AssetList from './components/AssetList';
import LabelsAndTags from './components/LabelsAndTags';
import HealthCheck from './components/HealthCheck';
import TenantManagement from './components/TenantManagement';
import ConfigManagement from './components/ConfigManagement';
import ActionsAndTriggers from './components/ActionsAndTriggers';
import { PrivateRoute, AdminRoute } from './components/PrivateRoute';

const App = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  
  const [theme, setTheme] = useState(() => localStorage.getItem('iw_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('iw_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = () => {
    localStorage.removeItem('iw_token');
    localStorage.removeItem('iw_tenantId');
    sessionStorage.removeItem('iw_assetGridCache');
    window.location.hash = '#/login';
    window.location.reload();
  };

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  const token = localStorage.getItem('iw_token');

  // Allow unauthenticated access to health check page if needed
  if (location.pathname === '/health' && !token) {
    return (
      <Routes>
        <Route path="/health" element={<HealthCheck />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <Sidebar theme={theme} toggleTheme={toggleTheme} handleLogout={handleLogout} />
      
      <div className="main-content-wrapper">
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={<Navigate to="/assets" replace />} />
            
            <Route
              path="/assets/*"
              element={
                <PrivateRoute>
                  <AssetList />
                </PrivateRoute>
              }
            />
            
            <Route
              path="/labels"
              element={
                <PrivateRoute>
                  <LabelsAndTags />
                </PrivateRoute>
              }
            />
            
            <Route
              path="/health"
              element={<HealthCheck />}
            />
            
            <Route
              path="/tenants"
              element={
                <AdminRoute>
                  <TenantManagement />
                </AdminRoute>
              }
            />
            
            <Route
              path="/configs"
              element={
                <AdminRoute>
                  <ConfigManagement />
                </AdminRoute>
              }
            />
            
            <Route
              path="/actions-triggers"
              element={
                <AdminRoute>
                  <ActionsAndTriggers />
                </AdminRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default App;
