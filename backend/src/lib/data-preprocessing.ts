import { DataType, PreprocessingOperation, PreprocessingType, DataFilter, FilterOperator, ColumnInfo, DescriptiveStats } from '../types/data-models.js';
import * as ss from 'simple-statistics';

export interface PreprocessingResult {
  data: Record<string, any>[];
  metadata: {
    operationsApplied: PreprocessingOperation[];
    rowsAffected: number;
    columnsAffected: string[];
    warnings: string[];
  };
}

export interface MissingValueOptions {
  strategy: 'remove' | 'fill_mean' | 'fill_median' | 'fill_mode' | 'fill_value' | 'interpolate';
  fillValue?: any;
  columns?: string[];
}

export interface OutlierDetectionOptions {
  method: 'iqr' | 'zscore' | 'modified_zscore';
  threshold?: number;
  action: 'remove' | 'cap' | 'flag';
  columns?: string[];
}

export interface DataTypeConversionOptions {
  column: string;
  targetType: DataType;
  dateFormat?: string;
  booleanMapping?: { true: any[]; false: any[] };
}

export interface FormulaOptions {
  newColumnName: string;
  formula: string;
  variables: Record<string, string>; // Maps formula variables to column names
}

export class DataPreprocessingService {
  /**
   * Apply multiple preprocessing operations to data
   */
  static async applyOperations(
    data: Record<string, any>[],
    operations: PreprocessingOperation[]
  ): Promise<PreprocessingResult> {
    let processedData = [...data];
    const metadata = {
      operationsApplied: [],
      rowsAffected: 0,
      columnsAffected: new Set<string>(),
      warnings: []
    };

    for (const operation of operations) {
      try {
        const result = await this.applySingleOperation(processedData, operation);
        processedData = result.data;
        
        metadata.operationsApplied.push(operation);
        metadata.rowsAffected += result.metadata.rowsAffected;
        result.metadata.columnsAffected.forEach(col => metadata.columnsAffected.add(col));
        metadata.warnings.push(...result.metadata.warnings);
      } catch (error) {
        metadata.warnings.push(`Failed to apply operation ${operation.type}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      data: processedData,
      metadata: {
        ...metadata,
        columnsAffected: Array.from(metadata.columnsAffected)
      }
    };
  }

  /**
   * Apply a single preprocessing operation
   */
  private static async applySingleOperation(
    data: Record<string, any>[],
    operation: PreprocessingOperation
  ): Promise<PreprocessingResult> {
    switch (operation.type) {
      case PreprocessingType.CONVERT_TYPE:
        return this.convertDataType(data, operation.parameters as DataTypeConversionOptions);
      
      case PreprocessingType.HANDLE_MISSING:
        return this.handleMissingValues(data, operation.parameters as MissingValueOptions);
      
      case PreprocessingType.REMOVE_OUTLIERS:
        return this.handleOutliers(data, operation.parameters as OutlierDetectionOptions);
      
      case PreprocessingType.FILTER_ROWS:
        return this.filterRows(data, operation.parameters.filters as DataFilter[]);
      
      case PreprocessingType.CREATE_VARIABLE:
        return this.createVariable(data, operation.parameters as FormulaOptions);
      
      case PreprocessingType.REMOVE_DUPLICATES:
        return this.removeDuplicates(data, operation.parameters.columns as string[]);
      
      case PreprocessingType.NORMALIZE:
        return this.normalizeColumns(data, operation.parameters.columns as string[]);
      
      case PreprocessingType.STANDARDIZE:
        return this.standardizeColumns(data, operation.parameters.columns as string[]);
      
      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  /**
   * Convert data types for specified columns
   */
  static convertDataType(
    data: Record<string, any>[],
    options: DataTypeConversionOptions
  ): PreprocessingResult {
    const { column, targetType, dateFormat, booleanMapping } = options;
    const processedData = [...data];
    let rowsAffected = 0;
    const warnings: string[] = [];

    for (let i = 0; i < processedData.length; i++) {
      const originalValue = processedData[i][column];
      
      if (originalValue === null || originalValue === undefined || originalValue === '') {
        continue;
      }

      try {
        let convertedValue;
        
        switch (targetType) {
          case DataType.NUMERIC:
            convertedValue = this.convertToNumeric(originalValue);
            break;
          
          case DataType.DATE:
            convertedValue = this.convertToDate(originalValue, dateFormat);
            break;
          
          case DataType.BOOLEAN:
            convertedValue = this.convertToBoolean(originalValue, booleanMapping);
            break;
          
          case DataType.TEXT:
            convertedValue = String(originalValue);
            break;
          
          case DataType.CATEGORICAL:
            convertedValue = String(originalValue);
            break;
          
          default:
            throw new Error(`Unsupported target type: ${targetType}`);
        }

        if (convertedValue !== originalValue) {
          processedData[i][column] = convertedValue;
          rowsAffected++;
        }
      } catch (error) {
        warnings.push(`Failed to convert value "${originalValue}" in row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected: [column],
        warnings
      }
    };
  }

  /**
   * Handle missing values in data
   */
  static handleMissingValues(
    data: Record<string, any>[],
    options: MissingValueOptions
  ): PreprocessingResult {
    const { strategy, fillValue, columns } = options;
    const processedData = [...data];
    const warnings: string[] = [];
    let rowsAffected = 0;
    const columnsAffected = new Set<string>();

    const targetColumns = columns || Object.keys(data[0] || {});

    for (const column of targetColumns) {
      const columnValues = data.map(row => row[column]);
      const nonMissingValues = columnValues.filter(val => val !== null && val !== undefined && val !== '');
      
      if (nonMissingValues.length === 0) {
        warnings.push(`Column "${column}" has no non-missing values`);
        continue;
      }

      let fillValueForColumn = fillValue;

      // Calculate fill value based on strategy
      if (strategy === 'fill_mean' && this.isNumericColumn(nonMissingValues)) {
        fillValueForColumn = ss.mean(nonMissingValues.map(Number));
      } else if (strategy === 'fill_median' && this.isNumericColumn(nonMissingValues)) {
        fillValueForColumn = ss.median(nonMissingValues.map(Number));
      } else if (strategy === 'fill_mode') {
        fillValueForColumn = ss.mode(nonMissingValues);
      }

      // Apply the strategy
      for (let i = 0; i < processedData.length; i++) {
        const value = processedData[i][column];
        
        if (value === null || value === undefined || value === '') {
          if (strategy === 'remove') {
            // Mark row for removal
            processedData[i]._toRemove = true;
          } else if (strategy === 'interpolate' && this.isNumericColumn(nonMissingValues)) {
            // Simple linear interpolation
            const interpolatedValue = this.interpolateValue(processedData, column, i);
            processedData[i][column] = interpolatedValue;
            rowsAffected++;
            columnsAffected.add(column);
          } else {
            processedData[i][column] = fillValueForColumn;
            rowsAffected++;
            columnsAffected.add(column);
          }
        }
      }
    }

    // Remove rows marked for removal
    const finalData = strategy === 'remove' 
      ? processedData.filter(row => !row._toRemove).map(row => {
          const { _toRemove, ...cleanRow } = row;
          return cleanRow;
        })
      : processedData;

    if (strategy === 'remove') {
      rowsAffected = data.length - finalData.length;
    }

    return {
      data: finalData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected: Array.from(columnsAffected),
        warnings
      }
    };
  }

