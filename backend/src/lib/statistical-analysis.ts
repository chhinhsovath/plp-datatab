import * as ss from 'simple-statistics';
import { DescriptiveStats, AnalysisResults, StatisticalTable, AssumptionResult } from '../types/data-models.js';
import { AnalysisCacheService } from './redis.js';
import { withStatisticalMetrics } from './performance-monitor.js';
import { JobQueue, JobType, JobPriority } from './job-queue.js';
import crypto from 'crypto';

export interface FrequencyAnalysisResult {
  frequencies: { [key: string]: number };
  relativeFrequencies: { [key: string]: number };
  cumulativeFrequencies: { [key: string]: number };
  histogram: HistogramBin[];
}

export interface HistogramBin {
  min: number;
  max: number;
  count: number;
  frequency: number;
}

export interface CorrelationMatrix {
  variables: string[];
  matrix: number[][];
  pValues?: number[][];
}

export interface NormalityTestResult {
  testName: string;
  statistic: number;
  pValue: number;
  isNormal: boolean;
  alpha: number;
}

export interface ContingencyTable {
  rowVariable: string;
  columnVariable: string;
  table: number[][];
  rowLabels: string[];
  columnLabels: string[];
  totals: {
    rowTotals: number[];
    columnTotals: number[];
    grandTotal: number;
  };
  chiSquareTest?: ChiSquareTestResult;
}

export interface ChiSquareTestResult {
  statistic: number;
  pValue: number;
  degreesOfFreedom: number;
  expected: number[][];
  cramersV: number;
}

// Advanced statistical test interfaces
export interface TTestResult {
  testType: 'one-sample' | 'independent' | 'paired';
  statistic: number;
  pValue: number;
  degreesOfFreedom: number;
  confidenceInterval: [number, number];
  meanDifference: number;
  standardError: number;
  effectSize: number; // Cohen's d
  assumptions: AssumptionResult[];
}

export interface ANOVAResult {
  fStatistic: number;
  pValue: number;
  degreesOfFreedomBetween: number;
  degreesOfFreedomWithin: number;
  meanSquareBetween: number;
  meanSquareWithin: number;
  etaSquared: number; // Effect size
  groups: GroupStatistics[];
  postHocTests?: PostHocTestResult[];
  assumptions: AssumptionResult[];
}

export interface GroupStatistics {
  group: string;
  n: number;
  mean: number;
  standardDeviation: number;
  standardError: number;
}

export interface PostHocTestResult {
  comparison: string;
  meanDifference: number;
  pValue: number;
  adjustedPValue: number;
  confidenceInterval: [number, number];
  significant: boolean;
}

export interface RegressionResult {
  type: 'linear' | 'multiple' | 'logistic' | 'polynomial';
  coefficients: RegressionCoefficient[];
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
  standardError: number;
  residuals: number[];
  fitted: number[];
  assumptions: AssumptionResult[];
  diagnostics: RegressionDiagnostics;
}

export interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  standardError: number;
  tStatistic: number;
  pValue: number;
  confidenceInterval: [number, number];
}

export interface RegressionDiagnostics {
  durbin_watson: number;
  jarque_bera: number;
  breusch_pagan: number;
  vif?: number[]; // Variance Inflation Factor for multiple regression
}

export interface NonParametricTestResult {
  testType: 'mann-whitney' | 'wilcoxon' | 'kruskal-wallis';
  statistic: number;
  pValue: number;
  effectSize?: number;
  ranks?: { [group: string]: number[] };
  medians?: { [group: string]: number };
}

export interface TestSuggestion {
  testName: string;
  testType: string;
  reason: string;
  assumptions: string[];
  alternatives?: string[];
  confidence: number; // 0-1 scale
}

/**
 * Statistical Analysis Service
 * Provides comprehensive statistical analysis functions using simple-statistics library
 * Enhanced with caching and performance monitoring
 */
export class StatisticalAnalysisService {
  
  /**
   * Generate a hash for caching statistical computations
   */
  private static generateComputationHash(functionName: string, data: any): string {
    const content = functionName + JSON.stringify(data);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Execute a statistical computation with caching and performance monitoring
   */
  private static async executeWithCache<T>(
    functionName: string,
    data: any,
    computationFn: () => Promise<T> | T,
    datasetSize: number = 0
  ): Promise<T> {
    const hash = this.generateComputationHash(functionName, data);
    
    // Try to get from cache first
    const cachedResult = await AnalysisCacheService.getCachedStatisticalResult<T>(hash);
    if (cachedResult !== null) {
      // Record cache hit metrics
      await withStatisticalMetrics(functionName, datasetSize, async () => cachedResult, true);
      return cachedResult;
    }

    // Execute computation with performance monitoring
    const result = await withStatisticalMetrics(
      functionName,
      datasetSize,
      async () => {
        const computation = computationFn();
        return computation instanceof Promise ? await computation : computation;
      },
      false
    );

    // Cache the result
    await AnalysisCacheService.cacheStatisticalResult(hash, result);

    return result;
  }

  /**
   * Execute heavy computation in background job queue
   */
  private static async executeAsBackgroundJob<T>(
    analysisType: string,
    data: any,
    userId?: string
  ): Promise<string> {
    const jobId = await JobQueue.addJob(
      JobType.STATISTICAL_ANALYSIS,
      {
        analysisType,
        data
      },
      {
        priority: JobPriority.NORMAL,
        userId,
        maxRetries: 2
      }
    );

    return jobId;
  }

  /**
   * Check if computation should be executed in background based on data size
   */
  private static shouldUseBackgroundJob(dataSize: number): boolean {
    const BACKGROUND_THRESHOLD = 10000; // 10k data points
    return dataSize > BACKGROUND_THRESHOLD;
  }
  
  /**
   * Calculate descriptive statistics for a numeric array
   */
  static async calculateDescriptiveStats(data: number[]): Promise<DescriptiveStats> {
    return await this.executeWithCache(
      'calculateDescriptiveStats',
      data,
      () => this.computeDescriptiveStats(data),
      data.length
    );
  }

  /**
   * Internal computation for descriptive statistics
   */
  private static computeDescriptiveStats(data: number[]): DescriptiveStats {
    // Filter out null/undefined values
    const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validData.length === 0) {
      return {
        count: 0,
        nullCount: data.length
      };
    }

    const sortedData = [...validData].sort((a, b) => a - b);
    
    return {
      mean: ss.mean(validData),
      median: ss.median(validData),
      mode: ss.mode(validData),
      standardDeviation: ss.standardDeviation(validData),
      variance: ss.variance(validData),
      min: ss.min(validData),
      max: ss.max(validData),
      quartiles: [
        ss.quantile(validData, 0.25),
        ss.quantile(validData, 0.5),
        ss.quantile(validData, 0.75)
      ],
      skewness: ss.sampleSkewness(validData),
      kurtosis: ss.sampleKurtosis(validData),
      count: validData.length,
      nullCount: data.length - validData.length
    };
  }

