import React, { useState, useEffect } from 'react';
import api from '../api';

const HealthCheck = () => {
  const [status, setStatus] = useState('checking'); // 'checking', 'up', 'down'
  const [healthData, setHealthData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const runHealthCheck = async () => {
      try {
        const healthUrl = api.defaults.baseURL.replace(/\/api\/v1\/?$/, '/health');
        const res = await api.get(healthUrl);
        setHealthData(res.data || res);
        setStatus('up');
      } catch (err) {
        console.error('Health check failed:', err);
        setStatus('down');
        setErrorMessage(err.message || 'Failed to connect to backend');
      }
    };
    runHealthCheck();
  }, []);

  return (
    <div className="health-container">
      <div className="health-card">
        <h1>System Health</h1>
        
        <div className={`status-indicator ${status}`}>
          <div className="status-dot" />
          <span className="status-text">
            {status === 'checking' && 'Checking status...'}
            {status === 'up' && 'All Systems Operational'}
            {status === 'down' && 'System Offline'}
          </span>
        </div>

        {status === 'up' && healthData && (
          <div className="health-details">
            <div className="detail-item">
              <span className="detail-label">Message</span>
              <span className="detail-value">{healthData.message || 'Service is running'}</span>
            </div>
            {healthData.timestamp && (
              <div className="detail-item">
                <span className="detail-label">Last Checked</span>
                <span className="detail-value">
                  {new Date(healthData.timestamp).toLocaleString()}
                </span>
              </div>
            )}
            {healthData.status && (
              <div className="detail-item">
                <span className="detail-label">Status Code</span>
                <span className="detail-value">{healthData.status}</span>
              </div>
            )}
          </div>
        )}

        {status === 'down' && (
          <div className="health-error">
            <p>Error connecting to the backend service.</p>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthCheck;
