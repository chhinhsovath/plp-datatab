import { api } from './api';
import type {
  Project,
  Comment,
  Activity,
  CreateProjectRequest,
  InviteUserRequest,
  UpdatePermissionRequest,
  CreateCommentRequest,
  ArchiveProjectRequest,
  ProjectCollaborator,
  UserRole
} from '../types/collaboration';

export const collaborationApi = {
  // Project Management
  async createProject(data: CreateProjectRequest): Promise<Project> {
    const response = await api.post('/collaboration/projects', data);
    return response.data.data;
  },

  async getProjects(): Promise<Project[]> {
    const response = await api.get('/collaboration/projects');
    return response.data.data;
  },

  async getProject(projectId: string): Promise<Project> {
    const response = await api.get(`/collaboration/projects/${projectId}`);
    return response.data.data;
  },

  async updateProject(projectId: string, data: Partial<CreateProjectRequest>): Promise<Project> {
    const response = await api.put(`/collaboration/projects/${projectId}`, data);
    return response.data.data;
  },

  async archiveProject(projectId: string, data: ArchiveProjectRequest): Promise<Project> {
    const response = await api.patch(`/collaboration/projects/${projectId}/archive`, data);
    return response.data.data;
  },

  // User Invitation and Permission Management
  async inviteUser(projectId: string, data: InviteUserRequest): Promise<ProjectCollaborator> {
    const response = await api.post(`/collaboration/projects/${projectId}/invite`, data);
    return response.data.data;
  },

  async updateUserPermission(
    projectId: string, 
    userId: string, 
    data: UpdatePermissionRequest
  ): Promise<ProjectCollaborator> {
    const response = await api.put(`/collaboration/projects/${projectId}/collaborators/${userId}`, data);
    return response.data.data;
  },

  async removeCollaborator(projectId: string, userId: string): Promise<void> {
    await api.delete(`/collaboration/projects/${projectId}/collaborators/${userId}`);
  },

  // Comments and Discussions
  async createComment(projectId: string, data: CreateCommentRequest): Promise<Comment> {
    const response = await api.post(`/collaboration/projects/${projectId}/comments`, data);
    return response.data.data;
  },

  async getProjectComments(projectId: string): Promise<Comment[]> {
    const response = await api.get(`/collaboration/projects/${projectId}/comments`);
    return response.data.data;
  },

  async updateComment(commentId: string, content: string): Promise<Comment> {
    const response = await api.put(`/collaboration/comments/${commentId}`, { content });
    return response.data.data;
  },

  async deleteComment(commentId: string): Promise<void> {
    await api.delete(`/collaboration/comments/${commentId}`);
  },

  // Activity Tracking
  async getProjectActivities(projectId: string, limit?: number): Promise<Activity[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await api.get(`/collaboration/projects/${projectId}/activities`, { params });
    return response.data.data;
  },

  // User Role
  async getUserRole(projectId: string): Promise<UserRole> {
    const response = await api.get(`/collaboration/projects/${projectId}/role`);
    return response.data.data.role;
  }
};