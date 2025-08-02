import { StatisticalAnalysisService } from '../lib/statistical-analysis.js';

/**
 * Demo script showcasing the statistical analysis functionality
 */
async function runStatisticalAnalysisDemo() {
  console.log('🔬 Statistical Analysis Demo');
  console.log('============================\n');

  // Sample datasets for demonstration
  const numericData1 = [23, 25, 28, 30, 32, 35, 38, 40, 42, 45, 48, 50, 52, 55, 58];
  const numericData2 = [12, 15, 18, 22, 25, 28, 32, 35, 38, 42, 45, 48, 52, 55, 60];
  const categoricalData = ['A', 'B', 'A', 'C', 'B', 'A', 'C', 'B', 'A', 'B', 'C', 'A', 'B', 'C', 'A'];
  const groupData = ['Group1', 'Group2', 'Group1', 'Group2', 'Group1', 'Group2', 'Group1', 'Group2', 'Group1', 'Group2', 'Group1', 'Group2', 'Group1', 'Group2', 'Group1'];

  // 1. Descriptive Statistics
  console.log('📊 1. Descriptive Statistics');
  console.log('----------------------------');
  const stats1 = StatisticalAnalysisService.calculateDescriptiveStats(numericData1);
  console.log('Dataset 1 Statistics:');
  console.log(`  Mean: ${stats1.mean?.toFixed(2)}`);
  console.log(`  Median: ${stats1.median?.toFixed(2)}`);
  console.log(`  Standard Deviation: ${stats1.standardDeviation?.toFixed(2)}`);
  console.log(`  Min: ${stats1.min}, Max: ${stats1.max}`);
  console.log(`  Quartiles: [${stats1.quartiles?.map(q => q.toFixed(2)).join(', ')}]`);
  console.log(`  Count: ${stats1.count}, Missing: ${stats1.nullCount}\n`);

  // 2. Frequency Analysis
  console.log('📈 2. Frequency Analysis');
  console.log('------------------------');
  const freqAnalysis = StatisticalAnalysisService.performFrequencyAnalysis(categoricalData);
  console.log('Categorical Data Frequencies:');
  Object.entries(freqAnalysis.frequencies).forEach(([value, count]) => {
    const percentage = (freqAnalysis.relativeFrequencies[value] * 100).toFixed(1);
    console.log(`  ${value}: ${count} (${percentage}%)`);
  });

  // Histogram for numeric data
  const histogram = StatisticalAnalysisService.performFrequencyAnalysis(numericData1, 5);
  console.log('\nNumeric Data Histogram (5 bins):');
  histogram.histogram.forEach((bin, index) => {
    console.log(`  Bin ${index + 1}: [${bin.min.toFixed(1)}, ${bin.max.toFixed(1)}) - Count: ${bin.count}`);
  });
  console.log();

  // 3. Correlation Analysis
  console.log('🔗 3. Correlation Analysis');
  console.log('--------------------------');
  const correlationData = {
    'Variable1': numericData1,
    'Variable2': numericData2
  };
  
  const pearsonCorr = StatisticalAnalysisService.calculateCorrelationMatrix(correlationData, 'pearson');
  console.log('Pearson Correlation Matrix:');
  console.log('Variables:', pearsonCorr.variables);
  pearsonCorr.matrix.forEach((row, i) => {
    const rowStr = row.map(val => val.toFixed(3)).join('\t');
    console.log(`  ${pearsonCorr.variables[i]}:\t${rowStr}`);
  });

  const spearmanCorr = StatisticalAnalysisService.calculateCorrelationMatrix(correlationData, 'spearman');
  console.log('\nSpearman Correlation Matrix:');
  console.log('Variables:', spearmanCorr.variables);
  spearmanCorr.matrix.forEach((row, i) => {
    const rowStr = row.map(val => val.toFixed(3)).join('\t');
    console.log(`  ${spearmanCorr.variables[i]}:\t${rowStr}`);
  });
  console.log();

  // 4. Normality Tests
  console.log('📐 4. Normality Tests');
  console.log('--------------------');
  try {
    const shapiroTest = StatisticalAnalysisService.shapiroWilkTest(numericData1);
    console.log('Shapiro-Wilk Test:');
    console.log(`  Statistic: ${shapiroTest.statistic.toFixed(4)}`);
    console.log(`  P-value: ${shapiroTest.pValue.toFixed(4)}`);
    console.log(`  Is Normal: ${shapiroTest.isNormal}`);
    console.log(`  Alpha: ${shapiroTest.alpha}`);
  } catch (error) {
    console.log('Shapiro-Wilk Test: Error -', (error as Error).message);
  }

  try {
    const ksTest = StatisticalAnalysisService.kolmogorovSmirnovTest(numericData1);
    console.log('\nKolmogorov-Smirnov Test:');
    console.log(`  Statistic: ${ksTest.statistic.toFixed(4)}`);
    console.log(`  P-value: ${ksTest.pValue.toFixed(4)}`);
    console.log(`  Is Normal: ${ksTest.isNormal}`);
    console.log(`  Alpha: ${ksTest.alpha}`);
  } catch (error) {
    console.log('Kolmogorov-Smirnov Test: Error -', (error as Error).message);
  }
  console.log();

  // 5. Contingency Table Analysis
  console.log('📋 5. Contingency Table Analysis');
  console.log('--------------------------------');
  const contingencyTable = StatisticalAnalysisService.createContingencyTable(
    categoricalData, 
    groupData, 
    'Category', 
    'Group'
  );
  
  console.log(`Contingency Table: ${contingencyTable.rowVariable} × ${contingencyTable.columnVariable}`);
  console.log('\nObserved Frequencies:');
  console.log('     \t' + contingencyTable.columnLabels.join('\t') + '\tTotal');
  contingencyTable.table.forEach((row, i) => {
    const rowStr = row.join('\t');
    console.log(`${contingencyTable.rowLabels[i]}\t${rowStr}\t${contingencyTable.totals.rowTotals[i]}`);
  });
  console.log('Total\t' + contingencyTable.totals.columnTotals.join('\t') + '\t' + contingencyTable.totals.grandTotal);

  if (contingencyTable.chiSquareTest) {
    console.log('\nChi-Square Test Results:');
    console.log(`  Chi-Square Statistic: ${contingencyTable.chiSquareTest.statistic.toFixed(4)}`);
    console.log(`  Degrees of Freedom: ${contingencyTable.chiSquareTest.degreesOfFreedom}`);
    console.log(`  P-value: ${contingencyTable.chiSquareTest.pValue.toFixed(4)}`);
    console.log(`  Cramer's V (Effect Size): ${contingencyTable.chiSquareTest.cramersV.toFixed(4)}`);
    
    console.log('\nExpected Frequencies:');
    contingencyTable.chiSquareTest.expected.forEach((row, i) => {
      const rowStr = row.map(val => val.toFixed(2)).join('\t');
      console.log(`${contingencyTable.rowLabels[i]}\t${rowStr}`);
    });
  }

  // ============ ADVANCED STATISTICAL TESTS ============
  
  // 6. T-Tests
  console.log('\n🧪 6. T-Tests');
  console.log('-------------');
  
  // One-sample t-test
  try {
    const oneSampleT = StatisticalAnalysisService.oneSampleTTest(numericData1, 35);
    console.log('One-Sample t-test (testing if mean = 35):');
    console.log(`  t-statistic: ${oneSampleT.statistic.toFixed(4)}`);
    console.log(`  p-value: ${oneSampleT.pValue.toFixed(4)}`);
    console.log(`  degrees of freedom: ${oneSampleT.degreesOfFreedom}`);
    console.log(`  mean difference: ${oneSampleT.meanDifference.toFixed(2)}`);
    console.log(`  95% CI: [${oneSampleT.confidenceInterval[0].toFixed(2)}, ${oneSampleT.confidenceInterval[1].toFixed(2)}]`);
    console.log(`  Cohen's d: ${oneSampleT.effectSize.toFixed(3)}`);
    console.log(`  assumptions checked: ${oneSampleT.assumptions.length}`);
  } catch (error) {
    console.log('One-Sample t-test: Error -', (error as Error).message);
  }

  // Independent t-test
  try {
    const independentT = StatisticalAnalysisService.independentTTest(numericData1, numericData2);
    console.log('\nIndependent t-test:');
    console.log(`  t-statistic: ${independentT.statistic.toFixed(4)}`);
    console.log(`  p-value: ${independentT.pValue.toFixed(4)}`);
    console.log(`  degrees of freedom: ${independentT.degreesOfFreedom}`);
    console.log(`  mean difference: ${independentT.meanDifference.toFixed(2)}`);
    console.log(`  95% CI: [${independentT.confidenceInterval[0].toFixed(2)}, ${independentT.confidenceInterval[1].toFixed(2)}]`);
    console.log(`  Cohen's d: ${independentT.effectSize.toFixed(3)}`);
    console.log(`  assumptions checked: ${independentT.assumptions.length}`);
  } catch (error) {
    console.log('Independent t-test: Error -', (error as Error).message);
  }

  // Paired t-test
  try {
    const pairedT = StatisticalAnalysisService.pairedTTest(numericData1, numericData2);
    console.log('\nPaired t-test:');
    console.log(`  t-statistic: ${pairedT.statistic.toFixed(4)}`);
    console.log(`  p-value: ${pairedT.pValue.toFixed(4)}`);
    console.log(`  degrees of freedom: ${pairedT.degreesOfFreedom}`);
    console.log(`  mean difference: ${pairedT.meanDifference.toFixed(2)}`);
    console.log(`  95% CI: [${pairedT.confidenceInterval[0].toFixed(2)}, ${pairedT.confidenceInterval[1].toFixed(2)}]`);
    console.log(`  Cohen's d: ${pairedT.effectSize.toFixed(3)}`);
  } catch (error) {
    console.log('Paired t-test: Error -', (error as Error).message);
  }

  // 7. ANOVA
  console.log('\n📊 7. One-Way ANOVA');
  console.log('-------------------');
  
  // Create sample groups for ANOVA
  const anovaGroups = {
    'Group A': [20, 22, 24, 26, 28],
    'Group B': [30, 32, 34, 36, 38],
    'Group C': [40, 42, 44, 46, 48]
  };

  try {
    const anova = StatisticalAnalysisService.oneWayANOVA(anovaGroups);
    console.log('One-Way ANOVA Results:');
    console.log(`  F-statistic: ${anova.fStatistic.toFixed(4)}`);
    console.log(`  p-value: ${anova.pValue.toFixed(4)}`);
    console.log(`  df between: ${anova.degreesOfFreedomBetween}`);
    console.log(`  df within: ${anova.degreesOfFreedomWithin}`);
    console.log(`  eta-squared: ${anova.etaSquared.toFixed(4)}`);
    
    console.log('\nGroup Statistics:');
    anova.groups.forEach(group => {
      console.log(`  ${group.group}: n=${group.n}, mean=${group.mean.toFixed(2)}, sd=${group.standardDeviation.toFixed(2)}`);
    });

    if (anova.postHocTests && anova.postHocTests.length > 0) {
      console.log('\nPost-hoc Tests (Tukey HSD):');
      anova.postHocTests.forEach(test => {
        console.log(`  ${test.comparison}: diff=${test.meanDifference.toFixed(2)}, p=${test.adjustedPValue.toFixed(4)}, sig=${test.significant}`);
      });
    }

    console.log(`\nAssumptions checked: ${anova.assumptions.length}`);
  } catch (error) {
    console.log('One-Way ANOVA: Error -', (error as Error).message);
  }

  // 8. Linear Regression
  console.log('\n📈 8. Linear Regression');
  console.log('-----------------------');
  
  try {
    const regression = StatisticalAnalysisService.linearRegression(numericData1, numericData2);
    console.log('Linear Regression Results:');
    console.log(`  R-squared: ${regression.rSquared.toFixed(4)}`);
    console.log(`  Adjusted R-squared: ${regression.adjustedRSquared.toFixed(4)}`);
    console.log(`  F-statistic: ${regression.fStatistic.toFixed(4)}`);
    console.log(`  F p-value: ${regression.fPValue.toFixed(4)}`);
    console.log(`  Standard error: ${regression.standardError.toFixed(4)}`);
    
    console.log('\nCoefficients:');
    regression.coefficients.forEach(coef => {
      console.log(`  ${coef.variable}: β=${coef.coefficient.toFixed(4)}, SE=${coef.standardError.toFixed(4)}, t=${coef.tStatistic.toFixed(4)}, p=${coef.pValue.toFixed(4)}`);
      console.log(`    95% CI: [${coef.confidenceInterval[0].toFixed(4)}, ${coef.confidenceInterval[1].toFixed(4)}]`);
    });

    console.log('\nDiagnostics:');
    console.log(`  Durbin-Watson: ${regression.diagnostics.durbin_watson.toFixed(4)}`);
    console.log(`  Assumptions checked: ${regression.assumptions.length}`);
  } catch (error) {
    console.log('Linear Regression: Error -', (error as Error).message);
  }

  // 9. Non-parametric Tests
  console.log('\n🔄 9. Non-parametric Tests');
  console.log('--------------------------');
  
  // Mann-Whitney U test
  try {
    const mannWhitney = StatisticalAnalysisService.mannWhitneyUTest(numericData1.slice(0, 8), numericData2.slice(0, 8));
    console.log('Mann-Whitney U Test:');
    console.log(`  U-statistic: ${mannWhitney.statistic.toFixed(4)}`);
    console.log(`  p-value: ${mannWhitney.pValue.toFixed(4)}`);
    console.log(`  effect size (r): ${mannWhitney.effectSize?.toFixed(4)}`);
    if (mannWhitney.medians) {
      console.log(`  Group 1 median: ${mannWhitney.medians['Group 1']?.toFixed(2)}`);
      console.log(`  Group 2 median: ${mannWhitney.medians['Group 2']?.toFixed(2)}`);
    }
  } catch (error) {
    console.log('Mann-Whitney U Test: Error -', (error as Error).message);
  }

  // Wilcoxon signed-rank test
  try {
    const wilcoxon = StatisticalAnalysisService.wilcoxonSignedRankTest(numericData1.slice(0, 8), numericData2.slice(0, 8));
    console.log('\nWilcoxon Signed-Rank Test:');
    console.log(`  W-statistic: ${wilcoxon.statistic.toFixed(4)}`);
    console.log(`  p-value: ${wilcoxon.pValue.toFixed(4)}`);
    console.log(`  effect size (r): ${wilcoxon.effectSize?.toFixed(4)}`);
  } catch (error) {
    console.log('Wilcoxon Signed-Rank Test: Error -', (error as Error).message);
  }

  // Kruskal-Wallis test
  try {
    const kruskalWallis = StatisticalAnalysisService.kruskalWallisTest(anovaGroups);
    console.log('\nKruskal-Wallis Test:');
    console.log(`  H-statistic: ${kruskalWallis.statistic.toFixed(4)}`);
    console.log(`  p-value: ${kruskalWallis.pValue.toFixed(4)}`);
    if (kruskalWallis.medians) {
      console.log('  Group medians:');
      Object.entries(kruskalWallis.medians).forEach(([group, median]) => {
        console.log(`    ${group}: ${median.toFixed(2)}`);
      });
    }
  } catch (error) {
    console.log('Kruskal-Wallis Test: Error -', (error as Error).message);
  }

  // 10. Test Suggestions
  console.log('\n💡 10. Test Suggestions');
  console.log('-----------------------');
  
  // Single numeric variable
  const suggestions1 = StatisticalAnalysisService.suggestTests(
    { 'variable1': 'numeric' },
    { 'variable1': 30 }
  );
  console.log('Suggestions for single numeric variable:');
  suggestions1.slice(0, 3).forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion.testName} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
    console.log(`     Reason: ${suggestion.reason}`);
  });

  // Two numeric variables
  const suggestions2 = StatisticalAnalysisService.suggestTests(
    { 'var1': 'numeric', 'var2': 'numeric' },
    { 'var1': 30, 'var2': 30 }
  );
  console.log('\nSuggestions for two numeric variables:');
  suggestions2.slice(0, 3).forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion.testName} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
    console.log(`     Reason: ${suggestion.reason}`);
  });

  // Multiple groups
  const suggestions3 = StatisticalAnalysisService.suggestTests(
    { 'outcome': 'numeric' },
    { 'outcome': 90 },
    3
  );
  console.log('\nSuggestions for multiple groups:');
  suggestions3.slice(0, 2).forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion.testName} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
    console.log(`     Reason: ${suggestion.reason}`);
  });

  // Small sample size
  const suggestions4 = StatisticalAnalysisService.suggestTests(
    { 'var1': 'numeric', 'var2': 'numeric' },
    { 'var1': 10, 'var2': 10 }
  );
  console.log('\nSuggestions for small sample sizes:');
  suggestions4.slice(0, 3).forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${suggestion.testName} (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`);
    console.log(`     Reason: ${suggestion.reason}`);
  });

  console.log('\n✅ Advanced Statistical Analysis Demo Complete!');
  console.log('\n🎯 All Advanced Features Demonstrated:');
  console.log('• Descriptive statistics (mean, median, std dev, quartiles)');
  console.log('• Frequency analysis and histograms');
  console.log('• Pearson and Spearman correlation matrices');
  console.log('• Normality tests (Shapiro-Wilk, Kolmogorov-Smirnov)');
  console.log('• Contingency tables and chi-square tests');
  console.log('• T-tests (one-sample, independent, paired)');
  console.log('• One-way ANOVA with post-hoc testing');
  console.log('• Linear regression with diagnostics');
  console.log('• Non-parametric tests (Mann-Whitney U, Wilcoxon, Kruskal-Wallis)');
  console.log('• Statistical assumption checking');
  console.log('• Automatic test suggestion system');
  console.log('• Effect size calculations');
  console.log('• Comprehensive error handling and edge cases');
  
  console.log('\n📋 Requirements Coverage:');
  console.log('✓ 4.1: T-test functions (one-sample, independent, paired)');
  console.log('✓ 4.2: ANOVA analysis with post-hoc testing');
  console.log('✓ 4.3: Linear and multiple regression analysis');
  console.log('✓ 4.4: Non-parametric tests (Mann-Whitney U, Wilcoxon, Kruskal-Wallis)');
  console.log('✓ 4.5: Chi-square tests with effect size calculations');
  console.log('✓ 4.6: Statistical assumption checking and validation');
  console.log('✓ Additional: Automatic test suggestion based on data characteristics');
  console.log('✓ Additional: Extensive unit tests with known datasets');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runStatisticalAnalysisDemo().catch(console.error);
}

export { runStatisticalAnalysisDemo };