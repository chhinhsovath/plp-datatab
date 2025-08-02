import { PrismaClient, CollaboratorRole, ActivityType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const InviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']),
});

export const UpdatePermissionSchema = z.object({
  userId: z.string(),
  role: z.enum(['VIEWER', 'EDITOR', 'ADMIN']),
});

export const CreateCommentSchema = z.object({
  content: z.string().min(1),
  parentId: z.string().optional(),
});

export const ArchiveProjectSchema = z.object({
  isArchived: z.boolean(),
});

export type CreateProjectData = z.infer<typeof CreateProjectSchema>;
export type InviteUserData = z.infer<typeof InviteUserSchema>;
export type UpdatePermissionData = z.infer<typeof UpdatePermissionSchema>;
export type CreateCommentData = z.infer<typeof CreateCommentSchema>;
export type ArchiveProjectData = z.infer<typeof ArchiveProjectSchema>;

export class CollaborationService {
  // Project Management
  async createProject(userId: string, data: CreateProjectData) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: userId,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            datasets: true,
            analyses: true,
            reports: true
          }
        }
      }
    });

    // Log activity
    await this.logActivity(userId, project.id, ActivityType.PROJECT_CREATED, {
      projectName: project.name
    });

    return project;
  }

  async getProject(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } }
        ]
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        datasets: {
          select: {
            id: true,
            name: true,
            fileSize: true,
            uploadedAt: true
          }
        },
        analyses: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            createdAt: true
          }
        },
        reports: {
          select: {
            id: true,
            title: true,
            version: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            datasets: true,
            analyses: true,
            reports: true,
            comments: true
          }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    return project;
  }

  async getUserProjects(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { collaborators: { some: { userId } } }
        ],
        isArchived: false
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            datasets: true,
            analyses: true,
            reports: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return projects;
  }

  async updateProject(projectId: string, userId: string, data: Partial<CreateProjectData>) {
    // Check permissions
    await this.checkProjectPermission(projectId, userId, 'EDITOR');

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        description: data.description,
        updatedAt: new Date()
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        collaborators: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    // Log activity
    await this.logActivity(userId, projectId, ActivityType.PROJECT_UPDATED, {
      changes: data
    });

    return project;
  }

  async archiveProject(projectId: string, userId: string, data: ArchiveProjectData) {
    // Check if user is owner or admin
    await this.checkProjectPermission(projectId, userId, 'ADMIN');

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        isArchived: data.isArchived,
        updatedAt: new Date()
      }
    });

    return project;
  }

  // User Invitation and Permission Management
  async inviteUser(projectId: string, inviterId: string, data: InviteUserData) {
    // Check if inviter has admin permissions
    await this.checkProjectPermission(projectId, inviterId, 'ADMIN');

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a collaborator
    const existingCollaborator = await prisma.projectCollaborator.findUnique({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId
        }
      }
    });

    if (existingCollaborator) {
      throw new Error('User is already a collaborator');
    }

    // Add collaborator
    const collaborator = await prisma.projectCollaborator.create({
      data: {
        userId: user.id,
        projectId,
        role: data.role as CollaboratorRole
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Log activity
    await this.logActivity(inviterId, projectId, ActivityType.USER_INVITED, {
      invitedUser: user.email,
      role: data.role
    });

    return collaborator;
  }

  async updateUserPermission(projectId: string, adminId: string, data: UpdatePermissionData) {
    // Check if admin has admin permissions
    await this.checkProjectPermission(projectId, adminId, 'ADMIN');

    const collaborator = await prisma.projectCollaborator.update({
      where: {
        userId_projectId: {
          userId: data.userId,
          projectId
        }
      },
      data: {
        role: data.role as CollaboratorRole
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return collaborator;
  }

  async removeCollaborator(projectId: string, adminId: string, userId: string) {
    // Check if admin has admin permissions
    await this.checkProjectPermission(projectId, adminId, 'ADMIN');

    await prisma.projectCollaborator.delete({
      where: {
        userId_projectId: {
          userId,
          projectId
        }
      }
    });

    return { success: true };
  }

  // Comments and Discussions
  async createComment(projectId: string, userId: string, data: CreateCommentData) {
    // Check if user has access to project
    await this.checkProjectPermission(projectId, userId, 'VIEWER');

    const comment = await prisma.comment.create({
      data: {
        content: data.content,
        userId,
        projectId,
        parentId: data.parentId
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    // Log activity
    await this.logActivity(userId, projectId, ActivityType.COMMENT_ADDED, {
      commentId: comment.id,
      isReply: !!data.parentId
    });

    return comment;
  }

  async getProjectComments(projectId: string, userId: string) {
    // Check if user has access to project
    await this.checkProjectPermission(projectId, userId, 'VIEWER');

    const comments = await prisma.comment.findMany({
      where: {
        projectId,
        parentId: null // Only get top-level comments
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return comments;
  }

  async updateComment(commentId: string, userId: string, content: string) {
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        userId // Only allow user to update their own comments
      }
    });

    if (!comment) {
      throw new Error('Comment not found or access denied');
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return updatedComment;
  }

  async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findFirst({
      where: {
        id: commentId,
        userId // Only allow user to delete their own comments
      }
    });

    if (!comment) {
      throw new Error('Comment not found or access denied');
    }

    await prisma.comment.delete({
      where: { id: commentId }
    });

    return { success: true };
  }

  // Activity Tracking
  async logActivity(userId: string, projectId: string, type: ActivityType, details: any) {
    await prisma.activity.create({
      data: {
        type,
        details,
        userId,
        projectId
      }
    });
  }

  async getProjectActivities(projectId: string, userId: string, limit = 50) {
    // Check if user has access to project
    await this.checkProjectPermission(projectId, userId, 'VIEWER');

    const activities = await prisma.activity.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return activities;
  }

  // Permission Checking
  async checkProjectPermission(projectId: string, userId: string, requiredRole: 'VIEWER' | 'EDITOR' | 'ADMIN') {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: { userId }
        }
      }
    });

    if (!project) {
      throw new Error('Project not found');
    }

    // Check if user is owner
    if (project.ownerId === userId) {
      return true; // Owner has all permissions
    }

    // Check if user is collaborator
    const collaborator = project.collaborators[0];
    if (!collaborator) {
      throw new Error('Access denied');
    }

    // Check role hierarchy
    const roleHierarchy = { VIEWER: 1, EDITOR: 2, ADMIN: 3 };
    const userRoleLevel = roleHierarchy[collaborator.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      throw new Error('Insufficient permissions');
    }

    return true;
  }

  async getUserRole(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        collaborators: {
          where: { userId }
        }
      }
    });

    if (!project) {
      return null;
    }

    // Check if user is owner
    if (project.ownerId === userId) {
      return 'OWNER';
    }

    // Check if user is collaborator
    const collaborator = project.collaborators[0];
    return collaborator?.role || null;
  }
}

export const collaborationService = new CollaborationService();