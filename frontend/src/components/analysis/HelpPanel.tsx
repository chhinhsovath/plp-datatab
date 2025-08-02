import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Link,
} from '@mui/material';
import {
  ExpandMore,
  Help,
  School,
  Book,
  VideoLibrary,
  Quiz,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { HelpContent } from '../../types/analysis';

interface HelpPanelProps {
  testType?: string;
  open: boolean;
  onClose: () => void;
}

const helpContent: { [key: string]: HelpContent } = {
  'descriptive': {
    title: 'Descriptive Statistics',
    content: `Descriptive statistics provide a summary of the main characteristics of your data. 
    They help you understand the central tendency, variability, and distribution shape of your variables.`,
    examples: [
      'Mean: The average value of your data points',
      'Median: The middle value when data is sorted',
      'Standard Deviation: How spread out your data is',
      'Skewness: Whether your data is symmetric or skewed'
    ],
    references: [
      'Field, A. (2013). Discovering Statistics Using IBM SPSS Statistics',
      'Gravetter, F. J., & Wallnau, L. B. (2016). Statistics for the Behavioral Sciences'
    ]
  },
  'one-sample-ttest': {
    title: 'One-Sample t-test',
    content: `The one-sample t-test compares a sample mean to a known population mean. 
    Use this test when you want to determine if your sample comes from a population with a specific mean.`,
    examples: [
      'Testing if average student height equals the national average (170cm)',
      'Comparing sample IQ scores to the population mean (100)',
      'Quality control: testing if product weight meets specifications'
    ],
    references: [
      'Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences',
      'Howell, D. C. (2012). Statistical Methods for Psychology'
    ]
  },
  'independent-ttest': {
    title: 'Independent t-test',
    content: `The independent t-test compares the means of two independent groups. 
    Use this test when you want to determine if there's a significant difference between two groups.`,
    examples: [
      'Comparing test scores between male and female students',
      'Evaluating treatment effectiveness (treatment vs. control group)',
      'Comparing sales performance between two regions'
    ],
    references: [
      'Welch, B. L. (1947). The generalization of Student\'s problem',
      'Student (1908). The probable error of a mean'
    ]
  },
  'correlation': {
    title: 'Correlation Analysis',
    content: `Correlation analysis measures the strength and direction of the linear relationship between two variables. 
    Correlation does not imply causation - it only indicates association.`,
    examples: [
      'Pearson correlation: Linear relationships (height vs. weight)',
      'Spearman correlation: Monotonic relationships (rank-based)',
      'Correlation matrix: Relationships among multiple variables'
    ],
    references: [
      'Pearson, K. (1895). Mathematical contributions to the theory of evolution',
      'Spearman, C. (1904). The proof and measurement of association between two things'
    ]
  },
  'anova': {
    title: 'One-Way ANOVA',
    content: `Analysis of Variance (ANOVA) compares means across three or more groups. 
    It tests whether at least one group mean is significantly different from the others.`,
    examples: [
      'Comparing test scores across multiple schools',
      'Evaluating effectiveness of different treatments',
      'Analyzing performance across different departments'
    ],
    references: [
      'Fisher, R. A. (1925). Statistical Methods for Research Workers',
      'Tukey, J. W. (1949). Comparing individual means in the analysis of variance'
    ]
  },
  'linear-regression': {
    title: 'Linear Regression',
    content: `Linear regression models the relationship between a dependent variable and one or more independent variables. 
    It helps predict outcomes and understand relationships.`,
    examples: [
      'Predicting sales based on advertising spend',
      'Modeling relationship between study time and test scores',
      'Analyzing factors affecting house prices'
    ],
    references: [
      'Galton, F. (1886). Regression towards mediocrity in hereditary stature',
      'Legendre, A. M. (1805). Nouvelles méthodes pour la détermination des orbites des comètes'
    ]
  }
};

const assumptions: { [key: string]: string[] } = {
  'one-sample-ttest': [
    'Data should be approximately normally distributed',
    'Observations should be independent',
    'Data should be measured at interval or ratio level',
    'No extreme outliers should be present'
  ],
  'independent-ttest': [
    'Data should be approximately normally distributed in each group',
    'Observations should be independent',
    'Variances should be approximately equal (homogeneity of variance)',
    'Data should be measured at interval or ratio level'
  ],
  'anova': [
    'Data should be approximately normally distributed in each group',
    'Observations should be independent',
    'Variances should be approximately equal across groups',
    'Data should be measured at interval or ratio level'
  ],
  'linear-regression': [
    'Linear relationship between variables',
    'Independence of residuals',
    'Homoscedasticity (constant variance of residuals)',
    'Normality of residuals',
    'No multicollinearity (for multiple regression)'
  ]
};

const interpretationGuides: { [key: string]: any } = {
  'pvalue': {
    title: 'Understanding p-values',
    content: `The p-value is the probability of obtaining results at least as extreme as observed, 
    assuming the null hypothesis is true.`,
    guidelines: [
      'p < 0.001: Very strong evidence against null hypothesis',
      'p < 0.01: Strong evidence against null hypothesis',
      'p < 0.05: Moderate evidence against null hypothesis',
      'p ≥ 0.05: Insufficient evidence to reject null hypothesis'
    ]
  },
  'effectsize': {
    title: 'Effect Size Interpretation',
    content: `Effect size measures the magnitude of the difference or relationship, 
    independent of sample size.`,
    guidelines: [
      'Cohen\'s d: 0.2 (small), 0.5 (medium), 0.8 (large)',
      'Correlation r: 0.1 (small), 0.3 (medium), 0.5 (large)',
      'Eta-squared η²: 0.01 (small), 0.06 (medium), 0.14 (large)'
    ]
  }
};

const HelpPanel: React.FC<HelpPanelProps> = ({ testType, open, onClose }) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | false>('overview');

  const currentHelp = testType ? helpContent[testType] : null;
  const currentAssumptions = testType ? assumptions[testType] : null;

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedTab(newValue);
  };

  const handleAccordionChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Help color="primary" />
          Statistical Analysis Help
          {currentHelp && (
            <Chip label={currentHelp.title} color="primary" variant="outlined" />
          )}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={selectedTab} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab icon={<Book />} label="Overview" />
          <Tab icon={<CheckCircle />} label="Assumptions" />
          <Tab icon={<Quiz />} label="Interpretation" />
          <Tab icon={<School />} label="Examples" />
          <Tab icon={<VideoLibrary />} label="Resources" />
        </Tabs>

        {/* Overview Tab */}
        {selectedTab === 0 && (
          <Box>
            {currentHelp ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {currentHelp.title}
                  </Typography>
                  <Typography variant="body1" paragraph>
                    {currentHelp.content}
                  </Typography>
                  
                  {currentHelp.examples && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Key Concepts:
                      </Typography>
                      <List dense>
                        {currentHelp.examples.map((example, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <CheckCircle color="primary" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={example} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                Select a statistical test to see specific help information.
              </Alert>
            )}
          </Box>
        )}

        {/* Assumptions Tab */}
        {selectedTab === 1 && (
          <Box>
            {currentAssumptions ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Statistical Assumptions
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    These assumptions should be met for valid results:
                  </Typography>
                  
                  <List>
                    {currentAssumptions.map((assumption, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText 
                          primary={assumption}
                          secondary="Check this assumption before interpreting results"
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      <strong>Important:</strong> Violating assumptions may lead to incorrect conclusions. 
                      Consider alternative tests if assumptions are not met.
                    </Typography>
                  </Alert>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                Select a statistical test to see its assumptions.
              </Alert>
            )}
          </Box>
        )}

        {/* Interpretation Tab */}
        {selectedTab === 2 && (
          <Box>
            <Accordion 
              expanded={expandedSection === 'pvalue'} 
              onChange={handleAccordionChange('pvalue')}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">Understanding p-values</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" paragraph>
                  {interpretationGuides.pvalue.content}
                </Typography>
                <List dense>
                  {interpretationGuides.pvalue.guidelines.map((guideline: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText primary={guideline} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            <Accordion 
              expanded={expandedSection === 'effectsize'} 
              onChange={handleAccordionChange('effectsize')}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="h6">Effect Size Interpretation</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" paragraph>
                  {interpretationGuides.effectsize.content}
                </Typography>
                <List dense>
                  {interpretationGuides.effectsize.guidelines.map((guideline: string, index: number) => (
                    <ListItem key={index}>
                      <ListItemText primary={guideline} />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Remember: Statistical significance (p-value) and practical significance (effect size) 
                are different concepts. Both should be considered when interpreting results.
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Examples Tab */}
        {selectedTab === 3 && (
          <Box>
            {currentHelp?.examples ? (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Practical Examples
                  </Typography>
                  <List>
                    {currentHelp.examples.map((example, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <School color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={example} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                Select a statistical test to see practical examples.
              </Alert>
            )}
          </Box>
        )}

        {/* Resources Tab */}
        {selectedTab === 4 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recommended Reading
                </Typography>
                {currentHelp?.references ? (
                  <List>
                    {currentHelp.references.map((reference, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Book color="primary" />
                        </ListItemIcon>
                        <ListItemText primary={reference} />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    General statistical resources will be shown here.
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Online Resources
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <VideoLibrary color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Khan Academy Statistics"
                      secondary={
                        <Link href="https://www.khanacademy.org/math/statistics-probability" target="_blank">
                          Free online statistics course
                        </Link>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Book color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Statistical Thinking for the 21st Century"
                      secondary={
                        <Link href="https://statsthinking21.github.io/statsthinking21-core-site/" target="_blank">
                          Free online textbook
                        </Link>
                      }
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Quiz color="primary" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Cross Validated (Stack Exchange)"
                      secondary={
                        <Link href="https://stats.stackexchange.com/" target="_blank">
                          Q&A community for statistics
                        </Link>
                      }
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpPanel;