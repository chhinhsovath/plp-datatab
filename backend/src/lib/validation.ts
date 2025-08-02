import { z } from 'zod';

// Common validation patterns
const uuidSchema = z.string().uuid('Invalid UUID format');
const positiveIntSchema = z.number().int().positive('Must be a positive integer');
const alphaSchema = z.number().min(0.001).max(0.1, 'Alpha must be between 0.001 and 0.1');
const columnNameSchema = z.string().min(1, 'Column name is required').max(255, 'Column name too long');

// User validation schemas
export const registerSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])?/, 
      'Password must contain at least one lowercase letter, one uppercase letter, and one number')
});

export const loginSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password too long')
});

export const updateProfileSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters long')
    .max(100, 'Name must be less than 100 characters')
    .trim()
    .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens, and apostrophes')
    .optional(),
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255, 'Email too long')
    .optional()
}).refine(data => data.name || data.email, {
  message: 'At least one field (name or email) must be provided'
});

export const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required')
    .max(128, 'Password too long'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters long')
    .max(128, 'New password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])?/, 
      'New password must contain at least one lowercase letter, one uppercase letter, and one number')
});

// File upload validation schemas
export const uploadOptionsSchema = z.object({
  delimiter: z.string().max(5, 'Delimiter too long').optional(),
  encoding: z.enum(['utf8', 'latin1', 'ascii', 'utf16le'], {
    errorMap: () => ({ message: 'Invalid encoding. Must be utf8, latin1, ascii, or utf16le' })
  }).optional(),
  hasHeader: z.boolean().optional(),
  selectedSheet: z.string().max(255, 'Sheet name too long').optional(),
  maxRows: z.number().int().min(1).max(1000000, 'Max rows cannot exceed 1,000,000').optional(),
  projectId: uuidSchema.optional()
});

export const urlImportSchema = z.object({
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .refine(url => {
      const allowedProtocols = ['http:', 'https:'];
      try {
        const parsedUrl = new URL(url);
        return allowedProtocols.includes(parsedUrl.protocol);
      } catch {
        return false;
      }
    }, 'URL must use HTTP or HTTPS protocol'),
  name: z.string()
    .min(1, 'Dataset name is required')
    .max(255, 'Dataset name too long')
    .trim(),
  delimiter: z.string().max(5, 'Delimiter too long').optional(),
  encoding: z.enum(['utf8', 'latin1', 'ascii', 'utf16le']).optional(),
  hasHeader: z.boolean().optional(),
  maxRows: z.number().int().min(1).max(1000000, 'Max rows cannot exceed 1,000,000').optional(),
  projectId: uuidSchema.optional()
});

// Data preprocessing validation schemas
export const preprocessingOperationSchema = z.object({
  type: z.enum(['remove_missing', 'fill_missing', 'remove_outliers', 'transform_data', 'filter_data', 'create_variable'], {
    errorMap: () => ({ message: 'Invalid operation type' })
  }),
  column: columnNameSchema,
  parameters: z.record(z.any()).optional()
});

export const preprocessingRequestSchema = z.object({
  datasetId: uuidSchema,
  operations: z.array(preprocessingOperationSchema)
    .min(1, 'At least one operation is required')
    .max(50, 'Too many operations (max 50)')
});

// Statistical analysis validation schemas
export const descriptiveStatsSchema = z.object({
  datasetId: uuidSchema,
  columnName: columnNameSchema
});

export const frequencyAnalysisSchema = z.object({
  datasetId: uuidSchema,
  columnName: columnNameSchema,
  binCount: z.number().int().min(1).max(100, 'Bin count must be between 1 and 100').optional()
});

export const correlationAnalysisSchema = z.object({
  datasetId: uuidSchema,
  columns: z.array(columnNameSchema)
    .min(2, 'At least 2 columns required for correlation analysis')
    .max(20, 'Too many columns (max 20)'),
  method: z.enum(['pearson', 'spearman'], {
    errorMap: () => ({ message: 'Method must be pearson or spearman' })
  }).optional()
});

export const normalityTestSchema = z.object({
  datasetId: uuidSchema,
  columnName: columnNameSchema,
  tests: z.array(z.enum(['shapiro-wilk', 'kolmogorov-smirnov', 'anderson-darling']))
    .min(1, 'At least one test must be selected')
    .optional(),
  alpha: alphaSchema.optional()
});

export const contingencyTableSchema = z.object({
  datasetId: uuidSchema,
  rowVariable: columnNameSchema,
  columnVariable: columnNameSchema
});

