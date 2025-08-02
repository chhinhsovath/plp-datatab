import { describe, it, expect } from 'vitest';
import { StatisticalAnalysisService } from '../lib/statistical-analysis.js';

describe('StatisticalAnalysisService', () => {
  
  describe('calculateDescriptiveStats', () => {
    it('should calculate correct descriptive statistics for normal data', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      expect(stats.mean).toBeCloseTo(5.5, 2);
      expect(stats.median).toBe(5.5);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.count).toBe(10);
      expect(stats.nullCount).toBe(0);
      expect(stats.standardDeviation).toBeCloseTo(2.87, 2);
      expect(stats.variance).toBeCloseTo(8.25, 2);
      expect(stats.quartiles).toEqual([3, 5.5, 8]);
    });

    it('should handle data with null values', () => {
      const data = [1, 2, null, 4, 5, undefined, 7, 8, 9, 10] as number[];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      expect(stats.count).toBe(8);
      expect(stats.nullCount).toBe(2);
      expect(stats.mean).toBeCloseTo(5.75, 2);
    });

    it('should handle empty data', () => {
      const data: number[] = [];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      expect(stats.count).toBe(0);
      expect(stats.nullCount).toBe(0);
    });

    it('should handle data with all null values', () => {
      const data = [null, undefined, null] as (number | null | undefined)[];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data as number[]);
      
      expect(stats.count).toBe(0);
      expect(stats.nullCount).toBe(3);
    });

    it('should calculate mode correctly', () => {
      const data = [1, 2, 2, 3, 3, 3, 4, 5];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      expect(stats.mode).toBe(3);
    });
  });

  describe('performFrequencyAnalysis', () => {
    it('should perform frequency analysis for categorical data', () => {
      const data = ['A', 'B', 'A', 'C', 'B', 'A'];
      const result = StatisticalAnalysisService.performFrequencyAnalysis(data);
      
      expect(result.frequencies).toEqual({
        'A': 3,
        'B': 2,
        'C': 1
      });
      expect(result.relativeFrequencies).toEqual({
        'A': 0.5,
        'B': 1/3,
        'C': 1/6
      });
      expect(result.cumulativeFrequencies).toEqual({
        'A': 3,
        'B': 5,
        'C': 6
      });
    });

    it('should create histogram for numeric data', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = StatisticalAnalysisService.performFrequencyAnalysis(data, 5);
      
      expect(result.histogram).toHaveLength(5);
      expect(result.histogram[0].count).toBe(2); // 1, 2
      expect(result.histogram[1].count).toBe(2); // 3, 4
      expect(result.histogram[2].count).toBe(2); // 5, 6
      expect(result.histogram[3].count).toBe(2); // 7, 8
      expect(result.histogram[4].count).toBe(2); // 9, 10
    });

    it('should handle data with null values', () => {
      const data = ['A', null, 'B', 'A', undefined, 'C'];
      const result = StatisticalAnalysisService.performFrequencyAnalysis(data);
      
      expect(result.frequencies).toEqual({
        'A': 2,
        'B': 1,
        'C': 1
      });
    });
  });

  describe('calculateCorrelationMatrix', () => {
    it('should calculate Pearson correlation matrix correctly', () => {
      const data = {
        'x': [1, 2, 3, 4, 5],
        'y': [2, 4, 6, 8, 10], // Perfect positive correlation
        'z': [5, 4, 3, 2, 1]   // Perfect negative correlation with x
      };
      
      const result = StatisticalAnalysisService.calculateCorrelationMatrix(data, 'pearson');
      
      expect(result.variables).toEqual(['x', 'y', 'z']);
      expect(result.matrix[0][0]).toBe(1); // x with x
      expect(result.matrix[0][1]).toBeCloseTo(1, 2); // x with y (perfect positive)
      expect(result.matrix[0][2]).toBeCloseTo(-1, 2); // x with z (perfect negative)
      expect(result.matrix[1][1]).toBe(1); // y with y
    });

    it('should handle data with missing values', () => {
      const data = {
        'x': [1, 2, null, 4, 5] as (number | null)[],
        'y': [2, 4, 6, null, 10] as (number | null)[]
      };
      
      const result = StatisticalAnalysisService.calculateCorrelationMatrix(data as { [key: string]: number[] }, 'pearson');
      
      expect(result.variables).toEqual(['x', 'y']);
      expect(result.matrix[0][0]).toBe(1);
      expect(result.matrix[1][1]).toBe(1);
      // Should still calculate correlation for available paired data
      expect(typeof result.matrix[0][1]).toBe('number');
    });

    it('should calculate Spearman correlation', () => {
      const data = {
        'x': [1, 2, 3, 4, 5],
        'y': [1, 4, 9, 16, 25] // Non-linear but monotonic relationship
      };
      
      const result = StatisticalAnalysisService.calculateCorrelationMatrix(data, 'spearman');
      
      expect(result.variables).toEqual(['x', 'y']);
      expect(result.matrix[0][1]).toBeCloseTo(1, 2); // Should be close to 1 for monotonic relationship
    });
  });

  describe('shapiroWilkTest', () => {
    it('should perform Shapiro-Wilk test', () => {
      const normalData = [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9];
      const result = StatisticalAnalysisService.shapiroWilkTest(normalData);
      
      expect(result.testName).toBe('Shapiro-Wilk');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(typeof result.isNormal).toBe('boolean');
      expect(result.alpha).toBe(0.05);
    });

    it('should throw error for insufficient data', () => {
      const data = [1, 2];
      expect(() => StatisticalAnalysisService.shapiroWilkTest(data)).toThrow();
    });

    it('should throw error for too much data', () => {
      const data = Array(6000).fill(0).map((_, i) => i);
      expect(() => StatisticalAnalysisService.shapiroWilkTest(data)).toThrow();
    });

    it('should handle custom alpha level', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = StatisticalAnalysisService.shapiroWilkTest(data, 0.01);
      
      expect(result.alpha).toBe(0.01);
    });
  });

  describe('kolmogorovSmirnovTest', () => {
    it('should perform Kolmogorov-Smirnov test', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = StatisticalAnalysisService.kolmogorovSmirnovTest(data);
      
      expect(result.testName).toBe('Kolmogorov-Smirnov');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(typeof result.isNormal).toBe('boolean');
      expect(result.alpha).toBe(0.05);
    });

    it('should throw error for empty data', () => {
      const data: number[] = [];
      expect(() => StatisticalAnalysisService.kolmogorovSmirnovTest(data)).toThrow();
    });

    it('should handle custom alpha level', () => {
      const data = [1, 2, 3, 4, 5];
      const result = StatisticalAnalysisService.kolmogorovSmirnovTest(data, 0.01);
      
      expect(result.alpha).toBe(0.01);
    });
  });

  describe('createContingencyTable', () => {
    it('should create contingency table correctly', () => {
      const rowData = ['A', 'A', 'B', 'B', 'A', 'B'];
      const columnData = ['X', 'Y', 'X', 'Y', 'X', 'X'];
      
      const result = StatisticalAnalysisService.createContingencyTable(
        rowData, columnData, 'Category', 'Group'
      );
      
      expect(result.rowVariable).toBe('Category');
      expect(result.columnVariable).toBe('Group');
      expect(result.rowLabels).toEqual(['A', 'B']);
      expect(result.columnLabels).toEqual(['X', 'Y']);
      expect(result.table).toEqual([
        [2, 1], // A: 2 in X, 1 in Y
        [2, 1]  // B: 2 in X, 1 in Y
      ]);
      expect(result.totals.rowTotals).toEqual([3, 3]);
      expect(result.totals.columnTotals).toEqual([4, 2]);
      expect(result.totals.grandTotal).toBe(6);
    });

    it('should perform chi-square test', () => {
      const rowData = ['A', 'A', 'B', 'B', 'A', 'B', 'A', 'B'];
      const columnData = ['X', 'Y', 'X', 'Y', 'X', 'X', 'Y', 'Y'];
      
      const result = StatisticalAnalysisService.createContingencyTable(
        rowData, columnData, 'Category', 'Group'
      );
      
      expect(result.chiSquareTest).toBeDefined();
      expect(typeof result.chiSquareTest!.statistic).toBe('number');
      expect(typeof result.chiSquareTest!.pValue).toBe('number');
      expect(typeof result.chiSquareTest!.degreesOfFreedom).toBe('number');
      expect(typeof result.chiSquareTest!.cramersV).toBe('number');
      expect(result.chiSquareTest!.expected).toBeDefined();
    });

    it('should handle mismatched data lengths', () => {
      const rowData = ['A', 'B'];
      const columnData = ['X', 'Y', 'Z'];
      
      expect(() => StatisticalAnalysisService.createContingencyTable(
        rowData, columnData, 'Category', 'Group'
      )).toThrow();
    });

    it('should handle data with null values', () => {
      const rowData = ['A', null, 'B', 'A', undefined];
      const columnData = ['X', 'Y', null, 'Y', 'X'];
      
      const result = StatisticalAnalysisService.createContingencyTable(
        rowData, columnData, 'Category', 'Group'
      );
      
      // Should only count valid pairs
      expect(result.totals.grandTotal).toBe(2); // Only 'A'-'Y' and 'B'-null (excluded)
    });
  });

  // ============ ADVANCED STATISTICAL TESTS ============

  describe('oneSampleTTest', () => {
    it('should perform one-sample t-test correctly', () => {
      const data = [2.1, 2.3, 2.0, 2.4, 2.2, 2.5, 1.9, 2.1, 2.3, 2.0];
      const populationMean = 2.0;
      
      const result = StatisticalAnalysisService.oneSampleTTest(data, populationMean);
      
      expect(result.testType).toBe('one-sample');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(result.degreesOfFreedom).toBe(9);
      expect(result.confidenceInterval).toHaveLength(2);
      expect(typeof result.meanDifference).toBe('number');
      expect(typeof result.standardError).toBe('number');
      expect(typeof result.effectSize).toBe('number');
      expect(result.assumptions).toBeInstanceOf(Array);
    });

    it('should throw error for insufficient data', () => {
      const data = [1];
      expect(() => StatisticalAnalysisService.oneSampleTTest(data, 0)).toThrow();
    });

    it('should handle data with null values', () => {
      const data = [2.1, null, 2.3, 2.0, undefined, 2.4] as (number | null | undefined)[];
      const result = StatisticalAnalysisService.oneSampleTTest(data as number[], 2.0);
      
      expect(result.degreesOfFreedom).toBe(3); // Only 4 valid values
    });
  });

  describe('independentTTest', () => {
    it('should perform independent t-test with equal variances', () => {
      const group1 = [1.2, 1.4, 1.1, 1.3, 1.5];
      const group2 = [2.1, 2.3, 2.0, 2.2, 2.4];
      
      const result = StatisticalAnalysisService.independentTTest(group1, group2, true);
      
      expect(result.testType).toBe('independent');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(result.degreesOfFreedom).toBe(8);
      expect(result.meanDifference).toBeCloseTo(-0.9, 1);
      expect(result.assumptions).toBeInstanceOf(Array);
    });

    it('should perform Welch t-test with unequal variances', () => {
      const group1 = [1, 2, 3];
      const group2 = [10, 20, 30, 40, 50];
      
      const result = StatisticalAnalysisService.independentTTest(group1, group2, false);
      
      expect(result.testType).toBe('independent');
      expect(typeof result.degreesOfFreedom).toBe('number');
      expect(result.degreesOfFreedom).not.toBe(6); // Should be adjusted for unequal variances
    });

    it('should throw error for insufficient data', () => {
      const group1 = [1];
      const group2 = [2, 3];
      
      expect(() => StatisticalAnalysisService.independentTTest(group1, group2)).toThrow();
    });
  });

  describe('pairedTTest', () => {
    it('should perform paired t-test correctly', () => {
      const before = [10, 12, 11, 13, 9];
      const after = [12, 14, 13, 15, 11];
      
      const result = StatisticalAnalysisService.pairedTTest(before, after);
      
      expect(result.testType).toBe('paired');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(result.degreesOfFreedom).toBe(4);
      expect(result.meanDifference).toBe(2); // All differences are +2
    });

    it('should throw error for mismatched array lengths', () => {
      const before = [1, 2, 3];
      const after = [4, 5];
      
      expect(() => StatisticalAnalysisService.pairedTTest(before, after)).toThrow();
    });

    it('should handle missing values in pairs', () => {
      const before = [10, null, 11, 13] as (number | null)[];
      const after = [12, 14, null, 15] as (number | null)[];
      
      const result = StatisticalAnalysisService.pairedTTest(before as number[], after as number[]);
      
      expect(result.degreesOfFreedom).toBe(1); // Only 2 valid pairs: (10->12) and (13->15)
    });
  });

  describe('oneWayANOVA', () => {
    it('should perform one-way ANOVA correctly', () => {
      const groups = {
        'Group A': [1, 2, 3, 4, 5],
        'Group B': [3, 4, 5, 6, 7],
        'Group C': [5, 6, 7, 8, 9]
      };
      
      const result = StatisticalAnalysisService.oneWayANOVA(groups);
      
      expect(typeof result.fStatistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(result.degreesOfFreedomBetween).toBe(2);
      expect(result.degreesOfFreedomWithin).toBe(12);
      expect(result.groups).toHaveLength(3);
      expect(result.groups[0].group).toBe('Group A');
      expect(result.groups[0].mean).toBe(3);
      expect(result.assumptions).toBeInstanceOf(Array);
    });

    it('should perform post-hoc tests when significant', () => {
      const groups = {
        'Low': [1, 1, 2, 2, 3],
        'Medium': [4, 5, 5, 6, 6],
        'High': [8, 9, 9, 10, 10]
      };
      
      const result = StatisticalAnalysisService.oneWayANOVA(groups, 0.05);
      
      // Should have post-hoc tests for 3 groups
      if (result.postHocTests) {
        expect(result.postHocTests.length).toBe(3); // 3 pairwise comparisons
        expect(result.postHocTests[0].comparison).toContain('vs');
      }
    });

    it('should throw error for insufficient groups', () => {
      const groups = {
        'Group A': [1, 2, 3]
      };
      
      expect(() => StatisticalAnalysisService.oneWayANOVA(groups)).toThrow();
    });
  });

  describe('linearRegression', () => {
    it('should perform linear regression correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10]; // Perfect linear relationship: y = 2x
      
      const result = StatisticalAnalysisService.linearRegression(x, y);
      
      expect(result.type).toBe('linear');
      expect(result.coefficients).toHaveLength(2);
      expect(result.coefficients[0].variable).toBe('Intercept');
      expect(result.coefficients[1].variable).toBe('X');
      expect(result.coefficients[1].coefficient).toBeCloseTo(2, 1); // Slope should be ~2
      expect(result.rSquared).toBeCloseTo(1, 2); // Perfect fit
      expect(result.residuals).toHaveLength(5);
      expect(result.fitted).toHaveLength(5);
      expect(result.assumptions).toBeInstanceOf(Array);
    });

    it('should calculate confidence intervals for coefficients', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1.9, 4.1, 5.8, 8.2, 9.9]; // Near-perfect linear relationship
      
      const result = StatisticalAnalysisService.linearRegression(x, y);
      
      expect(result.coefficients[0].confidenceInterval).toHaveLength(2);
      expect(result.coefficients[1].confidenceInterval).toHaveLength(2);
      expect(result.coefficients[0].pValue).toBeGreaterThan(0);
      expect(result.coefficients[1].pValue).toBeGreaterThan(0);
    });

    it('should throw error for insufficient data', () => {
      const x = [1, 2];
      const y = [2, 4];
      
      expect(() => StatisticalAnalysisService.linearRegression(x, y)).toThrow();
    });
  });

  describe('mannWhitneyUTest', () => {
    it('should perform Mann-Whitney U test correctly', () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];
      
      const result = StatisticalAnalysisService.mannWhitneyUTest(group1, group2);
      
      expect(result.testType).toBe('mann-whitney');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(typeof result.effectSize).toBe('number');
      expect(result.ranks).toHaveProperty('Group 1');
      expect(result.ranks).toHaveProperty('Group 2');
      expect(result.medians).toHaveProperty('Group 1');
      expect(result.medians).toHaveProperty('Group 2');
    });

    it('should handle tied values correctly', () => {
      const group1 = [1, 2, 2, 3];
      const group2 = [2, 3, 4, 4];
      
      const result = StatisticalAnalysisService.mannWhitneyUTest(group1, group2);
      
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
    });

    it('should throw error for empty groups', () => {
      const group1: number[] = [];
      const group2 = [1, 2, 3];
      
      expect(() => StatisticalAnalysisService.mannWhitneyUTest(group1, group2)).toThrow();
    });
  });

  describe('wilcoxonSignedRankTest', () => {
    it('should perform Wilcoxon signed-rank test correctly', () => {
      const before = [10, 12, 11, 13, 9];
      const after = [12, 14, 13, 15, 11];
      
      const result = StatisticalAnalysisService.wilcoxonSignedRankTest(before, after);
      
      expect(result.testType).toBe('wilcoxon');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(typeof result.effectSize).toBe('number');
    });

    it('should handle zero differences', () => {
      const before = [10, 12, 11, 13, 9];
      const after = [10, 14, 13, 15, 11]; // First pair has no difference
      
      const result = StatisticalAnalysisService.wilcoxonSignedRankTest(before, after);
      
      expect(typeof result.statistic).toBe('number');
    });

    it('should throw error for mismatched lengths', () => {
      const before = [1, 2, 3];
      const after = [4, 5];
      
      expect(() => StatisticalAnalysisService.wilcoxonSignedRankTest(before, after)).toThrow();
    });
  });

  describe('kruskalWallisTest', () => {
    it('should perform Kruskal-Wallis test correctly', () => {
      const groups = {
        'Group A': [1, 2, 3, 4, 5],
        'Group B': [3, 4, 5, 6, 7],
        'Group C': [5, 6, 7, 8, 9]
      };
      
      const result = StatisticalAnalysisService.kruskalWallisTest(groups);
      
      expect(result.testType).toBe('kruskal-wallis');
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
      expect(result.medians).toHaveProperty('Group A');
      expect(result.medians).toHaveProperty('Group B');
      expect(result.medians).toHaveProperty('Group C');
    });

    it('should handle tied values', () => {
      const groups = {
        'Group A': [1, 2, 2, 3],
        'Group B': [2, 3, 3, 4],
        'Group C': [3, 4, 4, 5]
      };
      
      const result = StatisticalAnalysisService.kruskalWallisTest(groups);
      
      expect(typeof result.statistic).toBe('number');
      expect(typeof result.pValue).toBe('number');
    });

    it('should throw error for insufficient groups', () => {
      const groups = {
        'Group A': [1, 2, 3]
      };
      
      expect(() => StatisticalAnalysisService.kruskalWallisTest(groups)).toThrow();
    });
  });

  describe('suggestTests', () => {
    it('should suggest appropriate tests for single numeric variable', () => {
      const dataTypes = { 'variable1': 'numeric' as const };
      const sampleSizes = { 'variable1': 30 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.testName.includes('t-test'))).toBe(true);
      expect(suggestions.some(s => s.testName.includes('Normality'))).toBe(true);
    });

    it('should suggest appropriate tests for two numeric variables', () => {
      const dataTypes = { 'var1': 'numeric' as const, 'var2': 'numeric' as const };
      const sampleSizes = { 'var1': 30, 'var2': 30 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes);
      
      expect(suggestions.some(s => s.testName.includes('Independent t-test'))).toBe(true);
      expect(suggestions.some(s => s.testName.includes('Correlation'))).toBe(true);
      expect(suggestions.some(s => s.testName.includes('Regression'))).toBe(true);
    });

    it('should suggest paired tests for paired data', () => {
      const dataTypes = { 'before': 'numeric' as const, 'after': 'numeric' as const };
      const sampleSizes = { 'before': 30, 'after': 30 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes, undefined, true);
      
      expect(suggestions.some(s => s.testName.includes('Paired t-test'))).toBe(true);
    });

    it('should suggest ANOVA for multiple groups', () => {
      const dataTypes = { 'outcome': 'numeric' as const };
      const sampleSizes = { 'outcome': 90 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes, 3);
      
      expect(suggestions.some(s => s.testName.includes('ANOVA'))).toBe(true);
    });

    it('should suggest chi-square for categorical variables', () => {
      const dataTypes = { 'var1': 'categorical' as const, 'var2': 'categorical' as const };
      const sampleSizes = { 'var1': 100, 'var2': 100 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes);
      
      expect(suggestions.some(s => s.testName.includes('Chi-Square'))).toBe(true);
    });

    it('should prioritize non-parametric tests for small samples', () => {
      const dataTypes = { 'var1': 'numeric' as const, 'var2': 'numeric' as const };
      const sampleSizes = { 'var1': 10, 'var2': 10 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes);
      
      expect(suggestions.some(s => s.testName.includes('Mann-Whitney'))).toBe(true);
    });

    it('should return suggestions sorted by confidence', () => {
      const dataTypes = { 'var1': 'numeric' as const };
      const sampleSizes = { 'var1': 30 };
      
      const suggestions = StatisticalAnalysisService.suggestTests(dataTypes, sampleSizes);
      
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i-1].confidence);
      }
    });
  });

  describe('Integration tests with known statistical results', () => {
    it('should match known descriptive statistics', () => {
      // Test data with known statistical properties
      const data = [2, 4, 4, 4, 5, 5, 7, 9];
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(data);
      
      expect(stats.mean).toBeCloseTo(5, 1);
      expect(stats.median).toBe(4.5);
      expect(stats.mode).toBe(4);
      expect(stats.standardDeviation).toBeCloseTo(2.0, 1);
    });

    it('should calculate correct correlation for known data', () => {
      // Perfect positive correlation
      const data = {
        'x': [1, 2, 3, 4, 5],
        'y': [2, 4, 6, 8, 10]
      };
      
      const result = StatisticalAnalysisService.calculateCorrelationMatrix(data);
      expect(result.matrix[0][1]).toBeCloseTo(1, 2);
    });

    it('should handle edge cases in frequency analysis', () => {
      // Single value repeated
      const data = ['A', 'A', 'A', 'A'];
      const result = StatisticalAnalysisService.performFrequencyAnalysis(data);
      
      expect(result.frequencies).toEqual({ 'A': 4 });
      expect(result.relativeFrequencies).toEqual({ 'A': 1 });
    });

    it('should perform comprehensive statistical workflow', () => {
      // Test a complete analysis workflow
      const group1 = [23, 25, 27, 29, 31, 33, 35];
      const group2 = [18, 20, 22, 24, 26, 28, 30];
      
      // Descriptive statistics
      const stats1 = StatisticalAnalysisService.calculateDescriptiveStats(group1);
      const stats2 = StatisticalAnalysisService.calculateDescriptiveStats(group2);
      
      expect(stats1.mean).toBeGreaterThan(stats2.mean);
      
      // Independent t-test
      const tTest = StatisticalAnalysisService.independentTTest(group1, group2);
      expect(tTest.meanDifference).toBeGreaterThan(0);
      
      // Mann-Whitney U test (non-parametric alternative)
      const mannWhitney = StatisticalAnalysisService.mannWhitneyUTest(group1, group2);
      expect(typeof mannWhitney.pValue).toBe('number');
      
      // Test suggestions
      const suggestions = StatisticalAnalysisService.suggestTests(
        { 'group1': 'numeric', 'group2': 'numeric' },
        { 'group1': group1.length, 'group2': group2.length }
      );
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});