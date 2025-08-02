import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import collaborationRoutes from '../routes/collaboration.js';

const prisma = new PrismaClient();

// Create test app
const app = express();
app.use(express.json());
app.use('/api/collaboration', collaborationRoutes);

describe('Collaboration API', () => {
  let testUser1: any;
  let testUser2: any;
  let authToken1: string;
  let authToken2: string;

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

    // Create auth tokens
    authToken1 = jwt.sign(
      { userId: testUser1.id, email: testUser1.email },
      process.env.JWT_SECRET || 'test-secret'
    );

    authToken2 = jwt.sign(
      { userId: testUser2.id, email: testUser2.email },
      process.env.JWT_SECRET || 'test-secret'
    );
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.activity.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.projectCollaborator.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  });

  describe('POST /api/collaboration/projects', () => {
    it('should create a new project', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project'
      };

      const response = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .send(projectData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(projectData.name);
      expect(response.body.data.description).toBe(projectData.description);
      expect(response.body.data.ownerId).toBe(testUser1.id);
    });

    it('should require authentication', async () => {
      const projectData = {
        name: 'Test Project'
      };

      await request(app)
        .post('/api/collaboration/projects')
        .send(projectData)
        .expect(401);
    });

    it('should validate project data', async () => {
      const response = await request(app)
        .post('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .send({}) // Empty data
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/collaboration/projects', () => {
    it('should get user projects', async () => {
      // Create a project
      const project = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });

      const response = await request(app)
        .get('/api/collaboration/projects')
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe(project.id);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/collaboration/projects')
        .expect(401);
    });
  });

  describe('GET /api/collaboration/projects/:projectId', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });
    });

    it('should get project details', async () => {
      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testProject.id);
      expect(response.body.data.name).toBe('Test Project');
    });

    it('should deny access to non-collaborators', async () => {
      await request(app)
        .get(`/api/collaboration/projects/${testProject.id}`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(404);
    });
  });

  describe('POST /api/collaboration/projects/:projectId/invite', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });
    });

    it('should invite user to project', async () => {
      const inviteData = {
        email: testUser2.email,
        role: 'EDITOR'
      };

      const response = await request(app)
        .post(`/api/collaboration/projects/${testProject.id}/invite`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(inviteData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe(testUser2.id);
      expect(response.body.data.role).toBe('EDITOR');
    });

    it('should require admin permissions', async () => {
      // Add user2 as viewer
      await prisma.projectCollaborator.create({
        data: {
          userId: testUser2.id,
          projectId: testProject.id,
          role: 'VIEWER'
        }
      });

      const inviteData = {
        email: 'newuser@test.com',
        role: 'EDITOR'
      };

      await request(app)
        .post(`/api/collaboration/projects/${testProject.id}/invite`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send(inviteData)
        .expect(403);
    });
  });

  describe('POST /api/collaboration/projects/:projectId/comments', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });

      // Add user2 as collaborator
      await prisma.projectCollaborator.create({
        data: {
          userId: testUser2.id,
          projectId: testProject.id,
          role: 'EDITOR'
        }
      });
    });

    it('should create comment', async () => {
      const commentData = {
        content: 'This is a test comment'
      };

      const response = await request(app)
        .post(`/api/collaboration/projects/${testProject.id}/comments`)
        .set('Authorization', `Bearer ${authToken1}`)
        .send(commentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(commentData.content);
      expect(response.body.data.userId).toBe(testUser1.id);
    });

    it('should create reply to comment', async () => {
      // Create parent comment
      const parentComment = await prisma.comment.create({
        data: {
          content: 'Parent comment',
          userId: testUser1.id,
          projectId: testProject.id
        }
      });

      const replyData = {
        content: 'Reply comment',
        parentId: parentComment.id
      };

      const response = await request(app)
        .post(`/api/collaboration/projects/${testProject.id}/comments`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send(replyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.parentId).toBe(parentComment.id);
    });

    it('should require project access', async () => {
      // Create project without user2 access
      const privateProject = await prisma.project.create({
        data: {
          name: 'Private Project',
          ownerId: testUser1.id
        }
      });

      const commentData = {
        content: 'This should fail'
      };

      await request(app)
        .post(`/api/collaboration/projects/${privateProject.id}/comments`)
        .set('Authorization', `Bearer ${authToken2}`)
        .send(commentData)
        .expect(403);
    });
  });

  describe('GET /api/collaboration/projects/:projectId/comments', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });

      // Add user2 as collaborator
      await prisma.projectCollaborator.create({
        data: {
          userId: testUser2.id,
          projectId: testProject.id,
          role: 'VIEWER'
        }
      });

      // Create test comments
      await prisma.comment.create({
        data: {
          content: 'Comment 1',
          userId: testUser1.id,
          projectId: testProject.id
        }
      });

      await prisma.comment.create({
        data: {
          content: 'Comment 2',
          userId: testUser2.id,
          projectId: testProject.id
        }
      });
    });

    it('should get project comments', async () => {
      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/comments`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should require project access', async () => {
      // Create project without user access
      const privateProject = await prisma.project.create({
        data: {
          name: 'Private Project',
          ownerId: testUser1.id
        }
      });

      await request(app)
        .get(`/api/collaboration/projects/${privateProject.id}/comments`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(403);
    });
  });

  describe('GET /api/collaboration/projects/:projectId/activities', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });

      // Create test activities
      await prisma.activity.create({
        data: {
          type: 'PROJECT_CREATED',
          details: { projectName: 'Test Project' },
          userId: testUser1.id,
          projectId: testProject.id
        }
      });

      await prisma.activity.create({
        data: {
          type: 'DATASET_UPLOADED',
          details: { datasetName: 'test.csv' },
          userId: testUser1.id,
          projectId: testProject.id
        }
      });
    });

    it('should get project activities', async () => {
      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/activities`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/activities?limit=1`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/collaboration/projects/:projectId/role', () => {
    let testProject: any;

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          name: 'Test Project',
          ownerId: testUser1.id
        }
      });
    });

    it('should get owner role', async () => {
      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/role`)
        .set('Authorization', `Bearer ${authToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('OWNER');
    });

    it('should get collaborator role', async () => {
      // Add user2 as editor
      await prisma.projectCollaborator.create({
        data: {
          userId: testUser2.id,
          projectId: testProject.id,
          role: 'EDITOR'
        }
      });

      const response = await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/role`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('EDITOR');
    });

    it('should deny access to non-collaborators', async () => {
      await request(app)
        .get(`/api/collaboration/projects/${testProject.id}/role`)
        .set('Authorization', `Bearer ${authToken2}`)
        .expect(403);
    });
  });
});