export const tTestSchema = z.object({
  datasetId: uuidSchema,
  testType: z.enum(['one-sample', 'independent', 'paired'], {
    errorMap: () => ({ message: 'Test type must be one-sample, independent, or paired' })
  }),
  variable1: columnNameSchema,
  variable2: columnNameSchema.optional(),
  populationMean: z.number().finite('Population mean must be a finite number').optional(),
  equalVariances: z.boolean().optional(),
  alpha: alphaSchema.optional()
}).refine(data => {
  if (data.testType === 'one-sample' && data.populationMean === undefined) {
    return false;
  }
  if ((data.testType === 'independent' || data.testType === 'paired') && !data.variable2) {
    return false;
  }
  return true;
}, {
  message: 'Invalid parameters for selected test type'
});

export const anovaSchema = z.object({
  datasetId: uuidSchema,
  dependentVariable: columnNameSchema,
  groupingVariable: columnNameSchema,
  alpha: alphaSchema.optional()
});

export const regressionSchema = z.object({
  datasetId: uuidSchema,
  dependentVariable: columnNameSchema,
  independentVariable: columnNameSchema,
  alpha: alphaSchema.optional()
});

export const nonParametricTestSchema = z.object({
  datasetId: uuidSchema,
  testType: z.enum(['mann-whitney', 'wilcoxon', 'kruskal-wallis'], {
    errorMap: () => ({ message: 'Test type must be mann-whitney, wilcoxon, or kruskal-wallis' })
  }),
  variable1: columnNameSchema,
  variable2: columnNameSchema.optional(),
  groupingVariable: columnNameSchema.optional(),
  alpha: alphaSchema.optional()
}).refine(data => {
  if ((data.testType === 'mann-whitney' || data.testType === 'wilcoxon') && !data.variable2) {
    return false;
  }
  if (data.testType === 'kruskal-wallis' && !data.groupingVariable) {
    return false;
  }
  return true;
}, {
  message: 'Invalid parameters for selected test type'
});

export const testSuggestionSchema = z.object({
  datasetId: uuidSchema,
  variables: z.array(columnNameSchema)
    .min(1, 'At least one variable is required')
    .max(10, 'Too many variables (max 10)'),
  numGroups: z.number().int().min(2).max(20, 'Number of groups must be between 2 and 20').optional(),
  pairedData: z.boolean().optional()
});

// Project and collaboration validation schemas
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(255, 'Project name too long')
    .trim(),
  description: z.string()
    .max(1000, 'Description too long')
    .trim()
    .optional()
});

export const updateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(255, 'Project name too long')
    .trim()
    .optional(),
  description: z.string()
    .max(1000, 'Description too long')
    .trim()
    .optional()
}).refine(data => data.name || data.description, {
  message: 'At least one field must be provided'
});

export const inviteCollaboratorSchema = z.object({
  email: z.string()
    .trim()
    .toLowerCase()
    .email('Invalid email format')
    .max(255, 'Email too long'),
  role: z.enum(['viewer', 'editor', 'admin'], {
    errorMap: () => ({ message: 'Role must be viewer, editor, or admin' })
  })
});

// Report validation schemas
export const createReportSchema = z.object({
  title: z.string()
    .min(1, 'Report title is required')
    .max(255, 'Report title too long')
    .trim(),
  projectId: uuidSchema.optional(),
  template: z.enum(['basic', 'academic', 'business'], {
    errorMap: () => ({ message: 'Template must be basic, academic, or business' })
  }).optional()
});

export const updateReportSchema = z.object({
  title: z.string()
    .min(1, 'Report title is required')
    .max(255, 'Report title too long')
    .trim()
    .optional(),
  content: z.string()
    .max(100000, 'Report content too long')
    .optional()
}).refine(data => data.title || data.content, {
  message: 'At least one field must be provided'
});

// Pagination validation schema
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').optional(),
  limit: z.number().int().min(1).max(1000, 'Limit must be between 1 and 1000').optional()
});

// Export types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UploadOptionsInput = z.infer<typeof uploadOptionsSchema>;
export type UrlImportInput = z.infer<typeof urlImportSchema>;
export type PreprocessingRequestInput = z.infer<typeof preprocessingRequestSchema>;
export type DescriptiveStatsInput = z.infer<typeof descriptiveStatsSchema>;
export type FrequencyAnalysisInput = z.infer<typeof frequencyAnalysisSchema>;
export type CorrelationAnalysisInput = z.infer<typeof correlationAnalysisSchema>;
export type NormalityTestInput = z.infer<typeof normalityTestSchema>;
export type ContingencyTableInput = z.infer<typeof contingencyTableSchema>;
export type TTestInput = z.infer<typeof tTestSchema>;
export type AnovaInput = z.infer<typeof anovaSchema>;
export type RegressionInput = z.infer<typeof regressionSchema>;
export type NonParametricTestInput = z.infer<typeof nonParametricTestSchema>;
export type TestSuggestionInput = z.infer<typeof testSuggestionSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type InviteCollaboratorInput = z.infer<typeof inviteCollaboratorSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;