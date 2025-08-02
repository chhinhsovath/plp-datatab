export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner: User;
  collaborators: ProjectCollaborator[];
  datasets?: Dataset[];
  analyses?: Analysis[];
  reports?: Report[];
  _count: {
    datasets: number;
    analyses: number;
    reports: number;
    comments?: number;
  };
}

export interface ProjectCollaborator {
  id: string;
  userId: string;
  projectId: string;
  role: CollaboratorRole;
  joinedAt: string;
  user: User;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  projectId: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  replies?: Comment[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  details: any;
  userId: string;
  projectId: string;
  createdAt: string;
  user: User;
}

export interface Dataset {
  id: string;
  name: string;
  fileSize: number;
  uploadedAt: string;
}

export interface Analysis {
  id: string;
  name: string;
  type: string;
  status: AnalysisStatus;
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  version: number;
  createdAt: string;
}

export type CollaboratorRole = 'VIEWER' | 'EDITOR' | 'ADMIN';
export type UserRole = CollaboratorRole | 'OWNER';

export type ActivityType = 
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'DATASET_UPLOADED'
  | 'ANALYSIS_CREATED'
  | 'ANALYSIS_COMPLETED'
  | 'REPORT_GENERATED'
  | 'USER_INVITED'
  | 'COMMENT_ADDED';

export type AnalysisStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

// API Request/Response types
export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface InviteUserRequest {
  email: string;
  role: CollaboratorRole;
}

export interface UpdatePermissionRequest {
  role: CollaboratorRole;
}

export interface CreateCommentRequest {
  content: string;
  parentId?: string;
}

export interface ArchiveProjectRequest {
  isArchived: boolean;
}

// Socket.io event types
export interface SocketEvents {
  // Connection events
  'join-project': (projectId: string) => void;
  'leave-project': (projectId: string) => void;
  'user-joined': (data: { user: User; timestamp: string }) => void;
  'user-left': (data: { user: User; timestamp: string }) => void;
  'connected-users': (users: User[]) => void;

  // Comment events
  'new-comment': (data: { projectId: string; content: string; parentId?: string }) => void;
  'comment-created': (comment: Comment) => void;

  // Activity events
  'activity-update': (data: { projectId: string; activity: any }) => void;
  'activity-updated': (data: { activity: any; user: User; timestamp: string }) => void;

  // Project events
  'project-updated': (data: { project: Project; user: User; timestamp: string }) => void;
  'collaborator-added': (data: { collaborator: ProjectCollaborator; inviter: User; timestamp: string }) => void;
  'collaborator-updated': (data: { collaborator: ProjectCollaborator; updater: User; timestamp: string }) => void;
  'collaborator-removed': (data: { userId: string; remover: User; timestamp: string }) => void;

  // Data events
  'dataset-uploaded': (data: { dataset: any; user: User; timestamp: string }) => void;
  'dataset-updated': (data: { dataset: any; user: User; timestamp: string }) => void;

  // Analysis events
  'analysis-started': (data: { projectId: string; analysis: any }) => void;
  'analysis-completed': (data: { projectId: string; analysis: any }) => void;
  'analysis-status-changed': (data: { analysis: any; status: string; user: User; timestamp: string }) => void;

  // Report events
  'report-updated': (data: { projectId: string; report: any }) => void;
  'report-changed': (data: { report: any; user: User; timestamp: string }) => void;

  // Typing indicators
  'typing-start': (data: { projectId: string }) => void;
  'typing-stop': (data: { projectId: string }) => void;
  'user-typing': (data: { user: User; timestamp: string }) => void;
  'user-stopped-typing': (data: { user: User; timestamp: string }) => void;

  // Error events
  'error': (data: { message: string }) => void;
}

// Permission helpers
export const canEditProject = (role: UserRole): boolean => {
  return ['OWNER', 'ADMIN', 'EDITOR'].includes(role);
};

export const canManageCollaborators = (role: UserRole): boolean => {
  return ['OWNER', 'ADMIN'].includes(role);
};

export const canArchiveProject = (role: UserRole): boolean => {
  return ['OWNER', 'ADMIN'].includes(role);
};

export const getRoleDisplayName = (role: UserRole): string => {
  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'EDITOR':
      return 'Editor';
    case 'VIEWER':
      return 'Viewer';
    default:
      return role;
  }
};

export const getRoleColor = (role: UserRole): string => {
  switch (role) {
    case 'OWNER':
      return 'primary';
    case 'ADMIN':
      return 'secondary';
    case 'EDITOR':
      return 'success';
    case 'VIEWER':
      return 'info';
    default:
      return 'default';
  }
};