import axios from 'axios';

export const getApiBaseUrl = () => {
  const url = localStorage.getItem("iw_apiBaseUrl");
  if (!url) return "https://infinity-workshop-api.autovrse.app/api/v1";
  return url.endsWith("/") ? `${url}api/v1` : `${url}/api/v1`;
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
  },
});

export const updateApiBaseUrl = (newUrl) => {
  localStorage.setItem("iw_apiBaseUrl", newUrl);
  api.defaults.baseURL = newUrl.endsWith("/") ? `${newUrl}api/v1` : `${newUrl}/api/v1`;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("iw_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || '';
    const isAuthError = error.response?.status === 401 || message === 'Failed to authenticate token';

    if (isAuthError && window.location.hash !== '#/login') {
      localStorage.removeItem('iw_token');
      localStorage.removeItem('iw_user');
      localStorage.removeItem('iw_tenantId');
      sessionStorage.removeItem('iw_assetGridCache');
      sessionStorage.setItem('iw_authMessage', 'Your session has expired. Please sign in again.');
      window.location.hash = '#/login';
    }

    return Promise.reject(error);
  }
);

export default api;
