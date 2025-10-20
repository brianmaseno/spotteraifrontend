import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const tripAPI = {
  // Calculate trip plan
  planTrip: async (tripData) => {
    const response = await apiClient.post('/trips/plan/', tripData);
    return response.data;
  },

  // Get trip details
  getTrip: async (tripId) => {
    const response = await apiClient.get(`/trips/${tripId}/`);
    return response.data;
  },

  // List trips
  listTrips: async (limit = 50) => {
    const response = await apiClient.get('/trips/list/', {
      params: { limit }
    });
    return response.data;
  },

  // Delete trip
  deleteTrip: async (tripId) => {
    const response = await apiClient.delete(`/trips/${tripId}/delete/`);
    return response.data;
  },

  // Download ELD PDF
  downloadELDPDF: async (tripId) => {
    const response = await apiClient.get(`/trips/${tripId}/eld-pdf/`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Health check
  healthCheck: async () => {
    const response = await apiClient.get('/health/');
    return response.data;
  },
};

export default apiClient;
