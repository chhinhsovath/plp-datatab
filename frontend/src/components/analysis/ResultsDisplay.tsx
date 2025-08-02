import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Warning,
  Error,
  Info,
  Download,
  Share,
  Bookmark,
  Help,
} from '@mui/icons-material';
import { Dataset } from '../../types/data';
import { AnalysisConfig, AnalysisResult, AssumptionResult } from '../../types/analysis';

interface ResultsDisplayProps {
  dataset: Dataset;
  config: AnalysisConfig;
  result: AnalysisResult;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ dataset, config, result }) => {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    summary: true,
    statistics: true,
    assumptions: false,
    interpretation: true,
    recommendations: false
  });

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const formatNumber = (value: number, decimals: number = 4): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return value.toFixed(decimals);
  };

  const formatPValue = (pValue: number): string => {
    if (pValue === null || pValue === undefined || isNaN(pValue)) return 'N/A';
    if (pValue < 0.001) return '< 0.001';
    return pValue.toFixed(3);
  };

  const getSignificanceLevel = (pValue: number, alpha: number = 0.05): 'significant' | 'not-significant' | 'marginal' => {
    if (pValue === null || pValue === undefined || isNaN(pValue)) return 'not-significant';
    if (pValue < alpha) return 'significant';
    if (pValue < alpha * 2) return 'marginal';
    return 'not-significant';
  };

  const getAssumptionIcon = (assumption: AssumptionResult) => {
    if (assumption.met) {
      return <CheckCircle color="success" />;
    } else {
      return <Warning color="warning" />;
    }
  };

  const renderDescriptiveStats = () => {
    const stats = result.statistics;
    if (!stats) return null;

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Statistic</strong></TableCell>
              <TableCell align="right"><strong>Value</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>Count</TableCell>
              <TableCell align="right">{stats.count}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Mean</TableCell>
              <TableCell align="right">{formatNumber(stats.mean)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Median</TableCell>
              <TableCell align="right">{formatNumber(stats.median)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Standard Deviation</TableCell>
              <TableCell align="right">{formatNumber(stats.standardDeviation)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Variance</TableCell>
              <TableCell align="right">{formatNumber(stats.variance)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Minimum</TableCell>
              <TableCell align="right">{formatNumber(stats.min)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Maximum</TableCell>
              <TableCell align="right">{formatNumber(stats.max)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Skewness</TableCell>
              <TableCell align="right">{formatNumber(stats.skewness)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Kurtosis</TableCell>
              <TableCell align="right">{formatNumber(stats.kurtosis)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderTTestResults = () => {
    const tResult = result.statistics.tTestResult || result.statistics;
    if (!tResult) return null;

    const significance = getSignificanceLevel(tResult.pValue);

    return (
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Test Statistic</strong></TableCell>
                  <TableCell align="right"><strong>Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>t-statistic</TableCell>
                  <TableCell align="right">{formatNumber(tResult.statistic)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>p-value</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      {formatPValue(tResult.pValue)}
                      <Chip
                        label={significance === 'significant' ? 'Significant' : 'Not Significant'}
                        size="small"
                        color={significance === 'significant' ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Degrees of Freedom</TableCell>
                  <TableCell align="right">{tResult.degreesOfFreedom}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Effect Size (Cohen's d)</TableCell>
                  <TableCell align="right">{formatNumber(tResult.effectSize)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} md={6}>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Estimate</strong></TableCell>
                  <TableCell align="right"><strong>Value</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Mean Difference</TableCell>
                  <TableCell align="right">{formatNumber(tResult.meanDifference)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Standard Error</TableCell>
                  <TableCell align="right">{formatNumber(tResult.standardError)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>95% Confidence Interval</TableCell>
                  <TableCell align="right">
                    [{formatNumber(tResult.confidenceInterval[0])}, {formatNumber(tResult.confidenceInterval[1])}]
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>
    );
  };

  const renderCorrelationMatrix = () => {
    const corrMatrix = result.statistics.correlationMatrix;
    if (!corrMatrix) return null;

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Variable</strong></TableCell>
              {corrMatrix.variables.map((variable: string) => (
                <TableCell key={variable} align="center">
                  <strong>{variable}</strong>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {corrMatrix.variables.map((rowVar: string, rowIndex: number) => (
              <TableRow key={rowVar}>
                <TableCell><strong>{rowVar}</strong></TableCell>
                {corrMatrix.variables.map((colVar: string, colIndex: number) => {
                  const correlation = corrMatrix.matrix[rowIndex][colIndex];
                  const absCorr = Math.abs(correlation);
                  let color = 'default';
                  if (absCorr > 0.7) color = 'error';
                  else if (absCorr > 0.5) color = 'warning';
                  else if (absCorr > 0.3) color = 'info';
                  
                  return (
                    <TableCell key={colVar} align="center">
                      <Chip
                        label={formatNumber(correlation, 3)}
                        size="small"
                        color={color as any}
                        variant={rowIndex === colIndex ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderStatisticsSection = () => {
    switch (config.testType) {
      case 'descriptive':
        return renderDescriptiveStats();
      case 'one-sample-ttest':
      case 'independent-ttest':
      case 'paired-ttest':
        return renderTTestResults();
      case 'correlation':
        return renderCorrelationMatrix();
      default:
        return (
          <Alert severity="info">
            Detailed statistics display for {config.testName} is not yet implemented.
            <pre>{JSON.stringify(result.statistics, null, 2)}</pre>
          </Alert>
        );
    }
  };

  const renderAssumptions = () => {
    if (!result.assumptions || result.assumptions.length === 0) {
      return (
        <Alert severity="info">
          No assumption checks were performed for this test.
        </Alert>
      );
    }

    return (
      <List>
        {result.assumptions.map((assumption, index) => (
          <ListItem key={index}>
            <ListItemIcon>
              {getAssumptionIcon(assumption)}
            </ListItemIcon>
            <ListItemText
              primary={assumption.assumption}
              secondary={
                <Box>
                  {assumption.test && (
                    <Typography variant="caption" display="block">
                      Test: {assumption.test}
                      {assumption.statistic && ` (statistic: ${formatNumber(assumption.statistic)})`}
                      {assumption.pValue && ` (p-value: ${formatPValue(assumption.pValue)})`}
                    </Typography>
                  )}
                  {assumption.recommendation && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      Recommendation: {assumption.recommendation}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    );
  };

  const getInterpretationSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    if (result.assumptions && result.assumptions.some(a => !a.met)) {
      return 'warning';
    }
    return 'info';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">
          Analysis Results: {config.testName}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Download Results">
            <IconButton size="small">
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Share Results">
            <IconButton size="small">
              <Share />
            </IconButton>
          </Tooltip>
          <Tooltip title="Save to Bookmarks">
            <IconButton size="small">
              <Bookmark />
            </IconButton>
          </Tooltip>
          <Tooltip title="Help & Documentation">
            <IconButton size="small">
              <Help />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {result.summary}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`Dataset: ${dataset.name}`} variant="outlined" />
            <Chip label={`Test: ${config.testName}`} color="primary" variant="outlined" />
            <Chip label={`Analysis ID: ${result.analysisId}`} variant="outlined" size="small" />
          </Box>
        </CardContent>
      </Card>

      {/* Statistical Results */}
      <Accordion 
        expanded={expandedSections.statistics}
        onChange={() => handleSectionToggle('statistics')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Statistical Results</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderStatisticsSection()}
        </AccordionDetails>
      </Accordion>

      {/* Assumptions */}
      <Accordion 
        expanded={expandedSections.assumptions}
        onChange={() => handleSectionToggle('assumptions')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">
            Assumption Checks
            {result.assumptions && result.assumptions.some(a => !a.met) && (
              <Warning color="warning" sx={{ ml: 1, verticalAlign: 'middle' }} />
            )}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderAssumptions()}
        </AccordionDetails>
      </Accordion>

      {/* Interpretation */}
      <Accordion 
        expanded={expandedSections.interpretation}
        onChange={() => handleSectionToggle('interpretation')}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Interpretation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Alert severity={getInterpretationSeverity()} sx={{ mb: 2 }}>
            <Typography variant="body1">
              {result.interpretation}
            </Typography>
          </Alert>
          
          {result.recommendations && result.recommendations.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Recommendations:
              </Typography>
              <List dense>
                {result.recommendations.map((recommendation, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Info color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={recommendation} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Actions */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Next Steps
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            What would you like to do with these results?
          </Typography>
        </CardContent>
        <CardActions>
          <Button variant="outlined" startIcon={<Download />}>
            Export Report
          </Button>
          <Button variant="outlined" startIcon={<Share />}>
            Share Results
          </Button>
          <Button variant="contained">
            Create Visualization
          </Button>
        </CardActions>
      </Card>
    </Box>
  );
};

export default ResultsDisplay;