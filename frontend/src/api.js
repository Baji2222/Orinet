import axios from 'axios';

function resolveApiBase() {
  const configured = import.meta.env.VITE_API_URL;

  // Vercel / production environment
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:4000/api';
  }

  const { hostname, protocol } = window.location;

  const isLocalHost = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0'
  ].includes(hostname);

  const isLanHost =
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);

  // Local computer
  if (isLocalHost) {
    return 'http://localhost:4000/api';
  }

  // LAN access
  if (isLanHost) {
    return `${protocol}//${hostname}:4000/api`;
  }

  // Production fallback
  return 'https://backend-theta-two-26.vercel.app/api';
}

const API_BASE = resolveApiBase();

console.log('API BASE URL:', API_BASE);

const api = axios.create({
  baseURL: API_BASE
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export function errMsg(err) {
  return (
    err?.response?.data?.error ||
    err?.response?.data?.message ||
    err?.message ||
    'Something went wrong'
  );
}

export default api;