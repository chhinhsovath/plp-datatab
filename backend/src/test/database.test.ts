import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { checkDatabaseConnection, withTransaction } from '../lib/database.js';
import { CollaboratorRole, AnalysisType, AnalysisStatus, VisualizationType, ActivityType } from '../types/database.js';

const prisma = new PrismaClient();

describe('Database Models', () => {
  beforeAll(async () => {
    // Clean up test data before running tests
    await cleanupTestData();
  });

  afterAll(async () => {
    // Clean up test data after running tests
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up before each test
    await cleanupTestData();
  });

  async function cleanupTestData() {
    // Delete in reverse dependency order
    await prisma.activity.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.comment.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.report.deleteMany({ where: { project: { owner: { email: { contains: 'test' } } } } });
    await prisma.visualization.deleteMany({ where: { project: { owner: { email: { contains: 'test' } } } } });
    await prisma.analysis.deleteMany({ where: { project: { owner: { email: { contains: 'test' } } } } });
    await prisma.dataset.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.projectCollaborator.deleteMany({ where: { user: { email: { contains: 'test' } } } });
    await prisma.project.deleteMany({ where: { owner: { email: { contains: 'test' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'test' } } });
  }

  it('should connect to database', async () => {
    const isConnected = await checkDatabaseConnection();
    expect(isConnected).toBe(true);
  });

  it('should create and retrieve a user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed_password'
    };

    const user = await prisma.user.create({
      data: userData
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe(userData.email);
    expect(user.name).toBe(userData.name);
    expect(user.createdAt).toBeInstanceOf(Date);

    const retrievedUser = await prisma.user.findUnique({
      where: { id: user.id }
    });

    expect(retrievedUser).toBeTruthy();
    expect(retrievedUser?.email).toBe(userData.email);
  });

  it('should create a project with owner relationship', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-project@example.com',
        name: 'Project Owner',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Test Project',
        description: 'A test project',
        ownerId: user.id
      },
      include: {
        owner: true
      }
    });

    expect(project.id).toBeDefined();
    expect(project.name).toBe('Test Project');
    expect(project.owner.email).toBe(user.email);
    expect(project.isArchived).toBe(false);
  });

  it('should create project collaborators with roles', async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'test-owner@example.com',
        name: 'Project Owner',
        passwordHash: 'hashed_password'
      }
    });

    const collaborator = await prisma.user.create({
      data: {
        email: 'test-collaborator@example.com',
        name: 'Collaborator',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Collaborative Project',
        ownerId: owner.id
      }
    });

    const collaboration = await prisma.projectCollaborator.create({
      data: {
        userId: collaborator.id,
        projectId: project.id,
        role: CollaboratorRole.EDITOR
      },
      include: {
        user: true,
        project: true
      }
    });

    expect(collaboration.role).toBe(CollaboratorRole.EDITOR);
    expect(collaboration.user.email).toBe(collaborator.email);
    expect(collaboration.project.name).toBe(project.name);
  });

  it('should create a dataset with metadata', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-dataset@example.com',
        name: 'Data User',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Data Project',
        ownerId: user.id
      }
    });

    const datasetMetadata = {
      columns: [
        {
          name: 'age',
          dataType: 'numeric',
          missingValues: 0,
          uniqueValues: 50
        },
        {
          name: 'gender',
          dataType: 'categorical',
          missingValues: 2,
          uniqueValues: 2
        }
      ],
      rowCount: 100,
      fileType: 'csv',
      hasHeader: true,
      importedAt: new Date().toISOString(),
      originalFileName: 'test_data.csv'
    };

    const dataset = await prisma.dataset.create({
      data: {
        name: 'Test Dataset',
        filePath: '/uploads/test_data.csv',
        fileSize: 1024,
        metadata: datasetMetadata,
        userId: user.id,
        projectId: project.id
      }
    });

    expect(dataset.id).toBeDefined();
    expect(dataset.name).toBe('Test Dataset');
    expect(dataset.metadata).toEqual(datasetMetadata);
    expect(dataset.fileSize).toBe(1024);
  });

  it('should create an analysis with results', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-analysis@example.com',
        name: 'Analyst',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Analysis Project',
        ownerId: user.id
      }
    });

    const dataset = await prisma.dataset.create({
      data: {
        name: 'Analysis Dataset',
        filePath: '/uploads/analysis_data.csv',
        fileSize: 2048,
        metadata: { columns: [], rowCount: 50, fileType: 'csv', hasHeader: true, importedAt: new Date().toISOString(), originalFileName: 'analysis_data.csv' },
        userId: user.id,
        projectId: project.id
      }
    });

    const analysisParameters = {
      variables: ['age', 'score'],
      options: { confidenceLevel: 0.95 },
      alpha: 0.05
    };

    const analysisResults = {
      testStatistic: 2.45,
      pValue: 0.014,
      confidenceInterval: [1.2, 3.8],
      interpretation: 'Significant difference found',
      assumptions: [
        {
          name: 'Normality',
          test: 'Shapiro-Wilk',
          result: 'passed',
          pValue: 0.12,
          message: 'Data appears normally distributed'
        }
      ],
      summary: 'The t-test shows a significant difference between groups'
    };

    const analysis = await prisma.analysis.create({
      data: {
        name: 'T-Test Analysis',
        type: AnalysisType.TTEST,
        parameters: analysisParameters,
        results: analysisResults,
        status: AnalysisStatus.COMPLETED,
        datasetId: dataset.id,
        projectId: project.id
      }
    });

    expect(analysis.id).toBeDefined();
    expect(analysis.type).toBe(AnalysisType.TTEST);
    expect(analysis.status).toBe(AnalysisStatus.COMPLETED);
    expect(analysis.parameters).toEqual(analysisParameters);
    expect(analysis.results).toEqual(analysisResults);
  });

  it('should create a visualization linked to analysis', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-viz@example.com',
        name: 'Visualizer',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Visualization Project',
        ownerId: user.id
      }
    });

    const dataset = await prisma.dataset.create({
      data: {
        name: 'Viz Dataset',
        filePath: '/uploads/viz_data.csv',
        fileSize: 1500,
        metadata: { columns: [], rowCount: 75, fileType: 'csv', hasHeader: true, importedAt: new Date().toISOString(), originalFileName: 'viz_data.csv' },
        userId: user.id,
        projectId: project.id
      }
    });

    const analysis = await prisma.analysis.create({
      data: {
        name: 'Correlation Analysis',
        type: AnalysisType.CORRELATION,
        parameters: { variables: ['x', 'y'] },
        status: AnalysisStatus.COMPLETED,
        datasetId: dataset.id,
        projectId: project.id
      }
    });

    const vizConfig = {
      chartType: 'scatter',
      data: { x: 'variable1', y: 'variable2' },
      styling: { title: 'Correlation Plot', colors: ['#1f77b4'] },
      interactivity: { tooltip: true, zoom: true }
    };

    const visualization = await prisma.visualization.create({
      data: {
        name: 'Scatter Plot',
        type: VisualizationType.SCATTER,
        config: vizConfig,
        analysisId: analysis.id,
        projectId: project.id
      },
      include: {
        analysis: true
      }
    });

    expect(visualization.id).toBeDefined();
    expect(visualization.type).toBe(VisualizationType.SCATTER);
    expect(visualization.config).toEqual(vizConfig);
    expect(visualization.analysis?.type).toBe(AnalysisType.CORRELATION);
  });

  it('should handle transactions correctly', async () => {
    const result = await withTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: 'test-transaction@example.com',
          name: 'Transaction User',
          passwordHash: 'hashed_password'
        }
      });

      const project = await tx.project.create({
        data: {
          name: 'Transaction Project',
          ownerId: user.id
        }
      });

      return { user, project };
    });

    expect(result.user.id).toBeDefined();
    expect(result.project.ownerId).toBe(result.user.id);

    // Verify data was committed
    const user = await prisma.user.findUnique({
      where: { id: result.user.id }
    });
    expect(user).toBeTruthy();
  });

  it('should create activity logs', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-activity@example.com',
        name: 'Activity User',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Activity Project',
        ownerId: user.id
      }
    });

    const activityDetails = {
      action: 'create',
      resourceType: 'project',
      resourceId: project.id,
      resourceName: project.name
    };

    const activity = await prisma.activity.create({
      data: {
        type: ActivityType.PROJECT_CREATED,
        details: activityDetails,
        userId: user.id,
        projectId: project.id
      }
    });

    expect(activity.id).toBeDefined();
    expect(activity.type).toBe(ActivityType.PROJECT_CREATED);
    expect(activity.details).toEqual(activityDetails);
  });

  it('should handle cascading deletes correctly', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-cascade@example.com',
        name: 'Cascade User',
        passwordHash: 'hashed_password'
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Cascade Project',
        ownerId: user.id
      }
    });

    const dataset = await prisma.dataset.create({
      data: {
        name: 'Cascade Dataset',
        filePath: '/uploads/cascade_data.csv',
        fileSize: 1000,
        metadata: { columns: [], rowCount: 25, fileType: 'csv', hasHeader: true, importedAt: new Date().toISOString(), originalFileName: 'cascade_data.csv' },
        userId: user.id,
        projectId: project.id
      }
    });

    const analysis = await prisma.analysis.create({
      data: {
        name: 'Cascade Analysis',
        type: AnalysisType.DESCRIPTIVE,
        parameters: { variables: ['test'] },
        datasetId: dataset.id,
        projectId: project.id
      }
    });

    // Delete the user - should cascade to project, dataset, and analysis
    await prisma.user.delete({
      where: { id: user.id }
    });

    // Verify cascading deletes
    const deletedProject = await prisma.project.findUnique({ where: { id: project.id } });
    const deletedDataset = await prisma.dataset.findUnique({ where: { id: dataset.id } });
    const deletedAnalysis = await prisma.analysis.findUnique({ where: { id: analysis.id } });

    expect(deletedProject).toBeNull();
    expect(deletedDataset).toBeNull();
    expect(deletedAnalysis).toBeNull();
  });
});