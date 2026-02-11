import axios from 'axios';

// Access environment variable (Vite uses import.meta.env)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the Token
api.interceptors.request.use(
  (config) => {
    // Trigger loading for non-GET requests (POST, PUT, DELETE)
    if (config.method && config.method.toLowerCase() !== 'get') {
        window.dispatchEvent(new Event('loading:start'));
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // If request fails to start, we might not need to stop loading if it didn't start? 
    // But safe to dispatch end just in case if we can determine method. 
    // Usually request error happens before config is fully formed or validation. 
    // SAFE: just dispatch end.
    window.dispatchEvent(new Event('loading:end'));
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401/403
api.interceptors.response.use(
  (response) => {
    if (response.config.method && response.config.method.toLowerCase() !== 'get') {
        window.dispatchEvent(new Event('loading:end'));
    }
    return response;
  },
  (error) => {
    if (error.config && error.config.method && error.config.method.toLowerCase() !== 'get') {
        window.dispatchEvent(new Event('loading:end'));
    }

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Don't redirect if it's a login attempt failure
      if (error.config.url.includes('/auth/login')) {
         return Promise.reject(error);
      }
      
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper methods wrapper
const apiService = {
  // Pass through axios methods
  get: (url, config) => api.get(url, config),
  post: (url, data, config) => api.post(url, data, config),
  put: (url, data, config) => api.put(url, data, config),
  delete: (url, config) => api.delete(url, config),

  // Rooms
  createRoom: (data) => api.post('/rooms', data),
  updateRoom: (id, data) => api.put(`/rooms/${id}`, data),
  deleteRoom: (id) => api.delete(`/rooms/${id}`),
  assignTenant: (id, data) => api.post(`/rooms/${id}/tenant`, data),
  moveOut: (id) => api.post(`/rooms/${id}/moveout`),

  // Buildings
  getBuildings: () => api.get('/buildings'),
  createBuilding: (formData) => api.post('/buildings', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateBuilding: (id, formData) => api.put(`/buildings/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteBuilding: (id) => api.delete(`/buildings/${id}`),

  // Payments
  getPayments: (params) => api.get('/payments', { params }),
  recordPayment: (id, data) => api.post(`/payments/${id}`, data),
};

export default apiService;
