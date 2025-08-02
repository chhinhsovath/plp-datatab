import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { DatasetMetadata, ColumnInfo, DataType, DescriptiveStats } from '../types/data-models.js';

export interface ImportResult {
  data: Record<string, any>[];
  metadata: DatasetMetadata;
}

export interface ImportOptions {
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
  selectedSheet?: string;
  maxRows?: number;
}

export class DataImportService {
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly MAX_SAMPLE_SIZE = 1000; // For type inference
  private static readonly SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json'];

  /**
   * Import data from a file
   */
  static async importFromFile(
    filePath: string,
    originalFileName: string,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    const fileExtension = path.extname(originalFileName).toLowerCase();
    
    if (!this.SUPPORTED_EXTENSIONS.includes(fileExtension)) {
      throw new Error(`Unsupported file format: ${fileExtension}`);
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }

    switch (fileExtension) {
      case '.csv':
        return this.importCSV(filePath, originalFileName, options);
      case '.xlsx':
      case '.xls':
        return this.importExcel(filePath, originalFileName, options);
      case '.json':
        return this.importJSON(filePath, originalFileName, options);
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }
  }

  /**
   * Import data from URL
   */
  static async importFromURL(url: string, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch data from URL: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const contentLength = response.headers.get('content-length');
      
      if (contentLength && parseInt(contentLength) > this.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      // Determine file type from content type or URL
      let fileType: 'csv' | 'json' | 'excel' = 'csv';
      if (contentType.includes('application/json') || url.includes('.json')) {
        fileType = 'json';
      } else if (contentType.includes('application/vnd.openxmlformats') || url.includes('.xlsx')) {
        fileType = 'excel';
      }

      const data = await response.text();
      
      // Create temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFileName = `temp_${Date.now()}.${fileType === 'json' ? 'json' : fileType === 'excel' ? 'xlsx' : 'csv'}`;
      const tempFilePath = path.join(tempDir, tempFileName);
      
      fs.writeFileSync(tempFilePath, data);
      
      try {
        const result = await this.importFromFile(tempFilePath, url, options);
        return result;
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to import from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import CSV file
   */
  private static async importCSV(
    filePath: string,
    originalFileName: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const data: Record<string, any>[] = [];
      const delimiter = options.delimiter || ',';
      const hasHeader = options.hasHeader !== false; // Default to true
      let rowCount = 0;
      
      const csvOptions: any = {
        separator: delimiter
      };
      
      // If no headers, use array indices as column names
      if (!hasHeader) {
        csvOptions.headers = false;
      }
      
      const stream = fs.createReadStream(filePath)
        .pipe(csv(csvOptions));

      stream.on('data', (row) => {
        if (options.maxRows && data.length >= options.maxRows) {
          return;
        }
        data.push(row);
      });

      stream.on('end', () => {
        try {
          const metadata = this.generateMetadata(data, {
            fileType: 'csv',
            originalFileName,
            delimiter,
            hasHeader,
            encoding: options.encoding || 'utf8'
          });
          
          resolve({ data, metadata });
        } catch (error) {
          reject(error);
        }
      });

      stream.on('error', (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      });
    });
  }

  /**
   * Import Excel file
   */
  private static async importExcel(
    filePath: string,
    originalFileName: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      // First check if it's a valid Excel file by trying to read it
      let workbook;
      try {
        workbook = XLSX.readFile(filePath);
      } catch (xlsxError) {
        throw new Error(`Invalid Excel file format: ${xlsxError instanceof Error ? xlsxError.message : 'Unknown error'}`);
      }

      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      const selectedSheet = options.selectedSheet || sheetNames[0];
      
      if (!sheetNames.includes(selectedSheet)) {
        throw new Error(`Sheet "${selectedSheet}" not found. Available sheets: ${sheetNames.join(', ')}`);
      }

      const worksheet = workbook.Sheets[selectedSheet];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: options.hasHeader !== false ? 1 : undefined,
        defval: null,
        raw: false
      }) as Record<string, any>[];

      // Limit rows if specified
      const limitedData = options.maxRows ? data.slice(0, options.maxRows) : data;

      const metadata = this.generateMetadata(limitedData, {
        fileType: 'excel',
        originalFileName,
        hasHeader: options.hasHeader !== false,
        sheets: sheetNames,
        selectedSheet
      });

