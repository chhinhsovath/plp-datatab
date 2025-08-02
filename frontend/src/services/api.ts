import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { ApiResponse } from '../types/api';
import { LoginCredentials, RegisterCredentials, AuthResponse } from '../types/auth';
import { Dataset, FileUploadResponse } from '../types/data';

const API_BASE_URL = (import.meta.env?.VITE_API_URL as string) || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Clear auth data on unauthorized
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.get(url);
  }

  async post<T>(url: string, data?: any): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.post(url, data);
  }

  async put<T>(url: string, data?: any): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.put(url, data);
  }

  async delete<T>(url: string): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.client.delete(url);
  }

  async uploadFile(url: string, formData: FormData, onProgress?: (progress: number) => void): Promise<AxiosResponse<ApiResponse<FileUploadResponse>>> {
    return this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
  }
}

const apiClient = new ApiClient();

// Auth API
export const authApi = {
  login: (credentials: LoginCredentials) => 
    apiClient.post<AuthResponse>('/auth/login', credentials),
  
  register: (credentials: RegisterCredentials) => 
    apiClient.post<AuthResponse>('/auth/register', credentials),
  
  logout: () => 
    apiClient.post('/auth/logout'),
  
  refreshToken: () => 
    apiClient.post<AuthResponse>('/auth/refresh'),
};

// Data API
export const dataApi = {
  uploadFile: (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.uploadFile('/data/upload', formData, onProgress);
  },
  
  getDatasets: () => 
    apiClient.get<Dataset[]>('/data/datasets'),
  
  getDataset: (id: string) => 
    apiClient.get<Dataset>(`/data/datasets/${id}`),
  
  deleteDataset: (id: string) => 
    apiClient.delete(`/data/datasets/${id}`),
};

export default apiClient;