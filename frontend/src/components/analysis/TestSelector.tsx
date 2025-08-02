import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Search,
  ExpandMore,
  CheckCircle,
  Warning,
  Info,
  Psychology,
} from '@mui/icons-material';
import { Dataset } from '../../types/data';
import { AnalysisConfig, StatisticalTest, TestSuggestion } from '../../types/analysis';
import { analysisApi } from '../../services/analysisApi';
import HelpPanel from './HelpPanel';

interface TestSelectorProps {
  dataset: Dataset;
  onSelect: (config: AnalysisConfig) => void;
  onError: (error: string) => void;
}

const statisticalTests: StatisticalTest[] = [
  {
    id: 'descriptive',
    name: 'Descriptive Statistics',
    category: 'descriptive',
    description: 'Calculate mean, median, standard deviation, and other summary statistics',
    assumptions: ['Data should be numeric'],
    minVariables: 1,
    maxVariables: 1,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 1 observation',
    examples: ['Summarize sales data', 'Analyze test scores', 'Describe survey responses']
  },
  {
    id: 'frequency',
    name: 'Frequency Analysis',
    category: 'descriptive',
    description: 'Analyze the distribution of categorical or discrete data',
    assumptions: ['Data can be categorical or numeric'],
    minVariables: 1,
    maxVariables: 1,
    variableTypes: ['numeric', 'categorical'],
    sampleSizeRequirement: 'At least 1 observation',
    examples: ['Count survey responses', 'Analyze product categories', 'Distribution of grades']
  },
  {
    id: 'correlation',
    name: 'Correlation Analysis',
    category: 'correlation',
    description: 'Measure the strength and direction of relationships between variables',
    assumptions: ['Variables should be numeric', 'Linear relationship (for Pearson)'],
    minVariables: 2,
    maxVariables: 10,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 3 observations',
    examples: ['Height vs Weight', 'Study time vs Test scores', 'Price vs Sales']
  },
  {
    id: 'normality',
    name: 'Normality Tests',
    category: 'parametric',
    description: 'Test if data follows a normal distribution',
    assumptions: ['Data should be numeric', 'Independent observations'],
    minVariables: 1,
    maxVariables: 1,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 3 observations',
    examples: ['Test exam scores normality', 'Check measurement distributions', 'Validate model assumptions']
  },
  {
    id: 'one-sample-ttest',
    name: 'One-Sample t-test',
    category: 'parametric',
    description: 'Compare a sample mean to a known population mean',
    assumptions: ['Normal distribution', 'Independent observations', 'Continuous data'],
    minVariables: 1,
    maxVariables: 1,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 2 observations',
    examples: ['Test if average height equals 170cm', 'Compare sample mean to standard', 'Quality control testing']
  },
  {
    id: 'independent-ttest',
    name: 'Independent t-test',
    category: 'parametric',
    description: 'Compare means between two independent groups',
    assumptions: ['Normal distribution', 'Independent observations', 'Equal variances (optional)'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric', 'categorical'],
    sampleSizeRequirement: 'At least 2 observations per group',
    examples: ['Compare test scores by gender', 'Treatment vs Control group', 'Before vs After intervention']
  },
  {
    id: 'paired-ttest',
    name: 'Paired t-test',
    category: 'parametric',
    description: 'Compare means of paired observations',
    assumptions: ['Normal distribution of differences', 'Paired observations'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 2 paired observations',
    examples: ['Before vs After treatment', 'Pre-test vs Post-test', 'Matched pairs comparison']
  },
  {
    id: 'anova',
    name: 'One-Way ANOVA',
    category: 'parametric',
    description: 'Compare means across multiple groups',
    assumptions: ['Normal distribution', 'Independent observations', 'Equal variances'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric', 'categorical'],
    sampleSizeRequirement: 'At least 2 observations per group',
    examples: ['Compare test scores across schools', 'Analyze treatment effects', 'Multi-group comparison']
  },
  {
    id: 'linear-regression',
    name: 'Linear Regression',
    category: 'regression',
    description: 'Model the relationship between a dependent and independent variable',
    assumptions: ['Linear relationship', 'Normal residuals', 'Independent observations', 'Homoscedasticity'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 3 observations',
    examples: ['Predict sales from advertising', 'Height vs Weight relationship', 'Income vs Education']
  },
  {
    id: 'chi-square',
    name: 'Chi-Square Test',
    category: 'nonparametric',
    description: 'Test independence between categorical variables',
    assumptions: ['Categorical data', 'Independent observations', 'Expected frequencies ≥ 5'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['categorical'],
    sampleSizeRequirement: 'At least 5 expected observations per cell',
    examples: ['Gender vs Product preference', 'Treatment vs Outcome', 'Survey response analysis']
  },
  {
    id: 'mann-whitney',
    name: 'Mann-Whitney U Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to independent t-test',
    assumptions: ['Independent observations', 'Ordinal or continuous data'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric', 'categorical'],
    sampleSizeRequirement: 'At least 1 observation per group',
    examples: ['Compare medians between groups', 'Non-normal data comparison', 'Ordinal data analysis']
  },
  {
    id: 'wilcoxon',
    name: 'Wilcoxon Signed-Rank Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to paired t-test',
    assumptions: ['Paired observations', 'Symmetric distribution of differences'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric'],
    sampleSizeRequirement: 'At least 1 paired observation',
    examples: ['Before vs After (non-normal)', 'Paired non-parametric comparison', 'Median difference testing']
  },
  {
    id: 'kruskal-wallis',
    name: 'Kruskal-Wallis Test',
    category: 'nonparametric',
    description: 'Non-parametric alternative to one-way ANOVA',
    assumptions: ['Independent observations', 'Ordinal or continuous data'],
    minVariables: 2,
    maxVariables: 2,
    variableTypes: ['numeric', 'categorical'],
    sampleSizeRequirement: 'At least 1 observation per group',
    examples: ['Compare medians across groups', 'Non-normal multi-group comparison', 'Ordinal ANOVA alternative']
  }
];

const TestSelector: React.FC<TestSelectorProps> = ({ dataset, onSelect, onError }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTest, setSelectedTest] = useState<StatisticalTest | null>(null);
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTestType, setHelpTestType] = useState<string | undefined>();

  const categories = [
    { value: 'all', label: 'All Tests' },
    { value: 'descriptive', label: 'Descriptive' },
    { value: 'parametric', label: 'Parametric' },
    { value: 'nonparametric', label: 'Non-parametric' },
    { value: 'correlation', label: 'Correlation' },
    { value: 'regression', label: 'Regression' }
  ];

  useEffect(() => {
    loadTestSuggestions();
  }, [dataset]);

  const loadTestSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const variables = dataset.columns.map(col => col.name);
      const response = await analysisApi.getTestSuggestions(dataset.id, {
        variables,
        numGroups: 2,
        pairedData: false
      });
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Failed to load test suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const filteredTests = statisticalTests.filter(test => {
    const matchesCategory = selectedCategory === 'all' || test.category === selectedCategory;
    const matchesSearch = test.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         test.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const isTestCompatible = (test: StatisticalTest): boolean => {
    const numericColumns = dataset.columns.filter(col => col.dataType === 'numeric').length;
    const categoricalColumns = dataset.columns.filter(col => col.dataType === 'categorical').length;
    
    if (test.variableTypes.includes('numeric') && numericColumns < test.minVariables) {
      return false;
    }
    
    if (test.variableTypes.includes('categorical') && categoricalColumns === 0 && 
        test.variableTypes.length === 1 && test.variableTypes[0] === 'categorical') {
      return false;
    }
    
    return dataset.columns.length >= test.minVariables;
  };

  const getCompatibilityMessage = (test: StatisticalTest): string => {
    if (isTestCompatible(test)) {
      return 'Compatible with your dataset';
    }
    
    const numericColumns = dataset.columns.filter(col => col.dataType === 'numeric').length;
    const categoricalColumns = dataset.columns.filter(col => col.dataType === 'categorical').length;
    
    if (test.variableTypes.includes('numeric') && numericColumns < test.minVariables) {
      return `Requires at least ${test.minVariables} numeric variables (you have ${numericColumns})`;
    }
    
    if (test.variableTypes.includes('categorical') && categoricalColumns === 0) {
      return 'Requires categorical variables (none found)';
    }
    
    return `Requires at least ${test.minVariables} variables (you have ${dataset.columns.length})`;
  };

  const handleTestSelect = () => {
    if (!selectedTest) return;

    const config: AnalysisConfig = {
      testType: selectedTest.id,
      testName: selectedTest.name,
      description: selectedTest.description,
      variables: [],
      parameters: {},
      assumptions: selectedTest.assumptions,
      alternatives: []
    };

    onSelect(config);
  };

  const handleShowHelp = (testType: string) => {
    setHelpTestType(testType);
    setHelpOpen(true);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Choose Statistical Test
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select the appropriate statistical test based on your research question and data characteristics.
      </Typography>

      {/* Test Suggestions */}
      {suggestions.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            <Psychology sx={{ mr: 1, verticalAlign: 'middle' }} />
            Recommended Tests
          </Typography>
          <List dense>
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <ListItemIcon>
                  <CheckCircle color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={suggestion.testName}
                  secondary={suggestion.reason}
                />
                <Chip
                  label={`${Math.round(suggestion.confidence * 100)}% match`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Search and Filter */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search statistical tests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />

        <Tabs
          value={selectedCategory}
          onChange={(_, newValue) => setSelectedCategory(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {categories.map((category) => (
            <Tab key={category.value} label={category.label} value={category.value} />
          ))}
        </Tabs>
      </Box>

      {selectedTest && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Selected: <strong>{selectedTest.name}</strong> - {selectedTest.description}
        </Alert>
      )}

      {/* Test Cards */}
      <Grid container spacing={2}>
        {filteredTests.map((test) => {
          const compatible = isTestCompatible(test);
          const isSelected = selectedTest?.id === test.id;
          
          return (
            <Grid item xs={12} md={6} key={test.id}>
              <Card
                sx={{
                  cursor: compatible ? 'pointer' : 'not-allowed',
                  opacity: compatible ? 1 : 0.6,
                  border: isSelected ? 2 : 1,
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  '&:hover': compatible ? {
                    boxShadow: 4,
                  } : {},
                }}
                onClick={() => compatible && setSelectedTest(test)}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                      {test.name}
                    </Typography>
                    <Chip
                      label={test.category}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {test.description}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    {compatible ? (
                      <CheckCircle color="success" fontSize="small" sx={{ mr: 1 }} />
                    ) : (
                      <Warning color="warning" fontSize="small" sx={{ mr: 1 }} />
                    )}
                    <Typography variant="caption" color={compatible ? 'success.main' : 'warning.main'}>
                      {getCompatibilityMessage(test)}
                    </Typography>
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    Variables: {test.minVariables}-{test.maxVariables === 10 ? '∞' : test.maxVariables} • 
                    Types: {test.variableTypes.join(', ')} • 
                    {test.sampleSizeRequirement}
                  </Typography>

                  <Accordion sx={{ mt: 2, boxShadow: 'none' }}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="caption">
                        <Info fontSize="small" sx={{ mr: 0.5, verticalAlign: 'middle' }} />
                        View Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="subtitle2" gutterBottom>
                        Assumptions:
                      </Typography>
                      <List dense>
                        {test.assumptions.map((assumption, index) => (
                          <ListItem key={index} sx={{ py: 0, pl: 0 }}>
                            <ListItemText
                              primary={assumption}
                              primaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                        Examples:
                      </Typography>
                      <List dense>
                        {test.examples.map((example, index) => (
                          <ListItem key={index} sx={{ py: 0, pl: 0 }}>
                            <ListItemText
                              primary={example}
                              primaryTypographyProps={{ variant: 'caption' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    disabled={!compatible}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (compatible) setSelectedTest(test);
                    }}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Help />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowHelp(test.id);
                    }}
                  >
                    Help
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {filteredTests.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            No tests found matching your criteria
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleTestSelect}
          disabled={!selectedTest}
        >
          Configure Test Parameters
        </Button>
      </Box>

      <HelpPanel
        testType={helpTestType}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
    </Box>
  );
};

export default TestSelector;