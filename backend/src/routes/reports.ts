import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { reportService } from '../lib/report-service.js';
import { authenticateToken } from '../lib/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation middleware
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Create a new report
router.post(
  '/',
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('projectId').isUUID().withMessage('Valid project ID is required'),
    body('description').optional().isString(),
    body('templateId').optional().isUUID(),
    body('sections').optional().isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { title, description, projectId, templateId, sections } = req.body;
      const userId = (req as any).user.id;

      const report = await reportService.createReport({
        title,
        description,
        projectId,
        userId,
        templateId,
        sections
      });

      res.status(201).json(report);
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  }
);

// Get reports for a project
router.get(
  '/project/:projectId',
  [
    param('projectId').isUUID().withMessage('Valid project ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user.id;

      // This would need to be implemented in the service
      // For now, return empty array
      res.json([]);
    } catch (error) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }
);

// Get a specific report
router.get(
  '/:reportId',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const userId = (req as any).user.id;

      // This would call a getReport method in the service
      res.status(501).json({ error: 'Not implemented yet' });
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }
);

// Update a report
router.put(
  '/:reportId',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required'),
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().isString(),
    body('sections').optional().isArray()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const { title, description, sections } = req.body;
      const userId = (req as any).user.id;

      const report = await reportService.updateReport(reportId, userId, {
        title,
        description,
        sections
      });

      res.json(report);
    } catch (error) {
      console.error('Error updating report:', error);
      if (error instanceof Error && error.message === 'Report not found') {
        res.status(404).json({ error: 'Report not found' });
      } else if (error instanceof Error && error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update report' });
      }
    }
  }
);

// Generate report from analysis
router.post(
  '/generate/:analysisId',
  [
    param('analysisId').isUUID().withMessage('Valid analysis ID is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('projectId').isUUID().withMessage('Valid project ID is required'),
    body('templateId').optional().isUUID(),
    body('includeCharts').optional().isBoolean(),
    body('includeRawData').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { analysisId } = req.params;
      const { title, projectId, templateId, includeCharts, includeRawData } = req.body;
      const userId = (req as any).user.id;

      const report = await reportService.generateFromAnalysis(
        analysisId,
        userId,
        projectId,
        {
          title,
          templateId,
          includeCharts: includeCharts ?? true,
          includeRawData: includeRawData ?? false
        }
      );

      res.status(201).json(report);
    } catch (error) {
      console.error('Error generating report:', error);
      if (error instanceof Error && error.message === 'Analysis not found') {
        res.status(404).json({ error: 'Analysis not found' });
      } else {
        res.status(500).json({ error: 'Failed to generate report' });
      }
    }
  }
);

// Export report
router.post(
  '/:reportId/export',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required'),
    body('format').isIn(['pdf', 'docx', 'html']).withMessage('Format must be pdf, docx, or html'),
    body('includeCharts').optional().isBoolean(),
    body('includeRawData').optional().isBoolean(),
    body('applyAPAFormatting').optional().isBoolean()
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const { format, includeCharts, includeRawData, applyAPAFormatting } = req.body;
      const userId = (req as any).user.id;

      const exportBuffer = await reportService.exportReport(reportId, userId, {
        format,
        includeCharts: includeCharts ?? true,
        includeRawData: includeRawData ?? false,
        applyAPAFormatting: applyAPAFormatting ?? true
      });

      // Set appropriate headers based on format
      const contentTypes = {
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        html: 'text/html'
      };

      const extensions = {
        pdf: 'pdf',
        docx: 'docx',
        html: 'html'
      };

      res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
      res.setHeader('Content-Disposition', `attachment; filename="report.${extensions[format as keyof typeof extensions]}"`);
      res.send(exportBuffer);
    } catch (error) {
      console.error('Error exporting report:', error);
      if (error instanceof Error && error.message === 'Report not found') {
        res.status(404).json({ error: 'Report not found' });
      } else if (error instanceof Error && error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to export report' });
      }
    }
  }
);

// Add collaborator
router.post(
  '/:reportId/collaborators',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required'),
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('role').isIn(['viewer', 'editor', 'admin']).withMessage('Role must be viewer, editor, or admin')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const { userId: collaboratorUserId, role } = req.body;
      const userId = (req as any).user.id;

      await reportService.addCollaborator(reportId, userId, collaboratorUserId, role);

      res.status(201).json({ message: 'Collaborator added successfully' });
    } catch (error) {
      console.error('Error adding collaborator:', error);
      if (error instanceof Error && error.message === 'Report not found') {
        res.status(404).json({ error: 'Report not found' });
      } else if (error instanceof Error && error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to add collaborator' });
      }
    }
  }
);

// Get report versions
router.get(
  '/:reportId/versions',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const userId = (req as any).user.id;

      const versions = await reportService.getReportVersions(reportId, userId);

      res.json(versions);
    } catch (error) {
      console.error('Error fetching report versions:', error);
      if (error instanceof Error && error.message === 'Report not found') {
        res.status(404).json({ error: 'Report not found' });
      } else if (error instanceof Error && error.message.includes('permission')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to fetch report versions' });
      }
    }
  }
);

// Create new version
router.post(
  '/:reportId/versions',
  [
    param('reportId').isUUID().withMessage('Valid report ID is required'),
    body('changeLog').notEmpty().withMessage('Change log is required')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { reportId } = req.params;
      const { changeLog } = req.body;
      const userId = (req as any).user.id;

      const version = await reportService.createVersion(reportId, userId, changeLog);

      res.status(201).json(version);
    } catch (error) {
      console.error('Error creating report version:', error);
      if (error instanceof Error && error.message === 'Report not found') {
        res.status(404).json({ error: 'Report not found' });
      } else {
        res.status(500).json({ error: 'Failed to create report version' });
      }
    }
  }
);

export default router;