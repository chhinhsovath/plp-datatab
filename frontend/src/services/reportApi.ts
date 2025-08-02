import { api } from './api';
import {
  Report,
  ReportVersion,
  ReportExportOptions,
  CreateReportRequest,
  UpdateReportRequest,
  GenerateReportRequest,
  AddCollaboratorRequest,
  CreateVersionRequest
} from '../types/report';

export const reportApi = {
  // Create a new report
  createReport: async (data: CreateReportRequest): Promise<Report> => {
    const response = await api.post('/reports', data);
    return response.data;
  },

  // Get reports for a project
  getProjectReports: async (projectId: string): Promise<Report[]> => {
    const response = await api.get(`/reports/project/${projectId}`);
    return response.data;
  },

  // Get a specific report
  getReport: async (reportId: string): Promise<Report> => {
    const response = await api.get(`/reports/${reportId}`);
    return response.data;
  },

  // Update a report
  updateReport: async (reportId: string, data: UpdateReportRequest): Promise<Report> => {
    const response = await api.put(`/reports/${reportId}`, data);
    return response.data;
  },

  // Delete a report
  deleteReport: async (reportId: string): Promise<void> => {
    await api.delete(`/reports/${reportId}`);
  },

  // Generate report from analysis
  generateFromAnalysis: async (analysisId: string, data: GenerateReportRequest): Promise<Report> => {
    const response = await api.post(`/reports/generate/${analysisId}`, data);
    return response.data;
  },

  // Export report
  exportReport: async (reportId: string, options: ReportExportOptions): Promise<Blob> => {
    const response = await api.post(`/reports/${reportId}/export`, options, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Add collaborator
  addCollaborator: async (reportId: string, data: AddCollaboratorRequest): Promise<void> => {
    await api.post(`/reports/${reportId}/collaborators`, data);
  },

  // Remove collaborator
  removeCollaborator: async (reportId: string, userId: string): Promise<void> => {
    await api.delete(`/reports/${reportId}/collaborators/${userId}`);
  },

  // Get report versions
  getReportVersions: async (reportId: string): Promise<ReportVersion[]> => {
    const response = await api.get(`/reports/${reportId}/versions`);
    return response.data;
  },

  // Create new version
  createVersion: async (reportId: string, data: CreateVersionRequest): Promise<ReportVersion> => {
    const response = await api.post(`/reports/${reportId}/versions`, data);
    return response.data;
  },

  // Restore version
  restoreVersion: async (reportId: string, versionId: string): Promise<Report> => {
    const response = await api.post(`/reports/${reportId}/versions/${versionId}/restore`);
    return response.data;
  }
};

// Helper function to download exported report
export const downloadReport = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};