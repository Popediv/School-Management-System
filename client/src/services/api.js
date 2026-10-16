import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30000, // 30s — covers Render free-tier cold starts (can take 20-25s)
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — auto-attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Give file uploads a longer timeout
  if (config.data instanceof FormData) {
    config.timeout = 60000;
  }
  return config;
});

// Response interceptor — handle token expiry globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sms_token');
      localStorage.removeItem('sms_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
