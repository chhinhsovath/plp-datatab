import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticateToken } from '../lib/auth.js';
import { DataImportService } from '../lib/data-import.js';
import { prisma } from '../lib/database.js';
import { auditLogger } from '../lib/audit-logger.js';
import { validateFileUpload, validateFileUploadSecurity, handleValidationErrors } from '../middleware/security.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json'];
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/plain'
  ];
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  
  // Check file extension
  if (!allowedExtensions.includes(fileExtension)) {
    auditLogger.logFileUploadEvent(req, {
      filename: file.originalname,
      fileSize: file.size || 0,
      mimeType,
      success: false,
      blocked: true,
      reason: `Invalid file extension: ${fileExtension}`
    });
    return cb(new Error(`Unsupported file format: ${fileExtension}. Allowed formats: ${allowedExtensions.join(', ')}`));
  }
  
  // Check MIME type
  if (!allowedMimeTypes.includes(mimeType)) {
    auditLogger.logFileUploadEvent(req, {
      filename: file.originalname,
      fileSize: file.size || 0,
      mimeType,
      success: false,
      blocked: true,
      reason: `Invalid MIME type: ${mimeType}`
    });
    return cb(new Error(`Unsupported file type: ${mimeType}`));
  }
  
  // Check filename for malicious patterns
  const maliciousPatterns = [
    /\.\./,  // Directory traversal
    /[<>:"|?*]/,  // Invalid filename characters
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Windows reserved names
    /\.(exe|bat|cmd|scr|pif|com|dll|vbs|js|jar|app|deb|rpm)$/i  // Executable extensions
  ];
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(file.originalname)) {
      auditLogger.logFileUploadEvent(req, {
        filename: file.originalname,
        fileSize: file.size || 0,
        mimeType,
        success: false,
        blocked: true,
        reason: 'Malicious filename pattern detected'
      });
      return cb(new Error('Invalid filename'));
    }
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  }
});

// Validation schemas
const uploadOptionsSchema = z.object({
  delimiter: z.string().optional(),
  encoding: z.string().optional(),
  hasHeader: z.boolean().optional(),
  selectedSheet: z.string().optional(),
  maxRows: z.number().int().positive().optional(),
  projectId: z.string().optional()
});

const urlImportSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(255),
  delimiter: z.string().optional(),
  encoding: z.string().optional(),
  hasHeader: z.boolean().optional(),
  maxRows: z.number().int().positive().optional(),
  projectId: z.string().optional()
});

/**
 * Upload and import file
 */
router.post('/file', 
  authenticateToken, 
  validateFileUpload,
  handleValidationErrors,
  upload.single('file'),
  validateFileUploadSecurity,
  async (req, res) => {
    try {
      if (!req.file) {
        auditLogger.logFileUploadEvent(req, {
          filename: 'unknown',
          fileSize: 0,
          mimeType: 'unknown',
          success: false,
          reason: 'No file provided'
        });
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user!.id;
      const options = uploadOptionsSchema.parse(req.body);

      // Log successful file upload
      auditLogger.logFileUploadEvent(req, {
        filename: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        success: true
      });

      // Additional security checks on file content
      const fileBuffer = fs.readFileSync(req.file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      
      // Check for malicious content patterns (basic check)
      const maliciousPatterns = [
        /<script/i,
        /javascript:/i,
        /<iframe/i,
        /eval\(/i,
        /document\.write/i
      ];
      
      const fileContent = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
      for (const pattern of maliciousPatterns) {
        if (pattern.test(fileContent)) {
          fs.unlinkSync(req.file.path);
          auditLogger.logSecurityEvent(
            'malicious_file_content',
            'file_upload',
            'error',
            req,
            {
              resource: 'file_system',
              details: { filename: req.file.originalname, pattern: pattern.toString() }
            }
          );
          return res.status(400).json({ error: 'File contains potentially malicious content' });
        }
      }

      // Validate file
      const validation = DataImportService.validateFile(req.file.path, req.file.originalname);
      if (!validation.valid) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        auditLogger.logFileUploadEvent(req, {
          filename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          success: false,
          reason: validation.error
        });
        return res.status(400).json({ error: validation.error });
      }

      // Import data
      const importResult = await DataImportService.importFromFile(
        req.file.path,
        req.file.originalname,
        options
      );

      // Save dataset to database
      const dataset = await prisma.dataset.create({
        data: {
          name: path.parse(req.file.originalname).name,
          filePath: req.file.path,
          fileSize: req.file.size,
          metadata: {
            ...importResult.metadata,
            fileHash,
            uploadedBy: userId,
            uploadedAt: new Date().toISOString()
          } as any,
          userId,
          projectId: options.projectId || null
        }
      });

      // Log successful data import
      auditLogger.logDataAccessEvent('write', 'dataset', req, {
        resourceId: dataset.id,
        recordCount: importResult.data.length,
        sensitive: false,
        details: {
          filename: req.file.originalname,
          fileSize: req.file.size,
          rowCount: importResult.data.length
        }
      });

      res.json({
        dataset: {
          id: dataset.id,
          name: dataset.name,
          fileSize: dataset.fileSize,
          uploadedAt: dataset.uploadedAt,
          metadata: importResult.metadata
        },
        preview: importResult.data.slice(0, 100) // Return first 100 rows as preview
      });

    } catch (error) {
      // Clean up uploaded file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // Log failed upload
      if (req.file) {
        auditLogger.logFileUploadEvent(req, {
          filename: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          success: false,
          reason: (error as Error).message
        });
      }

      console.error('File upload error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid request parameters',
          details: error.errors 
        });
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          auditLogger.logSecurityEvent(
            'file_size_exceeded',
            'file_upload',
            'warning',
            req,
            { resource: 'file_system', details: { limit: '100MB' } }
          );
          return res.status(400).json({ error: 'File size exceeds 100MB limit' });
        }
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'File upload failed' 
      });
    }
  }
);

