import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataApi, authApi } from '../services/api';
// import { Dataset } from '../types/data';
import { LoginCredentials, RegisterCredentials } from '../types/auth';

// Auth hooks
export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authApi.login(credentials),
  });
};

export const useRegister = () => {
  return useMutation({
    mutationFn: (credentials: RegisterCredentials) => authApi.register(credentials),
  });
};

// Data hooks
export const useDatasets = () => {
  return useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const response = await dataApi.getDatasets();
      return response.data.data;
    },
  });
};

export const useDataset = (id: string) => {
  return useQuery({
    queryKey: ['dataset', id],
    queryFn: async () => {
      const response = await dataApi.getDataset(id);
      return response.data.data;
    },
    enabled: !!id,
  });
};

export const useUploadFile = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }) =>
      dataApi.uploadFile(file, onProgress),
    onSuccess: () => {
      // Invalidate datasets query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
};

export const useDeleteDataset = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => dataApi.deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    },
  });
};