  /**
   * Perform frequency analysis for categorical or discrete data
   */
  static async performFrequencyAnalysis(data: any[], binCount?: number): Promise<FrequencyAnalysisResult> {
    return await this.executeWithCache(
      'performFrequencyAnalysis',
      { data, binCount },
      () => this.computeFrequencyAnalysis(data, binCount),
      data.length
    );
  }

  /**
   * Internal computation for frequency analysis
   */
  private static computeFrequencyAnalysis(data: any[], binCount?: number): FrequencyAnalysisResult {
    const validData = data.filter(val => val !== null && val !== undefined);
    
    // For numeric data, create histogram bins
    if (typeof validData[0] === 'number' && binCount) {
      return this.createHistogram(validData as number[], binCount);
    }
    
    // For categorical data, count frequencies
    const frequencies: { [key: string]: number } = {};
    validData.forEach(value => {
      const key = String(value);
      frequencies[key] = (frequencies[key] || 0) + 1;
    });

    const total = validData.length;
    const relativeFrequencies: { [key: string]: number } = {};
    const cumulativeFrequencies: { [key: string]: number } = {};
    
    let cumulative = 0;
    Object.keys(frequencies).forEach(key => {
      relativeFrequencies[key] = frequencies[key] / total;
      cumulative += frequencies[key];
      cumulativeFrequencies[key] = cumulative;
    });

    return {
      frequencies,
      relativeFrequencies,
      cumulativeFrequencies,
      histogram: []
    };
  }