/**
 * Import data from URL
 */
router.post('/url', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { url, name, ...options } = urlImportSchema.parse(req.body);

    // Import data from URL
    const importResult = await DataImportService.importFromURL(url, options);

    // Create a placeholder file path for URL imports
    const urlHash = Buffer.from(url).toString('base64').substring(0, 16);
    const filePath = `url_imports/${urlHash}_${Date.now()}`;

    // Save dataset to database
    const dataset = await prisma.dataset.create({
      data: {
        name,
        filePath,
        fileSize: JSON.stringify(importResult.data).length, // Approximate size
        metadata: importResult.metadata as any,
        userId,
        projectId: options.projectId || null
      }
    });

    res.json({
      dataset: {
        id: dataset.id,
        name: dataset.name,
        fileSize: dataset.fileSize,
        uploadedAt: dataset.uploadedAt,
        metadata: importResult.metadata
      },
      preview: importResult.data.slice(0, 100) // Return first 100 rows as preview
    });

  } catch (error) {
    console.error('URL import error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request parameters',
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'URL import failed' 
    });
  }
});

/**
 * Get Excel sheets for sheet selection
 */
router.post('/excel-sheets', authenticateToken, upload.single('file'), validateFileUploadSecurity, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (!['.xlsx', '.xls'].includes(fileExtension)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File must be an Excel file (.xlsx or .xls)' });
    }

    // Get available sheets
    const sheets = DataImportService.getExcelSheets(req.file.path);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ sheets });

  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Excel sheets error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to read Excel sheets' 
    });
  }
});

/**
 * Get dataset data with pagination
 */
router.get('/dataset/:id/data', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const datasetId = req.params.id;
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000); // Max 1000 rows per request
    const offset = (page - 1) * limit;

    // Check if user has access to dataset
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        OR: [
          { userId },
          { 
            project: {
              OR: [
                { ownerId: userId },
                { collaborators: { some: { userId } } }
              ]
            }
          }
        ]
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found' });
    }

    // For URL imports, we need to re-import the data (in a real app, you'd cache this)
    let data: Record<string, any>[];
    
    if (dataset.filePath.startsWith('url_imports/')) {
      // This is a URL import - in a real app, you'd store the URL and re-fetch or cache the data
      return res.status(501).json({ error: 'URL import data retrieval not implemented in this demo' });
    } else {
      // File import - re-parse the file
      const importResult = await DataImportService.importFromFile(
        dataset.filePath,
        (dataset.metadata as any).originalFileName,
        {
          delimiter: (dataset.metadata as any).delimiter,
          encoding: (dataset.metadata as any).encoding,
          hasHeader: (dataset.metadata as any).hasHeader,
          selectedSheet: (dataset.metadata as any).selectedSheet
        }
      );
      data = importResult.data;
    }

    const totalRows = data.length;
    const paginatedData = data.slice(offset, offset + limit);

    res.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / limit),
        hasNext: offset + limit < totalRows,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Dataset data error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to retrieve dataset data' 
    });
  }
});

/**
 * Get user's datasets
 */
router.get('/datasets', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const [datasets, total] = await Promise.all([
      prisma.dataset.findMany({
        where: {
          OR: [
            { userId },
            { 
              project: {
                OR: [
                  { ownerId: userId },
                  { collaborators: { some: { userId } } }
                ]
              }
            }
          ]
        },
        include: {
          project: {
            select: { id: true, name: true }
          }
        },
        orderBy: { uploadedAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.dataset.count({
        where: {
          OR: [
            { userId },
            { 
              project: {
                OR: [
                  { ownerId: userId },
                  { collaborators: { some: { userId } } }
                ]
              }
            }
          ]
        }
      })
    ]);

    res.json({
      datasets: datasets.map(dataset => ({
        id: dataset.id,
        name: dataset.name,
        fileSize: dataset.fileSize,
        uploadedAt: dataset.uploadedAt,
        metadata: dataset.metadata,
        project: dataset.project
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: offset + limit < total,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Datasets list error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to retrieve datasets' 
    });
  }
});

/**
 * Delete dataset
 */
router.delete('/dataset/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const datasetId = req.params.id;

    // Check if user owns the dataset
    const dataset = await prisma.dataset.findFirst({
      where: {
        id: datasetId,
        userId
      }
    });

    if (!dataset) {
      return res.status(404).json({ error: 'Dataset not found or access denied' });
    }

    // Delete file if it exists and is not a URL import
    if (!dataset.filePath.startsWith('url_imports/') && fs.existsSync(dataset.filePath)) {
      fs.unlinkSync(dataset.filePath);
    }

    // Delete dataset from database
    await prisma.dataset.delete({
      where: { id: datasetId }
    });

    res.json({ message: 'Dataset deleted successfully' });

  } catch (error) {
    console.error('Dataset deletion error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete dataset' 
    });
  }
});

export default router;