import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { reportService } from '../lib/report-service.js';
import { Report, ReportSection } from '../types/report-models.js';

// Mock Prisma
vi.mock('@prisma/client');
const mockPrisma = {
  report: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  reportTemplate: {
    findUnique: vi.fn()
  },
  reportVersion: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  reportCollaborator: {
    create: vi.fn()
  },
  reportActivity: {
    create: vi.fn()
  },
  analysis: {
    findUnique: vi.fn()
  }
};

vi.mocked(PrismaClient).mockImplementation(() => mockPrisma as any);

describe('ReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createReport', () => {
    it('should create a new report successfully', async () => {
      const mockReport = {
        id: 'report-1',
        title: 'Test Report',
        description: 'Test Description',
        sections: [],
        templateId: null,
        version: 1,
        userId: 'user-1',
        projectId: 'project-1',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: null,
        collaborators: [],
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        project: { id: 'project-1', name: 'Test Project' }
      };

      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.reportVersion.create.mockResolvedValue({
        id: 'version-1',
        reportId: 'report-1',
        version: 1,
        title: 'Test Report',
        sections: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        changeLog: 'Initial version'
      });
      mockPrisma.reportActivity.create.mockResolvedValue({});

      const result = await reportService.createReport({
        title: 'Test Report',
        description: 'Test Description',
        projectId: 'project-1',
        userId: 'user-1'
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Test Report');
      expect(result.description).toBe('Test Description');
      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: {
          title: 'Test Report',
          description: 'Test Description',
          sections: [],
          templateId: undefined,
          userId: 'user-1',
          projectId: 'project-1',
          version: 1
        },
        include: {
          template: true,
          collaborators: true,
          user: true,
          project: true
        }
      });
    });

    it('should handle report creation with sections', async () => {
      const sections: ReportSection[] = [
        {
          id: 'section-1',
          type: 'text',
          title: 'Introduction',
          content: 'This is the introduction',
          order: 0,
          formatting: {}
        }
      ];

      const mockReport = {
        id: 'report-1',
        title: 'Test Report',
        description: null,
        sections,
        templateId: null,
        version: 1,
        userId: 'user-1',
        projectId: 'project-1',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: null,
        collaborators: [],
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        project: { id: 'project-1', name: 'Test Project' }
      };

      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.reportVersion.create.mockResolvedValue({});
      mockPrisma.reportActivity.create.mockResolvedValue({});

      const result = await reportService.createReport({
        title: 'Test Report',
        projectId: 'project-1',
        userId: 'user-1',
        sections
      });

      expect(result.sections).toHaveLength(1);
      expect(result.sections[0].title).toBe('Introduction');
    });
  });

  describe('updateReport', () => {
    it('should update an existing report', async () => {
      const existingReport = {
        id: 'report-1',
        title: 'Old Title',
        description: 'Old Description',
        sections: [],
        version: 1,
        userId: 'user-1',
        projectId: 'project-1',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: null,
        collaborators: []
      };

      const updatedReport = {
        ...existingReport,
        title: 'New Title',
        description: 'New Description',
        version: 2,
        updatedAt: new Date(),
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        project: { id: 'project-1', name: 'Test Project' }
      };

      mockPrisma.report.findUnique.mockResolvedValue(existingReport);
      mockPrisma.report.update.mockResolvedValue(updatedReport);
      mockPrisma.reportVersion.create.mockResolvedValue({});
      mockPrisma.reportActivity.create.mockResolvedValue({});

      const result = await reportService.updateReport('report-1', 'user-1', {
        title: 'New Title',
        description: 'New Description'
      });

      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Description');
      expect(result.version).toBe(2);
    });

    it('should throw error if report not found', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null);

      await expect(
        reportService.updateReport('nonexistent', 'user-1', { title: 'New Title' })
      ).rejects.toThrow('Report not found');
    });
  });

  describe('generateFromAnalysis', () => {
    it('should generate report from analysis results', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        name: 'Test Analysis',
        type: 'TTEST',
        results: {
          summary: 'Test results summary',
          tables: [
            {
              title: 'T-Test Results',
              headers: ['Variable', 'Mean', 'SD', 't', 'p'],
              rows: [['Group1', '10.5', '2.3', '4.2', '0.001']],
              formatting: { applyAPA: true, decimalPlaces: 3, significanceMarkers: true }
            }
          ],
          interpretation: 'Significant difference found'
        },
        dataset: {
          id: 'dataset-1',
          name: 'Test Dataset'
        },
        visualizations: []
      };

      const mockReport = {
        id: 'report-1',
        title: 'Analysis Report',
        description: 'Automated report generated from Test Analysis analysis',
        sections: [],
        templateId: null,
        version: 1,
        userId: 'user-1',
        projectId: 'project-1',
        isPublic: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: null,
        collaborators: [],
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        project: { id: 'project-1', name: 'Test Project' }
      };

      mockPrisma.analysis.findUnique.mockResolvedValue(mockAnalysis);
      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.reportVersion.create.mockResolvedValue({});
      mockPrisma.reportActivity.create.mockResolvedValue({});

      const result = await reportService.generateFromAnalysis(
        'analysis-1',
        'user-1',
        'project-1',
        {
          title: 'Analysis Report',
          includeCharts: true,
          includeRawData: false
        }
      );

      expect(result).toBeDefined();
      expect(result.title).toBe('Analysis Report');
      expect(mockPrisma.analysis.findUnique).toHaveBeenCalledWith({
        where: { id: 'analysis-1' },
        include: {
          dataset: true,
          visualizations: true
        }
      });
    });

    it('should throw error if analysis not found', async () => {
      mockPrisma.analysis.findUnique.mockResolvedValue(null);

      await expect(
        reportService.generateFromAnalysis('nonexistent', 'user-1', 'project-1', {
          title: 'Test Report'
        })
      ).rejects.toThrow('Analysis not found');
    });
  });

  describe('addCollaborator', () => {
    it('should add collaborator to report', async () => {
      const mockReport = {
        id: 'report-1',
        userId: 'owner-1',
        collaborators: []
      };

      mockPrisma.report.findUnique.mockResolvedValue(mockReport);
      mockPrisma.reportCollaborator.create.mockResolvedValue({});
      mockPrisma.reportActivity.create.mockResolvedValue({});

      await reportService.addCollaborator('report-1', 'owner-1', 'user-2', 'editor');

      expect(mockPrisma.reportCollaborator.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-2',
          reportId: 'report-1',
          role: 'EDITOR',
          permissions: {
            canEdit: true,
            canComment: true,
            canExport: true,
            canShare: false
          }
        }
      });
    });
  });

  describe('createVersion', () => {
    it('should create a new version of the report', async () => {
      const mockReport = {
        id: 'report-1',
        title: 'Test Report',
        sections: [],
        version: 2
      };

      const mockVersion = {
        id: 'version-1',
        reportId: 'report-1',
        version: 2,
        title: 'Test Report',
        sections: [],
        createdBy: 'user-1',
        createdAt: new Date(),
        changeLog: 'Updated content'
      };

      mockPrisma.report.findUnique.mockResolvedValue(mockReport);
      mockPrisma.reportVersion.create.mockResolvedValue(mockVersion);
      mockPrisma.reportActivity.create.mockResolvedValue({});

      const result = await reportService.createVersion('report-1', 'user-1', 'Updated content');

      expect(result).toBeDefined();
      expect(result.version).toBe(2);
      expect(result.changeLog).toBe('Updated content');
    });
  });

  describe('getReportVersions', () => {
    it('should return report versions', async () => {
      const mockVersions = [
        {
          id: 'version-2',
          reportId: 'report-1',
          version: 2,
          title: 'Test Report v2',
          sections: [],
          createdBy: 'user-1',
          createdAt: new Date(),
          changeLog: 'Updated content',
          creator: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
        },
        {
          id: 'version-1',
          reportId: 'report-1',
          version: 1,
          title: 'Test Report v1',
          sections: [],
          createdBy: 'user-1',
          createdAt: new Date(),
          changeLog: 'Initial version',
          creator: { id: 'user-1', name: 'Test User', email: 'test@example.com' }
        }
      ];

      // Mock permission check
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'report-1',
        userId: 'user-1',
        isPublic: false,
        collaborators: []
      });
      
      mockPrisma.reportVersion.findMany.mockResolvedValue(mockVersions);

      const result = await reportService.getReportVersions('report-1', 'user-1');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(2);
      expect(result[1].version).toBe(1);
    });
  });
});