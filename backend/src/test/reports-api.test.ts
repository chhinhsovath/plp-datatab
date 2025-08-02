import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import reportsRoutes from '../routes/reports.js';
import { reportService } from '../lib/report-service.js';

// Mock the report service
vi.mock('../lib/report-service.js');
const mockReportService = vi.mocked(reportService);

// Mock authentication middleware
vi.mock('../lib/auth.js', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', email: 'test@example.com' };
    next();
  }
}));

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRoutes);

describe('Reports API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/reports', () => {
    it('should create a new report', async () => {
      const mockReport = {
        id: 'report-1',
        title: 'Test Report',
        description: 'Test Description',
        projectId: 'project-1',
        userId: 'user-1',
        sections: [],
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isPublic: false,
        collaborators: []
      };

      mockReportService.createReport.mockResolvedValue(mockReport as any);

      const response = await request(app)
        .post('/api/reports')
        .send({
          title: 'Test Report',
          description: 'Test Description',
          projectId: 'project-1'
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Test Report');
      expect(mockReportService.createReport).toHaveBeenCalledWith({
        title: 'Test Report',
        description: 'Test Description',
        projectId: 'project-1',
        userId: 'user-1',
        templateId: undefined,
        sections: undefined
      });
    });

    it('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/reports')
        .send({
          description: 'Test Description'
          // Missing required title and projectId
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/reports/:reportId', () => {
    it('should update an existing report', async () => {
      const mockReport = {
        id: 'report-1',
        title: 'Updated Report',
        description: 'Updated Description',
        projectId: 'project-1',
        userId: 'user-1',
        sections: [],
        version: 2,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T01:00:00Z',
        isPublic: false,
        collaborators: []
      };

      mockReportService.updateReport.mockResolvedValue(mockReport as any);

      const response = await request(app)
        .put('/api/reports/report-1')
        .send({
          title: 'Updated Report',
          description: 'Updated Description'
        });

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Updated Report');
      expect(mockReportService.updateReport).toHaveBeenCalledWith(
        'report-1',
        'user-1',
        {
          title: 'Updated Report',
          description: 'Updated Description',
          sections: undefined
        }
      );
    });

    it('should return 404 if report not found', async () => {
      mockReportService.updateReport.mockRejectedValue(new Error('Report not found'));

      const response = await request(app)
        .put('/api/reports/nonexistent')
        .send({
          title: 'Updated Report'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });

    it('should return 403 for permission denied', async () => {
      mockReportService.updateReport.mockRejectedValue(new Error('Edit permission denied'));

      const response = await request(app)
        .put('/api/reports/report-1')
        .send({
          title: 'Updated Report'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Edit permission denied');
    });
  });

  describe('POST /api/reports/generate/:analysisId', () => {
    it('should generate report from analysis', async () => {
      const mockReport = {
        id: 'report-1',
        title: 'Analysis Report',
        description: 'Automated report generated from Test Analysis analysis',
        projectId: 'project-1',
        userId: 'user-1',
        sections: [
          {
            id: 'intro',
            type: 'text',
            title: 'Introduction',
            content: 'This report presents the results...',
            order: 1,
            formatting: {}
          }
        ],
        version: 1,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isPublic: false,
        collaborators: []
      };

      mockReportService.generateFromAnalysis.mockResolvedValue(mockReport as any);

      const response = await request(app)
        .post('/api/reports/generate/analysis-1')
        .send({
          title: 'Analysis Report',
          projectId: 'project-1',
          includeCharts: true,
          includeRawData: false
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Analysis Report');
      expect(mockReportService.generateFromAnalysis).toHaveBeenCalledWith(
        'analysis-1',
        'user-1',
        'project-1',
        {
          title: 'Analysis Report',
          templateId: undefined,
          includeCharts: true,
          includeRawData: false
        }
      );
    });

    it('should return 404 if analysis not found', async () => {
      mockReportService.generateFromAnalysis.mockRejectedValue(new Error('Analysis not found'));

      const response = await request(app)
        .post('/api/reports/generate/nonexistent')
        .send({
          title: 'Analysis Report',
          projectId: 'project-1'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Analysis not found');
    });
  });

  describe('POST /api/reports/:reportId/export', () => {
    it('should export report as PDF', async () => {
      const mockBuffer = Buffer.from('PDF content');
      mockReportService.exportReport.mockResolvedValue(mockBuffer);

      const response = await request(app)
        .post('/api/reports/report-1/export')
        .send({
          format: 'pdf',
          includeCharts: true,
          includeRawData: false,
          applyAPAFormatting: true
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('attachment; filename="report.pdf"');
      expect(mockReportService.exportReport).toHaveBeenCalledWith(
        'report-1',
        'user-1',
        {
          format: 'pdf',
          includeCharts: true,
          includeRawData: false,
          applyAPAFormatting: true
        }
      );
    });

    it('should export report as DOCX', async () => {
      const mockBuffer = Buffer.from('DOCX content');
      mockReportService.exportReport.mockResolvedValue(mockBuffer);

      const response = await request(app)
        .post('/api/reports/report-1/export')
        .send({
          format: 'docx',
          includeCharts: false,
          includeRawData: true,
          applyAPAFormatting: false
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(response.headers['content-disposition']).toBe('attachment; filename="report.docx"');
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/api/reports/report-1/export')
        .send({
          format: 'invalid',
          includeCharts: true
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/reports/:reportId/collaborators', () => {
    it('should add collaborator to report', async () => {
      mockReportService.addCollaborator.mockResolvedValue();

      const response = await request(app)
        .post('/api/reports/report-1/collaborators')
        .send({
          userId: 'user-2',
          role: 'editor'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Collaborator added successfully');
      expect(mockReportService.addCollaborator).toHaveBeenCalledWith(
        'report-1',
        'user-1',
        'user-2',
        'editor'
      );
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .post('/api/reports/report-1/collaborators')
        .send({
          userId: 'user-2',
          role: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/reports/:reportId/versions', () => {
    it('should return report versions', async () => {
      const mockVersions = [
        {
          id: 'version-2',
          reportId: 'report-1',
          version: 2,
          title: 'Test Report v2',
          sections: [],
          createdBy: 'user-1',
          createdAt: '2024-01-01T01:00:00Z',
          changeLog: 'Updated content'
        },
        {
          id: 'version-1',
          reportId: 'report-1',
          version: 1,
          title: 'Test Report v1',
          sections: [],
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00Z',
          changeLog: 'Initial version'
        }
      ];

      mockReportService.getReportVersions.mockResolvedValue(mockVersions as any);

      const response = await request(app)
        .get('/api/reports/report-1/versions');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0].version).toBe(2);
      expect(response.body[1].version).toBe(1);
    });
  });

  describe('POST /api/reports/:reportId/versions', () => {
    it('should create new version', async () => {
      const mockVersion = {
        id: 'version-2',
        reportId: 'report-1',
        version: 2,
        title: 'Test Report',
        sections: [],
        createdBy: 'user-1',
        createdAt: '2024-01-01T01:00:00Z',
        changeLog: 'Updated content'
      };

      mockReportService.createVersion.mockResolvedValue(mockVersion as any);

      const response = await request(app)
        .post('/api/reports/report-1/versions')
        .send({
          changeLog: 'Updated content'
        });

      expect(response.status).toBe(201);
      expect(response.body.version).toBe(2);
      expect(response.body.changeLog).toBe('Updated content');
      expect(mockReportService.createVersion).toHaveBeenCalledWith(
        'report-1',
        'user-1',
        'Updated content'
      );
    });

    it('should return 400 if changeLog is missing', async () => {
      const response = await request(app)
        .post('/api/reports/report-1/versions')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });
});