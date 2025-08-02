export interface StatisticalErrorInfo {
  userMessage: string;
  technicalMessage: string;
  suggestions: string[];
  severity: 'low' | 'medium' | 'high';
  category: 'data' | 'statistical' | 'computational' | 'assumption';
}

export class StatisticalErrorMessages {
  private static errorMap: Record<string, StatisticalErrorInfo> = {
    // Data-related errors
    INSUFFICIENT_DATA: {
      userMessage: 'Not enough data points to perform this analysis',
      technicalMessage: 'Sample size is below the minimum required for reliable statistical inference',
      suggestions: [
        'Collect more data points',
        'Consider using non-parametric alternatives',
        'Check for missing values that might be reducing your sample size'
      ],
      severity: 'high',
      category: 'data'
    },

    MISSING_VALUES: {
      userMessage: 'Your data contains missing values that prevent analysis',
      technicalMessage: 'Missing values detected in critical variables',
      suggestions: [
        'Remove rows with missing values',
        'Use imputation methods to fill missing values',
        'Consider listwise or pairwise deletion strategies'
      ],
      severity: 'medium',
      category: 'data'
    },

    NON_NUMERIC_DATA: {
      userMessage: 'This analysis requires numeric data, but text or categorical data was found',
      technicalMessage: 'Non-numeric values detected in variables requiring numeric input',
      suggestions: [
        'Convert categorical variables to numeric codes if appropriate',
        'Use different analysis methods for categorical data',
        'Check data import settings and column types'
      ],
      severity: 'high',
      category: 'data'
    },

    CONSTANT_VALUES: {
      userMessage: 'Your data has no variation (all values are the same)',
      technicalMessage: 'Zero variance detected in one or more variables',
      suggestions: [
        'Check if the correct variable was selected',
        'Verify data import was successful',
        'Consider if this variable is meaningful for analysis'
      ],
      severity: 'medium',
      category: 'data'
    },

    // Statistical assumption violations
    NORMALITY_VIOLATION: {
      userMessage: 'Your data does not follow a normal distribution',
      technicalMessage: 'Normality assumption violated based on statistical tests',
      suggestions: [
        'Use non-parametric alternatives (e.g., Mann-Whitney instead of t-test)',
        'Apply data transformations (log, square root, etc.)',
        'Consider robust statistical methods',
        'Increase sample size if possible'
      ],
      severity: 'medium',
      category: 'assumption'
    },

    HOMOGENEITY_VIOLATION: {
      userMessage: 'The groups have unequal variances',
      technicalMessage: 'Homogeneity of variance assumption violated',
      suggestions: [
        'Use Welch\'s t-test instead of Student\'s t-test',
        'Apply variance-stabilizing transformations',
        'Use non-parametric alternatives',
        'Consider robust statistical methods'
      ],
      severity: 'medium',
      category: 'assumption'
    },

    INDEPENDENCE_VIOLATION: {
      userMessage: 'Your data points may not be independent',
      technicalMessage: 'Independence assumption may be violated',
      suggestions: [
        'Check for repeated measures or clustered data',
        'Use mixed-effects models if appropriate',
        'Consider time series analysis for temporal data',
        'Account for clustering in your analysis'
      ],
      severity: 'high',
      category: 'assumption'
    },

    LINEARITY_VIOLATION: {
      userMessage: 'The relationship between variables is not linear',
      technicalMessage: 'Linearity assumption violated in regression analysis',
      suggestions: [
        'Try polynomial or non-linear regression',
        'Transform variables to achieve linearity',
        'Use non-parametric regression methods',
        'Add interaction terms to the model'
      ],
      severity: 'medium',
      category: 'assumption'
    },

    // Computational errors
    NUMERICAL_INSTABILITY: {
      userMessage: 'The calculation encountered numerical precision issues',
      technicalMessage: 'Numerical instability detected during computation',
      suggestions: [
        'Check for extreme outliers in your data',
        'Consider data scaling or normalization',
        'Use more robust computational methods',
        'Verify data quality and remove invalid values'
      ],
      severity: 'medium',
      category: 'computational'
    },

    CONVERGENCE_FAILURE: {
      userMessage: 'The statistical algorithm failed to find a solution',
      technicalMessage: 'Iterative algorithm failed to converge',
      suggestions: [
        'Try different starting values or parameters',
        'Simplify the model if it\'s too complex',
        'Check for multicollinearity in predictors',
        'Increase the maximum number of iterations'
      ],
      severity: 'high',
      category: 'computational'
    },

    SINGULAR_MATRIX: {
      userMessage: 'The data structure prevents calculation (mathematical singularity)',
      technicalMessage: 'Singular matrix encountered during computation',
      suggestions: [
        'Check for perfectly correlated variables',
        'Remove redundant variables from the analysis',
        'Increase sample size relative to number of variables',
        'Use regularization techniques'
      ],
      severity: 'high',
      category: 'computational'
    },

    // Specific test errors
    SMALL_SAMPLE_TTEST: {
      userMessage: 'Sample size is too small for reliable t-test results',
      technicalMessage: 'Sample size below recommended minimum for t-test',
      suggestions: [
        'Collect more data if possible',
        'Use exact tests or bootstrap methods',
        'Consider non-parametric alternatives',
        'Report results with appropriate caveats'
      ],
      severity: 'medium',
      category: 'statistical'
    },

    SMALL_EXPECTED_FREQUENCIES: {
      userMessage: 'Some categories have too few observations for chi-square test',
      technicalMessage: 'Expected frequencies below 5 in chi-square test',
      suggestions: [
        'Combine categories with low frequencies',
        'Use Fisher\'s exact test instead',
        'Collect more data',
        'Use alternative categorical analysis methods'
      ],
      severity: 'medium',
      category: 'statistical'
    },

    UNEQUAL_GROUP_SIZES: {
      userMessage: 'Groups have very different sizes, which may affect results',
      technicalMessage: 'Substantial imbalance in group sizes detected',
      suggestions: [
        'Consider using robust statistical methods',
        'Apply appropriate corrections for unequal groups',
        'Use non-parametric alternatives if appropriate',
        'Balance groups through sampling if possible'
      ],
      severity: 'low',
      category: 'statistical'
    },

    MULTICOLLINEARITY: {
      userMessage: 'Some variables are too highly correlated with each other',
      technicalMessage: 'High multicollinearity detected among predictors',
      suggestions: [
        'Remove highly correlated variables',
        'Use principal component analysis',
        'Apply ridge regression or other regularization',
        'Center variables before analysis'
      ],
      severity: 'medium',
      category: 'statistical'
    },

    OUTLIERS_DETECTED: {
      userMessage: 'Extreme values (outliers) were detected in your data',
      technicalMessage: 'Statistical outliers identified that may affect results',
      suggestions: [
        'Investigate outliers for data entry errors',
        'Consider robust statistical methods',
        'Use outlier-resistant transformations',
        'Report results with and without outliers'
      ],
      severity: 'low',
      category: 'data'
    },

    ZERO_VARIANCE_GROUP: {
      userMessage: 'One or more groups has no variation in the data',
      technicalMessage: 'Zero variance detected in one or more groups',
      suggestions: [
        'Check if the correct grouping variable was used',
        'Verify data import and processing',
        'Consider if this group should be excluded',
        'Combine groups if appropriate'
      ],
      severity: 'high',
      category: 'data'
    }
  };

