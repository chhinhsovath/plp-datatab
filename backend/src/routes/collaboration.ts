import express from 'express';
import { authenticateToken } from '../lib/auth.js';
import { 
  collaborationService,
  CreateProjectSchema,
  InviteUserSchema,
  UpdatePermissionSchema,
  CreateCommentSchema,
  ArchiveProjectSchema
} from '../lib/collaboration-service.js';
import { getSocketService } from '../lib/socket-service.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Project Management Routes

// Create a new project
router.post('/projects', async (req, res) => {
  try {
    const validatedData = CreateProjectSchema.parse(req.body);
    const project = await collaborationService.createProject(req.user.userId, validatedData);
    
    res.status(201).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create project'
    });
  }
});

// Get user's projects
router.get('/projects', async (req, res) => {
  try {
    const projects = await collaborationService.getUserProjects(req.user.userId);
    
    res.json({
      success: true,
      data: projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects'
    });
  }
});

// Get specific project
router.get('/projects/:projectId', async (req, res) => {
  try {
    const project = await collaborationService.getProject(req.params.projectId, req.user.userId);
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch project'
    });
  }
});

// Update project
router.put('/projects/:projectId', async (req, res) => {
  try {
    const validatedData = CreateProjectSchema.partial().parse(req.body);
    const project = await collaborationService.updateProject(
      req.params.projectId,
      req.user.userId,
      validatedData
    );

    // Emit real-time update
    try {
      const socketService = getSocketService();
      socketService.emitToProject(req.params.projectId, 'project-updated', {
        project,
        user: req.user,
        timestamp: new Date().toISOString()
      });
    } catch (socketError) {
      console.warn('Failed to emit socket event:', socketError);
    }
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update project'
    });
  }
});

// Archive/unarchive project
router.patch('/projects/:projectId/archive', async (req, res) => {
  try {
    const validatedData = ArchiveProjectSchema.parse(req.body);
    const project = await collaborationService.archiveProject(
      req.params.projectId,
      req.user.userId,
      validatedData
    );
    
    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Archive project error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to archive project'
    });
  }
});

// User Invitation and Permission Management Routes

// Invite user to project
router.post('/projects/:projectId/invite', async (req, res) => {
  try {
    const validatedData = InviteUserSchema.parse(req.body);
    const collaborator = await collaborationService.inviteUser(
      req.params.projectId,
      req.user.userId,
      validatedData
    );

    // Emit real-time update
    try {
      const socketService = getSocketService();
      socketService.emitToProject(req.params.projectId, 'collaborator-added', {
        collaborator,
        inviter: req.user,
        timestamp: new Date().toISOString()
      });
    } catch (socketError) {
      console.warn('Failed to emit socket event:', socketError);
    }
    
    res.status(201).json({
      success: true,
      data: collaborator
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to invite user'
    });
  }
});

// Update user permissions
router.put('/projects/:projectId/collaborators/:userId', async (req, res) => {
  try {
    const validatedData = UpdatePermissionSchema.parse({
      userId: req.params.userId,
      role: req.body.role
    });
    const collaborator = await collaborationService.updateUserPermission(
      req.params.projectId,
      req.user.userId,
      validatedData
    );

    // Emit real-time update
    try {
      const socketService = getSocketService();
      socketService.emitToProject(req.params.projectId, 'collaborator-updated', {
        collaborator,
        updater: req.user,
        timestamp: new Date().toISOString()
      });
    } catch (socketError) {
      console.warn('Failed to emit socket event:', socketError);
    }
    
    res.json({
      success: true,
      data: collaborator
    });
  } catch (error) {
    console.error('Update permission error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update permissions'
    });
  }
});

// Remove collaborator
router.delete('/projects/:projectId/collaborators/:userId', async (req, res) => {
  try {
    await collaborationService.removeCollaborator(
      req.params.projectId,
      req.user.userId,
      req.params.userId
    );

    // Emit real-time update
    try {
      const socketService = getSocketService();
      socketService.emitToProject(req.params.projectId, 'collaborator-removed', {
        userId: req.params.userId,
        remover: req.user,
        timestamp: new Date().toISOString()
      });
    } catch (socketError) {
      console.warn('Failed to emit socket event:', socketError);
    }
    
    res.json({
      success: true,
      message: 'Collaborator removed successfully'
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove collaborator'
    });
  }
});

// Comments and Discussion Routes

// Create comment
router.post('/projects/:projectId/comments', async (req, res) => {
  try {
    const validatedData = CreateCommentSchema.parse(req.body);
    const comment = await collaborationService.createComment(
      req.params.projectId,
      req.user.userId,
      validatedData
    );
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create comment'
    });
  }
});

// Get project comments
router.get('/projects/:projectId/comments', async (req, res) => {
  try {
    const comments = await collaborationService.getProjectComments(
      req.params.projectId,
      req.user.userId
    );
    
    res.json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch comments'
    });
  }
});

// Update comment
router.put('/comments/:commentId', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const comment = await collaborationService.updateComment(
      req.params.commentId,
      req.user.userId,
      content
    );
    
    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update comment'
    });
  }
});

// Delete comment
router.delete('/comments/:commentId', async (req, res) => {
  try {
    await collaborationService.deleteComment(req.params.commentId, req.user.userId);
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(error instanceof Error && error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete comment'
    });
  }
});

// Activity Tracking Routes

// Get project activities
router.get('/projects/:projectId/activities', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const activities = await collaborationService.getProjectActivities(
      req.params.projectId,
      req.user.userId,
      limit
    );
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(error instanceof Error && error.message.includes('permission') ? 403 : 500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activities'
    });
  }
});

// Get user role in project
router.get('/projects/:projectId/role', async (req, res) => {
  try {
    const role = await collaborationService.getUserRole(req.params.projectId, req.user.userId);
    
    if (!role) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { role }
    });
  } catch (error) {
    console.error('Get user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user role'
    });
  }
});

export default router;