      return { data: limitedData, metadata };
    } catch (error) {
      throw new Error(`Excel parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import JSON file
   */
  private static async importJSON(
    filePath: string,
    originalFileName: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);
      
      // Flatten JSON data to tabular format
      const data = this.flattenJSONData(jsonData);
      
      // Limit rows if specified
      const limitedData = options.maxRows ? data.slice(0, options.maxRows) : data;

      const metadata = this.generateMetadata(limitedData, {
        fileType: 'json',
        originalFileName,
        hasHeader: true,
        encoding: options.encoding || 'utf8'
      });

      return { data: limitedData, metadata };
    } catch (error) {
      throw new Error(`JSON parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Flatten nested JSON data to tabular format
   */
  private static flattenJSONData(jsonData: any): Record<string, any>[] {
    if (Array.isArray(jsonData)) {
      return jsonData.map(item => this.flattenObject(item));
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      return [this.flattenObject(jsonData)];
    } else {
      throw new Error('JSON data must be an object or array of objects');
    }
  }

  /**
   * Flatten a nested object
   */
  private static flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] === null || obj[key] === undefined) {
          flattened[newKey] = null;
        } else if (Array.isArray(obj[key])) {
          // Convert arrays to comma-separated strings
          flattened[newKey] = obj[key].join(', ');
        } else if (typeof obj[key] === 'object') {
          // Recursively flatten nested objects
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }
    
    return flattened;
  }  /**

   * Generate metadata for imported data
   */
  private static generateMetadata(
    data: Record<string, any>[],
    options: {
      fileType: 'csv' | 'excel' | 'json';
      originalFileName: string;
      delimiter?: string;
      encoding?: string;
      hasHeader: boolean;
      sheets?: string[];
      selectedSheet?: string;
    }
  ): DatasetMetadata {
    const columns = this.analyzeColumns(data);
    
    return {
      columns,
      rowCount: data.length,
      fileType: options.fileType,
      encoding: options.encoding,
      delimiter: options.delimiter,
      hasHeader: options.hasHeader,
      sheets: options.sheets,
      selectedSheet: options.selectedSheet,
      importedAt: new Date(),
      originalFileName: options.originalFileName
    };
  }

  /**
   * Analyze columns to determine data types and statistics
   */
  private static analyzeColumns(data: Record<string, any>[]): ColumnInfo[] {
    if (data.length === 0) {
      return [];
    }

    const columnNames = Object.keys(data[0]);
    const sampleSize = Math.min(data.length, this.MAX_SAMPLE_SIZE);
    const sampleData = data.slice(0, sampleSize);

    return columnNames.map(columnName => {
      const values = sampleData.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
      const allValues = data.map(row => row[columnName]);
      
      const missingValues = allValues.filter(val => val === null || val === undefined || val === '').length;
      const uniqueValues = new Set(values).size;
      const sampleValues = Array.from(new Set(values)).slice(0, 10);

      const dataType = this.inferDataType(values);
      const statistics = this.calculateBasicStatistics(values, dataType);

      return {
        name: columnName,
        dataType,
        missingValues,
        uniqueValues,
        statistics,
        sampleValues
      };
    });
  }

  /**
   * Infer data type from sample values
   */
  private static inferDataType(values: any[]): DataType {
    if (values.length === 0) {
      return DataType.TEXT;
    }

    // Check for boolean
    const booleanValues = values.filter(val => 
      typeof val === 'boolean' || 
      (typeof val === 'string' && ['true', 'false', 'yes', 'no', '1', '0'].includes(val.toLowerCase()))
    );
    if (booleanValues.length / values.length > 0.8) {
      return DataType.BOOLEAN;
    }

    // Check for numeric
    const numericValues = values.filter(val => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    });
    if (numericValues.length / values.length > 0.8) {
      return DataType.NUMERIC;
    }

    // Check for date
    const dateValues = values.filter(val => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && val.toString().match(/\d{4}|\d{1,2}\/\d{1,2}|\d{1,2}-\d{1,2}/);
    });
    if (dateValues.length / values.length > 0.8) {
      return DataType.DATE;
    }

    // Check for categorical (limited unique values)
    const uniqueCount = new Set(values).size;
    const uniqueRatio = uniqueCount / values.length;
    if (uniqueRatio < 0.5 && values.length > 5 && uniqueCount <= 10) {
      return DataType.CATEGORICAL;
    }

    return DataType.TEXT;
  }

  /**
   * Calculate basic statistics for a column
   */
  private static calculateBasicStatistics(values: any[], dataType: DataType): DescriptiveStats | undefined {
    if (values.length === 0) {
      return undefined;
    }

    const count = values.length;
    const nullCount = 0; // Already filtered out

    if (dataType === DataType.NUMERIC) {
      const numericValues = values.map(val => Number(val)).filter(val => !isNaN(val));
      
      if (numericValues.length === 0) {
        return { count, nullCount };
      }

      numericValues.sort((a, b) => a - b);
      
      const sum = numericValues.reduce((acc, val) => acc + val, 0);
      const mean = sum / numericValues.length;
      
      const median = numericValues.length % 2 === 0
        ? (numericValues[numericValues.length / 2 - 1] + numericValues[numericValues.length / 2]) / 2
        : numericValues[Math.floor(numericValues.length / 2)];
      
      const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (numericValues.length - 1);
      const standardDeviation = Math.sqrt(variance);
      
      const q1Index = Math.floor(numericValues.length * 0.25);
      const q3Index = Math.floor(numericValues.length * 0.75);
      const quartiles: [number, number, number] = [
        numericValues[q1Index],
        median,
        numericValues[q3Index]
      ];

      return {
        count,
        nullCount,
        mean,
        median,
        standardDeviation,
        variance,
        min: numericValues[0],
        max: numericValues[numericValues.length - 1],
        quartiles
      };
    }

    // For non-numeric data, just return count information
    return { count, nullCount };
  }

  /**
   * Get available sheets from Excel file
   */
  static getExcelSheets(filePath: string): string[] {
    try {
      const workbook = XLSX.readFile(filePath);
      return workbook.SheetNames;
    } catch (error) {
      throw new Error(`Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate file before import
   */
  static validateFile(filePath: string, originalFileName: string): { valid: boolean; error?: string } {
    try {
      // Check file extension first
      const fileExtension = path.extname(originalFileName).toLowerCase();
      if (!this.SUPPORTED_EXTENSIONS.includes(fileExtension)) {
        return { valid: false, error: `Unsupported file format: ${fileExtension}` };
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return { valid: false, error: 'File not found' };
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size > this.MAX_FILE_SIZE) {
        return { valid: false, error: `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB` };
      }

      // Check if file is empty
      if (stats.size === 0) {
        return { valid: false, error: 'File is empty' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `File validation error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}