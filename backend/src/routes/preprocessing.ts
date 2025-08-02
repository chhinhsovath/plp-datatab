import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { DataPreprocessingService } from '../lib/data-preprocessing.js';
import { PreprocessingOperation, DataFilter } from '../types/data-models.js';

const router = express.Router();

/**
 * Apply preprocessing operations to dataset
 */
router.post('/apply-operations', [
  body('data').isArray().withMessage('Data must be an array'),
  body('operations').isArray().withMessage('Operations must be an array'),
  body('operations.*.type').isString().withMessage('Operation type is required'),
  body('operations.*.parameters').isObject().withMessage('Operation parameters are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, operations } = req.body;

    const result = await DataPreprocessingService.applyOperations(data, operations);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error applying preprocessing operations:', error);
    res.status(500).json({
      error: {
        code: 'PREPROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to apply preprocessing operations',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Convert data types for columns
 */
router.post('/convert-types', [
  body('data').isArray().withMessage('Data must be an array'),
  body('conversions').isArray().withMessage('Conversions must be an array'),
  body('conversions.*.column').isString().withMessage('Column name is required'),
  body('conversions.*.targetType').isString().withMessage('Target type is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, conversions } = req.body;
    let processedData = [...data];
    const allWarnings: string[] = [];
    let totalRowsAffected = 0;
    const columnsAffected = new Set<string>();

    for (const conversion of conversions) {
      const result = DataPreprocessingService.convertDataType(processedData, conversion);
      processedData = result.data;
      allWarnings.push(...result.metadata.warnings);
      totalRowsAffected += result.metadata.rowsAffected;
      result.metadata.columnsAffected.forEach(col => columnsAffected.add(col));
    }

    res.json({
      success: true,
      data: processedData,
      metadata: {
        rowsAffected: totalRowsAffected,
        columnsAffected: Array.from(columnsAffected),
        warnings: allWarnings
      }
    });
  } catch (error) {
    console.error('Error converting data types:', error);
    res.status(500).json({
      error: {
        code: 'TYPE_CONVERSION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to convert data types',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Handle missing values
 */
router.post('/handle-missing', [
  body('data').isArray().withMessage('Data must be an array'),
  body('strategy').isString().withMessage('Strategy is required'),
  body('columns').optional().isArray().withMessage('Columns must be an array'),
  body('fillValue').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, strategy, columns, fillValue } = req.body;

    const result = DataPreprocessingService.handleMissingValues(data, {
      strategy,
      columns,
      fillValue
    });

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error handling missing values:', error);
    res.status(500).json({
      error: {
        code: 'MISSING_VALUES_ERROR',
        message: error instanceof Error ? error.message : 'Failed to handle missing values',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Handle outliers
 */
router.post('/handle-outliers', [
  body('data').isArray().withMessage('Data must be an array'),
  body('method').isIn(['iqr', 'zscore', 'modified_zscore']).withMessage('Invalid outlier detection method'),
  body('action').isIn(['remove', 'cap', 'flag']).withMessage('Invalid outlier action'),
  body('threshold').optional().isNumeric().withMessage('Threshold must be numeric'),
  body('columns').optional().isArray().withMessage('Columns must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, method, action, threshold, columns } = req.body;

    const result = DataPreprocessingService.handleOutliers(data, {
      method,
      action,
      threshold,
      columns
    });

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error handling outliers:', error);
    res.status(500).json({
      error: {
        code: 'OUTLIERS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to handle outliers',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Filter rows based on conditions
 */
router.post('/filter-rows', [
  body('data').isArray().withMessage('Data must be an array'),
  body('filters').isArray().withMessage('Filters must be an array'),
  body('filters.*.column').isString().withMessage('Filter column is required'),
  body('filters.*.operator').isString().withMessage('Filter operator is required'),
  body('filters.*.value').exists().withMessage('Filter value is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, filters } = req.body;

    const result = DataPreprocessingService.filterRows(data, filters);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error filtering rows:', error);
    res.status(500).json({
      error: {
        code: 'FILTER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to filter rows',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Create new variable using formula
 */
router.post('/create-variable', [
  body('data').isArray().withMessage('Data must be an array'),
  body('newColumnName').isString().withMessage('New column name is required'),
  body('formula').isString().withMessage('Formula is required'),
  body('variables').isObject().withMessage('Variables mapping is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, newColumnName, formula, variables } = req.body;

    const result = DataPreprocessingService.createVariable(data, {
      newColumnName,
      formula,
      variables
    });

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error creating variable:', error);
    res.status(500).json({
      error: {
        code: 'VARIABLE_CREATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to create variable',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Remove duplicate rows
 */
router.post('/remove-duplicates', [
  body('data').isArray().withMessage('Data must be an array'),
  body('columns').optional().isArray().withMessage('Columns must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, columns } = req.body;

    const result = DataPreprocessingService.removeDuplicates(data, columns);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    res.status(500).json({
      error: {
        code: 'DUPLICATE_REMOVAL_ERROR',
        message: error instanceof Error ? error.message : 'Failed to remove duplicates',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Normalize columns (min-max scaling)
 */
router.post('/normalize', [
  body('data').isArray().withMessage('Data must be an array'),
  body('columns').isArray().withMessage('Columns must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, columns } = req.body;

    const result = DataPreprocessingService.normalizeColumns(data, columns);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error normalizing columns:', error);
    res.status(500).json({
      error: {
        code: 'NORMALIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to normalize columns',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Standardize columns (z-score)
 */
router.post('/standardize', [
  body('data').isArray().withMessage('Data must be an array'),
  body('columns').isArray().withMessage('Columns must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data, columns } = req.body;

    const result = DataPreprocessingService.standardizeColumns(data, columns);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    });
  } catch (error) {
    console.error('Error standardizing columns:', error);
    res.status(500).json({
      error: {
        code: 'STANDARDIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to standardize columns',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

/**
 * Validate data quality
 */
router.post('/validate-quality', [
  body('data').isArray().withMessage('Data must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array(),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }

    const { data } = req.body;

    const result = DataPreprocessingService.validateDataQuality(data);

    res.json({
      success: true,
      validation: result
    });
  } catch (error) {
    console.error('Error validating data quality:', error);
    res.status(500).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Failed to validate data quality',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
});

export default router;