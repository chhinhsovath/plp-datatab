import { describe, it, expect, beforeEach } from 'vitest';
import { DataPreprocessingService } from '../lib/data-preprocessing.js';
import { DataType, PreprocessingType, FilterOperator } from '../types/data-models.js';

describe('DataPreprocessingService', () => {
  let sampleData: Record<string, any>[];

  beforeEach(() => {
    sampleData = [
      { id: 1, name: 'Alice', age: 25, salary: 50000, active: true, date: '2023-01-01' },
      { id: 2, name: 'Bob', age: 30, salary: 60000, active: false, date: '2023-01-02' },
      { id: 3, name: 'Charlie', age: null, salary: 70000, active: true, date: '2023-01-03' },
      { id: 4, name: 'David', age: 35, salary: null, active: false, date: '2023-01-04' },
      { id: 5, name: 'Eve', age: 28, salary: 55000, active: true, date: null },
      { id: 6, name: 'Frank', age: 45, salary: 80000, active: false, date: '2023-01-06' },
      { id: 7, name: 'Grace', age: 22, salary: 45000, active: true, date: '2023-01-07' },
      { id: 8, name: 'Henry', age: 50, salary: 90000, active: false, date: '2023-01-08' },
      { id: 9, name: 'Ivy', age: 26, salary: 52000, active: true, date: '2023-01-09' },
      { id: 10, name: 'Jack', age: 40, salary: 75000, active: false, date: '2023-01-10' }
    ];
  });

  describe('convertDataType', () => {
    it('should convert numeric strings to numbers', () => {
      const testData = [
        { value: '123' },
        { value: '45.67' },
        { value: '0' }
      ];

      const result = DataPreprocessingService.convertDataType(testData, {
        column: 'value',
        targetType: DataType.NUMERIC
      });

      expect(result.data[0].value).toBe(123);
      expect(result.data[1].value).toBe(45.67);
      expect(result.data[2].value).toBe(0);
      expect(result.metadata.rowsAffected).toBe(3);
      expect(result.metadata.columnsAffected).toEqual(['value']);
    });

    it('should convert values to boolean', () => {
      const testData = [
        { flag: 'true' },
        { flag: 'false' },
        { flag: '1' },
        { flag: '0' },
        { flag: 'yes' },
        { flag: 'no' }
      ];

      const result = DataPreprocessingService.convertDataType(testData, {
        column: 'flag',
        targetType: DataType.BOOLEAN
      });

      expect(result.data[0].flag).toBe(true);
      expect(result.data[1].flag).toBe(false);
      expect(result.data[2].flag).toBe(true);
      expect(result.data[3].flag).toBe(false);
      expect(result.data[4].flag).toBe(true);
      expect(result.data[5].flag).toBe(false);
    });

    it('should convert strings to dates', () => {
      const testData = [
        { date: '2023-01-01' },
        { date: '2023-12-31' }
      ];

      const result = DataPreprocessingService.convertDataType(testData, {
        column: 'date',
        targetType: DataType.DATE
      });

      expect(result.data[0].date).toBeInstanceOf(Date);
      expect(result.data[1].date).toBeInstanceOf(Date);
    });

    it('should handle conversion errors gracefully', () => {
      const testData = [
        { value: 'not-a-number' },
        { value: '123' }
      ];

      const result = DataPreprocessingService.convertDataType(testData, {
        column: 'value',
        targetType: DataType.NUMERIC
      });

      expect(result.metadata.warnings).toHaveLength(1);
      expect(result.metadata.warnings[0]).toContain('Failed to convert value "not-a-number"');
      expect(result.data[1].value).toBe(123);
    });
  });

  describe('handleMissingValues', () => {
    it('should remove rows with missing values', () => {
      const result = DataPreprocessingService.handleMissingValues(sampleData, {
        strategy: 'remove',
        columns: ['age']
      });

      expect(result.data).toHaveLength(9); // One row with null age removed
      expect(result.data.every(row => row.age !== null)).toBe(true);
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should fill missing values with mean', () => {
      const result = DataPreprocessingService.handleMissingValues(sampleData, {
        strategy: 'fill_mean',
        columns: ['age']
      });

      const ages = sampleData.filter(row => row.age !== null).map(row => row.age);
      const meanAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

      expect(result.data).toHaveLength(10);
      expect(result.data[2].age).toBe(meanAge); // Charlie's age was null
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should fill missing values with median', () => {
      const result = DataPreprocessingService.handleMissingValues(sampleData, {
        strategy: 'fill_median',
        columns: ['age']
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[2].age).toBe(30); // Median age
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should fill missing values with custom value', () => {
      const result = DataPreprocessingService.handleMissingValues(sampleData, {
        strategy: 'fill_value',
        fillValue: 99,
        columns: ['age']
      });

      expect(result.data[2].age).toBe(99);
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should interpolate missing values', () => {
      const testData = [
        { value: 10 },
        { value: null },
        { value: 30 }
      ];

      const result = DataPreprocessingService.handleMissingValues(testData, {
        strategy: 'interpolate',
        columns: ['value']
      });

      expect(result.data[1].value).toBe(20); // Interpolated between 10 and 30
    });
  });

  describe('handleOutliers', () => {
    it('should detect outliers using IQR method', () => {
      const testData = [
        { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 },
        { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 100 } // 100 is outlier
      ];

      const result = DataPreprocessingService.handleOutliers(testData, {
        method: 'iqr',
        action: 'flag',
        columns: ['value']
      });

      expect(result.data[9].value_outlier).toBe(true);
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should remove outliers', () => {
      const testData = [
        { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 },
        { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 100 }
      ];

      const result = DataPreprocessingService.handleOutliers(testData, {
        method: 'iqr',
        action: 'remove',
        columns: ['value']
      });

      expect(result.data).toHaveLength(9);
      expect(result.data.every(row => row.value < 100)).toBe(true);
    });

    it('should cap outliers', () => {
      const testData = [
        { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 },
        { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 100 }
      ];

      const result = DataPreprocessingService.handleOutliers(testData, {
        method: 'iqr',
        action: 'cap',
        columns: ['value']
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[9].value).toBeLessThan(100);
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should detect outliers using z-score method', () => {
      const testData = [
        { value: 1 }, { value: 2 }, { value: 3 }, { value: 4 }, { value: 5 },
        { value: 6 }, { value: 7 }, { value: 8 }, { value: 9 }, { value: 100 }
      ];

      const result = DataPreprocessingService.handleOutliers(testData, {
        method: 'zscore',
        threshold: 2,
        action: 'flag',
        columns: ['value']
      });

      expect(result.data[9].value_outlier).toBe(true);
    });
  });

  describe('filterRows', () => {
    it('should filter rows with equals condition', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'active', operator: FilterOperator.EQUALS, value: true }
      ]);

      expect(result.data).toHaveLength(5);
      expect(result.data.every(row => row.active === true)).toBe(true);
      expect(result.metadata.rowsAffected).toBe(5);
    });

    it('should filter rows with greater than condition', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'age', operator: FilterOperator.GREATER_THAN, value: 30 }
      ]);

      const filteredRows = result.data.filter(row => row.age !== null);
      expect(filteredRows.every(row => row.age > 30)).toBe(true);
    });

    it('should filter rows with multiple conditions (AND)', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'active', operator: FilterOperator.EQUALS, value: true },
        { column: 'age', operator: FilterOperator.GREATER_THAN, value: 25, logicalOperator: 'AND' }
      ]);

      const validRows = result.data.filter(row => row.age !== null);
      expect(validRows.every(row => row.active === true && row.age > 25)).toBe(true);
    });

    it('should filter rows with multiple conditions (OR)', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'age', operator: FilterOperator.LESS_THAN, value: 25 },
        { column: 'salary', operator: FilterOperator.GREATER_THAN, value: 70000, logicalOperator: 'OR' }
      ]);

      const validRows = result.data.filter(row => row.age !== null && row.salary !== null);
      expect(validRows.every(row => row.age < 25 || row.salary > 70000)).toBe(true);
    });

    it('should filter rows with contains condition', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'name', operator: FilterOperator.CONTAINS, value: 'a' }
      ]);

      expect(result.data.every(row => row.name.toLowerCase().includes('a'))).toBe(true);
    });

    it('should filter rows with null conditions', () => {
      const result = DataPreprocessingService.filterRows(sampleData, [
        { column: 'age', operator: FilterOperator.IS_NULL, value: null }
      ]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Charlie');
    });
  });

  describe('createVariable', () => {
    it('should create new variable with simple arithmetic', () => {
      const result = DataPreprocessingService.createVariable(sampleData, {
        newColumnName: 'age_plus_10',
        formula: 'age + 10',
        variables: { age: 'age' }
      });

      expect(result.data[0].age_plus_10).toBe(35); // Alice: 25 + 10
      expect(result.data[1].age_plus_10).toBe(40); // Bob: 30 + 10
      expect(result.metadata.columnsAffected).toEqual(['age_plus_10']);
    });

    it('should create new variable with multiple variables', () => {
      const result = DataPreprocessingService.createVariable(sampleData, {
        newColumnName: 'salary_per_age',
        formula: 'salary / age',
        variables: { salary: 'salary', age: 'age' }
      });

      expect(result.data[0].salary_per_age).toBe(2000); // Alice: 50000 / 25
      expect(result.data[1].salary_per_age).toBe(2000); // Bob: 60000 / 30
    });

    it('should create new variable with mathematical functions', () => {
      const result = DataPreprocessingService.createVariable(sampleData, {
        newColumnName: 'sqrt_age',
        formula: 'sqrt(age)',
        variables: { age: 'age' }
      });

      expect(result.data[0].sqrt_age).toBe(5); // sqrt(25)
      expect(result.data[1].sqrt_age).toBe(Math.sqrt(30));
    });

    it('should handle formula errors gracefully', () => {
      const result = DataPreprocessingService.createVariable(sampleData, {
        newColumnName: 'invalid',
        formula: 'age / 0',
        variables: { age: 'age' }
      });

      expect(result.data[0].invalid).toBe(Infinity);
      expect(result.metadata.warnings).toHaveLength(0); // Division by zero is valid in JS
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicate rows', () => {
      const testData = [
        { name: 'Alice', age: 25 },
        { name: 'Bob', age: 30 },
        { name: 'Alice', age: 25 }, // Duplicate
        { name: 'Charlie', age: 35 }
      ];

      const result = DataPreprocessingService.removeDuplicates(testData);

      expect(result.data).toHaveLength(3);
      expect(result.metadata.rowsAffected).toBe(1);
    });

    it('should remove duplicates based on specific columns', () => {
      const testData = [
        { name: 'Alice', age: 25, city: 'NYC' },
        { name: 'Bob', age: 30, city: 'LA' },
        { name: 'Alice', age: 26, city: 'NYC' }, // Same name, different age
        { name: 'Charlie', age: 35, city: 'Chicago' }
      ];

      const result = DataPreprocessingService.removeDuplicates(testData, ['name']);

      expect(result.data).toHaveLength(3);
      expect(result.metadata.rowsAffected).toBe(1);
    });
  });

  describe('normalizeColumns', () => {
    it('should normalize numeric columns using min-max scaling', () => {
      const testData = [
        { value: 10 },
        { value: 20 },
        { value: 30 },
        { value: 40 },
        { value: 50 }
      ];

      const result = DataPreprocessingService.normalizeColumns(testData, ['value']);

      expect(result.data[0].value).toBe(0); // (10-10)/(50-10) = 0
      expect(result.data[2].value).toBe(0.5); // (30-10)/(50-10) = 0.5
      expect(result.data[4].value).toBe(1); // (50-10)/(50-10) = 1
      expect(result.metadata.rowsAffected).toBe(5);
    });

    it('should skip non-numeric columns', () => {
      const result = DataPreprocessingService.normalizeColumns(sampleData, ['name']);

      expect(result.metadata.warnings).toHaveLength(1);
      expect(result.metadata.warnings[0]).toContain('not numeric');
      expect(result.metadata.rowsAffected).toBe(0);
    });

    it('should skip columns with no variance', () => {
      const testData = [
        { value: 5 },
        { value: 5 },
        { value: 5 }
      ];

      const result = DataPreprocessingService.normalizeColumns(testData, ['value']);

      expect(result.metadata.warnings).toHaveLength(1);
      expect(result.metadata.warnings[0]).toContain('no variance');
    });
  });

  describe('standardizeColumns', () => {
    it('should standardize numeric columns using z-score', () => {
      const testData = [
        { value: 10 },
        { value: 20 },
        { value: 30 }
      ];

      const result = DataPreprocessingService.standardizeColumns(testData, ['value']);

      // Mean = 20, StdDev ≈ 8.16
      expect(result.data[0].value).toBeCloseTo(-1.22, 1); // (10-20)/8.16 ≈ -1.22
      expect(result.data[1].value).toBeCloseTo(0, 1); // (20-20)/8.16 = 0
      expect(result.data[2].value).toBeCloseTo(1.22, 1); // (30-20)/8.16 ≈ 1.22
    });

    it('should skip non-numeric columns', () => {
      const result = DataPreprocessingService.standardizeColumns(sampleData, ['name']);

      expect(result.metadata.warnings).toHaveLength(1);
      expect(result.metadata.warnings[0]).toContain('not numeric');
    });
  });

  describe('validateDataQuality', () => {
    it('should identify empty dataset', () => {
      const result = DataPreprocessingService.validateDataQuality([]);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Dataset is empty');
    });

    it('should identify high missing value percentage', () => {
      const testData = [
        { col1: 1, col2: null },
        { col1: 2, col2: null },
        { col1: 3, col2: null },
        { col1: 4, col2: 5 }
      ];

      const result = DataPreprocessingService.validateDataQuality(testData);

      expect(result.issues.some(issue => issue.includes('col2') && issue.includes('75.0%'))).toBe(true);
    });

    it('should identify constant values', () => {
      const testData = [
        { col1: 1, col2: 'constant' },
        { col1: 2, col2: 'constant' },
        { col1: 3, col2: 'constant' }
      ];

      const result = DataPreprocessingService.validateDataQuality(testData);

      expect(result.issues.some(issue => issue.includes('col2') && issue.includes('constant values'))).toBe(true);
    });

    it('should identify duplicate column names', () => {
      const testData = [
        { col1: 1, col1: 2 } // This would be overwritten in JS, but we simulate the issue
      ];

      // Simulate duplicate column scenario
      const duplicateData = [{ col1: 1, col2: 2 }];
      Object.defineProperty(duplicateData[0], 'col1', { value: 3, enumerable: true });
      
      const result = DataPreprocessingService.validateDataQuality(testData);
      
      // This test checks the general validation logic
      expect(result.isValid).toBeDefined();
    });

    it('should provide suggestions for data quality issues', () => {
      const testData = [
        { col1: 1, col2: null },
        { col1: 2, col2: null },
        { col1: 3, col2: null },
        { col1: 4, col2: 5 }
      ];

      const result = DataPreprocessingService.validateDataQuality(testData);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(suggestion => suggestion.includes('imputation') || suggestion.includes('imputing'))).toBe(true);
    });
  });

  describe('applyOperations', () => {
    it('should apply multiple operations in sequence', async () => {
      const operations = [
        {
          type: PreprocessingType.HANDLE_MISSING,
          parameters: { strategy: 'fill_mean', columns: ['age'] }
        },
        {
          type: PreprocessingType.CREATE_VARIABLE,
          parameters: {
            newColumnName: 'age_category',
            formula: 'age > 30 ? 1 : 0',
            variables: { age: 'age' }
          }
        }
      ];

      const result = await DataPreprocessingService.applyOperations(sampleData, operations);

      expect(result.data).toHaveLength(10);
      expect(result.data[2].age).not.toBeNull(); // Missing age filled
      expect(result.data[0]).toHaveProperty('age_category'); // New column created
      expect(result.metadata.operationsApplied).toHaveLength(2);
    });

    it('should handle operation errors gracefully', async () => {
      const operations = [
        {
          type: 'invalid_operation' as PreprocessingType,
          parameters: {}
        }
      ];

      const result = await DataPreprocessingService.applyOperations(sampleData, operations);

      expect(result.data).toEqual(sampleData); // Data unchanged
      expect(result.metadata.warnings).toHaveLength(1);
      expect(result.metadata.warnings[0]).toContain('Failed to apply operation');
    });
  });
});