  /**
   * Create histogram bins for numeric data
   */
  private static createHistogram(data: number[], binCount: number): FrequencyAnalysisResult {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const binWidth = (max - min) / binCount;
    
    const histogram: HistogramBin[] = [];
    const frequencies: { [key: string]: number } = {};
    
    // Initialize bins
    for (let i = 0; i < binCount; i++) {
      const binMin = min + i * binWidth;
      const binMax = i === binCount - 1 ? max : min + (i + 1) * binWidth;
      histogram.push({
        min: binMin,
        max: binMax,
        count: 0,
        frequency: 0
      });
    }
    
    // Count data points in each bin
    data.forEach(value => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), binCount - 1);
      histogram[binIndex].count++;
    });
    
    // Calculate frequencies
    const total = data.length;
    histogram.forEach((bin, index) => {
      bin.frequency = bin.count / total;
      const binLabel = `[${bin.min.toFixed(2)}, ${bin.max.toFixed(2)})`;
      frequencies[binLabel] = bin.count;
    });

    return {
      frequencies,
      relativeFrequencies: Object.fromEntries(
        Object.entries(frequencies).map(([key, value]) => [key, value / total])
      ),
      cumulativeFrequencies: {},
      histogram
    };
  }

  /**
   * Calculate correlation matrix for multiple numeric variables
   */
  static calculateCorrelationMatrix(
    data: { [variable: string]: number[] },
    method: 'pearson' | 'spearman' = 'pearson'
  ): CorrelationMatrix {
    const variables = Object.keys(data);
    const n = variables.length;
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const x = data[variables[i]].filter((val, idx) => 
            val !== null && val !== undefined && !isNaN(val) &&
            data[variables[j]][idx] !== null && data[variables[j]][idx] !== undefined && !isNaN(data[variables[j]][idx])
          );
          const y = data[variables[j]].filter((val, idx) => 
            val !== null && val !== undefined && !isNaN(val) &&
            data[variables[i]][idx] !== null && data[variables[i]][idx] !== undefined && !isNaN(data[variables[i]][idx])
          );
          
          if (x.length > 1 && y.length > 1) {
            if (method === 'pearson') {
              matrix[i][j] = ss.sampleCorrelation(x, y);
            } else {
              // For Spearman, we need to rank the data first
              matrix[i][j] = this.spearmanCorrelation(x, y);
            }
          } else {
            matrix[i][j] = NaN;
          }
        }
      }
    }
    
    return {
      variables,
      matrix
    };
  }

  /**
   * Calculate Spearman rank correlation
   */
  private static spearmanCorrelation(x: number[], y: number[]): number {
    const rankX = this.getRanks(x);
    const rankY = this.getRanks(y);
    return ss.sampleCorrelation(rankX, rankY);
  }

  /**
   * Get ranks for Spearman correlation
   */
  private static getRanks(data: number[]): number[] {
    const sorted = data.map((value, index) => ({ value, index }))
      .sort((a, b) => a.value - b.value);
    
    const ranks = new Array(data.length);
    sorted.forEach((item, rank) => {
      ranks[item.index] = rank + 1;
    });
    
    return ranks;
  }

  /**
   * Perform Shapiro-Wilk normality test
   * Note: This is a simplified implementation. For production, consider using a more robust library.
   */
  static shapiroWilkTest(data: number[], alpha: number = 0.05): NormalityTestResult {
    const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validData.length < 3 || validData.length > 5000) {
      throw new Error('Shapiro-Wilk test requires sample size between 3 and 5000');
    }
    
    // This is a simplified implementation
    // In a production environment, you would use a proper statistical library
    const n = validData.length;
    const sortedData = [...validData].sort((a, b) => a - b);
    
    // Calculate test statistic (simplified)
    const mean = ss.mean(sortedData);
    const variance = ss.variance(sortedData);
    
    // Simplified W statistic calculation
    let numerator = 0;
    for (let i = 0; i < Math.floor(n / 2); i++) {
      numerator += (sortedData[n - 1 - i] - sortedData[i]);
    }
    numerator = numerator * numerator;
    
    const denominator = (n - 1) * variance;
    const W = numerator / denominator;
    
    // Simplified p-value calculation (this would need proper statistical tables)
    const pValue = W > 0.9 ? 0.1 : 0.01; // Very simplified
    
    return {
      testName: 'Shapiro-Wilk',
      statistic: W,
      pValue,
      isNormal: pValue > alpha,
      alpha
    };
  }

  /**
   * Perform Kolmogorov-Smirnov normality test
   */
  static kolmogorovSmirnovTest(data: number[], alpha: number = 0.05): NormalityTestResult {
    const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validData.length < 1) {
      throw new Error('Insufficient data for Kolmogorov-Smirnov test');
    }
    
    const n = validData.length;
    const sortedData = [...validData].sort((a, b) => a - b);
    const mean = ss.mean(sortedData);
    const std = ss.standardDeviation(sortedData);
    
    // Calculate D statistic
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      const empiricalCDF = (i + 1) / n;
      const theoreticalCDF = this.normalCDF((sortedData[i] - mean) / std);
      const diff = Math.abs(empiricalCDF - theoreticalCDF);
      maxDiff = Math.max(maxDiff, diff);
    }
    
    // Critical value approximation
    const criticalValue = 1.36 / Math.sqrt(n); // For alpha = 0.05
    const pValue = maxDiff > criticalValue ? 0.01 : 0.1; // Simplified
    
    return {
      testName: 'Kolmogorov-Smirnov',
      statistic: maxDiff,
      pValue,
      isNormal: pValue > alpha,
      alpha
    };
  }

  /**
   * Approximate normal CDF using error function approximation
   */
  private static normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private static erf(x: number): number {
    // Abramowitz and Stegun approximation
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }

  // ============ ADVANCED STATISTICAL TESTS ============

  /**
   * Perform one-sample t-test
   */
  static oneSampleTTest(
    data: number[], 
    populationMean: number, 
    alpha: number = 0.05
  ): TTestResult {
    const validData = data.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validData.length < 2) {
      throw new Error('One-sample t-test requires at least 2 observations');
    }

    const n = validData.length;
    const sampleMean = ss.mean(validData);
    const sampleStd = ss.standardDeviation(validData);
    const standardError = sampleStd / Math.sqrt(n);
    const tStatistic = (sampleMean - populationMean) / standardError;
    const degreesOfFreedom = n - 1;
    
    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.tCDF(Math.abs(tStatistic), degreesOfFreedom));
    
    // Calculate confidence interval
    const tCritical = this.tInverse(1 - alpha / 2, degreesOfFreedom);
    const marginOfError = tCritical * standardError;
    const confidenceInterval: [number, number] = [
      sampleMean - marginOfError,
      sampleMean + marginOfError
    ];
    
    // Calculate Cohen's d (effect size)
    const cohensD = (sampleMean - populationMean) / sampleStd;
    
    // Check assumptions
    const assumptions = this.checkTTestAssumptions(validData);
    
    return {
      testType: 'one-sample',
      statistic: tStatistic,
      pValue,
      degreesOfFreedom,
      confidenceInterval,
      meanDifference: sampleMean - populationMean,
      standardError,
      effectSize: cohensD,
      assumptions
    };
  }

  /**
   * Perform independent samples t-test
   */
  static independentTTest(
    group1: number[], 
    group2: number[], 
    equalVariances: boolean = true,
    alpha: number = 0.05
  ): TTestResult {
    const validGroup1 = group1.filter(val => val !== null && val !== undefined && !isNaN(val));
    const validGroup2 = group2.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validGroup1.length < 2 || validGroup2.length < 2) {
      throw new Error('Independent t-test requires at least 2 observations in each group');
    }

    const n1 = validGroup1.length;
    const n2 = validGroup2.length;
    const mean1 = ss.mean(validGroup1);
    const mean2 = ss.mean(validGroup2);
    const var1 = ss.variance(validGroup1);
    const var2 = ss.variance(validGroup2);
    
    let tStatistic: number;
    let degreesOfFreedom: number;
    let standardError: number;
    
    if (equalVariances) {
      // Pooled variance t-test
      const pooledVariance = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
      standardError = Math.sqrt(pooledVariance * (1/n1 + 1/n2));
      tStatistic = (mean1 - mean2) / standardError;
      degreesOfFreedom = n1 + n2 - 2;
    } else {
      // Welch's t-test (unequal variances)
      standardError = Math.sqrt(var1/n1 + var2/n2);
      tStatistic = (mean1 - mean2) / standardError;
      
      // Welch-Satterthwaite equation for degrees of freedom
      const numerator = Math.pow(var1/n1 + var2/n2, 2);
      const denominator = Math.pow(var1/n1, 2)/(n1-1) + Math.pow(var2/n2, 2)/(n2-1);
      degreesOfFreedom = numerator / denominator;
    }
    
    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.tCDF(Math.abs(tStatistic), degreesOfFreedom));
    
    // Calculate confidence interval
    const tCritical = this.tInverse(1 - alpha / 2, degreesOfFreedom);
    const marginOfError = tCritical * standardError;
    const meanDifference = mean1 - mean2;
    const confidenceInterval: [number, number] = [
      meanDifference - marginOfError,
      meanDifference + marginOfError
    ];
    
    // Calculate Cohen's d (effect size)
    const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
    const cohensD = meanDifference / pooledStd;
    
    // Check assumptions
    const assumptions = this.checkIndependentTTestAssumptions(validGroup1, validGroup2);
    
    return {
      testType: 'independent',
      statistic: tStatistic,
      pValue,
      degreesOfFreedom,
      confidenceInterval,
      meanDifference,
      standardError,
      effectSize: cohensD,
      assumptions
    };
  }

  /**
   * Perform paired samples t-test
   */
  static pairedTTest(
    before: number[], 
    after: number[], 
    alpha: number = 0.05
  ): TTestResult {
    if (before.length !== after.length) {
      throw new Error('Paired t-test requires equal length arrays');
    }
    
    // Calculate differences, filtering out pairs with missing values
    const differences: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== null && before[i] !== undefined && !isNaN(before[i]) &&
          after[i] !== null && after[i] !== undefined && !isNaN(after[i])) {
        differences.push(after[i] - before[i]);
      }
    }
    
    if (differences.length < 2) {
      throw new Error('Paired t-test requires at least 2 valid pairs');
    }
    
    // Perform one-sample t-test on differences against 0
    const result = this.oneSampleTTest(differences, 0, alpha);
    
    return {
      ...result,
      testType: 'paired'
    };
  }

  /**
   * Perform one-way ANOVA
   */
  static oneWayANOVA(
    groups: { [groupName: string]: number[] },
    alpha: number = 0.05
  ): ANOVAResult {
    const groupNames = Object.keys(groups);
    if (groupNames.length < 2) {
      throw new Error('ANOVA requires at least 2 groups');
    }
    
    // Filter valid data for each group
    const validGroups: { [key: string]: number[] } = {};
    const groupStats: GroupStatistics[] = [];
    let totalN = 0;
    let grandSum = 0;
    
    for (const groupName of groupNames) {
      const validData = groups[groupName].filter(val => val !== null && val !== undefined && !isNaN(val));
      if (validData.length < 2) {
        throw new Error(`Group ${groupName} must have at least 2 observations`);
      }
      
      validGroups[groupName] = validData;
      const mean = ss.mean(validData);
      const std = ss.standardDeviation(validData);
      const n = validData.length;
      
      groupStats.push({
        group: groupName,
        n,
        mean,
        standardDeviation: std,
        standardError: std / Math.sqrt(n)
      });
      
      totalN += n;
      grandSum += ss.sum(validData);
    }
    
    const grandMean = grandSum / totalN;
    
    // Calculate sum of squares
    let ssBetween = 0;
    let ssWithin = 0;
    
    for (const groupName of groupNames) {
      const groupData = validGroups[groupName];
      const groupMean = ss.mean(groupData);
      const n = groupData.length;
      
      // Between-groups sum of squares
      ssBetween += n * Math.pow(groupMean - grandMean, 2);
      
      // Within-groups sum of squares
      for (const value of groupData) {
        ssWithin += Math.pow(value - groupMean, 2);
      }
    }
    
    const dfBetween = groupNames.length - 1;
    const dfWithin = totalN - groupNames.length;
    const msBetween = ssBetween / dfBetween;
    const msWithin = ssWithin / dfWithin;
    const fStatistic = msBetween / msWithin;
    
    // Calculate p-value
    const pValue = 1 - this.fCDF(fStatistic, dfBetween, dfWithin);
    
    // Calculate eta-squared (effect size)
    const etaSquared = ssBetween / (ssBetween + ssWithin);
    
    // Perform post-hoc tests if significant
    let postHocTests: PostHocTestResult[] | undefined;
    if (pValue < alpha && groupNames.length > 2) {
      postHocTests = this.tukeyHSD(validGroups, msWithin, dfWithin, alpha);
    }
    
    // Check assumptions
    const assumptions = this.checkANOVAAssumptions(validGroups);
    
    return {
      fStatistic,
      pValue,
      degreesOfFreedomBetween: dfBetween,
      degreesOfFreedomWithin: dfWithin,
      meanSquareBetween: msBetween,
      meanSquareWithin: msWithin,
      etaSquared,
      groups: groupStats,
      postHocTests,
      assumptions
    };
  }

  /**
   * Perform simple linear regression
   */
  static linearRegression(
    x: number[], 
    y: number[], 
    alpha: number = 0.05
  ): RegressionResult {
    if (x.length !== y.length) {
      throw new Error('X and Y arrays must have the same length');
    }
    
    // Filter out pairs with missing values
    const validPairs: Array<[number, number]> = [];
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== null && x[i] !== undefined && !isNaN(x[i]) &&
          y[i] !== null && y[i] !== undefined && !isNaN(y[i])) {
        validPairs.push([x[i], y[i]]);
      }
    }
    
    if (validPairs.length < 3) {
      throw new Error('Linear regression requires at least 3 valid data points');
    }
    
    const validX = validPairs.map(pair => pair[0]);
    const validY = validPairs.map(pair => pair[1]);
    
    // Calculate regression coefficients
    const n = validPairs.length;
    const sumX = ss.sum(validX);
    const sumY = ss.sum(validY);
    const sumXY = validPairs.reduce((sum, [xi, yi]) => sum + xi * yi, 0);
    const sumX2 = validX.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = validY.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate fitted values and residuals
    const fitted = validX.map(xi => intercept + slope * xi);
    const residuals = validY.map((yi, i) => yi - fitted[i]);
    
    // Calculate R-squared
    const yMean = ss.mean(validY);
    const ssTotal = validY.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = residuals.reduce((sum, ri) => sum + ri * ri, 0);
    const rSquared = 1 - ssResidual / ssTotal;
    const adjustedRSquared = 1 - (ssResidual / (n - 2)) / (ssTotal / (n - 1));
    
    // Calculate standard errors and t-statistics
    const mse = ssResidual / (n - 2);
    const standardError = Math.sqrt(mse);
    const sxx = sumX2 - sumX * sumX / n;
    const interceptSE = standardError * Math.sqrt(1/n + (sumX/n) * (sumX/n) / sxx);
    const slopeSE = standardError / Math.sqrt(sxx);
    
    const interceptT = intercept / interceptSE;
    const slopeT = slope / slopeSE;
    const df = n - 2;
    
    const interceptP = 2 * (1 - this.tCDF(Math.abs(interceptT), df));
    const slopeP = 2 * (1 - this.tCDF(Math.abs(slopeT), df));
    
    // Calculate confidence intervals
    const tCritical = this.tInverse(1 - alpha / 2, df);
    const interceptCI: [number, number] = [
      intercept - tCritical * interceptSE,
      intercept + tCritical * interceptSE
    ];
    const slopeCI: [number, number] = [
      slope - tCritical * slopeSE,
      slope + tCritical * slopeSE
    ];
    
    // F-statistic for overall model
    const fStatistic = (rSquared / 1) / ((1 - rSquared) / (n - 2));
    const fPValue = 1 - this.fCDF(fStatistic, 1, n - 2);
    
    const coefficients: RegressionCoefficient[] = [
      {
        variable: 'Intercept',
        coefficient: intercept,
        standardError: interceptSE,
        tStatistic: interceptT,
        pValue: interceptP,
        confidenceInterval: interceptCI
      },
      {
        variable: 'X',
        coefficient: slope,
        standardError: slopeSE,
        tStatistic: slopeT,
        pValue: slopeP,
        confidenceInterval: slopeCI
      }
    ];
    
    // Calculate diagnostics
    const diagnostics = this.calculateRegressionDiagnostics(residuals, fitted);
    
    // Check assumptions
    const assumptions = this.checkRegressionAssumptions(validX, validY, residuals, fitted);
    
    return {
      type: 'linear',
      coefficients,
      rSquared,
      adjustedRSquared,
      fStatistic,
      fPValue,
      standardError,
      residuals,
      fitted,
      assumptions,
      diagnostics
    };
  }

  /**
   * Perform Mann-Whitney U test (Wilcoxon rank-sum test)
   */
  static mannWhitneyUTest(
    group1: number[], 
    group2: number[], 
    alpha: number = 0.05
  ): NonParametricTestResult {
    const validGroup1 = group1.filter(val => val !== null && val !== undefined && !isNaN(val));
    const validGroup2 = group2.filter(val => val !== null && val !== undefined && !isNaN(val));
    
    if (validGroup1.length < 1 || validGroup2.length < 1) {
      throw new Error('Mann-Whitney U test requires at least 1 observation in each group');
    }
    
    const n1 = validGroup1.length;
    const n2 = validGroup2.length;
    
    // Combine and rank all observations
    const combined = [
      ...validGroup1.map(val => ({ value: val, group: 1 })),
      ...validGroup2.map(val => ({ value: val, group: 2 }))
    ].sort((a, b) => a.value - b.value);
    
    // Assign ranks (handle ties by averaging)
    const ranks: number[] = [];
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].value === combined[i].value) {
        j++;
      }
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[k] = avgRank;
      }
      i = j;
    }
    
    // Calculate rank sums
    let r1 = 0;
    let r2 = 0;
    for (let k = 0; k < combined.length; k++) {
      if (combined[k].group === 1) {
        r1 += ranks[k];
      } else {
        r2 += ranks[k];
      }
    }
    
    // Calculate U statistics
    const u1 = r1 - (n1 * (n1 + 1)) / 2;
    const u2 = r2 - (n2 * (n2 + 1)) / 2;
    const uStatistic = Math.min(u1, u2);
    
    // Calculate z-score for large samples
    const meanU = (n1 * n2) / 2;
    const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const zScore = (uStatistic - meanU) / stdU;
    
    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    // Calculate effect size (r = z / sqrt(N))
    const effectSize = Math.abs(zScore) / Math.sqrt(n1 + n2);
    
    return {
      testType: 'mann-whitney',
      statistic: uStatistic,
      pValue,
      effectSize,
      ranks: {
        'Group 1': validGroup1.map((_, idx) => ranks[combined.findIndex(item => item.group === 1 && combined.indexOf(item) === idx)]),
        'Group 2': validGroup2.map((_, idx) => ranks[combined.findIndex(item => item.group === 2 && combined.indexOf(item) === idx)])
      },
      medians: {
        'Group 1': ss.median(validGroup1),
        'Group 2': ss.median(validGroup2)
      }
    };
  }

  /**
   * Perform Wilcoxon signed-rank test
   */
  static wilcoxonSignedRankTest(
    before: number[], 
    after: number[], 
    alpha: number = 0.05
  ): NonParametricTestResult {
    if (before.length !== after.length) {
      throw new Error('Wilcoxon signed-rank test requires equal length arrays');
    }
    
    // Calculate differences, filtering out pairs with missing values and zero differences
    const differences: number[] = [];
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== null && before[i] !== undefined && !isNaN(before[i]) &&
          after[i] !== null && after[i] !== undefined && !isNaN(after[i])) {
        const diff = after[i] - before[i];
        if (diff !== 0) {
          differences.push(diff);
        }
      }
    }
    
    if (differences.length < 1) {
      throw new Error('Wilcoxon signed-rank test requires at least 1 non-zero difference');
    }
    
    const n = differences.length;
    
    // Rank absolute differences
    const absDiffs = differences.map(Math.abs);
    const sortedIndices = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => absDiffs[a] - absDiffs[b]);
    
    const ranks: number[] = new Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n && absDiffs[sortedIndices[j]] === absDiffs[sortedIndices[i]]) {
        j++;
      }
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[sortedIndices[k]] = avgRank;
      }
      i = j;
    }
    
    // Calculate W+ (sum of positive ranks)
    let wPlus = 0;
    for (let k = 0; k < n; k++) {
      if (differences[k] > 0) {
        wPlus += ranks[k];
      }
    }
    
    // Calculate test statistic (smaller of W+ and W-)
    const wMinus = (n * (n + 1)) / 2 - wPlus;
    const wStatistic = Math.min(wPlus, wMinus);
    
    // Calculate z-score for large samples (n > 10)
    const meanW = (n * (n + 1)) / 4;
    const stdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
    const zScore = (wStatistic - meanW) / stdW;
    
    // Calculate p-value (two-tailed)
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    // Calculate effect size
    const effectSize = Math.abs(zScore) / Math.sqrt(n);
    
    return {
      testType: 'wilcoxon',
      statistic: wStatistic,
      pValue,
      effectSize
    };
  }

  /**
   * Perform Kruskal-Wallis test
   */
  static kruskalWallisTest(
    groups: { [groupName: string]: number[] },
    alpha: number = 0.05
  ): NonParametricTestResult {
    const groupNames = Object.keys(groups);
    if (groupNames.length < 2) {
      throw new Error('Kruskal-Wallis test requires at least 2 groups');
    }
    
    // Filter valid data for each group
    const validGroups: { [key: string]: number[] } = {};
    let totalN = 0;
    
    for (const groupName of groupNames) {
      const validData = groups[groupName].filter(val => val !== null && val !== undefined && !isNaN(val));
      if (validData.length < 1) {
        throw new Error(`Group ${groupName} must have at least 1 observation`);
      }
      validGroups[groupName] = validData;
      totalN += validData.length;
    }
    
    // Combine all observations and rank them
    const combined: Array<{ value: number; group: string }> = [];
    for (const [groupName, data] of Object.entries(validGroups)) {
      for (const value of data) {
        combined.push({ value, group: groupName });
      }
    }
    combined.sort((a, b) => a.value - b.value);
    
    // Assign ranks (handle ties)
    const ranks: number[] = [];
    let i = 0;
    while (i < combined.length) {
      let j = i;
      while (j < combined.length && combined[j].value === combined[i].value) {
        j++;
      }
      const avgRank = (i + j + 1) / 2;
      for (let k = i; k < j; k++) {
        ranks[k] = avgRank;
      }
      i = j;
    }
    
    // Calculate rank sums for each group
    const rankSums: { [key: string]: number } = {};
    const groupSizes: { [key: string]: number } = {};
    
    for (const groupName of groupNames) {
      rankSums[groupName] = 0;
      groupSizes[groupName] = validGroups[groupName].length;
    }
    
    for (let k = 0; k < combined.length; k++) {
      rankSums[combined[k].group] += ranks[k];
    }
    
    // Calculate H statistic
    let h = 0;
    for (const groupName of groupNames) {
      const ni = groupSizes[groupName];
      const ri = rankSums[groupName];
      h += (ri * ri) / ni;
    }
    h = (12 / (totalN * (totalN + 1))) * h - 3 * (totalN + 1);
    
    // Calculate p-value (chi-square distribution with k-1 degrees of freedom)
    const df = groupNames.length - 1;
    const pValue = 1 - this.chiSquareCDF(h, df);
    
    // Calculate medians for each group
    const medians: { [key: string]: number } = {};
    for (const [groupName, data] of Object.entries(validGroups)) {
      medians[groupName] = ss.median(data);
    }
    
    return {
      testType: 'kruskal-wallis',
      statistic: h,
      pValue,
      medians
    };
  }

  /**
   * Create contingency table and perform chi-square test
   */
  static createContingencyTable(
    rowData: any[],
    columnData: any[],
    rowVariable: string,
    columnVariable: string
  ): ContingencyTable {
    if (rowData.length !== columnData.length) {
      throw new Error('Row and column data must have the same length');
    }
    
    // Get unique values for rows and columns
    const rowLabels = [...new Set(rowData.filter(val => val !== null && val !== undefined))].map(String).sort();
    const columnLabels = [...new Set(columnData.filter(val => val !== null && val !== undefined))].map(String).sort();
    
    // Initialize contingency table
    const table: number[][] = Array(rowLabels.length).fill(null).map(() => Array(columnLabels.length).fill(0));
    
    // Fill contingency table
    for (let i = 0; i < rowData.length; i++) {
      if (rowData[i] !== null && rowData[i] !== undefined && 
          columnData[i] !== null && columnData[i] !== undefined) {
        const rowIndex = rowLabels.indexOf(String(rowData[i]));
        const colIndex = columnLabels.indexOf(String(columnData[i]));
        if (rowIndex >= 0 && colIndex >= 0) {
          table[rowIndex][colIndex]++;
        }
      }
    }
    
    // Calculate totals
    const rowTotals = table.map(row => row.reduce((sum, val) => sum + val, 0));
    const columnTotals = columnLabels.map((_, colIndex) => 
      table.reduce((sum, row) => sum + row[colIndex], 0)
    );
    const grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);
    
    // Perform chi-square test
    const chiSquareTest = this.performChiSquareTest(table, rowTotals, columnTotals, grandTotal);
    
    return {
      rowVariable,
      columnVariable,
      table,
      rowLabels,
      columnLabels,
      totals: {
        rowTotals,
        columnTotals,
        grandTotal
      },
      chiSquareTest
    };
  }

  /**
   * Perform chi-square test of independence
   */
  private static performChiSquareTest(
    observed: number[][],
    rowTotals: number[],
    columnTotals: number[],
    grandTotal: number
  ): ChiSquareTestResult {
    const rows = observed.length;
    const cols = observed[0].length;
    
    // Calculate expected frequencies
    const expected: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0));
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        expected[i][j] = (rowTotals[i] * columnTotals[j]) / grandTotal;
      }
    }
    
    // Calculate chi-square statistic
    let chiSquare = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        if (expected[i][j] > 0) {
          chiSquare += Math.pow(observed[i][j] - expected[i][j], 2) / expected[i][j];
        }
      }
    }
    
    const degreesOfFreedom = (rows - 1) * (cols - 1);
    
    // Simplified p-value calculation (would need proper chi-square distribution)
    const pValue = chiSquare > 3.841 ? 0.01 : 0.1; // Very simplified for df=1
    
    // Calculate Cramer's V (effect size)
    const cramersV = Math.sqrt(chiSquare / (grandTotal * Math.min(rows - 1, cols - 1)));
    
    return {
      statistic: chiSquare,
      pValue,
      degreesOfFreedom,
      expected,
      cramersV
    };
  }

  // ============ STATISTICAL DISTRIBUTION FUNCTIONS ============

  /**
   * Student's t-distribution CDF
   */
  private static tCDF(t: number, df: number): number {
    // Approximation using the incomplete beta function
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;
    
    if (t >= 0) {
      return 1 - 0.5 * this.incompleteBeta(x, a, b);
    } else {
      return 0.5 * this.incompleteBeta(x, a, b);
    }
  }

  /**
   * Inverse t-distribution (quantile function)
   */
  private static tInverse(p: number, df: number): number {
    // Approximation for t-distribution quantiles
    if (df === 1) {
      return Math.tan(Math.PI * (p - 0.5));
    }
    
    // Use normal approximation for large df
    if (df > 30) {
      return this.normalInverse(p);
    }
    
    // Cornish-Fisher expansion approximation
    const z = this.normalInverse(p);
    const z2 = z * z;
    const z3 = z2 * z;
    const z5 = z3 * z2;
    
    const c1 = z3 + z;
    const c2 = 5 * z5 + 16 * z3 + 3 * z;
    const c3 = 3 * z3 + z;
    
    return z + c1 / (4 * df) + c2 / (96 * df * df) + c3 / (384 * df * df * df);
  }

  /**
   * F-distribution CDF
   */
  private static fCDF(f: number, df1: number, df2: number): number {
    if (f <= 0) return 0;
    
    const x = df2 / (df2 + df1 * f);
    return 1 - this.incompleteBeta(x, df2 / 2, df1 / 2);
  }

  /**
   * Chi-square distribution CDF
   */
  private static chiSquareCDF(x: number, df: number): number {
    if (x <= 0) return 0;
    
    return this.incompleteGamma(df / 2, x / 2);
  }

  /**
   * Standard normal CDF
   */
  private static normalCDF(z: number): number {
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  /**
   * Inverse normal distribution (quantile function)
   */
  private static normalInverse(p: number): number {
    // Beasley-Springer-Moro algorithm
    const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    if (p < 0 || p > 1) {
      throw new Error('p must be between 0 and 1');
    }

    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    if (p === 0.5) return 0;

    const q = p < 0.5 ? p : 1 - p;
    
    let x: number;
    if (q > 1.25e-4) {
      const u = Math.sqrt(-2 * Math.log(q));
      x = (((((c[6] * u + c[5]) * u + c[4]) * u + c[3]) * u + c[2]) * u + c[1]) * u + c[0];
      x /= ((((d[4] * u + d[3]) * u + d[2]) * u + d[1]) * u + 1);
    } else {
      const u = Math.sqrt(-2 * Math.log(q));
      x = (((((a[6] * u + a[5]) * u + a[4]) * u + a[3]) * u + a[2]) * u + a[1]) * u + a[0];
      x /= (((((b[5] * u + b[4]) * u + b[3]) * u + b[2]) * u + b[1]) * u + 1);
    }

    return p < 0.5 ? -x : x;
  }

  /**
   * Incomplete beta function
   */
  private static incompleteBeta(x: number, a: number, b: number): number {
    if (x === 0) return 0;
    if (x === 1) return 1;
    
    // Use continued fraction approximation
    const bt = Math.exp(this.logGamma(a + b) - this.logGamma(a) - this.logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    
    if (x < (a + 1) / (a + b + 2)) {
      return bt * this.betaContinuedFraction(x, a, b) / a;
    } else {
      return 1 - bt * this.betaContinuedFraction(1 - x, b, a) / b;
    }
  }

  /**
   * Beta function continued fraction
   */
  private static betaContinuedFraction(x: number, a: number, b: number): number {
    const maxIterations = 100;
    const epsilon = 1e-15;
    
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    let h = d;
    
    for (let m = 1; m <= maxIterations; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      h *= d * c;
      
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      const del = d * c;
      h *= del;
      
      if (Math.abs(del - 1) < epsilon) break;
    }
    
    return h;
  }

  /**
   * Incomplete gamma function
   */
  private static incompleteGamma(a: number, x: number): number {
    if (x === 0) return 0;
    if (x < 0 || a <= 0) throw new Error('Invalid parameters for incomplete gamma function');
    
    if (x < a + 1) {
      // Use series representation
      let sum = 1 / a;
      let term = 1 / a;
      
      for (let n = 1; n < 100; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < 1e-15) break;
      }
      
      return sum * Math.exp(-x + a * Math.log(x) - this.logGamma(a));
    } else {
      // Use continued fraction
      let b = x + 1 - a;
      let c = 1e30;
      let d = 1 / b;
      let h = d;
      
      for (let i = 1; i < 100; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-15) break;
      }
      
      return 1 - h * Math.exp(-x + a * Math.log(x) - this.logGamma(a));
    }
  }

  /**
   * Log gamma function
   */
  private static logGamma(x: number): number {
    const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    
    let j = 0;
    let ser = 1.000000000190015;
    let xx = x;
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    
    for (; j < 6; j++) {
      ser += cof[j] / ++y;
    }
    
    return -tmp + Math.log(2.5066282746310005 * ser / xx);
  }

  // ============ ASSUMPTION CHECKING METHODS ============

  /**
   * Check assumptions for t-tests
   */
  private static checkTTestAssumptions(data: number[]): AssumptionResult[] {
    const assumptions: AssumptionResult[] = [];
    
    // Normality assumption
    try {
      const normalityTest = this.shapiroWilkTest(data);
      assumptions.push({
        name: 'Normality',
        test: 'Shapiro-Wilk',
        result: normalityTest.isNormal ? 'passed' : 'failed',
        pValue: normalityTest.pValue,
        statistic: normalityTest.statistic,
        message: normalityTest.isNormal 
          ? 'Data appears to be normally distributed' 
          : 'Data may not be normally distributed. Consider non-parametric alternatives.'
      });
    } catch (error) {
      assumptions.push({
        name: 'Normality',
        test: 'Shapiro-Wilk',
        result: 'warning',
        message: 'Could not perform normality test: ' + (error as Error).message
      });
    }
    
    return assumptions;
  }

  /**
   * Check assumptions for independent t-test
   */
  private static checkIndependentTTestAssumptions(group1: number[], group2: number[]): AssumptionResult[] {
    const assumptions: AssumptionResult[] = [];
    
    // Normality for both groups
    try {
      const normalityTest1 = this.shapiroWilkTest(group1);
      const normalityTest2 = this.shapiroWilkTest(group2);
      
      const bothNormal = normalityTest1.isNormal && normalityTest2.isNormal;
      assumptions.push({
        name: 'Normality',
        test: 'Shapiro-Wilk',
        result: bothNormal ? 'passed' : 'failed',
        message: bothNormal 
          ? 'Both groups appear normally distributed' 
          : 'One or both groups may not be normally distributed'
      });
    } catch (error) {
      assumptions.push({
        name: 'Normality',
        test: 'Shapiro-Wilk',
        result: 'warning',
        message: 'Could not perform normality test: ' + (error as Error).message
      });
    }
    
    // Equal variances (Levene's test approximation)
    const var1 = ss.variance(group1);
    const var2 = ss.variance(group2);
    const fRatio = Math.max(var1, var2) / Math.min(var1, var2);
    
    assumptions.push({
      name: 'Equal Variances',
      test: 'F-ratio',
      result: fRatio < 4 ? 'passed' : 'failed',
      statistic: fRatio,
      message: fRatio < 4 
        ? 'Variances appear equal' 
        : 'Variances may be unequal. Consider Welch\'s t-test.'
    });
    
    return assumptions;
  }

  /**
   * Check assumptions for ANOVA
   */
  private static checkANOVAAssumptions(groups: { [key: string]: number[] }): AssumptionResult[] {
    const assumptions: AssumptionResult[] = [];
    
    // Normality for each group
    const groupNames = Object.keys(groups);
    let allNormal = true;
    
    for (const groupName of groupNames) {
      try {
        const normalityTest = this.shapiroWilkTest(groups[groupName]);
        if (!normalityTest.isNormal) {
          allNormal = false;
        }
      } catch (error) {
        allNormal = false;
      }
    }
    
    assumptions.push({
      name: 'Normality',
      test: 'Shapiro-Wilk',
      result: allNormal ? 'passed' : 'failed',
      message: allNormal 
        ? 'All groups appear normally distributed' 
        : 'One or more groups may not be normally distributed'
    });
    
    // Homogeneity of variances (Levene's test approximation)
    const variances = groupNames.map(name => ss.variance(groups[name]));
    const maxVar = Math.max(...variances);
    const minVar = Math.min(...variances);
    const varianceRatio = maxVar / minVar;
    
    assumptions.push({
      name: 'Homogeneity of Variances',
      test: 'Variance Ratio',
      result: varianceRatio < 4 ? 'passed' : 'failed',
      statistic: varianceRatio,
      message: varianceRatio < 4 
        ? 'Variances appear homogeneous' 
        : 'Variances may be heterogeneous. Consider non-parametric alternatives.'
    });
    
    return assumptions;
  }

  /**
   * Check assumptions for regression
   */
  private static checkRegressionAssumptions(
    x: number[], 
    y: number[], 
    residuals: number[], 
    fitted: number[]
  ): AssumptionResult[] {
    const assumptions: AssumptionResult[] = [];
    
    // Linearity (correlation between x and y)
    const correlation = ss.sampleCorrelation(x, y);
    assumptions.push({
      name: 'Linearity',
      test: 'Correlation',
      result: Math.abs(correlation) > 0.3 ? 'passed' : 'warning',
      statistic: correlation,
      message: Math.abs(correlation) > 0.3 
        ? 'Linear relationship appears reasonable' 
        : 'Weak linear relationship. Consider non-linear models.'
    });
    
    // Normality of residuals
    try {
      const normalityTest = this.shapiroWilkTest(residuals);
      assumptions.push({
        name: 'Normality of Residuals',
        test: 'Shapiro-Wilk',
        result: normalityTest.isNormal ? 'passed' : 'failed',
        pValue: normalityTest.pValue,
        statistic: normalityTest.statistic,
        message: normalityTest.isNormal 
          ? 'Residuals appear normally distributed' 
          : 'Residuals may not be normally distributed'
      });
    } catch (error) {
      assumptions.push({
        name: 'Normality of Residuals',
        test: 'Shapiro-Wilk',
        result: 'warning',
        message: 'Could not test residual normality: ' + (error as Error).message
      });
    }
    
    // Homoscedasticity (constant variance of residuals)
    const residualVariance = ss.variance(residuals);
    const firstHalf = residuals.slice(0, Math.floor(residuals.length / 2));
    const secondHalf = residuals.slice(Math.floor(residuals.length / 2));
    const var1 = ss.variance(firstHalf);
    const var2 = ss.variance(secondHalf);
    const varianceRatio = Math.max(var1, var2) / Math.min(var1, var2);
    
    assumptions.push({
      name: 'Homoscedasticity',
      test: 'Variance Ratio',
      result: varianceRatio < 4 ? 'passed' : 'failed',
      statistic: varianceRatio,
      message: varianceRatio < 4 
        ? 'Residual variance appears constant' 
        : 'Residual variance may not be constant'
    });
    
    return assumptions;
  }

  /**
   * Calculate regression diagnostics
   */
  private static calculateRegressionDiagnostics(
    residuals: number[], 
    fitted: number[]
  ): RegressionDiagnostics {
    // Durbin-Watson test for autocorrelation
    let sumSquaredDiff = 0;
    let sumSquaredResiduals = 0;
    
    for (let i = 1; i < residuals.length; i++) {
      sumSquaredDiff += Math.pow(residuals[i] - residuals[i - 1], 2);
    }
    
    for (const residual of residuals) {
      sumSquaredResiduals += residual * residual;
    }
    
    const durbinWatson = sumSquaredDiff / sumSquaredResiduals;
    
    // Simplified diagnostics (would need more sophisticated tests in production)
    return {
      durbin_watson: durbinWatson,
      jarque_bera: 0, // Placeholder
      breusch_pagan: 0 // Placeholder
    };
  }

  /**
   * Tukey HSD post-hoc test
   */
  private static tukeyHSD(
    groups: { [key: string]: number[] },
    msWithin: number,
    dfWithin: number,
    alpha: number
  ): PostHocTestResult[] {
    const groupNames = Object.keys(groups);
    const results: PostHocTestResult[] = [];
    
    // Calculate group means and sizes
    const groupMeans: { [key: string]: number } = {};
    const groupSizes: { [key: string]: number } = {};
    
    for (const groupName of groupNames) {
      groupMeans[groupName] = ss.mean(groups[groupName]);
      groupSizes[groupName] = groups[groupName].length;
    }
    
    // Perform pairwise comparisons
    for (let i = 0; i < groupNames.length; i++) {
      for (let j = i + 1; j < groupNames.length; j++) {
        const group1 = groupNames[i];
        const group2 = groupNames[j];
        
        const meanDiff = groupMeans[group1] - groupMeans[group2];
        const standardError = Math.sqrt(msWithin * (1/groupSizes[group1] + 1/groupSizes[group2]));
        
        // Studentized range statistic
        const qStatistic = Math.abs(meanDiff) / standardError;
        
        // Simplified p-value calculation (would need proper Studentized range distribution)
        const pValue = qStatistic > 3.0 ? 0.01 : 0.1;
        const adjustedPValue = Math.min(pValue * groupNames.length * (groupNames.length - 1) / 2, 1);
        
        // Confidence interval
        const qCritical = 3.0; // Simplified critical value
        const marginOfError = qCritical * standardError;
        const confidenceInterval: [number, number] = [
          meanDiff - marginOfError,
          meanDiff + marginOfError
        ];
        
        results.push({
          comparison: `${group1} vs ${group2}`,
          meanDifference: meanDiff,
          pValue,
          adjustedPValue,
          confidenceInterval,
          significant: adjustedPValue < alpha
        });
      }
    }
    
    return results;
  }

  // ============ TEST SUGGESTION SYSTEM ============

  /**
   * Suggest appropriate statistical tests based on data characteristics
   */
  static suggestTests(
    dataTypes: { [variable: string]: 'numeric' | 'categorical' },
    sampleSizes: { [variable: string]: number },
    numGroups?: number,
    pairedData?: boolean
  ): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];
    const variables = Object.keys(dataTypes);
    
    // Single numeric variable
    if (variables.length === 1 && dataTypes[variables[0]] === 'numeric') {
      suggestions.push({
        testName: 'One-Sample t-test',
        testType: 'parametric',
        reason: 'Compare sample mean to known population mean',
        assumptions: ['Normality', 'Independence'],
        alternatives: ['Wilcoxon Signed-Rank Test'],
        confidence: 0.8
      });
      
      suggestions.push({
        testName: 'Normality Tests',
        testType: 'diagnostic',
        reason: 'Test if data follows normal distribution',
        assumptions: ['Independence'],
        confidence: 0.9
      });
    }
    
    // Two numeric variables
    if (variables.length === 2 && 
        dataTypes[variables[0]] === 'numeric' && 
        dataTypes[variables[1]] === 'numeric') {
      
      if (pairedData) {
        suggestions.push({
          testName: 'Paired t-test',
          testType: 'parametric',
          reason: 'Compare means of paired observations',
          assumptions: ['Normality of differences', 'Independence'],
          alternatives: ['Wilcoxon Signed-Rank Test'],
          confidence: 0.9
        });
      } else {
        suggestions.push({
          testName: 'Independent t-test',
          testType: 'parametric',
          reason: 'Compare means of two independent groups',
          assumptions: ['Normality', 'Equal variances', 'Independence'],
          alternatives: ['Mann-Whitney U Test'],
          confidence: 0.9
        });
        
        suggestions.push({
          testName: 'Linear Regression',
          testType: 'regression',
          reason: 'Model relationship between variables',
          assumptions: ['Linearity', 'Normality of residuals', 'Homoscedasticity'],
          confidence: 0.8
        });
        
        suggestions.push({
          testName: 'Correlation Analysis',
          testType: 'association',
          reason: 'Measure strength of linear relationship',
          assumptions: ['Linearity', 'Normality (for significance testing)'],
          alternatives: ['Spearman Correlation'],
          confidence: 0.9
        });
      }
    }
    
    // Multiple groups (ANOVA scenario)
    if (numGroups && numGroups > 2) {
      suggestions.push({
        testName: 'One-Way ANOVA',
        testType: 'parametric',
        reason: 'Compare means across multiple groups',
        assumptions: ['Normality', 'Homogeneity of variances', 'Independence'],
        alternatives: ['Kruskal-Wallis Test'],
        confidence: 0.9
      });
    }
    
    // Categorical variables
    const categoricalVars = variables.filter(v => dataTypes[v] === 'categorical');
    if (categoricalVars.length === 2) {
      suggestions.push({
        testName: 'Chi-Square Test of Independence',
        testType: 'non-parametric',
        reason: 'Test association between categorical variables',
        assumptions: ['Expected frequencies ≥ 5', 'Independence'],
        alternatives: ['Fisher\'s Exact Test'],
        confidence: 0.9
      });
    }
    
    // Small sample size adjustments
    const minSampleSize = Math.min(...Object.values(sampleSizes));
    if (minSampleSize < 30) {
      // Boost non-parametric test confidence for small samples
      suggestions.forEach(suggestion => {
        if (suggestion.alternatives) {
          suggestion.confidence *= 0.9; // Reduce parametric test confidence
        }
      });
      
      // Add specific small sample recommendations
      if (variables.length === 2 && dataTypes[variables[0]] === 'numeric' && dataTypes[variables[1]] === 'numeric') {
        suggestions.push({
          testName: 'Mann-Whitney U Test',
          testType: 'non-parametric',
          reason: 'Robust alternative for small samples or non-normal data',
          assumptions: ['Independence', 'Similar distribution shapes'],
          confidence: 0.95
        });
      }
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }
}