  /**
   * Detect and handle outliers
   */
  static handleOutliers(
    data: Record<string, any>[],
    options: OutlierDetectionOptions
  ): PreprocessingResult {
    const { method, threshold = 3, action, columns } = options;
    const processedData = [...data];
    const warnings: string[] = [];
    let rowsAffected = 0;
    const columnsAffected = new Set<string>();

    const targetColumns = columns || Object.keys(data[0] || {}).filter(col => {
      const values = data.map(row => row[col]).filter(val => val !== null && val !== undefined && val !== '');
      return this.isNumericColumn(values);
    });

    for (const column of targetColumns) {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
      
      if (!this.isNumericColumn(values)) {
        warnings.push(`Column "${column}" is not numeric, skipping outlier detection`);
        continue;
      }

      const numericValues = values.map(Number);
      const outlierIndices = this.detectOutliers(numericValues, method, threshold);
      
      if (outlierIndices.length === 0) {
        continue;
      }

      columnsAffected.add(column);

      // Map outlier indices back to original data
      let valueIndex = 0;
      for (let i = 0; i < processedData.length; i++) {
        const value = processedData[i][column];
        
        if (value !== null && value !== undefined && value !== '') {
          if (outlierIndices.includes(valueIndex)) {
            if (action === 'remove') {
              processedData[i]._toRemove = true;
            } else if (action === 'cap') {
              const cappedValue = this.capOutlier(Number(value), numericValues, method, threshold);
              processedData[i][column] = cappedValue;
              rowsAffected++;
            } else if (action === 'flag') {
              processedData[i][`${column}_outlier`] = true;
              rowsAffected++;
            }
          }
          valueIndex++;
        }
      }
    }

    // Remove rows marked for removal
    const finalData = action === 'remove' 
      ? processedData.filter(row => !row._toRemove).map(row => {
          const { _toRemove, ...cleanRow } = row;
          return cleanRow;
        })
      : processedData;

    if (action === 'remove') {
      rowsAffected = data.length - finalData.length;
    }

    return {
      data: finalData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected: Array.from(columnsAffected),
        warnings
      }
    };
  }

  /**
   * Filter rows based on conditions
   */
  static filterRows(
    data: Record<string, any>[],
    filters: DataFilter[]
  ): PreprocessingResult {
    if (!filters || filters.length === 0) {
      return {
        data,
        metadata: {
          operationsApplied: [],
          rowsAffected: 0,
          columnsAffected: [],
          warnings: []
        }
      };
    }

    const processedData = data.filter(row => this.evaluateFilters(row, filters));
    const rowsAffected = data.length - processedData.length;
    const columnsAffected = [...new Set(filters.map(f => f.column))];

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected,
        warnings: []
      }
    };
  }

  /**
   * Create new variable using formula
   */
  static createVariable(
    data: Record<string, any>[],
    options: FormulaOptions
  ): PreprocessingResult {
    const { newColumnName, formula, variables } = options;
    const processedData = [...data];
    const warnings: string[] = [];
    let rowsAffected = 0;

    for (let i = 0; i < processedData.length; i++) {
      try {
        const result = this.evaluateFormula(formula, variables, processedData[i]);
        processedData[i][newColumnName] = result;
        rowsAffected++;
      } catch (error) {
        warnings.push(`Failed to evaluate formula for row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        processedData[i][newColumnName] = null;
      }
    }

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected: [newColumnName],
        warnings
      }
    };
  }

  /**
   * Remove duplicate rows
   */
  static removeDuplicates(
    data: Record<string, any>[],
    columns?: string[]
  ): PreprocessingResult {
    const compareColumns = columns || Object.keys(data[0] || {});
    const seen = new Set<string>();
    const processedData: Record<string, any>[] = [];

    for (const row of data) {
      const key = compareColumns.map(col => String(row[col] || '')).join('|');
      
      if (!seen.has(key)) {
        seen.add(key);
        processedData.push(row);
      }
    }

    const rowsAffected = data.length - processedData.length;

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected: compareColumns,
        warnings: []
      }
    };
  }

  /**
   * Normalize columns (min-max scaling)
   */
  static normalizeColumns(
    data: Record<string, any>[],
    columns: string[]
  ): PreprocessingResult {
    const processedData = [...data];
    const warnings: string[] = [];
    let rowsAffected = 0;
    const columnsAffected: string[] = [];

    for (const column of columns) {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
      
      if (!this.isNumericColumn(values)) {
        warnings.push(`Column "${column}" is not numeric, skipping normalization`);
        continue;
      }

      const numericValues = values.map(Number);
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const range = max - min;

      if (range === 0) {
        warnings.push(`Column "${column}" has no variance, skipping normalization`);
        continue;
      }

      columnsAffected.push(column);

      for (let i = 0; i < processedData.length; i++) {
        const value = processedData[i][column];
        
        if (value !== null && value !== undefined && value !== '') {
          const normalizedValue = (Number(value) - min) / range;
          processedData[i][column] = normalizedValue;
          rowsAffected++;
        }
      }
    }

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected,
        warnings
      }
    };
  }

  /**
   * Standardize columns (z-score)
   */
  static standardizeColumns(
    data: Record<string, any>[],
    columns: string[]
  ): PreprocessingResult {
    const processedData = [...data];
    const warnings: string[] = [];
    let rowsAffected = 0;
    const columnsAffected: string[] = [];

    for (const column of columns) {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined && val !== '');
      
      if (!this.isNumericColumn(values)) {
        warnings.push(`Column "${column}" is not numeric, skipping standardization`);
        continue;
      }

      const numericValues = values.map(Number);
      const mean = ss.mean(numericValues);
      const stdDev = ss.standardDeviation(numericValues);

      if (stdDev === 0) {
        warnings.push(`Column "${column}" has no variance, skipping standardization`);
        continue;
      }

      columnsAffected.push(column);

      for (let i = 0; i < processedData.length; i++) {
        const value = processedData[i][column];
        
        if (value !== null && value !== undefined && value !== '') {
          const standardizedValue = (Number(value) - mean) / stdDev;
          processedData[i][column] = standardizedValue;
          rowsAffected++;
        }
      }
    }

    return {
      data: processedData,
      metadata: {
        operationsApplied: [],
        rowsAffected,
        columnsAffected,
        warnings
      }
    };
  }

  /**
   * Validate data quality
   */
  static validateDataQuality(data: Record<string, any>[]): {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (data.length === 0) {
      issues.push('Dataset is empty');
      return { isValid: false, issues, suggestions };
    }

    const columns = Object.keys(data[0]);
    
    // Check for missing column names
    const emptyColumns = columns.filter(col => !col || col.trim() === '');
    if (emptyColumns.length > 0) {
      issues.push(`Found ${emptyColumns.length} columns with empty names`);
      suggestions.push('Rename columns with empty names');
    }

    // Check for duplicate column names
    const duplicateColumns = columns.filter((col, index) => columns.indexOf(col) !== index);
    if (duplicateColumns.length > 0) {
      issues.push(`Found duplicate column names: ${duplicateColumns.join(', ')}`);
      suggestions.push('Rename duplicate columns');
    }

    // Analyze each column
    for (const column of columns) {
      const values = data.map(row => row[column]);
      const nonMissingValues = values.filter(val => val !== null && val !== undefined && val !== '');
      const missingCount = values.length - nonMissingValues.length;
      const missingPercentage = (missingCount / values.length) * 100;

      // High missing value percentage
      if (missingPercentage > 50) {
        issues.push(`Column "${column}" has ${missingPercentage.toFixed(1)}% missing values`);
        suggestions.push(`Consider removing column "${column}" or imputing missing values`);
      } else if (missingPercentage > 20) {
        suggestions.push(`Column "${column}" has ${missingPercentage.toFixed(1)}% missing values - consider imputation`);
      }

      // Check for constant values
      const uniqueValues = new Set(nonMissingValues);
      if (uniqueValues.size === 1 && nonMissingValues.length > 1) {
        issues.push(`Column "${column}" has constant values`);
        suggestions.push(`Consider removing column "${column}" as it provides no variance`);
      }

      // Check for potential data type issues
      if (this.isNumericColumn(nonMissingValues)) {
        const numericValues = nonMissingValues.map(Number);
        const hasInfinite = numericValues.some(val => !isFinite(val));
        if (hasInfinite) {
          issues.push(`Column "${column}" contains infinite values`);
          suggestions.push(`Handle infinite values in column "${column}"`);
        }
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions
    };
  }

  // Helper methods

  private static convertToNumeric(value: any): number {
    if (typeof value === 'number') return value;
    
    const numValue = Number(value);
    if (isNaN(numValue)) {
      throw new Error(`Cannot convert "${value}" to numeric`);
    }
    
    return numValue;
  }

  private static convertToDate(value: any, format?: string): Date {
    if (value instanceof Date) return value;
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Cannot convert "${value}" to date`);
    }
    
    return date;
  }

  private static convertToBoolean(value: any, mapping?: { true: any[]; false: any[] }): boolean {
    if (typeof value === 'boolean') return value;
    
    if (mapping) {
      if (mapping.true.includes(value)) return true;
      if (mapping.false.includes(value)) return false;
    }
    
    const stringValue = String(value).toLowerCase();
    const trueValues = ['true', 'yes', '1', 'on', 'y'];
    const falseValues = ['false', 'no', '0', 'off', 'n'];
    
    if (trueValues.includes(stringValue)) return true;
    if (falseValues.includes(stringValue)) return false;
    
    throw new Error(`Cannot convert "${value}" to boolean`);
  }

  private static isNumericColumn(values: any[]): boolean {
    if (values.length === 0) return false;
    
    return values.every(val => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    });
  }

  private static interpolateValue(data: Record<string, any>[], column: string, index: number): number {
    // Find nearest non-missing values
    let prevValue: number | null = null;
    let nextValue: number | null = null;
    let prevIndex = -1;
    let nextIndex = -1;

    // Look backwards
    for (let i = index - 1; i >= 0; i--) {
      const val = data[i][column];
      if (val !== null && val !== undefined && val !== '') {
        prevValue = Number(val);
        prevIndex = i;
        break;
      }
    }

    // Look forwards
    for (let i = index + 1; i < data.length; i++) {
      const val = data[i][column];
      if (val !== null && val !== undefined && val !== '') {
        nextValue = Number(val);
        nextIndex = i;
        break;
      }
    }

    // Interpolate
    if (prevValue !== null && nextValue !== null) {
      const ratio = (index - prevIndex) / (nextIndex - prevIndex);
      return prevValue + (nextValue - prevValue) * ratio;
    } else if (prevValue !== null) {
      return prevValue;
    } else if (nextValue !== null) {
      return nextValue;
    } else {
      return 0; // Fallback
    }
  }

  private static detectOutliers(values: number[], method: string, threshold: number): number[] {
    const outlierIndices: number[] = [];

    switch (method) {
      case 'iqr':
        const q1 = ss.quantile(values, 0.25);
        const q3 = ss.quantile(values, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        values.forEach((value, index) => {
          if (value < lowerBound || value > upperBound) {
            outlierIndices.push(index);
          }
        });
        break;

      case 'zscore':
        const mean = ss.mean(values);
        const stdDev = ss.standardDeviation(values);
        
        values.forEach((value, index) => {
          const zScore = Math.abs((value - mean) / stdDev);
          if (zScore > threshold) {
            outlierIndices.push(index);
          }
        });
        break;

      case 'modified_zscore':
        const median = ss.median(values);
        const mad = ss.median(values.map(v => Math.abs(v - median)));
        const modifiedZScoreConstant = 0.6745;
        
        values.forEach((value, index) => {
          const modifiedZScore = modifiedZScoreConstant * (value - median) / mad;
          if (Math.abs(modifiedZScore) > threshold) {
            outlierIndices.push(index);
          }
        });
        break;
    }

    return outlierIndices;
  }

  private static capOutlier(value: number, values: number[], method: string, threshold: number): number {
    switch (method) {
      case 'iqr':
        const q1 = ss.quantile(values, 0.25);
        const q3 = ss.quantile(values, 0.75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        if (value < lowerBound) return lowerBound;
        if (value > upperBound) return upperBound;
        return value;

      case 'zscore':
      case 'modified_zscore':
        const mean = ss.mean(values);
        const stdDev = ss.standardDeviation(values);
        const lowerCap = mean - threshold * stdDev;
        const upperCap = mean + threshold * stdDev;
        
        if (value < lowerCap) return lowerCap;
        if (value > upperCap) return upperCap;
        return value;

      default:
        return value;
    }
  }

  private static evaluateFilters(row: Record<string, any>, filters: DataFilter[]): boolean {
    if (filters.length === 0) return true;

    let result = this.evaluateFilter(row, filters[0]);

    for (let i = 1; i < filters.length; i++) {
      const filterResult = this.evaluateFilter(row, filters[i]);
      const logicalOp = filters[i].logicalOperator || 'AND';
      
      if (logicalOp === 'AND') {
        result = result && filterResult;
      } else {
        result = result || filterResult;
      }
    }

    return result;
  }

  private static evaluateFilter(row: Record<string, any>, filter: DataFilter): boolean {
    const { column, operator, value } = filter;
    const cellValue = row[column];

    switch (operator) {
      case FilterOperator.EQUALS:
        return cellValue == value;
      
      case FilterOperator.NOT_EQUALS:
        return cellValue != value;
      
      case FilterOperator.GREATER_THAN:
        return Number(cellValue) > Number(value);
      
      case FilterOperator.LESS_THAN:
        return Number(cellValue) < Number(value);
      
      case FilterOperator.GREATER_EQUAL:
        return Number(cellValue) >= Number(value);
      
      case FilterOperator.LESS_EQUAL:
        return Number(cellValue) <= Number(value);
      
      case FilterOperator.CONTAINS:
        return String(cellValue).toLowerCase().includes(String(value).toLowerCase());
      
      case FilterOperator.NOT_CONTAINS:
        return !String(cellValue).toLowerCase().includes(String(value).toLowerCase());
      
      case FilterOperator.STARTS_WITH:
        return String(cellValue).toLowerCase().startsWith(String(value).toLowerCase());
      
      case FilterOperator.ENDS_WITH:
        return String(cellValue).toLowerCase().endsWith(String(value).toLowerCase());
      
      case FilterOperator.IS_NULL:
        return cellValue === null || cellValue === undefined || cellValue === '';
      
      case FilterOperator.IS_NOT_NULL:
        return cellValue !== null && cellValue !== undefined && cellValue !== '';
      
      case FilterOperator.IN:
        return Array.isArray(value) && value.includes(cellValue);
      
      case FilterOperator.NOT_IN:
        return Array.isArray(value) && !value.includes(cellValue);
      
      default:
        return true;
    }
  }

  private static evaluateFormula(
    formula: string,
    variables: Record<string, string>,
    row: Record<string, any>
  ): any {
    // Simple formula evaluator - supports basic arithmetic and functions
    let expression = formula;

    // Replace variables with actual values
    for (const [variable, columnName] of Object.entries(variables)) {
      const value = row[columnName];
      const numericValue = this.isNumericColumn([value]) ? Number(value) : 0;
      expression = expression.replace(new RegExp(`\\b${variable}\\b`, 'g'), String(numericValue));
    }

    // Support basic mathematical functions
    expression = expression.replace(/\babs\(([^)]+)\)/g, 'Math.abs($1)');
    expression = expression.replace(/\bsqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
    expression = expression.replace(/\bpow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');
    expression = expression.replace(/\blog\(([^)]+)\)/g, 'Math.log($1)');
    expression = expression.replace(/\bexp\(([^)]+)\)/g, 'Math.exp($1)');
    expression = expression.replace(/\bsin\(([^)]+)\)/g, 'Math.sin($1)');
    expression = expression.replace(/\bcos\(([^)]+)\)/g, 'Math.cos($1)');
    expression = expression.replace(/\btan\(([^)]+)\)/g, 'Math.tan($1)');

    // Evaluate the expression safely
    try {
      // Basic validation to prevent code injection - allow Math functions
      const functionCalls = expression.match(/(?:^|[^a-zA-Z0-9_$.])[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/g) || [];
      for (const funcCall of functionCalls) {
        const cleanFunc = funcCall.replace(/^[^a-zA-Z_$]*/, '').replace(/\s*\($/, '');
        if (!cleanFunc.startsWith('Math.')) {
          throw new Error('Invalid function call in formula');
        }
      }
      
      return Function(`"use strict"; return (${expression})`)();
    } catch (error) {
      throw new Error(`Invalid formula: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}