  public static getErrorInfo(errorCode: string): StatisticalErrorInfo | null {
    return this.errorMap[errorCode] || null;
  }

  public static createUserFriendlyError(
    errorCode: string,
    context?: Record<string, any>
  ): StatisticalErrorInfo {
    const baseError = this.errorMap[errorCode];
    
    if (!baseError) {
      return {
        userMessage: 'An unexpected error occurred during statistical analysis',
        technicalMessage: `Unknown error code: ${errorCode}`,
        suggestions: [
          'Check your data for common issues',
          'Try a different analysis method',
          'Contact support if the problem persists'
        ],
        severity: 'medium',
        category: 'computational'
      };
    }

    // Customize error message based on context
    let customizedError = { ...baseError };
    
    if (context) {
      customizedError = this.customizeErrorMessage(customizedError, context);
    }

    return customizedError;
  }

  private static customizeErrorMessage(
    error: StatisticalErrorInfo,
    context: Record<string, any>
  ): StatisticalErrorInfo {
    const customized = { ...error };

    // Add context-specific information
    if (context.sampleSize) {
      if (context.sampleSize < 30) {
        customized.suggestions.unshift(`Your sample size is ${context.sampleSize}, which is quite small`);
      }
    }

    if (context.missingCount) {
      customized.suggestions.unshift(`${context.missingCount} missing values were found`);
    }

    if (context.variableName) {
      customized.userMessage = customized.userMessage.replace(
        'Your data',
        `Variable "${context.variableName}"`
      );
    }

    if (context.testType) {
      customized.userMessage += ` for ${context.testType} analysis`;
    }

    return customized;
  }

  public static getAllErrorCodes(): string[] {
    return Object.keys(this.errorMap);
  }

  public static getErrorsByCategory(category: StatisticalErrorInfo['category']): Record<string, StatisticalErrorInfo> {
    const filtered: Record<string, StatisticalErrorInfo> = {};
    
    Object.entries(this.errorMap).forEach(([code, info]) => {
      if (info.category === category) {
        filtered[code] = info;
      }
    });
    
    return filtered;
  }

  public static formatErrorForUser(error: StatisticalErrorInfo, includeDetails: boolean = false): string {
    let message = error.userMessage;
    
    if (includeDetails && error.suggestions.length > 0) {
      message += '\n\nSuggestions:\n';
      error.suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }
    
    return message;
  }
}