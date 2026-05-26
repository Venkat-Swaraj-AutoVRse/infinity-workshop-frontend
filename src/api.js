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

export default api;
