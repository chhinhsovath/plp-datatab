import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  PlayArrow,
} from '@mui/icons-material';
import { Dataset, ColumnInfo } from '../../types/data';
import { AnalysisConfig, AnalysisResult, ParameterConfig } from '../../types/analysis';
import { analysisApi } from '../../services/analysisApi';
import LoadingSpinner from '../common/LoadingSpinner';

interface ParameterFormProps {
  dataset: Dataset;
  config: AnalysisConfig;
  onSubmit: (result: AnalysisResult) => void;
  onError: (error: string) => void;
}

const ParameterForm: React.FC<ParameterFormProps> = ({ dataset, config, onSubmit, onError }) => {
  const [parameters, setParameters] = useState<{ [key: string]: any }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});
  const [assumptionChecks, setAssumptionChecks] = useState<any[]>([]);

  const getParameterConfigs = (): ParameterConfig[] => {
    switch (config.testType) {
      case 'descriptive':
        return [
          {
            name: 'variable',
            type: 'variable',
            label: 'Variable',
            description: 'Select the numeric variable to analyze',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          }
        ];

      case 'frequency':
        return [
          {
            name: 'variable',
            type: 'variable',
            label: 'Variable',
            description: 'Select the variable for frequency analysis',
            required: true,
            variableFilter: (col: ColumnInfo) => true
          },
          {
            name: 'binCount',
            type: 'number',
            label: 'Number of Bins',
            description: 'Number of bins for histogram (numeric data only)',
            required: false,
            min: 5,
            max: 50,
            defaultValue: 10,
            dependsOn: 'variable'
          }
        ];

      case 'correlation':
        return [
          {
            name: 'variables',
            type: 'select',
            label: 'Variables',
            description: 'Select 2 or more numeric variables',
            required: true,
            options: dataset.columns
              .filter(col => col.dataType === 'numeric')
              .map(col => ({ value: col.name, label: col.name }))
          },
          {
            name: 'method',
            type: 'select',
            label: 'Correlation Method',
            description: 'Choose correlation method',
            required: true,
            defaultValue: 'pearson',
            options: [
              { value: 'pearson', label: 'Pearson (linear relationships)' },
              { value: 'spearman', label: 'Spearman (monotonic relationships)' }
            ]
          }
        ];

      case 'normality':
        return [
          {
            name: 'variable',
            type: 'variable',
            label: 'Variable',
            description: 'Select the numeric variable to test for normality',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'tests',
            type: 'select',
            label: 'Normality Tests',
            description: 'Select which tests to perform',
            required: true,
            defaultValue: ['shapiro-wilk', 'kolmogorov-smirnov'],
            options: [
              { value: 'shapiro-wilk', label: 'Shapiro-Wilk Test' },
              { value: 'kolmogorov-smirnov', label: 'Kolmogorov-Smirnov Test' }
            ]
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'one-sample-ttest':
        return [
          {
            name: 'variable',
            type: 'variable',
            label: 'Variable',
            description: 'Select the numeric variable to test',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'populationMean',
            type: 'number',
            label: 'Population Mean',
            description: 'The hypothesized population mean to test against',
            required: true
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'independent-ttest':
        return [
          {
            name: 'dependentVariable',
            type: 'variable',
            label: 'Dependent Variable',
            description: 'Select the numeric outcome variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'groupingVariable',
            type: 'variable',
            label: 'Grouping Variable',
            description: 'Select the categorical grouping variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          },
          {
            name: 'equalVariances',
            type: 'boolean',
            label: 'Assume Equal Variances',
            description: 'Use pooled variance (Student\'s t-test) or separate variances (Welch\'s t-test)',
            required: true,
            defaultValue: true
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'paired-ttest':
        return [
          {
            name: 'variable1',
            type: 'variable',
            label: 'First Variable',
            description: 'Select the first numeric variable (e.g., pre-test)',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'variable2',
            type: 'variable',
            label: 'Second Variable',
            description: 'Select the second numeric variable (e.g., post-test)',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'anova':
        return [
          {
            name: 'dependentVariable',
            type: 'variable',
            label: 'Dependent Variable',
            description: 'Select the numeric outcome variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'groupingVariable',
            type: 'variable',
            label: 'Grouping Variable',
            description: 'Select the categorical grouping variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'linear-regression':
        return [
          {
            name: 'dependentVariable',
            type: 'variable',
            label: 'Dependent Variable (Y)',
            description: 'Select the outcome variable to predict',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'independentVariable',
            type: 'variable',
            label: 'Independent Variable (X)',
            description: 'Select the predictor variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'chi-square':
        return [
          {
            name: 'rowVariable',
            type: 'variable',
            label: 'Row Variable',
            description: 'Select the first categorical variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          },
          {
            name: 'columnVariable',
            type: 'variable',
            label: 'Column Variable',
            description: 'Select the second categorical variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          }
        ];

      case 'mann-whitney':
        return [
          {
            name: 'dependentVariable',
            type: 'variable',
            label: 'Dependent Variable',
            description: 'Select the numeric outcome variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'groupingVariable',
            type: 'variable',
            label: 'Grouping Variable',
            description: 'Select the categorical grouping variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'wilcoxon':
        return [
          {
            name: 'variable1',
            type: 'variable',
            label: 'First Variable',
            description: 'Select the first numeric variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'variable2',
            type: 'variable',
            label: 'Second Variable',
            description: 'Select the second numeric variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      case 'kruskal-wallis':
        return [
          {
            name: 'dependentVariable',
            type: 'variable',
            label: 'Dependent Variable',
            description: 'Select the numeric outcome variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'numeric'
          },
          {
            name: 'groupingVariable',
            type: 'variable',
            label: 'Grouping Variable',
            description: 'Select the categorical grouping variable',
            required: true,
            variableFilter: (col: ColumnInfo) => col.dataType === 'categorical'
          },
          {
            name: 'alpha',
            type: 'number',
            label: 'Significance Level (α)',
            description: 'Significance level for the test',
            required: true,
            defaultValue: 0.05,
            min: 0.001,
            max: 0.1,
            step: 0.001
          }
        ];

      default:
        return [];
    }
  };

  const parameterConfigs = getParameterConfigs();

  useEffect(() => {
    // Set default values
    const defaultParams: { [key: string]: any } = {};
    parameterConfigs.forEach(paramConfig => {
      if (paramConfig.defaultValue !== undefined) {
        defaultParams[paramConfig.name] = paramConfig.defaultValue;
      }
    });
    setParameters(defaultParams);
  }, [config.testType]);

  const handleParameterChange = (name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateParameters = (): boolean => {
    const errors: { [key: string]: string } = {};
    
    parameterConfigs.forEach(paramConfig => {
      const value = parameters[paramConfig.name];
      
      if (paramConfig.required && (value === undefined || value === null || value === '')) {
        errors[paramConfig.name] = `${paramConfig.label} is required`;
      }
      
      if (paramConfig.type === 'number' && value !== undefined && value !== null) {
        if (paramConfig.min !== undefined && value < paramConfig.min) {
          errors[paramConfig.name] = `${paramConfig.label} must be at least ${paramConfig.min}`;
        }
        if (paramConfig.max !== undefined && value > paramConfig.max) {
          errors[paramConfig.name] = `${paramConfig.label} must be at most ${paramConfig.max}`;
        }
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const runAnalysis = async () => {
    if (!validateParameters()) {
      return;
    }

    setIsLoading(true);
    try {
      let response;
      
      switch (config.testType) {
        case 'descriptive':
          response = await analysisApi.calculateDescriptiveStats(dataset.id, parameters.variable);
          break;
          
        case 'frequency':
          response = await analysisApi.performFrequencyAnalysis(dataset.id, parameters.variable, {
            column: parameters.variable,
            binCount: parameters.binCount
          });
          break;
          
        case 'correlation':
          response = await analysisApi.calculateCorrelation(dataset.id, {
            columns: parameters.variables,
            method: parameters.method
          });
          break;
          
        case 'normality':
          response = await analysisApi.performNormalityTests(dataset.id, parameters.variable, {
            column: parameters.variable,
            tests: parameters.tests,
            alpha: parameters.alpha
          });
          break;
          
        case 'one-sample-ttest':
          response = await analysisApi.performTTest(dataset.id, {
            testType: 'one-sample',
            variable1: parameters.variable,
            populationMean: parameters.populationMean,
            alpha: parameters.alpha
          });
          break;
          
        case 'independent-ttest':
          response = await analysisApi.performTTest(dataset.id, {
            testType: 'independent',
            variable1: parameters.dependentVariable,
            variable2: parameters.groupingVariable,
            equalVariances: parameters.equalVariances,
            alpha: parameters.alpha
          });
          break;
          
        case 'paired-ttest':
          response = await analysisApi.performTTest(dataset.id, {
            testType: 'paired',
            variable1: parameters.variable1,
            variable2: parameters.variable2,
            alpha: parameters.alpha
          });
          break;
          
        case 'anova':
          response = await analysisApi.performANOVA(dataset.id, {
            dependentVariable: parameters.dependentVariable,
            groupingVariable: parameters.groupingVariable,
            alpha: parameters.alpha
          });
          break;
          
        case 'linear-regression':
          response = await analysisApi.performRegression(dataset.id, {
            dependentVariable: parameters.dependentVariable,
            independentVariable: parameters.independentVariable,
            alpha: parameters.alpha
          });
          break;
          
        case 'chi-square':
          response = await analysisApi.createContingencyTable(dataset.id, {
            rowVariable: parameters.rowVariable,
            columnVariable: parameters.columnVariable
          });
          break;
          
        case 'mann-whitney':
          response = await analysisApi.performNonParametricTest(dataset.id, {
            testType: 'mann-whitney',
            variable1: parameters.dependentVariable,
            variable2: parameters.groupingVariable,
            alpha: parameters.alpha
          });
          break;
          
        case 'wilcoxon':
          response = await analysisApi.performNonParametricTest(dataset.id, {
            testType: 'wilcoxon',
            variable1: parameters.variable1,
            variable2: parameters.variable2,
            alpha: parameters.alpha
          });
          break;
          
        case 'kruskal-wallis':
          response = await analysisApi.performNonParametricTest(dataset.id, {
            testType: 'kruskal-wallis',
            variable1: parameters.dependentVariable,
            groupingVariable: parameters.groupingVariable,
            alpha: parameters.alpha
          });
          break;
          
        default:
          throw new Error(`Unsupported test type: ${config.testType}`);
      }
      
      onSubmit(response.data.data);
    } catch (error: any) {
      onError(error.response?.data?.error || error.message || 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const renderParameterInput = (paramConfig: ParameterConfig) => {
    const value = parameters[paramConfig.name];
    const error = validationErrors[paramConfig.name];
    
    switch (paramConfig.type) {
      case 'variable':
        const filteredColumns = paramConfig.variableFilter 
          ? dataset.columns.filter(paramConfig.variableFilter)
          : dataset.columns;
          
        return (
          <FormControl fullWidth error={!!error} key={paramConfig.name}>
            <InputLabel>{paramConfig.label}</InputLabel>
            <Select
              value={value || ''}
              onChange={(e) => handleParameterChange(paramConfig.name, e.target.value)}
              label={paramConfig.label}
            >
              {filteredColumns.map((column) => (
                <MenuItem key={column.name} value={column.name}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {column.name}
                    <Chip
                      label={column.dataType}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {paramConfig.description}
            </Typography>
          </FormControl>
        );
        
      case 'select':
        return (
          <FormControl fullWidth error={!!error} key={paramConfig.name}>
            <InputLabel>{paramConfig.label}</InputLabel>
            <Select
              value={value || ''}
              onChange={(e) => handleParameterChange(paramConfig.name, e.target.value)}
              label={paramConfig.label}
              multiple={Array.isArray(paramConfig.defaultValue)}
            >
              {paramConfig.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {paramConfig.description}
            </Typography>
          </FormControl>
        );
        
      case 'number':
        return (
          <TextField
            key={paramConfig.name}
            fullWidth
            type="number"
            label={paramConfig.label}
            value={value || ''}
            onChange={(e) => handleParameterChange(paramConfig.name, parseFloat(e.target.value))}
            error={!!error}
            helperText={error || paramConfig.description}
            inputProps={{
              min: paramConfig.min,
              max: paramConfig.max,
              step: paramConfig.step
            }}
          />
        );
        
      case 'boolean':
        return (
          <Box key={paramConfig.name}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={value || false}
                  onChange={(e) => handleParameterChange(paramConfig.name, e.target.checked)}
                />
              }
              label={paramConfig.label}
            />
            <Typography variant="caption" color="text.secondary" display="block">
              {paramConfig.description}
            </Typography>
            {error && <Typography variant="caption" color="error">{error}</Typography>}
          </Box>
        );
        
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8 }}>
        <LoadingSpinner />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Running {config.testName}...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure {config.testName}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {config.description}
      </Typography>

      {/* Test Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Test Information
          </Typography>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="body2">
                <Info sx={{ mr: 1, verticalAlign: 'middle' }} />
                Assumptions & Requirements
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {config.assumptions.map((assumption, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CheckCircle color="primary" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={assumption} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>

      {/* Parameter Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Parameters
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {parameterConfigs.map(renderParameterInput)}
          </Box>
        </CardContent>
      </Card>

      {/* Run Analysis Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrow />}
          onClick={runAnalysis}
          disabled={isLoading}
        >
          Run Analysis
        </Button>
      </Box>
    </Box>
  );
};

export default ParameterForm;