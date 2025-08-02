import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { collaborationService } from '../lib/collaboration-service.js';

const prisma = new PrismaClient();

describe('CollaborationService', () => {
  let testUser1: any;
  let testUser2: any;
  let testProject: any;

  beforeEach(async () => {
    // Clean up test data
    await prisma.activity.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.projectCollaborator.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();

    // Create test users
    testUser1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        name: 'Test User 1',
        passwordHash: 'hashedpassword1'
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        name: 'Test User 2',
        passwordHash: 'hashedpassword2'
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.activity.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.projectCollaborator.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('Project Management', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project'
      };

      const project = await collaborationService.createProject(testUser1.id, projectData);

      expect(project.name).toBe(projectData.name);
      expect(project.description).toBe(projectData.description);
      expect(project.ownerId).toBe(testUser1.id);
      expect(project.owner.id).toBe(testUser1.id);
    });

    it('should get user projects', async () => {
      // Create a project owned by user1
      const project1 = await collaborationService.createProject(testUser1.id, {
        name: 'Project 1'
      });

      // Create a project owned by user2 and invite user1
      const project2 = await collaborationService.createProject(testUser2.id, {
        name: 'Project 2'
      });

      await collaborationService.inviteUser(project2.id, testUser2.id, {
        email: testUser1.email,
        role: 'EDITOR'
      });

      const projects = await collaborationService.getUserProjects(testUser1.id);

      expect(projects).toHaveLength(2);
      expect(projects.some(p => p.id === project1.id)).toBe(true);
      expect(projects.some(p => p.id === project2.id)).toBe(true);
    });

    it('should update project details', async () => {
      const project = await collaborationService.createProject(testUser1.id, {
        name: 'Original Name'
      });

      const updatedProject = await collaborationService.updateProject(
        project.id,
        testUser1.id,
        { name: 'Updated Name', description: 'New description' }
      );

      expect(updatedProject.name).toBe('Updated Name');
      expect(updatedProject.description).toBe('New description');
    });

    it('should archive and unarchive project', async () => {
      const project = await collaborationService.createProject(testUser1.id, {
        name: 'Test Project'
      });

      // Archive project
      const archivedProject = await collaborationService.archiveProject(
        project.id,
        testUser1.id,
        { isArchived: true }
      );

      expect(archivedProject.isArchived).toBe(true);

      // Unarchive project
      const unarchivedProject = await collaborationService.archiveProject(
        project.id,
        testUser1.id,
        { isArchived: false }
      );

      expect(unarchivedProject.isArchived).toBe(false);
    });
  });

  describe('User Invitation and Permissions', () => {
    beforeEach(async () => {
      testProject = await collaborationService.createProject(testUser1.id, {
        name: 'Test Project'
      });
    });

    it('should invite user to project', async () => {
      const collaborator = await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'EDITOR' }
      );

      expect(collaborator.userId).toBe(testUser2.id);
      expect(collaborator.projectId).toBe(testProject.id);
      expect(collaborator.role).toBe('EDITOR');
      expect(collaborator.user.email).toBe(testUser2.email);
    });

    it('should not invite user twice', async () => {
      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'EDITOR' }
      );

      await expect(
        collaborationService.inviteUser(
          testProject.id,
          testUser1.id,
          { email: testUser2.email, role: 'VIEWER' }
        )
      ).rejects.toThrow('User is already a collaborator');
    });

    it('should update user permissions', async () => {
      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'VIEWER' }
      );

      const updatedCollaborator = await collaborationService.updateUserPermission(
        testProject.id,
        testUser1.id,
        { userId: testUser2.id, role: 'ADMIN' }
      );

      expect(updatedCollaborator.role).toBe('ADMIN');
    });

    it('should remove collaborator', async () => {
      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'EDITOR' }
      );

      const result = await collaborationService.removeCollaborator(
        testProject.id,
        testUser1.id,
        testUser2.id
      );

      expect(result.success).toBe(true);

      // Verify collaborator is removed
      const project = await collaborationService.getProject(testProject.id, testUser1.id);
      expect(project.collaborators).toHaveLength(0);
    });
  });

  describe('Comments and Discussions', () => {
    beforeEach(async () => {
      testProject = await collaborationService.createProject(testUser1.id, {
        name: 'Test Project'
      });

      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'EDITOR' }
      );
    });

    it('should create comment', async () => {
      const comment = await collaborationService.createComment(
        testProject.id,
        testUser1.id,
        { content: 'This is a test comment' }
      );

      expect(comment.content).toBe('This is a test comment');
      expect(comment.userId).toBe(testUser1.id);
      expect(comment.projectId).toBe(testProject.id);
      expect(comment.user.id).toBe(testUser1.id);
    });

    it('should create reply to comment', async () => {
      const parentComment = await collaborationService.createComment(
        testProject.id,
        testUser1.id,
        { content: 'Parent comment' }
      );

      const reply = await collaborationService.createComment(
        testProject.id,
        testUser2.id,
        { content: 'Reply comment', parentId: parentComment.id }
      );

      expect(reply.parentId).toBe(parentComment.id);
      expect(reply.content).toBe('Reply comment');
    });

    it('should get project comments', async () => {
      await collaborationService.createComment(
        testProject.id,
        testUser1.id,
        { content: 'Comment 1' }
      );

      await collaborationService.createComment(
        testProject.id,
        testUser2.id,
        { content: 'Comment 2' }
      );

      const comments = await collaborationService.getProjectComments(
        testProject.id,
        testUser1.id
      );

      expect(comments).toHaveLength(2);
      expect(comments.some(c => c.content === 'Comment 1')).toBe(true);
      expect(comments.some(c => c.content === 'Comment 2')).toBe(true);
    });

    it('should update comment', async () => {
      const comment = await collaborationService.createComment(
        testProject.id,
        testUser1.id,
        { content: 'Original content' }
      );

      const updatedComment = await collaborationService.updateComment(
        comment.id,
        testUser1.id,
        'Updated content'
      );

      expect(updatedComment.content).toBe('Updated content');
    });

    it('should delete comment', async () => {
      const comment = await collaborationService.createComment(
        testProject.id,
        testUser1.id,
        { content: 'To be deleted' }
      );

      const result = await collaborationService.deleteComment(comment.id, testUser1.id);
      expect(result.success).toBe(true);

      // Verify comment is deleted
      const comments = await collaborationService.getProjectComments(
        testProject.id,
        testUser1.id
      );
      expect(comments.some(c => c.id === comment.id)).toBe(false);
    });
  });

  describe('Permission Checking', () => {
    beforeEach(async () => {
      testProject = await collaborationService.createProject(testUser1.id, {
        name: 'Test Project'
      });
    });

    it('should allow owner all permissions', async () => {
      await expect(
        collaborationService.checkProjectPermission(testProject.id, testUser1.id, 'ADMIN')
      ).resolves.toBe(true);
    });

    it('should check collaborator permissions correctly', async () => {
      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'VIEWER' }
      );

      // Viewer should have viewer permission
      await expect(
        collaborationService.checkProjectPermission(testProject.id, testUser2.id, 'VIEWER')
      ).resolves.toBe(true);

      // Viewer should not have editor permission
      await expect(
        collaborationService.checkProjectPermission(testProject.id, testUser2.id, 'EDITOR')
      ).rejects.toThrow('Insufficient permissions');
    });

    it('should deny access to non-collaborators', async () => {
      await expect(
        collaborationService.checkProjectPermission(testProject.id, testUser2.id, 'VIEWER')
      ).rejects.toThrow('Access denied');
    });

    it('should get user role correctly', async () => {
      // Owner role
      const ownerRole = await collaborationService.getUserRole(testProject.id, testUser1.id);
      expect(ownerRole).toBe('OWNER');

      // Collaborator role
      await collaborationService.inviteUser(
        testProject.id,
        testUser1.id,
        { email: testUser2.email, role: 'EDITOR' }
      );

      const collaboratorRole = await collaborationService.getUserRole(testProject.id, testUser2.id);
      expect(collaboratorRole).toBe('EDITOR');

      // No access
      const testUser3 = await prisma.user.create({
        data: {
          email: 'user3@test.com',
          name: 'Test User 3',
          passwordHash: 'hashedpassword3'
        }
      });

      const noRole = await collaborationService.getUserRole(testProject.id, testUser3.id);
      expect(noRole).toBeNull();
    });
  });

  describe('Activity Tracking', () => {
    beforeEach(async () => {
      testProject = await collaborationService.createProject(testUser1.id, {
        name: 'Test Project'
      });
    });

    it('should log activity', async () => {
      await collaborationService.logActivity(
        testUser1.id,
        testProject.id,
        'DATASET_UPLOADED',
        { datasetName: 'test.csv' }
      );

      const activities = await collaborationService.getProjectActivities(
        testProject.id,
        testUser1.id
      );

      expect(activities).toHaveLength(2); // PROJECT_CREATED + DATASET_UPLOADED
      expect(activities[0].type).toBe('DATASET_UPLOADED');
      expect(activities[0].details.datasetName).toBe('test.csv');
    });

    it('should get project activities with limit', async () => {
      // Create multiple activities
      for (let i = 0; i < 5; i++) {
        await collaborationService.logActivity(
          testUser1.id,
          testProject.id,
          'COMMENT_ADDED',
          { commentId: `comment-${i}` }
        );
      }

      const activities = await collaborationService.getProjectActivities(
        testProject.id,
        testUser1.id,
        3
      );

      expect(activities).toHaveLength(3);
    });
  });
});