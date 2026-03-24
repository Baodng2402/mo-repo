import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@env';

// ==================== Create Axios Instance ====================

console.log('Current API URL:', API_URL);

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ==================== Request Interceptor ====================

/**
 * Automatically attaches the JWT token from AsyncStorage
 * to every outgoing request as a Bearer token.
 */
axiosClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ==================== Response Interceptor ====================

/**
 * Handles API errors:
 * - Logs the error method + URL for debugging
 * - On 401 (Unauthorized): clears the stored token → forces re-login
 */
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;
    const expectedStatuses: number[] = (config as any)?.expectedErrorStatuses || [];
    const isExpectedStatus = typeof status === 'number' && expectedStatuses.includes(status);
    const shouldLog = !isExpectedStatus;

    if (shouldLog) {
      console.log(`[API ERROR] ${config?.method?.toUpperCase()} ${config?.url}`);
    }

    if (error.response) {
      if (shouldLog) {
        console.log('Status:', error.response.status);
      }

      // Token expired or invalid → auto logout
      if (error.response.status === 401) {
        const provider = error.response?.data?.provider;
        const isIntegration401 = provider === 'JIRA' || provider === 'GITHUB';

        if (!isIntegration401) {
          await AsyncStorage.removeItem('access_token');
          // The app will redirect to SignIn on next navigation or re-render
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
