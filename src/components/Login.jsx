import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api, { updateApiBaseUrl } from '../api';
import TenantSelector from './TenantSelector';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('iw_token') || null);
  const [loading, setLoading] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(
    localStorage.getItem('iw_apiBaseUrl') || 'https://infinity-workshop-api.autovrse.app'
  );
  
  const navigate = useNavigate();

  const handleEnvChange = (e) => {
    const newUrl = e.target.value;
    setApiBaseUrl(newUrl);
    updateApiBaseUrl(newUrl);
    
    // Clear old session
    localStorage.removeItem('iw_token');
    localStorage.removeItem('iw_user');
    localStorage.removeItem('iw_tenantId');
    sessionStorage.removeItem('iw_assetGridCache');
    setToken(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      updateApiBaseUrl(apiBaseUrl);
      const normalizedBaseUrl = apiBaseUrl.endsWith('/') ? `${apiBaseUrl}api/v1` : `${apiBaseUrl}/api/v1`;
      
      const response = await axios.post(`${normalizedBaseUrl}/auth/login`, {
        username,
        password
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data && response.data.data && response.data.data.token) {
        const user = response.data.data.user || {};
        localStorage.setItem('iw_token', response.data.data.token);
        localStorage.setItem('iw_user', JSON.stringify(user));
        setToken(response.data.data.token);
      } else {
        setError('Login failed: invalid response');
      }
    } catch (err) {
      console.error('Login error response:', err.response?.data);
      const errMsg = err.response?.data?.message || err.response?.data?.errors || err.message;
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (token) {
    return <TenantSelector onTenantSelected={() => navigate('/assets')} />;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="login-logo">∞</div>
          <h1>Infinity Workshop</h1>
          <p>Digital Asset Manager</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="apiEnv">Server Environment</label>
            <select
              id="apiEnv"
              value={apiBaseUrl}
              onChange={handleEnvChange}
              disabled={loading}
              className="login-select"
            >
              <option value="https://infinity-workshop-api.autovrse.app">Production</option>
              <option value="https://dev-infinity-workshop-api.autovrse.app">Development</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
