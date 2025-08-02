import { describe, it, expect } from 'vitest';
import { StatisticalAnalysisService } from '../lib/statistical-analysis.js';

describe('StatisticalAnalysisService - Comprehensive Tests', () => {
  
  // Test data sets for validation against known statistical software results
  const testDatasets = {
    normal: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    skewed: [1, 1, 2, 2, 2, 3, 3, 4, 5, 10, 15, 20],
    withOutliers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 100],
    smallSample: [1, 2, 3],
    largeSample: Array.from({ length: 1000 }, (_, i) => Math.sin(i / 100) * 10 + 50),
    categorical: ['A', 'B', 'A', 'C', 'B', 'A', 'D', 'B', 'A'],
    withMissing: [1, 2, null, 4, 5, undefined, 7, 8, null, 10] as (number | null | undefined)[]
  };

  describe('Descriptive Statistics', () => {
    it('should calculate accurate descriptive statistics for normal distribution', () => {
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(testDatasets.normal);
      
      // Validate against known values
      expect(stats.mean).toBeCloseTo(5.5, 10);
      expect(stats.median).toBe(5.5);
      expect(stats.mode).toEqual([]);  // No mode in uniform distribution
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(10);
      expect(stats.range).toBe(9);
      expect(stats.standardDeviation).toBeCloseTo(3.0277, 4);
      expect(stats.variance).toBeCloseTo(9.1667, 4);
      expect(stats.quartiles).toEqual([3, 5.5, 8]);
      expect(stats.iqr).toBeCloseTo(5, 4);
      expect(stats.skewness).toBeCloseTo(0, 4);  // Should be approximately 0 for uniform
      expect(stats.kurtosis).toBeCloseTo(-1.2, 1);  // Uniform distribution kurtosis
    });

    it('should handle skewed data correctly', () => {
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(testDatasets.skewed);
      
      expect(stats.mean).toBeGreaterThan(stats.median);  // Right-skewed
      expect(stats.skewness).toBeGreaterThan(0);  // Positive skew
      expect(stats.mode).toContain(2);  // Most frequent value
    });

    it('should identify outliers correctly', () => {
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(testDatasets.withOutliers);
      const outliers = StatisticalAnalysisService.detectOutliers(testDatasets.withOutliers);
      
      expect(outliers.outliers).toContain(100);
      expect(outliers.outliers.length).toBeGreaterThan(0);
      expect(stats.mean).toBeGreaterThan(stats.median);  // Outlier pulls mean up
    });

    it('should handle missing values appropriately', () => {
      const stats = StatisticalAnalysisService.calculateDescriptiveStats(testDatasets.withMissing);
      
      expect(stats.count).toBe(7);  // Only non-null values
      expect(stats.nullCount).toBe(3);
      expect(stats.mean).toBeCloseTo(5.29, 2);
    });

    it('should calculate percentiles accurately', () => {
      const data = Array.from({ length: 100 }, (_, i) => i + 1);  // 1 to 100
      const percentiles = StatisticalAnalysisService.calculatePercentiles(data, [25, 50, 75, 90, 95, 99]);
      
      expect(percentiles[25]).toBeCloseTo(25.75, 1);
      expect(percentiles[50]).toBeCloseTo(50.5, 1);
      expect(percentiles[75]).toBeCloseTo(75.25, 1);
      expect(percentiles[90]).toBeCloseTo(90.1, 1);
      expect(percentiles[95]).toBeCloseTo(95.05, 1);
      expect(percentiles[99]).toBeCloseTo(99.01, 1);
    });
  });

  describe('Hypothesis Testing - T-Tests', () => {
    it('should perform one-sample t-test correctly', () => {
      const data = [2.1, 2.3, 1.9, 2.0, 2.2, 2.4, 1.8, 2.1, 2.0, 2.2];
      const result = StatisticalAnalysisService.oneSampleTTest(data, 2.0);
      
      expect(result.testStatistic).toBeCloseTo(1.897, 3);
      expect(result.pValue).toBeLessThan(0.1);
      expect(result.pValue).toBeGreaterThan(0.05);
      expect(result.degreesOfFreedom).toBe(9);
      expect(result.confidenceInterval).toHaveLength(2);
      expect(result.mean).toBeCloseTo(2.1, 1);
    });

    it('should perform independent samples t-test correctly', () => {
      const group1 = [1.2, 1.4, 1.1, 1.3, 1.5, 1.2, 1.4];
      const group2 = [2.1, 2.3, 2.0, 2.2, 2.4, 2.1, 2.3];
      const result = StatisticalAnalysisService.independentTTest(group1, group2);
      
      expect(result.testStatistic).toBeLessThan(-5);  // Significant difference
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.degreesOfFreedom).toBeGreaterThan(10);
      expect(result.effectSize).toBeGreaterThan(2);  // Large effect size
    });

    it('should perform paired t-test correctly', () => {
      const before = [10, 12, 11, 13, 15, 14, 12];
      const after = [12, 14, 13, 15, 17, 16, 14];
      const result = StatisticalAnalysisService.pairedTTest(before, after);
      
      expect(result.testStatistic).toBeLessThan(-2);  // Negative because after > before
      expect(result.pValue).toBeLessThan(0.05);
      expect(result.degreesOfFreedom).toBe(6);
      expect(result.meanDifference).toBeCloseTo(-2, 1);
    });

    it('should check t-test assumptions', () => {
      const normalData = Array.from({ length: 50 }, () => Math.random() * 2 - 1);  // Approximately normal
      const nonNormalData = Array.from({ length: 50 }, () => Math.pow(Math.random(), 3));  // Skewed
      
      const normalAssumptions = StatisticalAnalysisService.checkTTestAssumptions(normalData);
      const nonNormalAssumptions = StatisticalAnalysisService.checkTTestAssumptions(nonNormalData);
      
      expect(normalAssumptions.normality.pValue).toBeGreaterThan(0.05);
      expect(normalAssumptions.normality.isNormal).toBe(true);
      expect(nonNormalAssumptions.normality.isNormal).toBe(false);
    });
  });

  describe('ANOVA Tests', () => {
    it('should perform one-way ANOVA correctly', () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [3, 4, 5, 6, 7],
        [5, 6, 7, 8, 9]
      ];
      const result = StatisticalAnalysisService.oneWayANOVA(groups);
      
      expect(result.fStatistic).toBeGreaterThan(10);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.degreesOfFreedomBetween).toBe(2);
      expect(result.degreesOfFreedomWithin).toBe(12);
      expect(result.etaSquared).toBeGreaterThan(0.8);  // Large effect size
    });

    it('should perform post-hoc tests when ANOVA is significant', () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15]
      ];
      const anovaResult = StatisticalAnalysisService.oneWayANOVA(groups);
      
      if (anovaResult.pValue < 0.05) {
        const postHoc = StatisticalAnalysisService.tukeyHSD(groups);
        expect(postHoc.comparisons).toHaveLength(3);  // 3 pairwise comparisons
        expect(postHoc.comparisons.every(comp => comp.pValue < 0.05)).toBe(true);
      }
    });

    it('should check ANOVA assumptions', () => {
      const groups = [
        Array.from({ length: 20 }, () => Math.random() + 1),
        Array.from({ length: 20 }, () => Math.random() + 2),
        Array.from({ length: 20 }, () => Math.random() + 3)
      ];
      
      const assumptions = StatisticalAnalysisService.checkANOVAAssumptions(groups);
      
      expect(assumptions.normality).toBeDefined();
      expect(assumptions.homogeneity).toBeDefined();
      expect(assumptions.independence).toBe(true);  // Assumed for test data
    });
  });

  describe('Correlation Analysis', () => {
    it('should calculate Pearson correlation correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];  // Perfect positive correlation
      const result = StatisticalAnalysisService.pearsonCorrelation(x, y);
      
      expect(result.coefficient).toBeCloseTo(1.0, 10);
      expect(result.pValue).toBeCloseTo(0, 5);
      expect(result.significance).toBe('***');
    });

    it('should calculate Spearman correlation correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [1, 4, 9, 16, 25];  // Non-linear but monotonic
      const result = StatisticalAnalysisService.spearmanCorrelation(x, y);
      
      expect(result.coefficient).toBeCloseTo(1.0, 10);
      expect(result.pValue).toBeCloseTo(0, 5);
    });

    it('should create correlation matrix', () => {
      const data = {
        var1: [1, 2, 3, 4, 5],
        var2: [2, 4, 6, 8, 10],
        var3: [5, 4, 3, 2, 1]
      };
      const matrix = StatisticalAnalysisService.correlationMatrix(data);
      
      expect(matrix.var1.var1).toBeCloseTo(1.0, 10);
      expect(matrix.var1.var2).toBeCloseTo(1.0, 10);
      expect(matrix.var1.var3).toBeCloseTo(-1.0, 10);
      expect(matrix.var2.var3).toBeCloseTo(-1.0, 10);
    });
  });

  describe('Regression Analysis', () => {
    it('should perform simple linear regression correctly', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const result = StatisticalAnalysisService.simpleLinearRegression(x, y);
      
      expect(result.slope).toBeCloseTo(2.0, 10);
      expect(result.intercept).toBeCloseTo(0.0, 10);
      expect(result.rSquared).toBeCloseTo(1.0, 10);
      expect(result.pValue).toBeCloseTo(0, 5);
      expect(result.standardError).toBeCloseTo(0, 5);
    });

    it('should perform multiple linear regression correctly', () => {
      const X = [
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6]
      ];
      const y = [5, 8, 11, 14, 17];  // y = 1 + 2*x1 + 1*x2
      const result = StatisticalAnalysisService.multipleLinearRegression(X, y);
      
      expect(result.coefficients).toHaveLength(3);  // Intercept + 2 variables
      expect(result.coefficients[0]).toBeCloseTo(1, 1);  // Intercept
      expect(result.coefficients[1]).toBeCloseTo(2, 1);  // x1 coefficient
      expect(result.coefficients[2]).toBeCloseTo(1, 1);  // x2 coefficient
      expect(result.rSquared).toBeCloseTo(1.0, 5);
    });

    it('should calculate regression diagnostics', () => {
      const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const y = [2.1, 3.9, 6.1, 7.8, 10.2, 11.9, 14.1, 15.8, 18.2, 19.9];
      const result = StatisticalAnalysisService.simpleLinearRegression(x, y);
      const diagnostics = StatisticalAnalysisService.regressionDiagnostics(x, y, result);
      
      expect(diagnostics.residuals).toHaveLength(10);
      expect(diagnostics.standardizedResiduals).toHaveLength(10);
      expect(diagnostics.cookDistance).toHaveLength(10);
      expect(diagnostics.leverage).toHaveLength(10);
      expect(diagnostics.durbinWatson).toBeGreaterThan(0);
      expect(diagnostics.durbinWatson).toBeLessThan(4);
    });
  });

  describe('Non-parametric Tests', () => {
    it('should perform Mann-Whitney U test correctly', () => {
      const group1 = [1, 3, 5, 7, 9];
      const group2 = [2, 4, 6, 8, 10, 12];
      const result = StatisticalAnalysisService.mannWhitneyU(group1, group2);
      
      expect(result.uStatistic).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
      expect(result.effectSize).toBeDefined();
    });

    it('should perform Wilcoxon signed-rank test correctly', () => {
      const before = [10, 12, 11, 13, 15, 14, 12];
      const after = [12, 14, 13, 15, 17, 16, 14];
      const result = StatisticalAnalysisService.wilcoxonSignedRank(before, after);
      
      expect(result.wStatistic).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(0.1);
      expect(result.effectSize).toBeGreaterThan(0);
    });

    it('should perform Kruskal-Wallis test correctly', () => {
      const groups = [
        [1, 2, 3, 4, 5],
        [6, 7, 8, 9, 10],
        [11, 12, 13, 14, 15]
      ];
      const result = StatisticalAnalysisService.kruskalWallis(groups);
      
      expect(result.hStatistic).toBeGreaterThan(10);
      expect(result.pValue).toBeLessThan(0.001);
      expect(result.degreesOfFreedom).toBe(2);
    });
  });

  describe('Chi-square Tests', () => {
    it('should perform chi-square goodness of fit test', () => {
      const observed = [10, 15, 20, 25];
      const expected = [12, 18, 18, 22];
      const result = StatisticalAnalysisService.chiSquareGoodnessOfFit(observed, expected);
      
      expect(result.chiSquare).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.degreesOfFreedom).toBe(3);
      expect(result.cramersV).toBeGreaterThan(0);
    });

    it('should perform chi-square test of independence', () => {
      const contingencyTable = [
        [10, 20, 30],
        [15, 25, 35],
        [5, 15, 25]
      ];
      const result = StatisticalAnalysisService.chiSquareIndependence(contingencyTable);
      
      expect(result.chiSquare).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.degreesOfFreedom).toBe(4);  // (3-1) * (3-1)
      expect(result.cramersV).toBeGreaterThan(0);
      expect(result.cramersV).toBeLessThan(1);
    });
  });

  describe('Normality Tests', () => {
    it('should perform Shapiro-Wilk test correctly', () => {
      const normalData = Array.from({ length: 30 }, () => Math.random() * 2 - 1);
      const uniformData = Array.from({ length: 30 }, (_, i) => i);
      
      const normalResult = StatisticalAnalysisService.shapiroWilk(normalData);
      const uniformResult = StatisticalAnalysisService.shapiroWilk(uniformData);
      
      expect(normalResult.wStatistic).toBeGreaterThan(0.8);
      expect(normalResult.pValue).toBeGreaterThan(0.05);
      expect(uniformResult.pValue).toBeLessThan(0.05);
    });

    it('should perform Kolmogorov-Smirnov test correctly', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = StatisticalAnalysisService.kolmogorovSmirnov(data, 'normal');
      
      expect(result.dStatistic).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.pValue).toBeLessThan(1);
    });

    it('should perform Anderson-Darling test correctly', () => {
      const normalData = Array.from({ length: 50 }, () => Math.random() * 2 - 1);
      const result = StatisticalAnalysisService.andersonDarling(normalData);
      
      expect(result.aStatistic).toBeGreaterThan(0);
      expect(result.pValue).toBeGreaterThan(0);
      expect(result.criticalValues).toBeDefined();
    });
  });

  describe('Effect Size Calculations', () => {
    it('should calculate Cohen\'s d correctly', () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [3, 4, 5, 6, 7];
      const d = StatisticalAnalysisService.cohensD(group1, group2);
      
      expect(d).toBeCloseTo(-1.26, 2);  // Large effect size
    });

    it('should calculate eta squared correctly', () => {
      const groups = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ];
      const anovaResult = StatisticalAnalysisService.oneWayANOVA(groups);
      
      expect(anovaResult.etaSquared).toBeGreaterThan(0.8);  // Large effect
    });

    it('should calculate Cramer\'s V correctly', () => {
      const contingencyTable = [
        [10, 20],
        [30, 40]
      ];
      const result = StatisticalAnalysisService.chiSquareIndependence(contingencyTable);
      
      expect(result.cramersV).toBeGreaterThan(0);
      expect(result.cramersV).toBeLessThan(1);
    });
  });

  describe('Power Analysis', () => {
    it('should calculate power for t-test', () => {
      const power = StatisticalAnalysisService.powerAnalysisTTest({
        effectSize: 0.8,
        alpha: 0.05,
        sampleSize: 20
      });
      
      expect(power).toBeGreaterThan(0.5);
      expect(power).toBeLessThan(1);
    });

    it('should calculate required sample size', () => {
      const sampleSize = StatisticalAnalysisService.sampleSizeCalculation({
        effectSize: 0.8,
        alpha: 0.05,
        power: 0.8,
        testType: 'ttest'
      });
      
      expect(sampleSize).toBeGreaterThan(10);
      expect(sampleSize).toBeLessThan(50);
    });
  });

  describe('Bootstrap and Resampling', () => {
    it('should perform bootstrap confidence intervals', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const bootstrap = StatisticalAnalysisService.bootstrapConfidenceInterval(
        data, 
        (sample) => sample.reduce((a, b) => a + b) / sample.length,  // Mean function
        0.95,
        1000
      );
      
      expect(bootstrap.lowerBound).toBeLessThan(bootstrap.upperBound);
      expect(bootstrap.lowerBound).toBeGreaterThan(4);
      expect(bootstrap.upperBound).toBeLessThan(7);
    });

    it('should perform permutation test', () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];
      const result = StatisticalAnalysisService.permutationTest(group1, group2, 1000);
      
      expect(result.observedDifference).toBeCloseTo(-5, 1);
      expect(result.pValue).toBeLessThan(0.01);
      expect(result.permutations).toBe(1000);
    });
  });

  describe('Time Series Analysis', () => {
    it('should detect trend in time series', () => {
      const timeSeries = Array.from({ length: 100 }, (_, i) => i + Math.random());
      const trend = StatisticalAnalysisService.detectTrend(timeSeries);
      
      expect(trend.slope).toBeGreaterThan(0.5);
      expect(trend.pValue).toBeLessThan(0.001);
      expect(trend.isSignificant).toBe(true);
    });

    it('should perform autocorrelation analysis', () => {
      const timeSeries = Array.from({ length: 50 }, (_, i) => Math.sin(i / 5));
      const autocorr = StatisticalAnalysisService.autocorrelation(timeSeries, 10);
      
      expect(autocorr).toHaveLength(11);  // Lags 0-10
      expect(autocorr[0]).toBeCloseTo(1, 5);  // Perfect correlation at lag 0
    });
  });

  describe('Multivariate Analysis', () => {
    it('should perform principal component analysis', () => {
      const data = [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
        [4, 5, 6],
        [5, 6, 7]
      ];
      const pca = StatisticalAnalysisService.principalComponentAnalysis(data);
      
      expect(pca.eigenvalues).toHaveLength(3);
      expect(pca.eigenvectors).toHaveLength(3);
      expect(pca.varianceExplained).toHaveLength(3);
      expect(pca.varianceExplained[0]).toBeGreaterThan(0.9);  // First PC explains most variance
    });

    it('should perform cluster analysis', () => {
      const data = [
        [1, 1], [1, 2], [2, 1], [2, 2],  // Cluster 1
        [8, 8], [8, 9], [9, 8], [9, 9]   // Cluster 2
      ];
      const clusters = StatisticalAnalysisService.kMeansClustering(data, 2);
      
      expect(clusters.centroids).toHaveLength(2);
      expect(clusters.assignments).toHaveLength(8);
      expect(clusters.withinSumOfSquares).toBeGreaterThan(0);
    });
  });

  describe('Robust Statistics', () => {
    it('should calculate robust statistics with outliers', () => {
      const dataWithOutliers = [1, 2, 3, 4, 5, 100];  // 100 is outlier
      const robust = StatisticalAnalysisService.robustStatistics(dataWithOutliers);
      
      expect(robust.median).toBe(3.5);  // Not affected by outlier
      expect(robust.mad).toBeLessThan(robust.standardDeviation);  // MAD more robust
      expect(robust.trimmedMean).toBeLessThan(robust.mean);  // Trimmed mean excludes outliers
    });

    it('should perform robust regression', () => {
      const x = [1, 2, 3, 4, 5, 6];
      const y = [2, 4, 6, 8, 10, 100];  // Last point is outlier
      const robust = StatisticalAnalysisService.robustRegression(x, y);
      const ordinary = StatisticalAnalysisService.simpleLinearRegression(x, y);
      
      expect(Math.abs(robust.slope - 2)).toBeLessThan(Math.abs(ordinary.slope - 2));
    });
  });

  describe('Bayesian Statistics', () => {
    it('should perform Bayesian t-test', () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [6, 7, 8, 9, 10];
      const bayesian = StatisticalAnalysisService.bayesianTTest(group1, group2);
      
      expect(bayesian.bayesFactor).toBeGreaterThan(1);  // Evidence for difference
      expect(bayesian.posteriorProbability).toBeGreaterThan(0.5);
      expect(bayesian.credibleInterval).toHaveLength(2);
    });

    it('should calculate Bayes factor for correlation', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const bayesian = StatisticalAnalysisService.bayesianCorrelation(x, y);
      
      expect(bayesian.bayesFactor).toBeGreaterThan(10);  // Strong evidence
      expect(bayesian.posteriorMean).toBeCloseTo(1, 1);
    });
  });
});