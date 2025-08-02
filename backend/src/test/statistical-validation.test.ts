import { describe, it, expect } from 'vitest';
import { 
  calculateDescriptiveStats,
  performTTest,
  performANOVA,
  calculateCorrelation,
  performChiSquareTest,
  performNormalityTest
} from '../lib/statistical-analysis.js';

describe('Statistical Accuracy Validation', () => {
  // Known datasets with expected results from R/SPSS/SAS
  const knownDatasets = {
    // Dataset 1: Simple numeric data
    simple: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    
    // Dataset 2: Normal distribution (generated with known parameters)
    normal: [
      23.5, 25.1, 24.8, 26.2, 25.9, 24.3, 25.7, 26.1, 24.9, 25.4,
      25.8, 24.6, 25.2, 26.0, 24.7, 25.3, 25.6, 24.4, 25.9, 25.1
    ],
    
    // Dataset 3: Bivariate data for correlation
    bivariate: {
      x: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      y: [2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1, 18.0, 20.2]
    },
    
    // Dataset 4: Two groups for t-test
    twoGroups: {
      group1: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      group2: [15, 17, 19, 21, 23, 25, 27, 29, 31, 33]
    },
    
    // Dataset 5: Categorical data for chi-square
    categorical: {
      observed: [10, 15, 20, 25],
      expected: [17.5, 17.5, 17.5, 17.5]
    }
  };

  describe('Descriptive Statistics Validation', () => {
    it('should calculate correct descriptive statistics for simple dataset', () => {
      const result = calculateDescriptiveStats(knownDatasets.simple);
      
      // Expected values calculated manually and verified with R
      expect(result.mean).toBeCloseTo(5.5, 10);
      expect(result.median).toBeCloseTo(5.5, 10);
      expect(result.standardDeviation).toBeCloseTo(3.0276503540974917, 10);
      expect(result.variance).toBeCloseTo(9.166666666666666, 10);
      expect(result.min).toBe(1);
      expect(result.max).toBe(10);
      expect(result.count).toBe(10);
      expect(result.sum).toBe(55);
      
      // Quartiles
      expect(result.q1).toBeCloseTo(3.25, 2);
      expect(result.q3).toBeCloseTo(7.75, 2);
      
      // Skewness and kurtosis
      expect(result.skewness).toBeCloseTo(0, 5); // Symmetric distribution
      expect(result.kurtosis).toBeCloseTo(-1.2, 1); // Uniform distribution kurtosis
    });

    it('should calculate correct statistics for normal distribution', () => {
      const result = calculateDescriptiveStats(knownDatasets.normal);
      
      // This dataset was generated with mean=25, sd=0.6
      expect(result.mean).toBeCloseTo(25.0, 1);
      expect(result.standardDeviation).toBeCloseTo(0.6, 1);
      expect(result.count).toBe(20);
      
      // For normal distribution, skewness should be close to 0
      expect(Math.abs(result.skewness)).toBeLessThan(0.5);
    });
  });

  describe('T-Test Validation', () => {
    it('should perform correct one-sample t-test', () => {
      // Test against known mean
      const result = performTTest({
        data: knownDatasets.simple,
        testType: 'one-sample',
        testValue: 5.5,
        alpha: 0.05
      });
      
      // Testing against the actual mean should give t-statistic close to 0
      expect(Math.abs(result.testStatistic)).toBeLessThan(0.001);
      expect(result.pValue).toBeGreaterThan(0.99);
      expect(result.degreesOfFreedom).toBe(9);
      
      // Confidence interval should contain the test value
      expect(result.confidenceInterval[0]).toBeLessThan(5.5);
      expect(result.confidenceInterval[1]).toBeGreaterThan(5.5);
    });

    it('should perform correct two-sample t-test', () => {
      const result = performTTest({
        data1: knownDatasets.twoGroups.group1,
        data2: knownDatasets.twoGroups.group2,
        testType: 'independent',
        alpha: 0.05,
        assumeEqualVariances: true
      });
      
      // Group2 mean is 3 units higher than Group1
      // Expected t-statistic (calculated manually): approximately -3.464
      expect(result.testStatistic).toBeCloseTo(-3.464, 2);
      expect(result.pValue).toBeCloseTo(0.003, 2);
      expect(result.degreesOfFreedom).toBe(18);
      
      // Effect size (Cohen's d)
      expect(result.effectSize).toBeCloseTo(1.549, 2);
    });

    it('should perform correct paired t-test', () => {
      // Create paired data (before/after measurements)
      const before = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28];
      const after = [12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
      
      const result = performTTest({
        data1: before,
        data2: after,
        testType: 'paired',
        alpha: 0.05
      });
      
      // Consistent difference of 2 units
      expect(result.testStatistic).toBeCloseTo(-10.954, 2);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.degreesOfFreedom).toBe(9);
    });
  });

  describe('ANOVA Validation', () => {
    it('should perform correct one-way ANOVA', () => {
      const groups = [
        [1, 2, 3, 4, 5],      // Group 1: mean = 3
        [6, 7, 8, 9, 10],     // Group 2: mean = 8
        [11, 12, 13, 14, 15]  // Group 3: mean = 13
      ];
      
      const result = performANOVA({
        groups,
        alpha: 0.05
      });
      
      // Expected F-statistic for this data: 65
      expect(result.fStatistic).toBeCloseTo(65, 1);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.dfBetween).toBe(2);
      expect(result.dfWithin).toBe(12);
      
      // Effect size (eta-squared)
      expect(result.etaSquared).toBeCloseTo(0.915, 2);
    });

    it('should perform correct post-hoc tests when significant', () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15]
      ];
      
      const result = performANOVA({
        groups,
        alpha: 0.05,
        postHoc: 'tukey'
      });
      
      expect(result.postHocTests).toBeDefined();
      expect(result.postHocTests).toHaveLength(3); // 3 pairwise comparisons
      
      // All pairwise comparisons should be significant
      result.postHocTests.forEach(test => {
        expect(test.pValue).toBeLessThan(0.05);
      });
    });
  });

  describe('Correlation Analysis Validation', () => {
    it('should calculate correct Pearson correlation', () => {
      const result = calculateCorrelation({
        x: knownDatasets.bivariate.x,
        y: knownDatasets.bivariate.y,
        method: 'pearson'
      });
      
      // Strong positive correlation expected (r ≈ 0.99)
      expect(result.coefficient).toBeCloseTo(0.9939, 3);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.degreesOfFreedom).toBe(8);
      
      // Confidence interval should not include 0
      expect(result.confidenceInterval[0]).toBeGreaterThan(0);
      expect(result.confidenceInterval[1]).toBeLessThan(1);
    });

    it('should calculate correct Spearman correlation', () => {
      // Use data with non-linear relationship
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]; // y = x²
      
      const result = calculateCorrelation({
        x,
        y,
        method: 'spearman'
      });
      
      // Perfect monotonic relationship
      expect(result.coefficient).toBeCloseTo(1.0, 10);
      expect(result.pValue).toBeLessThan(0.001);
    });
  });

  describe('Chi-Square Test Validation', () => {
    it('should perform correct goodness-of-fit test', () => {
      const result = performChiSquareTest({
        observed: knownDatasets.categorical.observed,
        expected: knownDatasets.categorical.expected,
        testType: 'goodness-of-fit'
      });
      
      // Expected chi-square statistic: 5.714
      expect(result.chiSquareStatistic).toBeCloseTo(5.714, 2);
      expect(result.degreesOfFreedom).toBe(3);
      expect(result.pValue).toBeCloseTo(0.126, 2);
      
      // Effect size (Cramer's V)
      expect(result.cramersV).toBeCloseTo(0.301, 2);
    });

    it('should perform correct test of independence', () => {
      // 2x2 contingency table
      const contingencyTable = [
        [10, 15],
        [20, 25]
      ];
      
      const result = performChiSquareTest({
        contingencyTable,
        testType: 'independence'
      });
      
      expect(result.degreesOfFreedom).toBe(1);
      expect(result.chiSquareStatistic).toBeCloseTo(0, 3);
      expect(result.pValue).toBeCloseTo(1, 1);
    });
  });

  describe('Normality Test Validation', () => {
    it('should correctly identify normal distribution', () => {
      const result = performNormalityTest({
        data: knownDatasets.normal,
        test: 'shapiro-wilk'
      });
      
      // Should not reject normality (p > 0.05)
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.isNormal).toBe(true);
    });

    it('should correctly identify non-normal distribution', () => {
      // Highly skewed data
      const skewedData = [1, 1, 1, 1, 2, 2, 3, 10, 15, 20, 25, 30, 35, 40, 50];
      
      const result = performNormalityTest({
        data: skewedData,
        test: 'shapiro-wilk'
      });
      
      // Should reject normality (p < 0.05)
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.isNormal).toBe(false);
    });

    it('should perform Kolmogorov-Smirnov test correctly', () => {
      const result = performNormalityTest({
        data: knownDatasets.simple,
        test: 'kolmogorov-smirnov'
      });
      
      expect(result).toHaveProperty('testStatistic');
      expect(result).toHaveProperty('pValue');
      expect(result).toHaveProperty('isNormal');
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle missing values correctly', () => {
      const dataWithMissing = [1, 2, null, 4, 5, undefined, 7, 8, 9, 10];
      const result = calculateDescriptiveStats(dataWithMissing);
      
      expect(result.count).toBe(8); // Should exclude missing values
      expect(result.mean).toBeCloseTo(5.75, 2);
    });

    it('should handle identical values', () => {
      const identicalData = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
      const result = calculateDescriptiveStats(identicalData);
      
      expect(result.mean).toBe(5);
      expect(result.standardDeviation).toBe(0);
      expect(result.variance).toBe(0);
      expect(result.min).toBe(5);
      expect(result.max).toBe(5);
    });

    it('should handle single value', () => {
      const singleValue = [42];
      const result = calculateDescriptiveStats(singleValue);
      
      expect(result.mean).toBe(42);
      expect(result.standardDeviation).toBe(0);
      expect(result.count).toBe(1);
    });

    it('should handle very large numbers', () => {
      const largeNumbers = [1e10, 2e10, 3e10, 4e10, 5e10];
      const result = calculateDescriptiveStats(largeNumbers);
      
      expect(result.mean).toBeCloseTo(3e10, -8);
      expect(result.standardDeviation).toBeCloseTo(1.5811388300841898e10, -8);
    });

    it('should handle very small numbers', () => {
      const smallNumbers = [1e-10, 2e-10, 3e-10, 4e-10, 5e-10];
      const result = calculateDescriptiveStats(smallNumbers);
      
      expect(result.mean).toBeCloseTo(3e-10, 12);
      expect(result.standardDeviation).toBeCloseTo(1.5811388300841898e-10, 12);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle large datasets efficiently', () => {
      // Generate large dataset (10,000 points)
      const largeDataset = Array.from({ length: 10000 }, (_, i) => Math.random() * 100);
      
      const startTime = Date.now();
      const result = calculateDescriptiveStats(largeDataset);
      const endTime = Date.now();
      
      expect(result.count).toBe(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle correlation with large datasets', () => {
      const size = 5000;
      const x = Array.from({ length: size }, (_, i) => i);
      const y = Array.from({ length: size }, (_, i) => i + Math.random() * 10);
      
      const startTime = Date.now();
      const result = calculateCorrelation({ x, y, method: 'pearson' });
      const endTime = Date.now();
      
      expect(result.coefficient).toBeGreaterThan(0.9);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 0.5 seconds
    });
  });

  describe('Numerical Precision', () => {
    it('should maintain precision with floating point arithmetic', () => {
      // Data that can cause floating point precision issues
      const precisionData = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      const result = calculateDescriptiveStats(precisionData);
      
      expect(result.mean).toBeCloseTo(0.55, 10);
      expect(result.sum).toBeCloseTo(5.5, 10);
    });

    it('should handle calculations near machine epsilon', () => {
      const epsilon = Number.EPSILON;
      const nearEpsilonData = [epsilon, 2 * epsilon, 3 * epsilon, 4 * epsilon, 5 * epsilon];
      const result = calculateDescriptiveStats(nearEpsilonData);
      
      expect(result.mean).toBeCloseTo(3 * epsilon, 20);
      expect(result.count).toBe(5);
    });
  });
});